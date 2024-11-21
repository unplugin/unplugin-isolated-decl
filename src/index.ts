/**
 * This entry file is for main unplugin.
 * @module
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createFilter } from '@rollup/pluginutils'
import Debug from 'debug'
import MagicString from 'magic-string'
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
import { lowestCommonAncestor, stripExt } from './core/utils'
import type {
  JsPlugin,
  NormalizedConfig,
  ResolvedCompilation,
} from '@farmfe/core'
import type * as OxcTypes from '@oxc-project/types'
import type { PluginBuild } from 'esbuild'
import type {
  NormalizedInputOptions,
  NormalizedOutputOptions,
  Plugin,
  PluginContext,
} from 'rollup'

const debug = Debug('unplugin-isolated-decl')

export type { Options }

export type * from './core/types'

/**
 * The main unplugin instance.
 */
export const IsolatedDecl: UnpluginInstance<Options | undefined, false> =
  createUnplugin((rawOptions = {}) => {
    const options = resolveOptions(rawOptions)
    const filter = createFilter(options.include, options.exclude)

    let farmPluginContext: UnpluginBuildContext
    const outputFiles: Record<string, string> = {}
    function addOutput(filename: string, source: string) {
      outputFiles[stripExt(filename)] = source
    }

    const rollup: Partial<Plugin> = {
      renderStart: rollupRenderStart,
    }
    const farm: Partial<JsPlugin> = {
      renderStart: { executor: farmRenderStart },
    }
    return {
      name: 'unplugin-isolated-decl',

      buildStart() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        farmPluginContext = this
      },

      transformInclude: (id) => filter(id),
      transform(code, id): Promise<undefined> {
        return transform(this, code, id)
      },

      esbuild: { setup: esbuildSetup },
      rollup,
      rolldown: rollup as any,
      vite: {
        apply: 'build',
        enforce: 'pre',
        ...rollup,
      },
      farm,
    }

    async function transform(
      context: UnpluginBuildContext & UnpluginContext,
      code: string,
      id: string,
    ): Promise<undefined> {
      let program: OxcTypes.Program | undefined
      try {
        program = (await parseAsync(code, { sourceFilename: id })).program
      } catch {}
      if (options.autoAddExts && program) {
        const imports = program.body.filter(
          (node) =>
            node.type === 'ImportDeclaration' ||
            node.type === 'ExportAllDeclaration' ||
            node.type === 'ExportNamedDeclaration',
        )
        const s = new MagicString(code)
        for (const i of imports) {
          if (!i.source || path.basename(i.source.value).includes('.')) {
            continue
          }

          const resolved = await resolve(context, i.source.value, id)
          if (!resolved || resolved.external) continue
          if (resolved.id.endsWith('.ts') || resolved.id.endsWith('.tsx')) {
            s.overwrite(
              i.source.start,
              i.source.end,
              JSON.stringify(`${i.source.value}.js`),
            )
          }
        }
        code = s.toString()
      }

      const label = debug.enabled && `[${options.transformer}]`
      debug(label, 'transform', id)

      let result: TransformResult
      switch (options.transformer) {
        case 'oxc':
          result = await oxcTransform(id, code)
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
      debug(
        label,
        'transformed',
        id,
        errors.length ? 'with errors' : 'successfully',
      )
      if (errors.length) {
        if (options.ignoreErrors) {
          context.warn(errors[0])
        } else {
          context.error(errors[0])
          return
        }
      }
      addOutput(id, sourceText)

      if (!program) {
        debug('cannot parse', id)
        return
      }
      const typeImports = program.body.filter(
        (
          node,
        ): node is
          | OxcTypes.ImportDeclaration
          | OxcTypes.ExportNamedDeclaration
          | OxcTypes.ExportAllDeclaration => {
          if (node.type === 'ImportDeclaration') {
            if (node.importKind === 'type') return true
            return (
              !!node.specifiers &&
              node.specifiers.every(
                (spec) =>
                  spec.type === 'ImportSpecifier' && spec.importKind === 'type',
              )
            )
          }
          if (
            node.type === 'ExportNamedDeclaration' ||
            node.type === 'ExportAllDeclaration'
          ) {
            if (node.exportKind === 'type') return true
            return (
              node.type === 'ExportNamedDeclaration' &&
              node.specifiers &&
              node.specifiers.every(
                (spec) =>
                  spec.type === 'ExportSpecifier' && spec.exportKind === 'type',
              )
            )
          }
          return false
        },
      )

      for (const i of typeImports) {
        if (!i.source) continue
        const resolved = (await resolve(context, i.source.value, id))?.id
        if (resolved && filter(resolved) && !outputFiles[stripExt(resolved)]) {
          let source: string
          try {
            source = await readFile(resolved, 'utf8')
          } catch {
            continue
          }
          debug('transform type import:', resolved)
          await transform(context, source, resolved)
        }
      }
    }

    function rollupRenderStart(
      this: PluginContext,
      outputOptions: NormalizedOutputOptions,
      inputOptions: NormalizedInputOptions,
    ) {
      const { input } = inputOptions
      const { outBase, map } = resolveEntry(input)
      debug('[rollup] out base:', outBase)

      if (typeof outputOptions.entryFileNames !== 'string') {
        return this.error('entryFileNames must be a string')
      }

      let entryFileNames = outputOptions.entryFileNames.replace(
        /\.(.)?[jt]sx?$/,
        (_, s) => `.d.${s || ''}ts`,
      )

      if (options.extraOutdir) {
        entryFileNames = path.join(options.extraOutdir, entryFileNames)
      }

      for (let [outname, source] of Object.entries(outputFiles)) {
        const name: string = map?.[outname] || path.relative(outBase, outname)
        const fileName = entryFileNames.replace('[name]', name)
        if (options.patchCjsDefaultExport && fileName.endsWith('.d.cts')) {
          source = patchCjsDefaultExport(source)
        }
        debug('[rollup] emit dts file:', fileName)
        this.emitFile({
          type: 'asset',
          fileName,
          source,
        })
      }
    }

    function farmRenderStart(
      config: NormalizedConfig['compilationConfig']['config'],
    ) {
      const { input = {}, output = {} } = config as ResolvedCompilation
      const { outBase, map } = resolveEntry(input as Record<string, string>)
      debug('[farm] out base:', outBase)

      if (output && typeof output.entryFilename !== 'string') {
        return console.error('entryFileName must be a string')
      }
      const extFormatMap = new Map([
        ['cjs', 'cjs'],
        ['esm', 'js'],
        ['mjs', 'js'],
      ])

      // TODO format normalizeName `entryFilename` `filenames`
      output.entryFilename = '[entryName].[ext]'

      output.entryFilename = output.entryFilename.replace(
        '[ext]',
        extFormatMap.get(output.format || 'esm') || 'js',
      )

      let entryFileNames = output.entryFilename.replace(
        /\.(.)?[jt]sx?$/,
        (_, s) => `.d.${s || ''}ts`,
      )

      if (options.extraOutdir) {
        entryFileNames = path.join(options.extraOutdir, entryFileNames)
      }

      for (let [outname, source] of Object.entries(outputFiles)) {
        const name: string = map?.[outname] || path.relative(outBase, outname)
        const fileName = entryFileNames.replace('[entryName]', name)

        if (options.patchCjsDefaultExport && fileName.endsWith('.d.cts')) {
          source = patchCjsDefaultExport(source)
        }
        debug('[farm] emit dts file:', fileName)
        farmPluginContext.emitFile({
          type: 'asset',
          fileName,
          source,
        })
      }
    }

    function esbuildSetup(build: PluginBuild) {
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
        debug('[esbuild] out base:', outBase)

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
        for (let [filename, source] of Object.entries(outputFiles)) {
          const outDir = build.initialOptions.outdir
          let outFile = `${path.relative(outBase, filename)}.d.${outExt}`
          if (options.extraOutdir) {
            outFile = path.join(options.extraOutdir, outFile)
          }
          const filePath = outDir ? path.resolve(outDir, outFile) : outFile
          if (options.patchCjsDefaultExport && filePath.endsWith('.d.cts')) {
            source = patchCjsDefaultExport(source)
          }
          if (write) {
            await mkdir(path.dirname(filePath), { recursive: true })
            await writeFile(filePath, source)
            debug('[esbuild] write dts file:', filePath)
          } else {
            debug('[esbuild] emit dts file:', filePath)
            result.outputFiles!.push({
              path: filePath,
              contents: textEncoder.encode(source),
              hash: '',
              text: source,
            })
          }
        }
      })
    }
  })

