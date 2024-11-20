/**
 * This entry file is for esbuild plugin.
 *
 * @module
 */

import { IsolatedDecl } from './index'

/**
 * Esbuild plugin
 *
 * @example
 * ```ts
 * import { build } from 'esbuild'
 *
 * build({
 *   plugins: [require('unplugin-isolated-decl/esbuild')()],
 * })
 * ```
 */
export default IsolatedDecl.esbuild as typeof IsolatedDecl.esbuild
