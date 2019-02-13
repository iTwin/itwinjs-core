/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

/** Checks if the specified argument is a promise */
export function isPromiseLike(obj: unknown): obj is PromiseLike<unknown> {
  return !!(obj && (typeof obj === "object") && (typeof (obj as any).then === "function"));
}
