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

/** Make a new type from an existing type `T`, with set of required properties `K` optional.
 * @public
 */
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

/** Make a new type from an existing type `T`, with set of optional properties `K` required.
 * @public
 */
export type MarkRequired<T, K extends keyof T> = Pick<Required<T>, K> & Omit<T, K>;

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

/** Extracts the names of all public properties of `T` that are not of type `function`.
 * This includes properties defined using `get` syntax. Care should be used when using this type in conjunction with
 * the object spread (`...`) operator, because the spread operator omits properties defined using `get` syntax and, therefore,
 * so too does the type that TypeScript infers from that operator.
 * `get` syntax. For example:
 * ```ts
 *  class Thing {
 *     private _a = "a"; // a private variable
 *     public b = "b"; // a public variable
 *     public get c() { return "c"; } // a public property
 *     public d() { return "d"; } // a public method
 *     public e = () => "e"; // a public variable of type `function`
 *  }
 *
 *  // The following can have the values "b" or "c" - those are the public, non-function properties of Thing.
 *  let nonFunctionProperty: NonFunctionPropertyNamesOf<Thing> = "c";
 *
 *  // The following produces an error: "Property 'c' is missing in type '{ b: string; e: () => string; }' but required in type 'NonFunctionPropertiesOf<Thing>'"
 *  const thing1 = new Thing();
 *  const thing2: NonFunctionPropertiesOf<Thing> = { ...thing1 };
 * ```
 * @see [[NonFunctionPropertiesOf]] to obtain a type that includes only these properties.
 * @public
 */
export type NonFunctionPropertyNamesOf<T> = {
  [K in keyof T]: T[K] extends (...args: any) => any ? never : K;
}[keyof T];

/** Produces a type consisting of all of the public properties of `T` except for those of type `function`.
 * @see [[NonFunctionPropertyNamesOf]] for potential pitfalls when used in conjunction with the object spread operator.
 * @public
 */
export type NonFunctionPropertiesOf<T> = Pick<T, NonFunctionPropertyNamesOf<T>>;

/** Any function returning a Promise.
 * @see [[AsyncMethodsOf]] to extract all async methods from a type.
 * @see [[PromiseReturnType]] to extract the type to which the Promise resolves.
 * @public
 */
export type AsyncFunction = (...args: any[]) => Promise<unknown>;

/** The members of `T` that are async functions (functions that return a promise), and no other properties
 * @public
 */
export type PickAsyncMethods<T> = { [P in keyof T]: T[P] extends AsyncFunction ? T[P] : never; };

/** Extracts the names of all function properties of `T` that return a Promise.
 * @public
 */
export type AsyncMethodsOf<T> = { [P in keyof T]: T[P] extends AsyncFunction ? P : never }[keyof T];

/** A type that is either `T` or `Promise<T>`.
 * @public
 */
export type MaybePromise<T> = T | Promise<T>;

/** Extracts the type to which the Promise returned by an async function resolves.
 * @public
 */
export type PromiseReturnType<T extends AsyncFunction> = T extends (...args: any) => Promise<infer R> ? R : any;

/** The members of `T` that are functions and no other properties
 * @public
 */
export type PickMethods<T> = { [P in keyof T]: T[P] extends (...args: any) => any ? T[P] : never; };

/** The members of `T` that are functions that do not return a Promise
 * @public
 */
export type PickSyncMethods<T> = Omit<PickMethods<T>, AsyncMethodsOf<T>>;

/** A runtime property omitter, makes a shallow copy of the given object without the specified properties
 * Compatible with the typescript `Omit` mapped type:
 * ```js
 * const testvar: Omit<{x: string, y: object}, "y"> = omit({x: "hello", y: {}}, ["y"]);
 * ```
 * @public
 */
export function omit<T extends object, K extends readonly (keyof T)[]>(t: T, keys: K): Omit<T, K[number]> {
  const clone = { ...t };
  for (const key of keys)
    delete clone[key];
  return clone;
}

/** Defines a type wherein at least one of the properties of T is required to exist.
 * In the following example, paying for a coffee requires a customer to have either a credit card, some cash, or both in their wallet.
 * ```ts
 *  interface Wallet {
 *    cash?: number;
 *    card?: CreditCard;
 *  }
 *
 *  function payForCoffee(wallet: RequireAtLeastOne<Wallet>) { ... }
 * ```
 * Source: [@azure/keyvault-certificates](https://learn.microsoft.com/en-us/javascript/api/@azure/keyvault-certificates/requireatleastone?view=azure-node-latest).
 * @public
 */
export type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>;
}[keyof T];
