import path from 'node:path'
import { debug } from './utils'
import type * as OxcTypes from '@oxc-project/types'
import type MagicString from 'magic-string'

export type OxcImport = (
  | OxcTypes.ImportDeclaration
  | OxcTypes.ExportAllDeclaration
  | OxcTypes.ExportNamedDeclaration
) & {
  source: OxcTypes.StringLiteral & { originalValue?: string }
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
  const entryAlias = entryMap?.[srcFilename]

  const srcRel = path.relative(inputBase, srcFilename)
  const srcDir = path.dirname(srcFilename)
  const srcDirRel = path.relative(inputBase, srcDir)

  const emitName = entryFileNames.replace('[name]', entryAlias || srcRel)
  const emitDir = path.dirname(emitName)

  // rewrite imports if current file is aliased-entry
  const isAliasedEntry = entryAlias && entryAlias !== srcRel
  isAliasedEntry && debug('Patch alias entry:', srcRel, '->', emitName)

  for (const i of imports) {
    const { source } = i
    if (source.value[0] !== '.') continue

    const resolved = path.resolve(srcDir, source.originalValue || source.value)
    const importAlias = entryMap?.[resolved]
    let final: string | undefined
    if (importAlias) {
      final = path.join(
        path.relative(emitDir, path.dirname(importAlias)),
        path.basename(importAlias),
      )
      if (i.suffix) final += i.suffix
      debug('Patch aliased import in', srcRel, ':', source.value, '->', final)
    } else if (isAliasedEntry) {
      const fileOffset = path.relative(emitDir, srcDirRel)
      final = path.join(fileOffset, i.source.value)
      debug(
        'Patch import for aliased entry',
        emitName,
        ':',
        i.source.value,
        '->',
        final,
      )
    }

    if (final) {
      final = final.replaceAll('\\', '/')
      if (!/^\.\.?\//.test(final)) {
        final = `./${final}`
      }
      s.overwrite(i.source.start + 1, i.source.end - 1, final)
    }
  }

  return emitName
}
