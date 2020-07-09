/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

/** Generically represents a class `T`, for use in type annotations.
 * @note A variable of type `Constructor<T>` matches a class `T` only if `T` has a **public** constructor.
 * @see [[asInstanceOf]] to attempt to cast an arbitrary value to class `T`.
 * @see [[isInstanceOf]] to determine if an arbitrary value is an instance of class `T`.
 * @public
 */
export type Constructor<T> = new (...args: any[]) => T;

/** Returns true if `obj` is an object of class `T`.
 * @see [[asInstanceOf]] to cast `obj` to class `T`.
 * @public
 */
export function isInstanceOf<T>(obj: any, constructor: Constructor<T>): boolean {
  return "object" === typeof obj && obj instanceof constructor;
}

/** Cast `obj` to an instance of class `T`, or return undefined if `obj` is not an instance of class `T`.
 * @see [[isInstanceOf]] to query whether `obj` is of class `T`.
 * @public
 */
export function asInstanceOf<T>(obj: any, constructor: Constructor<T>): T | undefined {
  return isInstanceOf<T>(obj, constructor) ? obj as T : undefined;
}
