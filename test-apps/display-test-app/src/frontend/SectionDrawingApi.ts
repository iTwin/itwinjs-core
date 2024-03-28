/* eslint-disable no-console */
import { Camera, CategorySelectorProps, Code, ColorDef, DisplayStyle3dProps, DisplayStyleProps, Environment, ModelSelectorProps, QueryRowFormat, RenderMode, SectionDrawingViewProps, SpatialViewDefinitionProps, ViewDefinition2dProps, ViewDefinition3dProps, ViewStateProps } from "@itwin/core-common";
import { DrawingViewState, IModelApp, IModelConnection, SpatialViewState, StandardViewId, ViewCreator3dOptions, Viewport, ViewState } from "@itwin/core-frontend";
import { Range3d, Range3dProps } from "@itwin/core-geometry";
import { Id64Array } from "@itwin/core-bentley";
import { SectionDrawingIpcInvoker } from "./SectionDrawingIpcInvoker";

export class SectionDrawingApi {

  // Temporary spatial view creation logic

  /**
   * This is mostly the function from ViewCreator3d.
   * @param IModel
   * @param models
   * @param categories
   * @param modelExtents
   * @param options
   * @returns
   */
  private static async createViewStateProps(iModel: IModelConnection, models: Id64Array, categories: Id64Array, modelExtents: Range3d, options?: ViewCreator3dOptions): Promise<ViewStateProps> {
    // Use dictionary model in all props
    const dictionaryId = IModelConnection.dictionaryId;

    if (modelExtents.isNull)
      modelExtents.setFrom(iModel.projectExtents);

    const originX = modelExtents.low.x;
    const originY = modelExtents.low.y;
    const originZ = modelExtents.low.z;
    const deltaX = modelExtents.xLength();
    const deltaY = modelExtents.yLength();
    const deltaZ = modelExtents.zLength();

    const categorySelectorProps: CategorySelectorProps = {
      categories,
      code: Code.createEmpty(),
      model: dictionaryId,
      classFullName: "BisCore:CategorySelector",
    };

    const modelSelectorProps: ModelSelectorProps = {
      models,
      code: Code.createEmpty(),
      model: dictionaryId,
      classFullName: "BisCore:ModelSelector",
    };

    const cameraData = new Camera();
    const cameraOn = options?.cameraOn !== false;
    const viewDefinitionProps: ViewDefinition3dProps = {
      categorySelectorId: "",
      displayStyleId: "",
      code: Code.createEmpty(),
      model: dictionaryId,
      origin: { x: originX, y: originY, z: originZ },
      extents: { x: deltaX, y: deltaY, z: deltaZ },
      classFullName: "BisCore:SpatialViewDefinition",
      cameraOn,
      camera: {
        lens: cameraData.lens.toJSON(),
        focusDist: cameraData.focusDist,
        eye: cameraData.eye.toJSON(),
      },
    };

    const displayStyleProps: DisplayStyle3dProps = {
      code: Code.createEmpty(),
      model: dictionaryId,
      classFullName: "BisCore:DisplayStyle3d",
      jsonProperties: {
        styles: {
          viewflags: {
            renderMode: RenderMode.SmoothShade,
            noSourceLights: false,
            noCameraLights: false,
            noSolarLight: false,
            noConstruct: true,
            noTransp: false,
            visEdges: false,
            backgroundMap: iModel.isGeoLocated,
          },
          environment:
            options !== undefined &&
              options.skyboxOn !== undefined &&
              options.skyboxOn
              ? Environment.defaults.withDisplay({ sky: true }).toJSON()
              : undefined,
        },
      },
    };

    const viewStateProps: ViewStateProps = {
      displayStyleProps,
      categorySelectorProps,
      modelSelectorProps,
      viewDefinitionProps,
    };

    // merge seed view props if needed
    return viewStateProps;
  }

