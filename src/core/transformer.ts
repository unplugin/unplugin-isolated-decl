import type { TranspileOptions } from 'typescript'

export interface TransformResult {
  code: string
  errors: Array<string>
}

function tryImport<T>(pkg: string): Promise<T | null> {
  try {
    return import(pkg)
  } catch {
    return Promise.resolve(null)
  }
}

/**
 * Transform isolated declarations with `oxc-transform`.
 */
export async function oxcTransform(
  id: string,
  code: string,
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
  return oxc.isolatedDeclaration(id, code, { sourcemap: false })
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

  const { outputText, diagnostics } = ts.transpileDeclaration(code, {
    fileName: id,
    reportDiagnostics: true,
    ...transformOptions,
  })

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
  return {
    code: outputText,
    errors,
  }
}
