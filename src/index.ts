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
  createUnplugin((rawOptions = {}) => {
    const options = resolveOptions(rawOptions)
    const filter = createFilter(options.include, options.exclude)

    interface Context {
      outBase: string
      outDir: string
      outExt: string
    }
    const contexts: Context[] = []
    let id = 0

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
          outDir: options.outDir,
          outBase,
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
          throw new AggregateError(
            errors,
            'TypeScript Isolated Declarations Error',
          )
        }
        if (!context.outDir) {
          throw new Error('outDir is not set')
        }

        const outFile = path
          .relative(context.outBase, id)
          .replace(/\.(.?)ts$/, `.d.${context.outExt}`)

        this.emitFile({
          type: 'asset',
          fileName: outFile,
          source: sourceText,
        })
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
          const outDir = esbuildOptions.outdir || options.outDir
          if (!outDir) {
            throw new Error('outDir is not set')
          }

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
            outDir,
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