  /**
     * Creates a spatial view for testing. In an actual workflow, the spatial view would be created earlier and would be provided/queried.
     * @param orientation Which standard view to use of the house model.
     * @returns The SpatialViewDefinitionProps and the range of the spatial view (the range is used in the CreateSpatialViewAttachmentTool).
     */
  private static async createTestSpatialViewProps(orientation: StandardViewId = StandardViewId.Left): Promise<SpatialViewDefinitionProps> {
    const iModelConnection = IModelApp.viewManager.selectedView?.iModel;
    if (!iModelConnection)
      return {} as SpatialViewDefinitionProps;

    // Query physical model(s)
    const modelIds = [];
    const query = `SELECT ECInstanceId FROM Bis:PhysicalPartition`;
    for await (const row of iModelConnection.createQueryReader(query)) {
      modelIds.push(row[0]);
    }

    // Query all categories
    const categoriesQuery = `SELECT ECInstanceId FROM Bis:Category`;
    const categories: string[] = (await iModelConnection.createQueryReader(categoriesQuery, undefined, {
      rowFormat: QueryRowFormat.UseJsPropertyNames,
    }).toArray()).map((category: any) => category.id);

    // Create a SpatialViewState
    const viewCreatorOptions: ViewCreator3dOptions = {
      cameraOn: false,
      skyboxOn: false,
      standardViewId: orientation,
    };
    const spatialViewStateProps = await SectionDrawingApi.createViewStateProps(iModelConnection, modelIds, categories, Range3d.createNull(), viewCreatorOptions);
    const spatialViewState = SpatialViewState.createFromProps(spatialViewStateProps, iModelConnection);
    // Get and preserve aspect ratio before rotation
    const ap = spatialViewState.getAspectRatio();
    spatialViewState.setStandardRotation(orientation);
    const range = spatialViewState.computeFitRange();
    spatialViewState.lookAtVolume(range, ap);

    // Create SpatialViewDefinitionProps
    const dictionaryModelId = IModelConnection.dictionaryId;
    const modelSelectorId = await SectionDrawingIpcInvoker.getOrCreate().insertElement(spatialViewStateProps.modelSelectorProps!, [dictionaryModelId]);
    const categorySelectorId = await SectionDrawingIpcInvoker.getOrCreate().insertElement(spatialViewStateProps.categorySelectorProps, [dictionaryModelId]);
    const displayStyleId = await SectionDrawingIpcInvoker.getOrCreate().insertElement(spatialViewStateProps.displayStyleProps, [dictionaryModelId]);
    const spatialViewDefinitionProps: SpatialViewDefinitionProps = spatialViewState.toJSON();
    spatialViewDefinitionProps.categorySelectorId = categorySelectorId;
    spatialViewDefinitionProps.displayStyleId = displayStyleId;
    spatialViewDefinitionProps.modelSelectorId = modelSelectorId;

    return spatialViewDefinitionProps;
  }

  public static async insertTestSpatialView(name: string): Promise<string> {
    const spatialViewDefinitionProps = await this.createTestSpatialViewProps();
    const testSpatialViewId = await SectionDrawingIpcInvoker.getOrCreate().insertSpatialView(spatialViewDefinitionProps, name);

    return testSpatialViewId;
  }

  // Section drawing logic

  /**
     * Create a new section drawing and drawing view state viewing the section drawing. Switches views to new drawing view state.
     * @param name The name of the new section drawing.
     * @param spatialViewDefinitionId The id of the SpatialViewDefinition.
     */
  public static async createAndViewSectionDrawing(name: string, spatialViewDefinitionId: string): Promise<void> {
    // For the demo, I need a way to determine if the section drawing is made by us, or by Microstation connector. Adding a prefix allows me to do this quickly. This is hackathon quality.
    const tempName = `SectionDrawingDemo-${name}`;
    // Insert a new section drawing and section drawing model.
    const sectionDrawingId = await this.insertSectionDrawing(tempName, spatialViewDefinitionId);
    // Insert a new drawing view definition viewing the section drawing model.
    const drawingViewDefinitionId = await this.insertSectionDrawingViewDefinition(tempName, spatialViewDefinitionId, sectionDrawingId);
    await this.viewSectionDrawing(drawingViewDefinitionId);
  }

  private static async insertSectionDrawing(name: string, spatialViewDefinitionId: string): Promise<string> {
    if (!spatialViewDefinitionId || !name)
      return "";

    const sectionDrawingId = await SectionDrawingIpcInvoker.getOrCreate().insertSectionDrawing(name, spatialViewDefinitionId);

    return sectionDrawingId;
  }

