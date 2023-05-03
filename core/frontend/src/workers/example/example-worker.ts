/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { formatAnimationBranchId } from "../../render/GraphicBranch";

onmessage = function(e) {
  if (e.data === "ERROR")
    throw new Error("worker received ERROR");

  postMessage(formatAnimationBranchId(e.data, 123456));
  // postMessage(e.data.toUpperCase());
}
