import path from 'node:path'
import type { CompilerOptions, TranspileOptions } from 'typescript'

export interface TransformResult {
  code: string
  errors: Array<string>
  map?: string
}

function tryImport<T>(pkg: string): Promise<T | null> {
  return import(pkg).catch(() => null)
}

/**
 * Transform isolated declarations with `oxc-transform`.
 */
export async function oxcTransform(
  id: string,
  code: string,
  sourceMap?: boolean,
): Promise<TransformResult> {
  const oxc = await tryImport<typeof import('oxc-transform')>('oxc-transform')
  if (!oxc) {
    return {
      code: '',
      errors: [
        'oxc-transform is required for transforming TypeScript, please install `oxc-transform`.',
      ],
    }
  }
  const result = oxc.isolatedDeclaration(id, code, { sourcemap: sourceMap })
  return {
    ...result,
    map: result.map?.mappings,
    errors: result.errors.map((error) => error.message),
  }
}

/**
 * Transform isolated declarations with `@swc/core`.
 */
export async function swcTransform(
  id: string,
  code: string,
): Promise<TransformResult> {
  const swc = await tryImport<typeof import('@swc/core')>('@swc/core')
  if (!swc) {
    return {
      code: '',
      errors: [
        'SWC is required for transforming TypeScript, please install `@swc/core`.',
      ],
    }
  }

  try {
    const result = await swc.transform(code, {
      filename: id,
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: false,
        },
        experimental: {
          emitIsolatedDts: true,
        },
      },
    })
    // @ts-expect-error
    const output = JSON.parse(result.output)
    return {
      code: output.__swc_isolated_declarations__,
      errors: [],
    }
  } catch (error: any) {
    return {
      code: '',
      errors: [error.toString()],
    }
  }
}

/**
 * Transform isolated declarations with `typescript`.
 */
export async function tsTransform(
  id: string,
  code: string,
  transformOptions?: TranspileOptions,
  sourceMap?: boolean,
): Promise<TransformResult> {
  const ts = await tryImport<typeof import('typescript')>('typescript')
  if (!ts) {
    return {
      code: '',
      errors: [
        'TypeScript is required for transforming TypeScript, please install `typescript`.',
      ],
    }
  }

  if (!ts.transpileDeclaration) {
    return {
      code: '',
      errors: [
        'TypeScript version is too low, please upgrade to TypeScript 5.5.2+.',
      ],
    }
  }

  const compilerOptions: CompilerOptions = {
    declarationMap: sourceMap,
    ...transformOptions?.compilerOptions,
  }
  let { outputText, diagnostics, sourceMapText } = ts.transpileDeclaration(
    code,
    {
      fileName: id,
      reportDiagnostics: true,
      ...transformOptions,
      compilerOptions,
    },
  )

  if (compilerOptions.declarationMap) {
    outputText = stripMapUrl(outputText)
  }

  const errors = diagnostics?.length
    ? [
        ts.formatDiagnostics(diagnostics, {
          getCanonicalFileName: (fileName) =>
            ts.sys.useCaseSensitiveFileNames
              ? fileName
              : fileName.toLowerCase(),
          getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
          getNewLine: () => ts.sys.newLine,
        }),
      ]
    : []

  if (sourceMapText) {
    sourceMapText = JSON.parse(sourceMapText).mappings
  }

  return {
    code: outputText,
    errors,
    map: sourceMapText,
  }
}

function stripMapUrl(code: string) {
  const lines = code.split('\n')
  const lastLine = lines.at(-1)
  if (lastLine?.startsWith('//# sourceMappingURL=')) {
    return lines.slice(0, -1).join('\n')
  }
  return code
}

export function appendMapUrl(map: string, filename: string) {
  return `${map}\n//# sourceMappingURL=${path.basename(filename)}.map`
}

export function generateDtsMap(
  mappings: string,
  src: string,
  dts: string,
): string {
  return JSON.stringify({
    version: 3,
    file: path.basename(dts),
    sourceRoot: '',
    sources: [path.relative(path.dirname(dts), src).replaceAll('\\', '/')],
    names: [],
    mappings,
  })
}
