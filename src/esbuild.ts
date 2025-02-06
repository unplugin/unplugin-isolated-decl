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
const esbuild = IsolatedDecl.esbuild as typeof IsolatedDecl.esbuild
export default esbuild
export { esbuild as 'module.exports' }
