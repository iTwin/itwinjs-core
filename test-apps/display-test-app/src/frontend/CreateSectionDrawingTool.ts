/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, SpatialViewState, Tool } from "@itwin/core-frontend";
import { Id64 } from "@itwin/core-bentley";
import { CreateSectionDrawingViewArgs } from "../common/DtaIpcInterface";
import { dtaIpc } from "./App";
import { Transform } from "@itwin/core-geometry";

export class CreateSectionDrawingTool extends Tool {
  public static override toolId = "CreateSectionDrawing";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }
  
  public override async run(...toolArgs: any[]): Promise<boolean> {
    if (toolArgs.length !== 1 || typeof toolArgs[0] !== "string") {
      return false;
    }

    const spatialView = IModelApp.viewManager.selectedView?.view;
    if (!(spatialView instanceof SpatialViewState) || spatialView.isCameraOn) {
      throw new Error("Orthographic spatial view required");
    }

    if (spatialView.iModel.isReadonly) {
      throw new Error("Writable briefcase required");
    }

    const drawingToSpatialTransform = Transform.identity.toJSON(); // ###TODO
    
    const args: CreateSectionDrawingViewArgs = {
      iModelKey: spatialView.iModel.key,
      baseName: toolArgs[0],
      spatialView: spatialView.toJSON(),
      models: Array.from(spatialView.modelSelector.models),
      categories: Array.from(spatialView.categorySelector.categories),
      displayStyle: spatialView.displayStyle.toJSON(),
      drawingToSpatialTransform,
    };

    const drawingViewId = await dtaIpc.createSectionDrawingView(args);
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
