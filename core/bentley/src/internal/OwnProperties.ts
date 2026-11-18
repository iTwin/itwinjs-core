/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

// Names that come from data, such as schema item, property or column names, can match members of Object.prototype,
// such as `__proto__` or `constructor`. A plain `target[name] = value` with `__proto__` replaces the target's prototype,
// and a plain read returns inherited members. Objects keyed by such names go through these helpers.

/** Adds or replaces `name` as an own enumerable property of `target`.
 * @internal
 */
export function setOwnProperty<T>(target: { [name: string]: T }, name: string, value: T): void {
  // A plain assignment only reliably creates an own data property when the name does not exist yet. Inherited names
  // can be accessors such as __proto__, or read-only. Defining is slower, so it is reserved for names that exist.
  if (name in target)
    Object.defineProperty(target, name, { value, writable: true, enumerable: true, configurable: true });
  else
    target[name] = value;
}

/** The own property `name` of `source`, or `undefined` when `source` has no such own property.
 * @internal
 */
export function getOwnProperty<T>(source: Readonly<{ [name: string]: T }>, name: string): T | undefined {
  return Object.hasOwn(source, name) ? source[name] : undefined;
}
