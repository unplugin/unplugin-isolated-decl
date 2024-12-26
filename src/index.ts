/**
 * This entry file is for main unplugin.
 * @module
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createFilter } from '@rollup/pluginutils'
import MagicString from 'magic-string'
import { parseAsync } from 'oxc-parser'
import {
  createUnplugin,
  type UnpluginBuildContext,
  type UnpluginContext,
  type UnpluginInstance,
} from 'unplugin'
import { filterImports, rewriteImports, type OxcImport } from './core/ast'
import { resolveOptions, type Options } from './core/options'
import {
  appendMapUrl,
  generateDtsMap,
  oxcTransform,
  swcTransform,
  tsTransform,
  type TransformResult,
} from './core/transformer'
import {
  debug,
  lowestCommonAncestor,
  resolveEntry,
  shouldAddIndex,
  stripExt,
} from './core/utils'
import type {
  JsPlugin,
  NormalizedConfig,
  ResolvedCompilation,
} from '@farmfe/core'
import type { PluginBuild } from 'esbuild'
import type {
  NormalizedInputOptions,
  NormalizedOutputOptions,
  Plugin,
  PluginContext,
} from 'rollup'

export type { Options }

interface Output {
  s: MagicString
  imports: OxcImport[]
  map?: string
  ext: string
}

/**
 * The main unplugin instance.
 */
