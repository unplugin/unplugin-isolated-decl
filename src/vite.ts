/**
 * This entry file is for Vite plugin.
 *
 * @module
 */

import { IsolatedDecl } from './index.ts'

/**
 * Vite plugin
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import IsolatedDecl from 'unplugin-isolated-decl/vite'
 *
 * export default defineConfig({
 *   plugins: [IsolatedDecl()],
 * })
 * ```
 */
const vite = IsolatedDecl.vite as typeof IsolatedDecl.vite
export default vite
export { vite as 'module.exports' }
