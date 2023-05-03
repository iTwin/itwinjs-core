/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

onmessage = function(e) {
  if (e.data === "ERROR")
    throw new Error("worker received ERROR");

  postMessage(e.data.toUpperCase());
}
