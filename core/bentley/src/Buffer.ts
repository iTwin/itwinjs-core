/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

/**
 * Check if an object is a buffer. Should be used in lieu of the node's Buffer.isBuffer for code that also runs in the browser.
 * @param obj
 * @returns boolean
 * @public
 */
export function isBuffer(obj: any): boolean {
  return obj != null && obj.constructor != null &&
    typeof obj.constructor.isBuffer === "function" && obj.constructor.isBuffer(obj);
}
