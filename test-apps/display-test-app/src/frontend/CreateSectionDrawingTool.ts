/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DrawingViewState, IModelApp, Tool } from "@itwin/core-frontend";
import { Id64 } from "@itwin/core-bentley";
import { CreateSectionDrawingViewArgs } from "../common/DtaIpcInterface";
import { dtaIpc } from "./App";
import { Range3d, Transform } from "@itwin/core-geometry";
import { CategorySelectorProps, Code, ColorDef, DisplayStyleProps, IModel, Npc, QueryRowFormat, SectionDrawingViewProps, ViewDefinition2dProps, ViewStateProps } from "@itwin/core-common";

/** Creates a section drawing model that references a copy of the active viewport's spatial view,
 * then changes the viewport to render a (non-persistent) drawing view displaying the drawing model along
 * with the spatial view.
 */
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

    const vp = IModelApp.viewManager.selectedView;
    if (!vp || vp.iModel.isReadonly) {
      throw new Error("Writable briefcase required");
    }

    const spatialView = vp.view.isSpatialView() ? vp.view.clone() : undefined;
    if (!spatialView || spatialView.isCameraOn) {
      throw new Error("Orthographic spatial view required");
    }

    // Compute a transform from drawing to spatial coordinates.
    // We want the near plane of the spatial view to coincide with the center of the xy plane of the drawing model at z=0
    // Note: If we had a section clip plane, we'd want to align that plane with the drawing's z=0.
    const frustum = vp.getFrustum();
    const center = frustum.frontCenter;
    const translate = Transform.createTranslation(center);
    const rotate = Transform.createFixedPointAndMatrix(center, spatialView.rotation.inverse()!);
    const drawingToSpatial = rotate.multiplyTransformTransform(translate);

    // Insert the spatial view and the section drawing model.
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
    const spatialToDrawing = drawingToSpatial.inverse()!;
    frustum.multiply(spatialToDrawing);
    const extents = Range3d.create(frustum.getCorner(Npc.LeftBottomFront), frustum.getCorner(Npc.RightTopFront));

    // Enable all 2d categories.
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

