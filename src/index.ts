import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createFilter } from '@rollup/pluginutils'
import { parseAsync } from 'oxc-parser'
import {
  createUnplugin,
  type UnpluginBuildContext,
  type UnpluginContext,
  type UnpluginInstance,
} from 'unplugin'
import { resolveOptions, type Options } from './core/options'
import {
  oxcTransform,
  swcTransform,
  tsTransform,
  type TransformResult,
} from './core/transformer'
import type { Plugin, PluginContext } from 'rollup'

export type { Options }

export const IsolatedDecl: UnpluginInstance<Options | undefined, false> =
  createUnplugin((rawOptions = {}) => {
    const options = resolveOptions(rawOptions)
    const filter = createFilter(options.include, options.exclude)

    const outputFiles: Record<string, string> = {}

    function addOutput(filename: string, source: string) {
      outputFiles[stripExt(filename)] = source
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

      transform(code, id): Promise<undefined> {
        return transform.call(this, code, id)
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

            const write = build.initialOptions.write ?? true
            if (write) {
              if (!build.initialOptions.outdir)
                throw new Error('outdir is required when write is true')
            } else {
              result.outputFiles ||= []
            }

            const textEncoder = new TextEncoder()
            for (const [filename, source] of Object.entries(outputFiles)) {
              const outDir = build.initialOptions.outdir
              const outFile = `${path.relative(outBase, filename)}.d.${outExt}`
              const filePath = outDir ? path.resolve(outDir, outFile) : outFile
              if (write) {
                await mkdir(path.dirname(filePath), { recursive: true })
                await writeFile(filePath, source)
              } else {
                result.outputFiles!.push({
                  path: filePath,
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

    async function transform(
      this: UnpluginBuildContext & UnpluginContext,
      code: string,
      id: string,
    ): Promise<undefined> {
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
      const { code: sourceText, errors } = result
      if (errors.length) {
        if (options.ignoreErrors) {
          this.warn(errors[0])
        } else {
          this.error(errors[0])
          return
        }
      }
      addOutput(id, sourceText)

      let program: any
      try {
        program = JSON.parse(
          (await parseAsync(code, { sourceFilename: id })).program,
        )
      } catch {
        return
      }
      const typeImports = program.body.filter((node: any) => {
        if (node.type !== 'ImportDeclaration') return false
        if (node.importKind === 'type') return true
        return (node.specifiers || []).every(
          (spec: any) =>
            spec.type === 'ImportSpecifier' && spec.importKind === 'type',
        )
      })

      const resolve = async (id: string, importer: string) => {
        const context = this.getNativeBuildContext?.()
        if (context?.framework === 'esbuild') {
          return (
            await context.build.resolve(id, {
              importer,
              resolveDir: path.dirname(importer),
              kind: 'import-statement',
            })
          ).path
        }
        return (await (this as any as PluginContext).resolve(id, importer))?.id
      }
      for (const i of typeImports) {
        const resolved = await resolve(i.source.value, id)
        if (resolved && filter(resolved) && !outputFiles[stripExt(resolved)]) {
          let source: string
          try {
            source = await readFile(resolved, 'utf8')
          } catch {
            continue
          }
          await transform.call(this, source, resolved)
        }
      }
    }
  })

function stripExt(filename: string) {
  return filename.replace(/\.(.?)[jt]s$/, '')
}

export function lowestCommonAncestor(...filepaths: string[]): string {
  if (filepaths.length === 0) return ''
  if (filepaths.length === 1) return path.dirname(filepaths[0])
  filepaths = filepaths.map((p) => p.replaceAll('\\', '/'))
  const [first, ...rest] = filepaths
  let ancestor = first.split('/')
  for (const filepath of rest) {
    const directories = filepath.split('/', ancestor.length)
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
    ? `/${ancestor[0]}`
    : ancestor.join('/')
}
