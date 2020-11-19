/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnection, InteractiveEditingSession } from "@bentley/imodeljs-frontend";

export function setTitle(imodel: IModelConnection) {
  let prefix = "";
  if (OpenMode.ReadWrite === imodel.openMode)
    prefix = undefined !== InteractiveEditingSession.get(imodel) ? "[ EDIT ] " : "[ R/W ] ";

  document.title = `${prefix}${imodel.getRpcProps().key} - Display Test App`;
}