function resolveEntry(input: string[] | Record<string, string>): {
  map: Record<string, string> | undefined
  outBase: string
} {
  const map = !Array.isArray(input)
    ? Object.fromEntries(
        Object.entries(input).map(([k, v]) => [
          path.resolve(stripExt(v as string)),
          k,
        ]),
      )
    : undefined
  const arr = Array.isArray(input) && input ? input : Object.values(input)
  const outBase = lowestCommonAncestor(...arr)

  return { map, outBase }
}

async function resolve(
  context: UnpluginBuildContext,
  id: string,
  importer: string,
): Promise<{ id: string; external: boolean } | undefined> {
  const nativeContext = context.getNativeBuildContext?.()
  switch (nativeContext?.framework) {
    case 'esbuild': {
      const resolved = await nativeContext?.build.resolve(id, {
        importer,
        resolveDir: path.dirname(importer),
        kind: 'import-statement',
      })
      return {
        id: resolved?.path,
        external: resolved?.external,
      }
    }
    case 'farm': {
      const resolved = await nativeContext?.context.resolve(
        { source: id, importer, kind: 'import' },
        {
          meta: {},
          caller: 'unplugin-isolated-decl',
        },
      )
      return { id: resolved.resolvedPath, external: !!resolved.external }
    }
    default: {
      const resolved = await (context as PluginContext).resolve(id, importer)
      if (!resolved) return
      return { id: resolved.id, external: !!resolved.external }
    }
  }
}

function patchCjsDefaultExport(source: string) {
  return source.replace(
    /(?<=(?:[;}]|^)\s*export\s*)(?:\{\s*([\w$]+)\s*as\s+default\s*\}|default\s+([\w$]+))/,
    (_, s1, s2) => `= ${s1 || s2}`,
  )
}
