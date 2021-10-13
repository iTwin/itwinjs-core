/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { OpenMode } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";

export function setTitle(imodel: IModelConnection) {
  let prefix = "";
  if (OpenMode.ReadWrite === imodel.openMode && imodel.isBriefcaseConnection())
    prefix = imodel.editingScope ? "[ EDIT ] " : "[ R/W ] ";

  document.title = `${prefix}${imodel.key} - Display Test App`;
}
