/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

/** Returns `true` if browser supports PointerEvents API.
 * @internal
 */
export function hasPointerEventsSupport() {
  return !!window.PointerEvent;
}
