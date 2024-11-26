import { basename, dirname, join, normalize, relative, resolve } from 'pathe'
import { debug, guessExt, stripExt } from './utils'
import type * as OxcTypes from '@oxc-project/types'
import type MagicString from 'magic-string'

export type OxcImport = (
  | OxcTypes.ImportDeclaration
  | OxcTypes.ExportAllDeclaration
  | OxcTypes.ExportNamedDeclaration
) & {
  source: OxcTypes.StringLiteral
  ext?: string
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
  const srcRel = relative(inputBase, srcFilename)
  const srcDir = dirname(srcFilename)
  const srcDirRel = relative(inputBase, srcDir)

  let entryAlias = entryMap?.[srcFilename]
  if (entryAlias && normalize(entryAlias) === srcRel) entryAlias = undefined

  const entry = entryAlias || srcRel
  const resolvedEntry = entryFileNames.replaceAll('[name]', entry)

  const emitDir = dirname(resolvedEntry)
  const emitDtsName = resolvedEntry.replace(
    /\.(.)?[jt]sx?$/,
    (_, s) => `.d.${s || ''}ts`,
  )
  const offset = relative(emitDir, srcDirRel)

  for (const i of imports) {
    const { source } = i
    const srcIdRel = stripExt(source.value)
    if (srcIdRel[0] !== '.') continue

    const srcId = resolve(srcDir, srcIdRel)
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

    const ext = i.ext || guessExt(source.value)
    if (ext) id += `.${ext}`

    let final = normalize(join(offset, id))
    if (final !== normalize(source.value)) {
      debug('Patch import in', srcRel, ':', srcIdRel, '->', final)
      if (!/^\.\.?\//.test(final)) {
        final = `./${final}`
      }
      s.overwrite(i.source.start + 1, i.source.end - 1, final)
    }
  }

  return emitDtsName
}

function pathRelative(from: string, to: string) {
  return join(relative(from, dirname(to)), basename(to))
}
