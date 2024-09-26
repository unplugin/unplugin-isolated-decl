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
import { resolveOptions, type Options } from './core/options'
import {
  oxcTransform,
  swcTransform,
  tsTransform,
  type TransformResult,
} from './core/transformer'
import type { TSESTree } from '@typescript-eslint/typescript-estree'
import type { PluginBuild } from 'esbuild'
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
        } else if (typeof input === 'object') {
          outBase = lowestCommonAncestor(...Object.values(input))
        }

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
          const fileName = entryFileNames.replace(
            '[name]',
            path.relative(outBase, outname),
          )
          if (options.patchCjsDefaultExport && fileName.endsWith('.d.cts')) {
            source = patchCjsDefaultExport(source)
          }
          this.emitFile({
            type: 'asset',
            fileName,
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
        return transform(this, code, id)
      },

      esbuild: {
        setup: esbuildSetup,
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
      context: UnpluginBuildContext & UnpluginContext,
      code: string,
      id: string,
    ): Promise<undefined> {
      let program: TSESTree.Program | undefined
      try {
        program = JSON.parse(
          (await parseAsync(code, { sourceFilename: id })).program,
        )
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
              // @ts-expect-error
              i.source.start,
              // @ts-expect-error
              i.source.end,
              JSON.stringify(`${i.source.value}.js`),
            )
          }
        }
        code = s.toString()
      }

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
      if (errors.length) {
        if (options.ignoreErrors) {
          context.warn(errors[0])
        } else {
          context.error(errors[0])
          return
        }
      }
      addOutput(id, sourceText)

      if (!program) return
      const typeImports = program.body.filter(
        (
          node,
        ): node is
          | TSESTree.ImportDeclaration
          | TSESTree.ExportNamedDeclaration
          | TSESTree.ExportAllDeclaration => {
          if (node.type === 'ImportDeclaration') {
            if (node.importKind === 'type') return true
            return (
              node.specifiers &&
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
          await transform(context, source, resolved)
        }
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
    }
  })

async function resolve(
  context: UnpluginBuildContext,
  id: string,
  importer: string,
): Promise<{ id: string; external: boolean } | undefined> {
  const nativeContext = context.getNativeBuildContext?.()
  if (nativeContext?.framework === 'esbuild') {
    const resolved = await nativeContext.build.resolve(id, {
      importer,
      resolveDir: path.dirname(importer),
      kind: 'import-statement',
    })
    return { id: resolved.path, external: resolved.external }
  }
  const resolved = await (context as PluginContext).resolve(id, importer)
  if (!resolved) return
  return { id: resolved.id, external: !!resolved.external }
}

function stripExt(filename: string) {
  return filename.replace(/\.(.?)[jt]sx?$/, '')
}

function patchCjsDefaultExport(source: string) {
  return source.replace(
    /(?<=(?:[;}]|^)\s*export\s*)(?:\{\s*([\w$]+)\s*as\s+default\s*\}|default\s+([\w$]+))/,
    (_, s1, s2) => `= ${s1 || s2}`,
  )
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
