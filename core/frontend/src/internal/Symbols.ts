/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

function sym(name: string): string {
  return `${name}_core-frontend_INTERNAL_ONLY_DO_NOT_USE`;
}

/** @internal */
export const _callIpcChannel = Symbol.for(sym("callIpcChannel"));
export const _requestSnap = Symbol.for(sym("requestSnap"));
