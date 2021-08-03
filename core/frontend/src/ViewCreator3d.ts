/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Views
 */

/*
API for creating a 3D default view for an iModel.
Either takes in a list of modelIds, or displays all 3D models by default.
*/

import { Id64Array, Id64String, IModelStatus } from "@bentley/bentleyjs-core";
import { Camera, CategorySelectorProps, Code, DisplayStyle3dProps, IModel, IModelError, IModelReadRpcInterface, ModelSelectorProps, RenderMode, ViewDefinition3dProps, ViewQueryParams, ViewStateProps } from "@bentley/imodeljs-common";
import { Range3d } from "@bentley/geometry-core";
import { StandardViewId } from "./StandardView";
import { IModelConnection } from "./IModelConnection";
import { ViewState } from "./ViewState";
import { SpatialViewState } from "./SpatialViewState";
import { Environment } from "./DisplayStyleState";

/** Options for creating a [[ViewState3d]] via [[ViewCreator3d]].
 *  @public
*/
export interface ViewCreator3dOptions {
  /** Turn [[Camera]] on when generating the view. */
  cameraOn?: boolean;
  /** Turn [[SkyBox]] on when generating the view. */
  skyboxOn?: boolean;
  /** [[StandardViewId]] for the view state. */
  standardViewId?: StandardViewId;
  /** Merge in props from the seed view (default spatial view) of the iModel.  */
  useSeedView?: boolean;
  /** Aspect ratio of [[Viewport]]. Required to fit contents of the model(s) in the initial state of the view. */
  vpAspect?: number;
}

/**
 * API for creating a 3D default [[ViewState3d]] for an iModel. @see [[ViewCreator2d]] to create a view for a 2d model.
 * Example usage:
 * ```ts
 * const viewCreator = new ViewCreator3d(imodel);
 * const defaultView = await viewCreator.createDefaultView({skyboxOn: true});
 * ```
 * @public
 */
export class ViewCreator3d {

  /**
   * Constructs a ViewCreator3d using an [[IModelConnection]].
   * @param _imodel [[IModelConnection]] to query for categories and/or models.
   */
  constructor(private _imodel: IModelConnection) { }

  /**
   * Creates a default [[ViewState3d]] based on the model ids passed in. If no model ids are passed in, all 3D models in the iModel are used.
   * @param [options] Options for creating the view.
   * @param [modelIds] Ids of models to display in the view.
   * @throws [IModelError]($common) If no 3d models are found in the iModel.
   */
  public async createDefaultView(options?: ViewCreator3dOptions, modelIds?: string[]): Promise<ViewState> {

    const models = modelIds ? modelIds : await this._getAllModels();
    if (models === undefined || models.length === 0)
      throw new IModelError(IModelStatus.BadModel, "ViewCreator3d.createDefaultView: no 3D models found in iModel");

    const props = await this._createViewStateProps(models, options);
    const viewState = SpatialViewState.createFromProps(props, this._imodel);
    try {
      await viewState.load();
    } catch { }

    if (options?.standardViewId)
      viewState.setStandardRotation(options.standardViewId);
    const range = viewState.computeFitRange();
    viewState.lookAtVolume(range, options?.vpAspect);

    return viewState;
  }

