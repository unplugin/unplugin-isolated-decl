/**
 * This entry file is for Vite plugin.
 *
 * @module
 */

import { IsolatedDecl } from './index'

/**
 * Vite plugin
 *
 * @example
 * ```ts
 * // vite.config.js
 * import IsolatedDecl from 'unplugin-isolated-decl/vite'
 *
 * export default {
 *   plugins: [IsolatedDecl()],
 * }
 * ```
 */
export default IsolatedDecl.vite as typeof IsolatedDecl.vite
