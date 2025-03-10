import type { IsolatedDeclarationsOptions } from 'oxc-transform'
import type { TranspileOptions } from 'typescript'
import type { FilterPattern } from 'unplugin-utils'

/**
 * Represents the options for the plugin.
 */
export type Options = {
  include?: FilterPattern
  exclude?: FilterPattern
  enforce?: 'pre' | 'post' | undefined
  /**
   * Whether to generate declaration source maps.
   *
   * Supported by `typescript` and `oxc` transformer only.
   *
   * @link https://www.typescriptlang.org/tsconfig/#declarationMap
   */
  sourceMap?: boolean
  ignoreErrors?: boolean
  /** An extra directory layer for output files. */
  extraOutdir?: string
  /** Patch `export default` in `.d.cts` to `export = ` */
  patchCjsDefaultExport?: boolean
  /** Base directory for input files. */
  inputBase?: string
  rewriteImports?: (
    id: string,
    importer: string,
  ) => string | void | null | undefined
} & (
  | {
      /**
       * @default 'oxc'
       */
      transformer?: 'oxc'
      transformOptions?: Omit<IsolatedDeclarationsOptions, 'sourceMap'>
    }
  | {
      /**
       * `@swc/core` should be installed yourself.
       */
      transformer?: 'swc'
    }
  | {
      /**
       * `typescript` should be installed yourself.
       */
      transformer?: 'typescript'
      /** Only for typescript transformer */
      transformOptions?: TranspileOptions
    }
)

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U

export type OptionsResolved = Overwrite<
  Required<Options> & { transformOptions?: any },
  Pick<Options, 'enforce' | 'extraOutdir' | 'rewriteImports' | 'inputBase'>
>

export function resolveOptions(options: Options): OptionsResolved {
  return {
    include: options.include || [/\.[cm]?tsx?$/],
    exclude: options.exclude || [/node_modules/],
    enforce: 'enforce' in options ? options.enforce : 'pre',
    sourceMap: options.sourceMap || false,
    transformer: options.transformer || 'oxc',
    ignoreErrors: options.ignoreErrors || false,
    extraOutdir: options.extraOutdir,
    patchCjsDefaultExport: options.patchCjsDefaultExport || false,
    rewriteImports: options.rewriteImports,
    inputBase: options.inputBase,
    transformOptions: (options as any).transformOptions,
  }
}
