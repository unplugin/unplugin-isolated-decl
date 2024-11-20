/**
 * This entry file is for Rolldown plugin.
 *
 * @module
 */

import { IsolatedDecl } from './index'

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
export default IsolatedDecl.rolldown as typeof IsolatedDecl.rolldown
