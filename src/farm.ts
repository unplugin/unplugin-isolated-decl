/**
 * This entry file is for Farm plugin.
 *
 * @module
 */
/* eslint-disable import/no-default-export */

import { IsolatedDecl } from './index'

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
export default IsolatedDecl.farm as typeof IsolatedDecl.farm
