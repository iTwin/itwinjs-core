/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

export const _implementationProhibited = Symbol.for("Implementations of this interface can only be obtained from the containing package");

function sym(name: string): string {
  return `${name}_core-frontend_INTERNAL_ONLY_DO_NOT_USE`;
}

export const _accumulator = Symbol.for(sym("accumulator"));
/** @internal */
export const _callIpcChannel = Symbol.for(sym("callIpcChannel"));
export const _requestSnap = Symbol.for(sym("requestSnap"));
export const _textures = Symbol.for(sym("textures"));
