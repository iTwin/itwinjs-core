/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

/** The inverse of TypeScript's Readonly<T> type, producing a type that has all the properties of `T` with any `readonly` modifiers removed.
 * @public
 */
export type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

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

/** Extracts the names of all properties of `T` that are not of type `function`.
 * @see [[NonFunctionPropertiesOf]] to obtain a type that includes only these properties.
 * @public
 */
export type NonFunctionPropertyNamesOf<T> = {
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

/** Produces a type consisting of all of the properties of `T` except for those of type `function`.
 * @public
 */
export type NonFunctionPropertiesOf<T> = Pick<T, NonFunctionPropertyNamesOf<T>>;