  /**
   * Generates a view state props object for creating a view. Merges display styles with a seed view if the options.useSeedView is true
   * @param models Models to put in view props
   * @param options view creation options like camera On and skybox On
   */
  private async _createViewStateProps(models: Id64String[], options?: ViewCreator3dOptions): Promise<ViewStateProps> {
    // Use dictionary model in all props
    const dictionaryId = IModel.dictionaryId;
    const categories: Id64Array = await this._getAllCategories();

    // model extents
    const modelExtents = new Range3d();
    const modelProps = await this._imodel.models.queryModelRanges(models);

    for (const props of modelProps)
      modelExtents.union(Range3d.fromJSON(props), modelExtents);

    if (modelExtents.isNull)
      modelExtents.setFrom(this._imodel.projectExtents);

    let originX = modelExtents.low.x;
    let originY = modelExtents.low.y;
    const originZ = modelExtents.low.z;
    let deltaX = modelExtents.xLength();
    let deltaY = modelExtents.yLength();
    const deltaZ = modelExtents.zLength();

    // if vp aspect given, update model extents to fit view
    if (options?.vpAspect) {
      const modelAspect = deltaY / deltaX;

      if (modelAspect > options.vpAspect) {
        const xFix = deltaY / options.vpAspect;
        originX = originX - xFix / 2;
        deltaX = deltaX + xFix;
      } else if (modelAspect < options.vpAspect) {
        const yFix = deltaX * options.vpAspect;
        originY = originY - yFix / 2;
        deltaY = deltaY + yFix;
      }
    }

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
    const cameraOn = options?.cameraOn ? options.cameraOn : false;
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
      classFullName: "BisCore:DisplayStyle",
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
            backgroundMap: this._imodel.isGeoLocated,
          },
          environment:
            options !== undefined &&
              options.skyboxOn !== undefined &&
              options.skyboxOn
              ? new Environment({ sky: { display: true } }).toJSON()
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
    return options?.useSeedView ? this._mergeSeedView(viewStateProps) : viewStateProps;
  }

  /**
   * Merges a seed view in the iModel with the passed view state props. It will be a no-op if there are no default 3D views in the iModel
   * @param viewStateProps Input view props to be merged
   */
  private async _mergeSeedView(viewStateProps: ViewStateProps): Promise<ViewStateProps> {
    const viewId = await this._getDefaultViewId();
    // Handle iModels without any default view id
    if (viewId === undefined)
      return viewStateProps;

    const seedViewState = (await this._imodel.views.load(viewId) as SpatialViewState);
    const seedViewStateProps = {
      categorySelectorProps: seedViewState.categorySelector.toJSON(),
      modelSelectorProps: seedViewState.modelSelector.toJSON(),
      viewDefinitionProps: seedViewState.toJSON(),
      displayStyleProps: seedViewState.displayStyle.toJSON(),
    };
    const mergedDisplayProps = seedViewStateProps.displayStyleProps;
    if (mergedDisplayProps.jsonProperties !== undefined) {
      mergedDisplayProps.jsonProperties.styles = {
        ...mergedDisplayProps.jsonProperties.styles,
        ...viewStateProps.displayStyleProps.jsonProperties!.styles,
      };
    }

    return { ...seedViewStateProps, ...viewStateProps, displayStyleProps: mergedDisplayProps };
  }

  /**
   * Get ID of default view.
   */
  private async _getDefaultViewId(): Promise<Id64String | undefined> {
    const viewId = await this._imodel.views.queryDefaultViewId();
    const params: ViewQueryParams = {};
    params.from = SpatialViewState.classFullName;
    params.where = `ECInstanceId=${viewId}`;

    // Check validity of default view
    const viewProps = await IModelReadRpcInterface.getClient().queryElementProps(this._imodel.getRpcProps(), params);
    if (viewProps.length === 0) {
      // Return the first view we can find
      const viewList = await this._imodel.views.getViewList({ wantPrivate: false });
      if (viewList.length === 0)
        return undefined;

      const spatialViewList = viewList.filter((value: IModelConnection.ViewSpec) => value.class.indexOf("Spatial") !== -1);
      if (spatialViewList.length === 0)
        return undefined;

      return spatialViewList[0].id;
    }

    return viewId;
  }

  /**
   * Get all categories containing elements
   */
  private async _getAllCategories(): Promise<Id64Array> {
    // Only use categories with elements in them
    const query = `SELECT DISTINCT Category.Id AS id FROM BisCore.GeometricElement3d WHERE Category.Id IN (SELECT ECInstanceId FROM BisCore.SpatialCategory)`;
    const categories: Id64Array = await this._executeQuery(query);

    return categories;
  }

  /**
   * Get all PhysicalModel ids in the connection
   */
  private async _getAllModels(): Promise<Id64Array> {
    let query = "SELECT ECInstanceId FROM Bis.GeometricModel3D WHERE IsPrivate = false AND IsTemplate = false AND isNotSpatiallyLocated = false";
    let models = [];
    try {
      models = await this._executeQuery(query);
    } catch {
      // possible that the isNotSpatiallyLocated property is not available in the iModel's schema
      query = "SELECT ECInstanceId FROM Bis.GeometricModel3D WHERE IsPrivate = false AND IsTemplate = false";
      models = await this._executeQuery(query);
    }

    return models;
  }

  /**
   * Helper function to execute ECSql queries.
   */
  private _executeQuery = async (query: string) => {
    const rows = [];
    for await (const row of this._imodel.query(query))
      rows.push(row.id);

    return rows;
  };
}
