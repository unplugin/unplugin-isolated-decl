/**
 * This entry file is for Rolldown plugin.
 *
 * @module
 */

import { IsolatedDecl } from './index.ts'

/**
 * Rolldown plugin
 *
 * @example
 * ```ts
 * // rolldown.config.js
 * import IsolatedDecl from 'unplugin-isolated-decl/rolldown'
 *
 * export default {
 *   plugins: [IsolatedDecl()],
 * }
 * ```
 */
const rolldown = IsolatedDecl.rolldown as typeof IsolatedDecl.rolldown
export default rolldown
export { rolldown as 'module.exports' }
