// Copyright (c) Bentley Systems
import {
  CategorySelectorProps,
  Code,
  ColorDef,
  DisplayStyleProps,
  Frustum,
  Npc,
  QueryRowFormat,
  SectionDrawingViewProps,
  SpatialViewDefinitionProps,
  ViewDefinition2dProps,
  ViewStateProps,
} from "@itwin/core-common";
import {
  DrawingViewState,
  IModelApp,
  IModelConnection,
  SpatialViewState,
  ViewCreator2d,
} from "@itwin/core-frontend";
import { Point3d, Range1d, Range3d, Range3dProps, Transform, Vector3d } from "@itwin/core-geometry";
import { SectionDrawingIpcInvoker } from "./SectionDrawingIpcInvoker";
// eslint-disable-next-line @itwin/no-internal-barrel-imports

export class SectionDrawingApi {
  public static async insertSpatialView(name: string, spatialViewState: SpatialViewState): Promise<string> {
    const spatialViewStateProps = spatialViewState.toProps();
    const dictionaryModelId = IModelConnection.dictionaryId;
    const modelSelectorId = await SectionDrawingIpcInvoker.getOrCreate().insertElement(
      spatialViewStateProps.modelSelectorProps!,
      [dictionaryModelId],
    );
    const categorySelectorId = await SectionDrawingIpcInvoker.getOrCreate().insertElement(
      spatialViewStateProps.categorySelectorProps,
      [dictionaryModelId],
    );
    const spatialViewDefinitionProps: SpatialViewDefinitionProps = spatialViewState.toJSON();
    spatialViewDefinitionProps.categorySelectorId = categorySelectorId;
    spatialViewDefinitionProps.displayStyleId = spatialViewDefinitionProps.displayStyleId === "0"
      ? await SectionDrawingIpcInvoker.getOrCreate().insertElement(spatialViewStateProps.displayStyleProps, [
        dictionaryModelId,
      ])
      : spatialViewDefinitionProps.displayStyleId;
    spatialViewDefinitionProps.modelSelectorId = modelSelectorId;
    spatialViewDefinitionProps.code = await SectionDrawingIpcInvoker.getOrCreate().spatialViewDefinitionCode(name);
    return SectionDrawingIpcInvoker.getOrCreate().insertElement(spatialViewDefinitionProps, []);
  }

  private static async insertSectionDrawingViewDefinition(
    iModelConnection: IModelConnection,
    name: string,
    drawingViewStateProps: ViewStateProps,
  ): Promise<string> {
    if (!iModelConnection)
      return "";
    const drawingViewState = DrawingViewState.createFromProps(drawingViewStateProps, iModelConnection);
    const dictionaryModelId = IModelConnection.dictionaryId;
    const categorySelectorId = await SectionDrawingIpcInvoker.getOrCreate().insertElement(
      drawingViewStateProps.categorySelectorProps,
      [dictionaryModelId],
    );
    const displayStyleId = await SectionDrawingIpcInvoker.getOrCreate().insertElement(drawingViewStateProps.displayStyleProps, [
      dictionaryModelId,
    ]);
    const drawingViewDefinitionProps = drawingViewState.toJSON();
    drawingViewDefinitionProps.categorySelectorId = categorySelectorId;
    drawingViewDefinitionProps.displayStyleId = displayStyleId;
    const drawingViewDefinitionId = await SectionDrawingIpcInvoker.getOrCreate().insertSectionDrawingViewState(
      drawingViewDefinitionProps,
      name,
    );
    return drawingViewDefinitionId;
  }

  public static async viewSectionDrawing(iModelConnection: IModelConnection, drawingViewDefinitionId: string, sectionDrawingId?: string): Promise<void> {
    if (!iModelConnection)
      return;

    const drawingViewState: DrawingViewState = (await iModelConnection.views.load(
      drawingViewDefinitionId,
    )) as DrawingViewState;

    if (sectionDrawingId)
      await drawingViewState.changeViewedModel(sectionDrawingId);
    await drawingViewState.load();

    const viewport = IModelApp.viewManager.selectedView;
    if (!viewport)
      return;
    viewport.changeView(drawingViewState);
  }

