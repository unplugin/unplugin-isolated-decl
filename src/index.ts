import path from 'node:path'
import {
  type UnpluginBuildContext,
  type UnpluginInstance,
  createUnplugin,
} from 'unplugin'
import { isolatedDeclaration } from 'oxc-transform'
import { createFilter } from '@rollup/pluginutils'
import { type Options, resolveOptions } from './core/options'
import type { Plugin } from 'rollup'

declare module 'unplugin' {
  interface UnpluginBuildContext {
    id: number
  }
}

export const plugin: UnpluginInstance<Options | undefined, false> =
  createUnplugin((rawOptions = {}, { framework }) => {
    const options = resolveOptions(rawOptions)
    const filter = createFilter(options.include, options.exclude)

    interface Context {
      outBase: string
      outExt: string
    }
    const contexts: Context[] = []
    let id = 0
    const emitFiles: Record<string, string> = {}

    function emit(
      ctx: UnpluginBuildContext,
      filename: string,
      source: string,
      outExt: string,
    ) {
      if (framework === 'esbuild') {
        ctx.emitFile({
          type: 'asset',
          fileName: filename.replace(/\.(.?)ts$/, `.d.${outExt}`),
          source,
        })
      } else {
        emitFiles[filename.replace(/\.(.?)[jt]s$/, '')] = source
      }
    }

    const rollup: Partial<Plugin> = {
      options(rollupOptions) {
        let outBase = ''
        let input = rollupOptions.input
        input = typeof input === 'string' ? [input] : input
        if (Array.isArray(input)) {
          outBase = lowestCommonAncestor(...input)
        }

        if (!contexts.length) contexts.push({} as any)
        contexts[0] = {
          outExt: options.outExt,
          outBase,
        }
      },
      renderStart(outputOptions) {
        if (typeof outputOptions.entryFileNames !== 'string') {
          return this.error('entryFileNames must be a string')
        }

        const entryFileNames = outputOptions.entryFileNames.replace(
          /\.(.)?[jt]s$/,
          (_, s) => `.d.${s || ''}ts`,
        )

        for (const [filename, source] of Object.entries(emitFiles)) {
          this.emitFile({
            type: 'asset',
            fileName: entryFileNames.replace('[name]', filename),
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
        const context = contexts[this.id || 0]

        const { sourceText, errors } = isolatedDeclaration(id, code)
        if (errors.length) {
          this.error(errors[0])
          return
        }

        const outFile = path.relative(context.outBase, id)
        emit(this, outFile, sourceText, context.outExt)
      },

      esbuild: {
        config(this: UnpluginBuildContext, esbuildOptions) {
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

          this.id = id++
          contexts.push({
            outBase,
            outExt,
          })
        },
      },

      rollup,
      rolldown: rollup,
      vite: rollup,
    }
  })

export default plugin

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
