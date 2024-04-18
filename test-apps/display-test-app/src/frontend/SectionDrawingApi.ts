// Copyright (c) Bentley Systems
import {
  CategorySelectorProps,
  Code,
  ColorDef,
  DisplayStyleProps,
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
import { Point3d, Range3d, Range3dProps, Transform, Vector3d } from "@itwin/core-geometry";
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

  /**
     * Create a new section drawing and drawing view state viewing the section drawing. Switch views to new drawing view state.
     * @param name The name of the SpatialViewDefinition AND new section drawing.
     * @param spatialViewDefinitionId The id of the SpatialViewDefinition.
     * TODO: What happens on undo? Is the user stuck with bad data? Are all created/modified elements removed? Can we modify undo to remove them (via bundling the transactions)? Tools have to be able to create more than 1 element.
     */
  public static async createAndViewSectionDrawingMethod1(iModelConnection: IModelConnection, name: string, spatialViewDefinitionId: string, saveView: boolean = true): Promise<void> {
    if (!iModelConnection)
      return;
    const tempName = `SectionDrawingDemo-${name}`;

    const spatialViewState: SpatialViewState = await iModelConnection.views.load(spatialViewDefinitionId) as SpatialViewState;
    /**
         * The idea is to do a 3 step process.
         * Step 1: Untranslate from the spatial view's origin to the center of the spatial view.
         * Step 2: Rotate the view.
         * Step 3: Re-translate back to the spatial view's origin.
         * The question is, how do we do this? After doing steps 1 and 2, when/where does step 3 happen?
         */
    // This seems to consistently move any attached spatial view to slightly off-screen to the bottom left corner. It has significant culling. Maybe this is doing steps 1 & 2, but missing step 3?
    const drawingToSpatial = Transform.createOriginAndMatrix(Vector3d.createFrom(spatialViewState.getCenter()), spatialViewState.rotation.inverse());
    // This seems slightly less consistent in placing than the above transform, but with less culling. Still missing step 3?
    // const drawingToSpatial = Transform.createOriginAndMatrix(Vector3d.createFrom(spatialViewState.getCenter()).negate(), spatialViewState.rotation.inverse());
    // This seems to get the view *somewhat* close to the center, except for the top view (which completely disappears). It seems to have worse culling, and I wonder if the top view is completely culled.
    // const drawingToSpatial = Transform.createOriginAndMatrix(Vector3d.createFrom(spatialViewState.getCenter()), spatialViewState.rotation).inverse();
    // const step3 = Transform.createTranslation(spatialViewState.origin);
    // step3.multiplyTransformTransform(drawingToSpatial, drawingToSpatial);
    // const drawingToSpatial = Transform.createOriginAndMatrix(Point3d.createZero(), spatialViewState.rotation.inverse());
    const sectionDrawingId = await SectionDrawingIpcInvoker.getOrCreate().insertSectionDrawing(
      tempName,
      spatialViewDefinitionId,
      drawingToSpatial!.toJSON(),
    );
    const drawingViewCreator = new ViewCreator2d(iModelConnection);
    const drawingViewState = (await drawingViewCreator.createViewForModel(sectionDrawingId)) as DrawingViewState;

    // Manually set the extents and origin of the drawing view for testing purposes
    drawingViewState.extentLimits = {min:0.1, max: 50000};
    drawingViewState.setExtents({x:100, y: 100});
    drawingViewState.setOrigin({x: 0, y: 0});

    // This reads the transform from the saved SectionDrawing, so we do not have to deal with setting up our own view state.
    await drawingViewState.changeViewedModel(sectionDrawingId);

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

  public static async createAndViewSectionDrawingMethod2(iModelConnection: IModelConnection, name: string, spatialViewDefinitionId: string, saveView: boolean = true): Promise<void> {
    if (!iModelConnection)
      return;
    const tempName = `SectionDrawingDemo-${name}`;

    const spatialViewState: SpatialViewState = await iModelConnection.views.load(spatialViewDefinitionId) as SpatialViewState;
    // Rotate around world space
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

  public static async createAndViewSectionDrawingRevitWay(iModelConnection: IModelConnection, name: string, spatialViewDefinitionId: string, saveView: boolean = true): Promise<void> {
    if (!iModelConnection)
      return;
    const tempName = `SectionDrawingDemo-${name}`;

    const spatialViewState: SpatialViewState = await iModelConnection.views.load(spatialViewDefinitionId) as SpatialViewState;
    const drawingToSpatial = Transform.createIdentity();
    const nonsense = iModelConnection.ecefLocation?.getTransform();
    drawingToSpatial.multiplyTransformTransform(nonsense!, drawingToSpatial);
    const huh = Transform.createOriginAndMatrix(spatialViewState.origin, spatialViewState.rotation.inverse());
    if (huh)
      drawingToSpatial.multiplyTransformTransform(huh, drawingToSpatial);
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
