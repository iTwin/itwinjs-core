/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, SpatialViewState, Tool } from "@itwin/core-frontend";
import { Id64 } from "@itwin/core-bentley";
import { CreateSectionDrawingViewArgs } from "../common/DtaIpcInterface";
import { dtaIpc } from "./App";
import { Range1d, Transform, } from "@itwin/core-geometry";
import { Frustum } from "@itwin/core-common";

export class CreateSectionDrawingTool extends Tool {
  public static override toolId = "CreateSectionDrawing";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }
  
  public override async run(...toolArgs: any[]): Promise<boolean> {
    if (toolArgs.length !== 1 || typeof toolArgs[0] !== "string") {
      return false;
    }

    const spatialView = IModelApp.viewManager.selectedView?.view.clone();
    if (!(spatialView instanceof SpatialViewState) || spatialView.isCameraOn) {
      throw new Error("Orthographic spatial view required");
    }

    if (spatialView.iModel.isReadonly) {
      throw new Error("Writable briefcase required");
    }

    const drawingToSpatialTransform = computeDrawingToSpatialTransform(spatialView).toJSON();
    
    const args: CreateSectionDrawingViewArgs = {
      iModelKey: spatialView.iModel.key,
      baseName: toolArgs[0],
      spatialView: spatialView.toJSON(),
      models: Array.from(spatialView.modelSelector.models),
      categories: Array.from(spatialView.categorySelector.categories),
      displayStyle: spatialView.displayStyle.toJSON(),
      drawingToSpatialTransform,
    };

    const drawingModelId = await dtaIpc.createSectionDrawing(args);
    if (!Id64.isValidId64(drawingModelId)) {
      return false;
    }

    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      return false;
    }

    // ###TODO create and switch to a non-persistent view of the drawing.
    const drawingView = await spatialView.iModel.views.load(drawingModelId);
    vp.changeView(drawingView);
    return true;
  }
}

// ###TODO Use ViewingSpace API.
function adjustZPlanes(view: SpatialViewState) {
  const viewOrigin = view.getOrigin().clone();
  const viewDelta = view.getExtents().clone();
  const viewRot = view.getRotation().clone();
  const origin = view.getOrigin().clone();
  const delta = view.getExtents().clone();
  delta.z = Math.max(delta.z, 1);

  const extents = view.getViewedExtents();
  const frustum = new Frustum();
  const worldToNpc = view.computeWorldToNpc(viewRot, viewOrigin, viewDelta, false).map!;
  if (!worldToNpc) {
    return;
  }

  worldToNpc.transform1.multiplyPoint3dArrayQuietNormalize(frustum.points);
  const depthRange = Range1d.createNull();
  if (!extents.isNull) {
    const viewZ = viewRot.getRow(2);
    const corners = extents.corners();
    for (const corner of corners) {
      depthRange.extendX(viewZ.dotProduct(corner));
    }

    if (depthRange.isNull) {
      return;
    }

    viewRot.multiplyVectorInPlace(origin);
    origin.z = depthRange.low;
    delta.z = Math.max(depthRange.high - depthRange.low, 1)
    viewRot.multiplyTransposeVectorInPlace(origin);
  }

  view.setOrigin(origin);
  view.setExtents(delta);
}

function computeDrawingToSpatialTransform(view: SpatialViewState): Transform {
  adjustZPlanes(view);

  const frustum = view.calculateFrustum()!;
  const center = frustum!.frontCenter;
  const translate = Transform.createTranslation(center);
  const rotate = Transform.createFixedPointAndMatrix(center, view.rotation.inverse()!);

  return rotate.multiplyTransformTransform(translate);
}
