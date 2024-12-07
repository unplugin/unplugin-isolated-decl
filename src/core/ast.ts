import path from 'node:path'
import { debug, guessSuffix, stripExt } from './utils'
import type * as OxcTypes from '@oxc-project/types'
import type MagicString from 'magic-string'

export type OxcImport = (
  | OxcTypes.ImportDeclaration
  | OxcTypes.ExportAllDeclaration
  | OxcTypes.ExportNamedDeclaration
) & {
  source: OxcTypes.StringLiteral
  suffix?: string
}

export function filterImports(program: OxcTypes.Program): OxcImport[] {
  return program.body.filter(
    (node): node is OxcImport =>
      (node.type === 'ImportDeclaration' ||
        node.type === 'ExportAllDeclaration' ||
        node.type === 'ExportNamedDeclaration') &&
      !!node.source,
  )
}

export function rewriteImports(
  s: MagicString,
  imports: OxcImport[],
  entryMap: Record<string, string> | undefined,
  inputBase: string,
  entryFileNames: string,
  srcFilename: string,
): string {
  const srcRel = path.relative(inputBase, srcFilename)
  const srcDir = path.dirname(srcFilename)
  const srcDirRel = path.relative(inputBase, srcDir)

  let entryAlias = entryMap?.[srcFilename]
  if (entryAlias && path.normalize(entryAlias) === srcRel)
    entryAlias = undefined

  const entry = entryAlias || srcRel
  const resolvedEntry = entryFileNames.replaceAll('[name]', entry)

  const emitDir = path.dirname(resolvedEntry)
  const emitDtsName = resolvedEntry.replace(
    /\.(.)?[jt]sx?$/,
    (_, s) => `.d.${s || ''}ts`,
  )
  const offset = path.relative(emitDir, srcDirRel)

  for (const i of imports) {
    const { source } = i
    const srcIdRel = stripExt(source.value)
    if (srcIdRel[0] !== '.') continue

    const srcId = path.resolve(srcDir, srcIdRel)
    const importAlias = entryMap?.[srcId]

    let id: string
    if (importAlias) {
      const resolved = stripExt(
        entryFileNames.replaceAll('[name]', importAlias),
      )
      id = pathRelative(srcDirRel, resolved)
    } else {
      id = stripExt(entryFileNames.replaceAll('[name]', srcIdRel))
    }

    const suffix = i.suffix || guessSuffix(source.value, source.value)
    if (suffix) id += suffix

    let final = path.normalize(path.join(offset, id))
    if (final !== path.normalize(source.value)) {
      debug('Patch import in', srcRel, ':', srcIdRel, '->', final)

      final = final.replaceAll('\\', '/')
      if (final.startsWith('/')) final = `.${final}`
      if (!/^\.\.?\//.test(final)) final = `./${final}`

      s.overwrite(i.source.start + 1, i.source.end - 1, final)
    }
  }

  return emitDtsName
}

function pathRelative(from: string, to: string) {
  return path.join(path.relative(from, path.dirname(to)), path.basename(to))
}