  private static adjustZPlanes(view: SpatialViewState): void {
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
    const clipPlanes = frustum.getRangePlanes(false, false, 0);
    const viewedExtentCorners = extents.corners();

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

  public static async createAndViewSectionDrawingMethod2(iModelConnection: IModelConnection, name: string, spatialViewDefinitionId: string, saveView: boolean = true): Promise<void> {
    if (!iModelConnection)
      return;
    const tempName = `SectionDrawingDemo-${name}`;

    const spatialViewState: SpatialViewState = await iModelConnection.views.load(spatialViewDefinitionId) as SpatialViewState;
    // Rotate around world space
    this.adjustZPlanes(spatialViewState);
    const frustum = spatialViewState.calculateFrustum()!;
    const center = frustum!.frontCenter;
    const translate = Transform.createTranslation(center);
    const rotate = Transform.createFixedPointAndMatrix(center, spatialViewState.rotation.inverse()!);
    const drawingToSpatial = rotate.multiplyTransformTransform(translate);

    const sectionDrawingId = await SectionDrawingIpcInvoker.getOrCreate().insertSectionDrawing(
      tempName,
      spatialViewDefinitionId,
      drawingToSpatial.toJSON(),
    );
    // Create view state
    const viewStateProps = await this.createSectionDrawingViewStateProps(
      iModelConnection,
      spatialViewDefinitionId,
      sectionDrawingId,
      drawingToSpatial,
    );
    const drawingViewState = DrawingViewState.createFromProps(viewStateProps, iModelConnection);

    if (saveView) {
      // Insert a new drawing view definition and view it
      const drawingViewDefinitionId = await this.insertSectionDrawingViewDefinition(
        iModelConnection,
        tempName,
        drawingViewState.toProps(),
      );
      await this.viewSectionDrawing(iModelConnection, drawingViewDefinitionId, sectionDrawingId);
    } else {
      // View new drawing view state directly (without saving it)
      await drawingViewState.load();
      const viewport = IModelApp.viewManager.selectedView;
      if (!viewport)
        return;
      viewport.changeView(drawingViewState);
    }
  }

  private static async createSectionDrawingViewStateProps(
    iModelConnection: IModelConnection,
    spatialViewDefinitionId: string,
    sectionDrawingModelId: string,
    drawingToSpatial: Transform,
  ): Promise<ViewStateProps> {
    if (!iModelConnection)
      return {} as ViewStateProps;

    const dictionaryId = IModelConnection.dictionaryId;
    // Get all categories
    const query = "SELECT ECInstanceId from BisCore.Category";
    const categories = [];
    for await (const row of iModelConnection.createQueryReader(query, undefined, {
      rowFormat: QueryRowFormat.UseJsPropertyNames,
    })) {
      categories.push(row.id);
    }

    const spatialToDrawing = drawingToSpatial.inverse()!;
    const spatialViewState: SpatialViewState = await iModelConnection.views.load(spatialViewDefinitionId) as SpatialViewState;
    this.adjustZPlanes(spatialViewState);
    const frustum = spatialViewState.calculateFrustum()!;
    frustum.multiply(spatialToDrawing);
    const drawingViewExtents = Range3d.create(frustum.getCorner(Npc.LeftBottomFront), frustum.getCorner(Npc.RightTopFront));
    
    // // Visible extents
    // const drawingViewExtentsProps: Range3dProps =
    //     await SectionDrawingIpcInvoker.getOrCreate().calculateDrawingViewExtents(
    //       spatialViewDefinitionId,
    //       sectionDrawingModelId,
    //       drawingToSpatial.toJSON(),
    //     );
    // const drawingViewExtents = Range3d.fromJSON(drawingViewExtentsProps);
    const originX = drawingViewExtents.low.x;
    const originY = drawingViewExtents.low.y;
    const deltaX = drawingViewExtents.xLength();
    const deltaY = drawingViewExtents.yLength();

    const categorySelectorProps: CategorySelectorProps = {
      categories,
      code: Code.createEmpty(),
      model: dictionaryId,
      classFullName: "BisCore:CategorySelector",
    };

    const viewDefinitionProps: ViewDefinition2dProps = {
      baseModelId: sectionDrawingModelId,
      categorySelectorId: "",
      displayStyleId: "",
      origin: { x: originX, y: originY },
      delta: { x: deltaX, y: deltaY },
      angle: { radians: 0 },
      code: Code.createEmpty(),
      model: dictionaryId,
      classFullName: "BisCore:ViewDefinition2d",
    };

    const displayStyleProps: DisplayStyleProps = {
      code: Code.createEmpty(),
      model: dictionaryId,
      classFullName: "BisCore:DisplayStyle2d",
      jsonProperties: {
        styles: {
          backgroundColor: ColorDef.white.tbgr,
        },
      },
    };

    // const rotation = spatialViewState.rotation;

    // const transform = Transform.createOriginAndMatrix(spatialViewState.origin, rotation).inverse();
    const transform = drawingToSpatial;

    const spatialOriginInDrawingSpace = spatialToDrawing?.multiplyPoint3d(spatialViewState.origin);
    const spatialRangeInDrawingSpace = spatialToDrawing?.multiplyVector(spatialViewState.extents);
    const viewRange = Range3d.createXYZXYZ(
      spatialOriginInDrawingSpace.x,
      spatialOriginInDrawingSpace.y,
      spatialOriginInDrawingSpace.z,
      spatialOriginInDrawingSpace.x + spatialRangeInDrawingSpace.x,
      spatialOriginInDrawingSpace.y + spatialRangeInDrawingSpace.y,
      spatialOriginInDrawingSpace.z + spatialRangeInDrawingSpace.z,
    );

    const sectionDrawing: SectionDrawingViewProps = {
      spatialView: spatialViewDefinitionId,
      displaySpatialView: true,
      drawingToSpatialTransform: transform!.toJSON(),
    };

    const viewStateProps: ViewStateProps = {
      displayStyleProps,
      categorySelectorProps,
      viewDefinitionProps,
      modelExtents: drawingViewExtents,
      sectionDrawing,
    };

    return viewStateProps;
  }
}
