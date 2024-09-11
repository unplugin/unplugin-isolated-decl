import type { TranspileOptions } from 'typescript'

export interface TransformResult {
  code: string
  errors: Array<string>
}

export async function oxcTransform(
  id: string,
  code: string,
): Promise<TransformResult> {
  const { isolatedDeclaration } = await import('oxc-transform')
  return isolatedDeclaration(id, code, { sourcemap: false })
}

export async function swcTransform(
  id: string,
  code: string,
): Promise<TransformResult> {
  let swc: typeof import('@swc/core')
  try {
    swc = await import('@swc/core')
  } catch {
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

export async function tsTransform(
  id: string,
  code: string,
  transformOptions?: TranspileOptions,
): Promise<TransformResult> {
  let ts: typeof import('typescript')

  try {
    ts = await import('typescript')
  } catch {
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
