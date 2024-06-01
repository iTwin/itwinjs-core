/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** This file defines `Symbol`s for "package-internal" APIs - that is, APIs that should never be used by any code outside of iTwin.js core.
 * Top-level APIs like classes, interfaces, enums, and functions that are not intended for use outside
 * of the monorepo should never be exported from the package's barrel file, thereby excluding them
 * from the package's public API.
 * But some top-level public APIs may contain interior APIs that should be used only within the monorepo.
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
 *  import { _isOpen, _nativeDb } from "./internal/Internal";
 *  class IModelDb {
 *    // A package-internal property, initialized in the constructor, accessed as `this[_nativeDb]`.
 *    // @internal
 *    public readonly [_nativeDb]: IModelJsNative.DgnDb;
 *
 *    // A package-internal method, accessed as `this[_isOpen]()`.
 *    // @internal
 *    public [_isOpen]: () => boolean {
 *      return this[_nativeDb].isOpen();
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
 * Those existing APIs should be annotated as `@deprecated` and removed as soon as possible. (Note, because they are `@internal`, they
 * are not subject to our API deprecation policies).
 */

export const _isOpen = Symbol("isOpen");
export const _nativeDb = Symbol("nativeDb");