  public static async viewSectionDrawing(drawingViewDefinitionId: string): Promise<void> {
    const iModelConnection = IModelApp.viewManager.selectedView?.iModel;
    if (!iModelConnection)
      return;

    // TODO: How should we handle changes in the underlying section model? Probably need logic for updating the DrawingViewDefinition extents based on changes in the underlying model

    // Get saved view state
    const drawingViewState: DrawingViewState = await iModelConnection.views.load(drawingViewDefinitionId) as DrawingViewState;

    // [For debugging] - make a copy and log the copy to avoid any async issues affecting the console log.
    const drawingViewStateCopy = DrawingViewState.createFromProps(drawingViewState.toProps(), iModelConnection);

    // [For debugging] console log the original spatial view
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const spatialViewDefinitionId: string = drawingViewState.attachmentInfo.sectionDrawingInfo.spatialView;
    const originalSpatialViewState: SpatialViewState = await iModelConnection.views.load(spatialViewDefinitionId) as SpatialViewState;

    await drawingViewState.load();

    // [For debugging] - make a copy and log the copy to avoid any async issues affecting the console log.
    const drawingViewStateCopyAfterLoad = DrawingViewState.createFromProps(drawingViewState.toProps(), iModelConnection);
    await drawingViewStateCopyAfterLoad.load();

    const viewport = IModelApp.viewManager.selectedView;
    if (!viewport)
      return;
    // [For debugging] - Dump data to console after view changes
    viewport.onChangeView.addListener((vp: Viewport, _previousViewState: ViewState) => {
      // attachmentInfo property's spatial view is an Id64
      console.log("Original drawing view state:", drawingViewStateCopy);
      // Spatial view has expected z extents
      console.log("Original spatial view state:", originalSpatialViewState);
      // attachmentInfo property's spatial view is now a SpatialViewState. It has the same extents as the spatial view.
      console.log("Drawing view state after load:", drawingViewStateCopyAfterLoad);
      // attachment property is now populated. attachmentInfo property's spatial view has different extents, such as a much smaller z extent.
      console.log("Drawing view state after changing view", vp.view);
    });
    viewport.changeView(drawingViewState);
  }

  private static async insertSectionDrawingViewDefinition(name: string, spatialViewDefinitionId: string, sectionDrawingModelId: string): Promise<string> {
    const iModelConnection = IModelApp.viewManager.selectedView?.iModel;
    if (!iModelConnection)
      return "";
    const viewStateProps = await this.createSectionDrawingViewStateProps(spatialViewDefinitionId, sectionDrawingModelId);
    const drawingViewState = DrawingViewState.createFromProps(viewStateProps, iModelConnection);
    const dictionaryModelId = IModelConnection.dictionaryId;
    const categorySelectorId = await SectionDrawingIpcInvoker.getOrCreate().insertElement(viewStateProps.categorySelectorProps, [dictionaryModelId]);
    const displayStyleId = await SectionDrawingIpcInvoker.getOrCreate().insertElement(viewStateProps.displayStyleProps, [dictionaryModelId]);
    const drawingViewDefinitionProps = drawingViewState.toJSON();
    drawingViewDefinitionProps.categorySelectorId = categorySelectorId;
    drawingViewDefinitionProps.displayStyleId = displayStyleId;
    const drawingViewDefinitionId = await SectionDrawingIpcInvoker.getOrCreate().insertSectionDrawingViewState(drawingViewDefinitionProps, name);
    return drawingViewDefinitionId;
  }

  private static async createSectionDrawingViewStateProps(spatialViewDefinitionId: string, sectionDrawingModelId: string): Promise<ViewStateProps> {
    const iModelConnection = IModelApp.viewManager.selectedView?.iModel;
    if (!iModelConnection)
      return {} as ViewStateProps;

    const dictionaryId = IModelConnection.dictionaryId;
    // Get all categories
    const query = "SELECT ECInstanceId from BisCore.Category";
    const categories = [];
    for await (const row of iModelConnection.createQueryReader(query, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      categories.push(row.id);
    }

    // Visible extents
    const drawingViewExtentsProps: Range3dProps = await SectionDrawingIpcInvoker.getOrCreate().calculateDrawingViewExtents(spatialViewDefinitionId, sectionDrawingModelId);
    const drawingViewExtents = Range3d.fromJSON(drawingViewExtentsProps);
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

    const sectionDrawing: SectionDrawingViewProps = {
      spatialView: spatialViewDefinitionId,
      displaySpatialView: true,
      drawingToSpatialTransform: undefined,
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
