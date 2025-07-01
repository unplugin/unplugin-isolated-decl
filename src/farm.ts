/**
 * This entry file is for Farm plugin.
 *
 * @module
 */

import { IsolatedDecl } from './index.ts'

/**
 * Farm plugin
 *
 * @example
 * ```ts
 * // farm.config.js
 * import IsolatedDecl from 'unplugin-isolated-decl/farm'
 *
 * export default {
 *   plugins: [IsolatedDecl()],
 * }
 * ```
 */
const farm = IsolatedDecl.farm as typeof IsolatedDecl.farm
export default farm
export { farm as 'module.exports' }
