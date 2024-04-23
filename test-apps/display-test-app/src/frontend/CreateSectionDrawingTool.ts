/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DrawingViewState, IModelApp, SpatialViewState, Tool } from "@itwin/core-frontend";
import { Id64 } from "@itwin/core-bentley";
import { CreateSectionDrawingViewArgs } from "../common/DtaIpcInterface";
import { dtaIpc } from "./App";
import { Range1d, Range3d, Transform, } from "@itwin/core-geometry";
import { CategorySelectorProps, Code, ColorDef, DisplayStyleProps, Frustum, IModel, Npc, QueryRowFormat, SectionDrawingViewProps, ViewDefinition2dProps, ViewDefinitionProps, ViewStateProps } from "@itwin/core-common";

export class CreateSectionDrawingTool extends Tool {
  public static override toolId = "CreateSectionDrawing";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }
  
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0]);
  }

  public override async run(baseName: string): Promise<boolean> {
    if (typeof baseName !== "string") {
      return false;
    }

    const spatialView = IModelApp.viewManager.selectedView?.view.clone();
    if (!(spatialView instanceof SpatialViewState) || spatialView.isCameraOn) {
      throw new Error("Orthographic spatial view required");
    }

    if (spatialView.iModel.isReadonly) {
      throw new Error("Writable briefcase required");
    }

    // Insert the spatial view and the section drawing model.
    const drawingToSpatial = computeDrawingToSpatialTransform(spatialView);
    
    const args: CreateSectionDrawingViewArgs = {
      iModelKey: spatialView.iModel.key,
      baseName,
      spatialView: spatialView.toJSON(),
      models: Array.from(spatialView.modelSelector.models),
      categories: Array.from(spatialView.categorySelector.categories),
      displayStyle: spatialView.displayStyle.toJSON(),
      drawingToSpatialTransform: drawingToSpatial.toJSON(),
    };

    const { sectionDrawingId, spatialViewId } = await dtaIpc.createSectionDrawing(args);
    if (!Id64.isValidId64(sectionDrawingId)) {
      return false;
    }

    // Switch to a view of the section drawing model.
    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      return false;
    }

    const spatialToDrawing = drawingToSpatial.inverse()!;
    const frustum = spatialView.calculateFrustum()!;
    frustum.multiply(spatialToDrawing);
    const extents = Range3d.create(frustum.getCorner(Npc.LeftBottomFront), frustum.getCorner(Npc.RightTopFront));

    const categories = [];
    for await (const row of spatialView.iModel.createQueryReader("SELECT ECInstanceId from BisCore.DrawingCategory", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      categories.push(row.id);
    }

    const categorySelectorProps: CategorySelectorProps = {
      categories,
      code: Code.createEmpty(),
      model: IModel.dictionaryId,
      classFullName: "BisCore.CategorySelector",
    };
    
    const viewDefinitionProps: ViewDefinition2dProps = {
      baseModelId: sectionDrawingId,
      categorySelectorId: "",
      displayStyleId: "",
      origin: { x: extents.low.x, y: extents.low.y },
      delta: { x: extents.xLength(), y: extents.yLength() },
      angle: { radians: 0 },
      code: Code.createEmpty(),
      model: IModel.dictionaryId,
      classFullName: DrawingViewState.classFullName,
    };

    const displayStyleProps: DisplayStyleProps = {
      code: Code.createEmpty(),
      model: IModel.dictionaryId,
      classFullName: "BisCore.DisplayStyle2d",
      jsonProperties: {
        styles: {
          backgroundColor: ColorDef.white.toJSON(),
        },
      },
    };

    const sectionDrawing: SectionDrawingViewProps = {
      spatialView: spatialViewId,
      displaySpatialView: true,
      drawingToSpatialTransform: drawingToSpatial.toJSON(),
    };

    const viewStateProps: ViewStateProps = {
      displayStyleProps,
      categorySelectorProps,
      viewDefinitionProps,
      sectionDrawing,
    };
    
    const drawingView = DrawingViewState.createFromProps(viewStateProps, vp.iModel);
    await drawingView.load();
    
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
