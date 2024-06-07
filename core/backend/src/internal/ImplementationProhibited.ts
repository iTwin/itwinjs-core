/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** A symbol used to prevent implementations of an interface from being created outside of the package that defines the interface.
 * This is useful when a package defines a public interface with one or more private implementations.
 * The only way for users of the package to obtain an implementation of the interface is by calling a method in the package's public API that returns one.
 * It permits the package to add new required properties and methods to the interface without breaking API compatibility, because no one
 * else can possibly have created their own implementations lacking those new properties or methods.
 *
 * Simple example:
 * ```ts
 *  // @public
 *  interface Thing {
 *    name: string;
 *    [implementationProhibited]: unknown;
 *  }
 *
 *  // Not exported
 *  class ThingImpl implements Thing {
 *    constructor(public name: string) { }
 *    public readonly [implementationProhibited] = undefined;
 *  }
 *
 *  // @public
 *  export function getThing(name: string): Thing { return new ThingImpl(name); }
 * ```
 *
 * This effectively turns the interface into a nominal type, bypassing TypeScript's structural typing.
 * If someone attempts to supply their own implementation of `Thing`:
 *
 * ```ts
 *  const thing: Thing = { name: "my thing" };
 * ```
 *
 * ...they will receive a compiler error. Because they cannot access the `implementationProhibited` symbol,
 * they will not be able to appease the compiler except by casting to `any`.
 *
 * Of course, you must make sure not to export the symbol from the package - that would defeat the whole purpose.
 * It is exported here from the internal API for consumption inside the package only. It is not exported from the package's barrel file.
 *
 * The vast majority of interfaces do not need this.
 */
export const implementationProhibited = Symbol("implementation prohibited");
