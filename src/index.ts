import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { type UnpluginInstance, createUnplugin } from 'unplugin'
import { isolatedDeclaration } from 'oxc-transform'
import { createFilter } from '@rollup/pluginutils'
import { type Options, resolveOptions } from './core/options'
import type { Plugin } from 'rollup'

export type { Options }

export const IsolatedDecl: UnpluginInstance<Options | undefined, false> =
  createUnplugin((rawOptions = {}, meta) => {
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

      transform(code, id): undefined {
        const { sourceText, errors } = isolatedDeclaration(id, code)
        if (errors.length) {
          this.error(errors[0])
          return
        }
        addOutput(id, sourceText)
      },

      // esbuild only
      async buildEnd() {
        if (meta.framework === 'esbuild') {
          const esbuildOptions = meta.build!.initialOptions

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

          const build = meta.build!
          if (
            build.initialOptions.outdir &&
            (build.initialOptions.write ?? true)
          )
            for (const [filename, source] of Object.entries(outputFiles)) {
              const outFile = `${path.relative(outBase, filename)}.d.${outExt}`

              const filePath = path.resolve(
                build.initialOptions.outdir,
                outFile,
              )
              await mkdir(path.dirname(filePath), { recursive: true })
              await writeFile(filePath, source)
            }
        }
      },

      // esbuild,
      rollup,
      rolldown: rollup,
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
