/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** Checks if the specified argument is a promise
 * @internal
 */
export function isPromiseLike(obj: unknown): obj is PromiseLike<unknown> {
  return !!(obj && (typeof obj === "object") && (typeof (obj as any).then === "function"));
}
