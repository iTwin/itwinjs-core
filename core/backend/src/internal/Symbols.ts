/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

export const _implementationProhibited = Symbol.for("Implementations of this interface can only be obtained from the containing package");

function sym(name: string): string {
  return `${name}_core-backend_INTERNAL_ONLY_DO_NOT_USE`;
}

export const _close = Symbol.for(sym("close"));
export const _elementWasCreated = Symbol.for(sym("elementWasCreated"));
export const _nativeDb = Symbol.for(sym("nativeDb"));
export const _releaseAllLocks = Symbol.for(sym("releaseAllLocks"));
export const _verifyChannel = Symbol.for(sym("verifyChannel"));
