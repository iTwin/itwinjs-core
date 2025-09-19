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
export const _faceProps = Symbol.for(sym("faceProps"));
export const _getData = Symbol.for(sym("getData"));
export const _key = Symbol.for(sym("key"));
/** @internal */
export const _nativeDb = Symbol.for(sym("nativeDb"));
export const _releaseAllLocks = Symbol.for(sym("releaseAllLocks"));
export const _verifyChannel = Symbol.for(sym("verifyChannel"));
/** @internal */
export const _hubAccess = Symbol.for(sym("hubAccess"));
export const _setHubAccess = Symbol.for(sym("setHubAccess"));
export const _getHubAccess = Symbol.for(sym("getHubAccess"));
export const _mockCheckpoint = Symbol.for(sym("mockCheckpoint"));
export const _cache = Symbol.for(sym("cache"));
export const _instanceKeyCache = Symbol.for(sym("instanceKeyCache"));
export const _resetIModelDb = Symbol.for(sym("resetIModelDb"));
