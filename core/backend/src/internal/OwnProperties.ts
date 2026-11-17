/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

/** Adds or replaces `name` as an own enumerable property of `target`. Use it when `name` comes from data, such as a
 * property or column name: those can match members of Object.prototype, and a plain assignment of `__proto__`
 * replaces the target's prototype instead of adding a property.
 * @internal
 */
export function setOwnProperty<T>(target: { [name: string]: T }, name: string, value: T): void {
  Object.defineProperty(target, name, { value, writable: true, enumerable: true, configurable: true });
}
