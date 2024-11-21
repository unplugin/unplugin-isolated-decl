import path from 'node:path'
import MagicString from 'magic-string'
import { debug } from './utils'
import type * as OxcTypes from '@oxc-project/types'

export type OxcImport = (
  | OxcTypes.ImportDeclaration
  | OxcTypes.ExportAllDeclaration
  | OxcTypes.ExportNamedDeclaration
) & { source: OxcTypes.StringLiteral }

export function filterImports(program: OxcTypes.Program): OxcImport[] {
  return program.body.filter(
    (node): node is OxcImport =>
      (node.type === 'ImportDeclaration' ||
        node.type === 'ExportAllDeclaration' ||
        node.type === 'ExportNamedDeclaration') &&
      !!node.source,
  )
}

export function patchEntryAlias(
  source: string,
  s: MagicString | undefined,
  imports: OxcImport[],
  outname: string,
  offset: string,
): string {
  debug('Patching entry alias:', outname, 'offset:', offset)

  s ||= new MagicString(source)
  for (const i of imports) {
    if (i.source.value[0] === '.') {
      s.overwrite(
        i.source.start + 1,
        i.source.end - 1,
        `./${path.join(offset, i.source.value).replaceAll('\\', '/')}`,
      )
    }
  }

  if (s.hasChanged()) {
    debug('Patched entry alias:', outname)
    return s.toString()
  }
  return source
}
