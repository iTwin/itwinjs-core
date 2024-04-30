
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, Tool, ViewCreator2d } from "@itwin/core-frontend";
import { Id64 } from "@itwin/core-bentley";
import { CreateDrawingArgs, CreateDrawingViewArgs } from "../common/DtaIpcInterface";
import { DisplayTestApp, dtaIpc } from "./App";

/** Creates a drawing model,
 * then changes the viewport to render a (non-persistent) drawing view displaying the drawing model.
 */
export class CreateDrawingTool extends Tool {
  public static override toolId = "CreateDrawing";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0]);
  }
  public override async run(baseName: string): Promise<boolean> {
    if (typeof baseName !== "string") {
      return false;
    }
    const vp = IModelApp.viewManager.selectedView;
    if (!vp || vp.iModel.isReadonly || !vp.iModel.isBriefcaseConnection()) {
      throw new Error("Writable briefcase required");
    }
    // Enter editing scope - prefer using the `dta edit` keyin over this code snippet
    // if (!vp.iModel.editingScope)
    //   await vp.iModel.enterEditingScope();
    // Create drawing element/model
    const drawingArgs: CreateDrawingArgs = {
      iModelKey: vp.iModel.key,
      baseName,
    };
    const drawingId = await dtaIpc.createDrawing(drawingArgs);
    if (!Id64.isValidId64(drawingId)) {
      return false;
    }
    // Create a drawing view on the frontend
    const viewCreator = new ViewCreator2d(vp.iModel);
    const drawingView = await viewCreator.createViewForModel(drawingId);
    if (!drawingView.isDrawingView())
      return false;
    // Save the drawing view so it is findable after re-opening the iModel
    const drawingViewArgs: CreateDrawingViewArgs = {
      ...drawingArgs,
      drawingView: drawingView.toJSON(),
      categories: Array.from(drawingView.categorySelector.categories),
      displayStyle: drawingView.displayStyle.toJSON(),
    };
    const drawingViewId = await dtaIpc.insertDrawingView(drawingViewArgs);
    if (!Id64.isValidId64(drawingViewId)) {
      return false;
    }
    // Switch to the drawing view, using the same logic as the view dropdown
    const displayTestAppViewer = DisplayTestApp.surface.firstViewer;
    if (displayTestAppViewer) {
      await displayTestAppViewer.changeView(drawingViewId);
    }
    return true;
  }
}
