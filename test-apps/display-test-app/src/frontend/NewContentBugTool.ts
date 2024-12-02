/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, SpatialViewState, Tool } from "@itwin/core-frontend";

/** Connect or disconnect two or more viewports using connectViewports. */
export class NewContentBugTool extends Tool {
  public static override toolId = "NewContentBug";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return undefined; }

  private static _allModels: string[] = [];

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    if (args.length < 1)
      return false;

    if (args[0].toLowerCase() === "remove") {
      const models = (IModelApp.viewManager.selectedView!.view as SpatialViewState).modelSelector.models;
      NewContentBugTool._allModels = Array.from(models);
      console.log(`Dropping models: ${  [...NewContentBugTool._allModels]}`);
      (IModelApp.viewManager.selectedView!.view as SpatialViewState).modelSelector.dropModels([...NewContentBugTool._allModels]);
    } else if (args[0].toLowerCase() === "add") {
      const newView = (IModelApp.viewManager.selectedView!.view as SpatialViewState).clone();
      console.log(`Adding models: ${  [...NewContentBugTool._allModels]}`);
      newView.modelSelector.addModels([...NewContentBugTool._allModels]);
      IModelApp.viewManager.selectedView!.changeView(newView);
    } else {
      return false;
    }

    return true;
  }
}
