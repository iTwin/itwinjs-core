/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, SpatialViewState, Tool } from "@itwin/core-frontend";
import { SectionDrawingIpcInvoker } from "./SectionDrawingIpcInvoker";
import { Id64 } from "@itwin/core-bentley";

export class CreateSectionDrawingTool extends Tool {
  public static override toolId = "CreateSectionDrawing";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }
  
  public override async run(...args: any[]): Promise<boolean> {
    if (args.length !== 1 || typeof args[0] !== "string") {
      return false;
    }

    const spatialView = IModelApp.viewManager.selectedView?.view;
    if (!(spatialView instanceof SpatialViewState) || spatialView.isCameraOn) {
      throw new Error("Orthographic spatial view required");
    }

    if (spatialView.iModel.isReadonly) {
      throw new Error("Writable briefcase required");
    }

    const drawingViewId = await SectionDrawingIpcInvoker.createSectionDrawingView(spatialView, args[0]);
    if (!Id64.isValidId64(drawingViewId)) {
      return false;
    }

    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      return false;
    }

    const drawingView = await spatialView.iModel.views.load(drawingViewId);
    vp.changeView(drawingView);
    return true;
  }
}
