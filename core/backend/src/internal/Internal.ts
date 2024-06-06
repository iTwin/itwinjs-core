/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** This file defines `Symbol`s for "package-internal" APIs - that is, APIs that should never be used by any code outside of iTwin.js core.
 * Such APIs should be kept to a minimum, given that we are developing reusable libraries.
 * But some APIs serve as lower-level "glue" that may be too error-prone for external callers to use correctly (e.g., `IModelDb[_nativeDb]`),
 * inherently subject to instability (e.g., the RPC system), or too low-level to be of meaningful use on their own serving only to clutter the public API.
 *
 * Top-level APIs like classes, interfaces, enums, and functions that are not intended for use outside
 * of the monorepo should never be exported from the package's barrel file, thereby excluding them
 * from the package's public API.
 * But some top-level public APIs may contain interior package-internal APIs.
 * These should be minimized where possible, e.g., by moving a package-internal function out of a public namespace.
 * In some cases, like class properties, extracting the package-internal API from the public top-level API is not feasible.
 * Instead, you can define a `Symbol` in this file to serve as the name of the package-internal API.
 * These symbols are not exported from the package's barrel file, which prevents any code outside of the package from
 * accessing them without jumping through several hoops.
 *
 * The symbol names should begin with an underscore. It is fine to reuse the same symbol in different contexts - e.g.,
 * two `close` methods on two unrelated classes can use the same `_close` symbol.
 *
 * Example: in IModelDb.ts:
 * ```ts
 *  import { _isOpen, _nativeDb, _prepareSqliteStatement } from "./internal/Internal";
 *  export class IModelDb {
 *    // A package-internal property, initialized in the constructor, accessed as `this[_nativeDb]`.
 *    // @internal
 *    public readonly [_nativeDb]: IModelJsNative.DgnDb;
 *
 *    // A package-internal computed property, accessed as `this[_isOpen]`.
 *    // @internal
 *    public get [_isOpen](): boolean {
 *      return this[_nativeDb].isOpen();
 *    }
 *
 *    // A package-internal method, accessed a `this[_prepareSqliteStatement](sql, false)`.
 *    // @internal
 *    public [_prepareSqliteStatement](sql: string, logErrors = true): SqliteStatement {
 *      const stmt = new SqliteStatement(sql);
 *      stmt.prepare(this[_nativeDb], logErrors);
 *      return stmt;
 *    }
 *  }
 * ```
 *
 * The declarations of package-internal APIs should be annotated with the `@internal` release tag.
 * Every API annotated as `@internal` must be accessed via a symbol.
 *
 * Because many packages outside of the itwinjs-core repository do use `@internal` APIs, it is okay during the transition
 * to this new policy to temporarily preserve the existing API, delegating to the new `Symbol`-accessed package-internal API.
 * where removing the existing API would present an undue burden for those packages to update their code in the short term.
 * Those existing APIs should be annotated as `deprecated` and removed as soon as possible. (Note, because they are `@internal`, they
 * are not subject to our API deprecation policies).
 *
 * NOTE: Currently, it is possible for people to misconfigure their dependencies such that they end up with multiple versions of this package, which would
 * cause multiple independent sets of the symbols below to exist.
 * To avoid breaking them, for now we use `Symbol.for("name")` instead of `Symbol()` to add the symbols to the global registry.
 * This does permit sneaky people to call internal APIs by looking up the corresponding symbol via `Symbol.for`.
 * In iTwin.js 5.0, we will prohibit people from ending up in the multiple-versions-of-core-dependencies situation, and switch to
 * using `unique symbol`s instead.
 */

export const _isOpen = Symbol.for("_isOpen");
export const _nativeDb = Symbol.for("_nativeDb");
export const _prepareSqliteStatement = Symbol.for("_prepareSqliteStatement");

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
 *    [_implementation_prohibited]: unknown;
 *  }
 *
 *  // Not exported
 *  class ThingImpl implements Thing {
 *    constructor(public name: string) { }
 *    public readonly [_implementation_prohibited] = undefined;
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
 * ...they will receive a compiler error. Because they cannot access the `_implementation_prohibited` symbol,
 * they will not be able to appease the compiler except by casting to `any`.
 *
 * Of course, you must make sure not to export the symbol from the package - that would defeat the whole purpose.
 * It is exported here from the internal API for consumption inside the package only. It is not exported from the package's barrel file.
 *
 * The vast majority of interfaces do not need this.
 */
export const _implementationProhibited = Symbol.for("_implementationProhibited");