export const IsolatedDecl: UnpluginInstance<Options | undefined, false> =
  createUnplugin((rawOptions = {}) => {
    const options = resolveOptions(rawOptions)
    const filter = createFilter(options.include, options.exclude)

    let farmPluginContext: UnpluginBuildContext

    let outputFiles: Record<string, Output> = Object.create(null)
    function addOutput(filename: string, output: Omit<Output, 'ext'>) {
      const name = stripExt(filename)
      const ext = path.extname(filename)
      debug('Add output:', name)
      outputFiles[name] = { ...output, ext }
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
        outputFiles = Object.create(null)
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
      const label = debug.enabled && `[${options.transformer}]`
      debug(label, 'transform', id)

      let result: TransformResult
      switch (options.transformer) {
        case 'oxc':
          result = await oxcTransform(id, code, options.sourceMap)
          break
        case 'swc':
          result = await swcTransform(id, code)
          break
        case 'typescript':
          result = await tsTransform(
            id,
            code,
            (options as any).transformOptions,
            options.sourceMap,
          )
          break
      }
      const { code: dts, errors, map } = result
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

      const { program } = await parseAsync(id, dts)
      const imports = filterImports(program)

      const s = new MagicString(dts)

      for (const i of imports) {
        const { source } = i
        let { value } = source

        if (options.rewriteImports) {
          const result = options.rewriteImports(value, id)
          if (typeof result === 'string') {
            source.value = value = result
            s.overwrite(source.start + 1, source.end - 1, result)
          }
        }

        if (path.isAbsolute(value) || value[0] === '.') {
          const resolved = await resolve(context, value, stripExt(id))
          if (!resolved || resolved.external) continue
          i.shouldAddIndex = shouldAddIndex(value, resolved.id)
        }
      }

      addOutput(id, { s, imports, map })

      const typeImports = program.body.filter((node): node is OxcImport => {
        if (!('source' in node) || !node.source) return false
        if ('importKind' in node && node.importKind === 'type') return true
        if ('exportKind' in node && node.exportKind === 'type') return true

        if (node.type === 'ImportDeclaration') {
          return (
            !!node.specifiers &&
            node.specifiers.every(
              (spec) =>
                spec.type === 'ImportSpecifier' && spec.importKind === 'type',
            )
          )
        }
        return (
          node.type === 'ExportNamedDeclaration' &&
          node.specifiers &&
          node.specifiers.every((spec) => spec.exportKind === 'type')
        )
      })
      for (const { source } of typeImports) {
        const resolved = (await resolve(context, source.value, id))?.id
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
      const { inputBase, entryMap } = resolveEntry(input, options.inputBase)
      debug('[rollup] input base:', inputBase)

      const { entryFileNames = '[name].js', dir: outDir } = outputOptions
      if (typeof entryFileNames !== 'string') {
        return this.error('entryFileNames must be a string')
      }

      for (const [srcFilename, { s, imports, map, ext }] of Object.entries(
        outputFiles,
      )) {
        let emitName = rewriteImports(
          s,
          imports,
          entryMap,
          inputBase,
          entryFileNames,
          srcFilename,
        )

        let source = s.toString()
        if (options.patchCjsDefaultExport && emitName.endsWith('.d.cts')) {
          source = patchCjsDefaultExport(source)
        }

        if (options.extraOutdir) {
          emitName = path.join(options.extraOutdir || '', emitName)
        }

        debug('[rollup] emit dts file:', emitName)
        const originalFileName = srcFilename + ext

        if (options.sourceMap && map && outDir) {
          source = appendMapUrl(source, emitName)
          this.emitFile({
            type: 'asset',
            fileName: `${emitName}.map`,
            source: generateDtsMap(
              map,
              originalFileName,
              path.join(outDir, emitName),
            ),
            originalFileName,
          })
        }
        this.emitFile({
          type: 'asset',
          fileName: emitName,
          source,
          originalFileName,
        })
      }
    }

    function farmRenderStart(
      config: NormalizedConfig['compilationConfig']['config'],
    ) {
      const { input = {}, output = {} } = config as ResolvedCompilation
      const { inputBase, entryMap } = resolveEntry(
        input as Record<string, string>,
        options.inputBase,
      )
      debug('[farm] input base:', inputBase)

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

      const entryFileNames = output.entryFilename
      for (const [srcFilename, { s, imports, map, ext }] of Object.entries(
        outputFiles,
      )) {
        let emitName = rewriteImports(
          s,
          imports,
          entryMap,
          inputBase,
          entryFileNames,
          srcFilename,
        )

        let source = s.toString()
        if (options.patchCjsDefaultExport && emitName.endsWith('.d.cts')) {
          source = patchCjsDefaultExport(source)
        }

        if (options.extraOutdir) {
          emitName = path.join(options.extraOutdir || '', emitName)
        }

        debug('[farm] emit dts file:', emitName)
        const outDir = output.path
        if (options.sourceMap && map && outDir) {
          source = appendMapUrl(source, emitName)
          farmPluginContext.emitFile({
            type: 'asset',
            fileName: `${emitName}.map`,
            source: generateDtsMap(
              map,
              srcFilename + ext,
              path.join(outDir, emitName),
            ),
          })
        }
        farmPluginContext.emitFile({
          type: 'asset',
          fileName: emitName,
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

        const inputBase = options.inputBase || lowestCommonAncestor(...entries)
        debug('[esbuild] input base:', inputBase)

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
        for (const [srcFilename, { s, map, ext }] of Object.entries(
          outputFiles,
        )) {
          const outDir = build.initialOptions.outdir
          let outName = `${path.relative(inputBase, srcFilename)}.d.${outExt}`
          if (options.extraOutdir) {
            outName = path.join(options.extraOutdir, outName)
          }
          const outPath = outDir ? path.resolve(outDir, outName) : outName

          // TODO rewrite imports

          let source = s.toString()
          if (options.patchCjsDefaultExport && outPath.endsWith('.d.cts')) {
            source = patchCjsDefaultExport(source)
          }

          if (write) {
            await mkdir(path.dirname(outPath), { recursive: true })

            if (options.sourceMap && map) {
              source = appendMapUrl(source, outPath)
              await writeFile(
                `${outPath}.map`,
                generateDtsMap(map, srcFilename + ext, path.join(outPath)),
              )
            }

            await writeFile(outPath, source)
            debug('[esbuild] write dts file:', outPath)
          } else {
            debug('[esbuild] emit dts file:', outPath)
            result.outputFiles!.push({
              path: outPath,
              contents: textEncoder.encode(source),
              hash: '',
              text: source,
            })
          }
        }
      })
    }
  })

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
