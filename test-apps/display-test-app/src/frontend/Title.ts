/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export function setTitle(iModelName: string, writable: boolean) {
  const prefix = writable ? "[ R/W ] " : "";
  document.title = `${prefix}${iModelName} - Display Test App`;
}
