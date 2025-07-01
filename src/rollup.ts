/**
 * This entry file is for Rollup plugin.
 *
 * @module
 */

import { IsolatedDecl } from './index.ts'

/**
 * Rollup plugin
 *
 * @example
 * ```ts
 * // rollup.config.js
 * import IsolatedDecl from 'unplugin-isolated-decl/rollup'
 *
 * export default {
 *   plugins: [IsolatedDecl()],
 * }
 * ```
 */
const rollup = IsolatedDecl.rollup as typeof IsolatedDecl.rollup
export default rollup
export { rollup as 'module.exports' }
