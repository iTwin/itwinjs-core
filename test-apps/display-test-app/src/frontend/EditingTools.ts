/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelWriteRpcInterface } from "@bentley/imodeljs-common";
import {
  IModelApp, InteractiveEditingSession, Tool,
} from "@bentley/imodeljs-frontend";
import { setTitle } from "./Title";

// Simple tools for testing interactive editing. They require the iModel to have been opened in read-write mode.

/** If an editing session is currently in progress, end it; otherwise, begin a new one. */
export class EditingSessionTool extends Tool {
  public static toolId = "EditingSession";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 0; }

  public run(): boolean {
    const imodel = IModelApp.viewManager.selectedView?.iModel;
    if (!imodel)
      return false;

    const session = InteractiveEditingSession.get(imodel);
    if (session)
      session.end().then(() => setTitle(imodel));
    else
      InteractiveEditingSession.begin(imodel).then(() => setTitle(imodel));

    return true;
  }
}

/** Delete all elements currently in the selection set. */
export class DeleteElementsTool extends Tool {
  public static toolId = "DeleteElements";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 0; }

  public run(): boolean {
    const imodel = IModelApp.viewManager.selectedView?.iModel;
    if (!imodel)
      return false;

    const elements = imodel.selectionSet.elements;
    if (0 !== elements.size)
      IModelWriteRpcInterface.getClient().deleteElements(imodel.getRpcProps(), Array.from(elements));

    return true;
  }
}
