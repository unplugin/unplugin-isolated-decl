/**
 * This entry file is for Rollup plugin.
 *
 * @module
 */

import { IsolatedDecl } from './index'

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
export default IsolatedDecl.rollup as typeof IsolatedDecl.rollup
