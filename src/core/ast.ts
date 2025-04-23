import path from 'node:path'
import { debug, stripExt } from './utils'
import type * as OxcTypes from '@oxc-project/types'
import type MagicString from 'magic-string'

export type OxcImport = (
  | OxcTypes.ImportDeclaration
  | OxcTypes.ExportAllDeclaration
  | OxcTypes.ExportNamedDeclaration
) & {
  source: OxcTypes.StringLiteral
  shouldAddIndex?: boolean
}

export function filterImports(program: OxcTypes.Program): OxcImport[] {
  return program.body.filter(
    (node): node is OxcImport => !!('source' in node && node.source),
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
    let srcIdRel = source.value
    if (srcIdRel[0] !== '.') continue

    if (i.shouldAddIndex) srcIdRel += '/index'

    const srcId = path.resolve(srcDir, srcIdRel)
    const importAlias = entryMap?.[stripExt(srcId)]

    let id: string
    if (importAlias) {
      const resolved = entryFileNames.replaceAll(
        '[name]',
        stripExt(importAlias),
      )
      id = pathRelative(srcDirRel, resolved)
    } else {
      id = entryFileNames.replaceAll('[name]', stripExt(srcIdRel))
    }

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
