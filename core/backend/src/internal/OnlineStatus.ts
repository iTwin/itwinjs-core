/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

let isOnline = true;

/**
 * Sets the online status of the backend that will be returned by `getOnlineStatus`.
 * @param online The new online status.
 * @internal
 */
export function setOnlineStatus(online: boolean) {
  isOnline = online;
}

/**
 * Determine whether the backend is currently considered online.
 * @note This only works if `setOnlineStatus` has been called by something to update the status.
 * `NativeHost` does this whenever the connectivity changes. If `setOnlineStatus` has never been
 * called, this will return `true`.
 * @internal
 */
export function getOnlineStatus(): boolean {
  return isOnline;
}
