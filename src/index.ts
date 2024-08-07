import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createFilter } from '@rollup/pluginutils'
import { createUnplugin, type UnpluginInstance } from 'unplugin'
import { resolveOptions, type Options } from './core/options'
import {
  oxcTransform,
  swcTransform,
  tsTransform,
  type TransformResult,
} from './core/transformer'
import type { Plugin } from 'rollup'

export type { Options }

export const IsolatedDecl: UnpluginInstance<Options | undefined, false> =
  createUnplugin((rawOptions = {}) => {
    const options = resolveOptions(rawOptions)
    const filter = createFilter(options.include, options.exclude)

    const outputFiles: Record<string, string> = {}
    function addOutput(filename: string, source: string) {
      outputFiles[filename.replace(/\.(.?)[jt]s$/, '')] = source
    }

    const rollup: Partial<Plugin> = {
      renderStart(outputOptions, inputOptions) {
        let outBase = ''
        let input = inputOptions.input
        input = typeof input === 'string' ? [input] : input
        if (Array.isArray(input)) {
          outBase = lowestCommonAncestor(...input)
        }

        if (typeof outputOptions.entryFileNames !== 'string') {
          return this.error('entryFileNames must be a string')
        }

        const entryFileNames = outputOptions.entryFileNames.replace(
          /\.(.)?[jt]s$/,
          (_, s) => `.d.${s || ''}ts`,
        )

        for (const [filename, source] of Object.entries(outputFiles)) {
          this.emitFile({
            type: 'asset',
            fileName: entryFileNames.replace(
              '[name]',
              path.relative(outBase, filename),
            ),
            source,
          })
        }
      },
    }

    return {
      name: 'unplugin-isolated-decl',

      transformInclude(id) {
        return filter(id)
      },

      async transform(code, id): Promise<undefined> {
        let result: TransformResult
        switch (options.transformer) {
          case 'oxc':
            result = oxcTransform(id, code)
            break
          case 'swc':
            result = await swcTransform(id, code)
            break
          case 'typescript':
            result = await tsTransform(
              id,
              code,
              (options as any).transformOptions,
            )
        }
        const { sourceText, errors } = result
        if (errors.length) {
          if (options.ignoreErrors) {
            this.warn(errors[0])
          } else {
            this.error(errors[0])
            return
          }
        }
        addOutput(id, sourceText)
      },

      esbuild: {
        setup(build) {
          build.onEnd(async (result) => {
            const esbuildOptions = build.initialOptions

            const entries = esbuildOptions.entryPoints
            if (
              !(
                entries &&
                Array.isArray(entries) &&
                entries.every((entry) => typeof entry === 'string')
              )
            )
              throw new Error('unsupported entryPoints, must be an string[]')

            const outBase = lowestCommonAncestor(...entries)
            const jsExt = esbuildOptions.outExtension?.['.js']
            let outExt: string
            switch (jsExt) {
              case '.cjs':
                outExt = 'cts'
                break
              case '.mjs':
                outExt = 'mts'
                break
              default:
                outExt = 'ts'
                break
            }

            if (build.initialOptions.write ?? true) {
              if (!build.initialOptions.outdir)
                throw new Error('outdir is required when write is true')

              for (const [filename, source] of Object.entries(outputFiles)) {
                const outFile = `${path.relative(outBase, filename)}.d.${outExt}`

                const filePath = path.resolve(
                  build.initialOptions.outdir,
                  outFile,
                )
                await mkdir(path.dirname(filePath), { recursive: true })
                await writeFile(filePath, source)
              }
            } else {
              result.outputFiles ||= []
              const textEncoder = new TextEncoder()

              for (const [filename, source] of Object.entries(outputFiles)) {
                const outFile = `${path.relative(outBase, filename)}.d.${outExt}`
                result.outputFiles.push({
                  path: outFile,
                  contents: textEncoder.encode(source),
                  hash: '',
                  text: source,
                })
              }
            }
          })
        },
      },
      rollup,
      rolldown: rollup as any,
      vite: {
        apply: 'build',
        enforce: 'pre',
        ...rollup,
      },
    }
  })

function lowestCommonAncestor(...filepaths: string[]) {
  if (filepaths.length === 0) return ''
  if (filepaths.length === 1) return path.dirname(filepaths[0])
  const [first, ...rest] = filepaths
  let ancestor = first.split(path.sep)
  for (const filepath of rest) {
    const directories = filepath.split(path.sep, ancestor.length)
    let index = 0
    for (const directory of directories) {
      if (directory === ancestor[index]) {
        index += 1
      } else {
        ancestor = ancestor.slice(0, index)
        break
      }
    }
    ancestor = ancestor.slice(0, index)
  }

  return ancestor.length <= 1 && ancestor[0] === ''
    ? path.sep + ancestor[0]
    : ancestor.join(path.sep)
}
