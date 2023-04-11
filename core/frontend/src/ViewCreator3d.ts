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

import { CompressedId64Set, Id64Array, Id64String } from "@itwin/core-bentley";
import {
  Camera, CategorySelectorProps, Code, CustomViewState3dProps, DisplayStyle3dProps, Environment, IModel, IModelReadRpcInterface, ModelSelectorProps,
  QueryRowFormat, RenderMode, ViewDefinition3dProps, ViewQueryParams, ViewStateProps,
} from "@itwin/core-common";
import { Range3d } from "@itwin/core-geometry";
import { StandardViewId } from "./StandardView";
import { IModelConnection } from "./IModelConnection";
import { ViewState } from "./ViewState";
import { SpatialViewState } from "./SpatialViewState";

/** Options for creating a [[ViewState3d]] via [[ViewCreator3d]].
 *  @public
 * @extensions
*/
export interface ViewCreator3dOptions {
  /** Turn the [[Camera]] on to produce a perspective view.
   * Default: true
   */
  cameraOn?: boolean;
  /** Enables display of a [[SkyBox]] in the view. */
  skyboxOn?: boolean;
  /** Orients the view to one of the standard view rotations. */
  standardViewId?: StandardViewId;
  /** Merge in props from a persistent "seed" view obtained from the iModel.
   * @note The selection of the seed view is somewhat arbitrary, and the contents and styling of that view are unpredictable, so this option is not recommended.
   */
  useSeedView?: boolean;
  /** The desired aspect ratio of the [[Viewport]] in which the view is to be displayed.
   * This is used to adjust the view's frustum so that the viewed models are better centered within the viewport.
   */
  vpAspect?: number;
  /** Indicates that geometry belonging to every [SubCategory]($backend) should be visible within the view.
   * Each subcategory has a [SubCategoryAppearance]($common) that specifies how its geometry is displayed. This includes a [SubCategoryAppearance.invisible]($common) property that,
   * when set to `true`, indicates the geometry should not be displayed at all. A view can override the appearances of any subcategories using a [SubCategoryOverride]($common).
   * If `allSubCategoriesVisible` is `true`, [[ViewCreator3d]] will apply such an override to every viewed subcategory to change [SubCategoryOverride.invisible]($common) to `false`, making
   * every subcategory visible.
   * @note Subcategories are typically set to invisible by default for a reason.
   * Forcing them all to be visible may produce undesirable results, such as z-fighting between geometry on different subcategories that are not intended to be viewed together.
   */
  allSubCategoriesVisible?: boolean;
}

/**
 * API for creating a 3D default [[ViewState3d]] for an iModel. @see [[ViewCreator2d]] to create a view for a 2d model.
 * Example usage:
 * ```ts
 * const viewCreator = new ViewCreator3d(imodel);
 * const defaultView = await viewCreator.createDefaultView({skyboxOn: true});
 * ```
 * @public
 * @extensions
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
  public async createDefaultView(options?: ViewCreator3dOptions, modelIds?: Id64String[]): Promise<ViewState> {
    const serializedProps: CustomViewState3dProps = await IModelReadRpcInterface.getClientForRouting(this._imodel.routingContext.token).getCustomViewState3dData(this._imodel.getRpcProps(),
      modelIds === undefined ? {} : { modelIds: CompressedId64Set.sortAndCompress(modelIds) });
    const props = await this._createViewStateProps(
      CompressedId64Set.decompressArray(serializedProps.modelIds),
      CompressedId64Set.decompressArray(serializedProps.categoryIds),
      Range3d.fromJSON(serializedProps.modelExtents),
      options);

    const viewState = SpatialViewState.createFromProps(props, this._imodel);
    try {
      await viewState.load();
    } catch {
    }

    if (options?.standardViewId)
      viewState.setStandardRotation(options.standardViewId);

    if (options?.allSubCategoriesVisible)
      viewState.displayStyle.enableAllLoadedSubCategories(viewState.categorySelector.categories);

    const range = viewState.computeFitRange();
    viewState.lookAtVolume(range, options?.vpAspect);

    return viewState;
  }

  /**
   * Generates a view state props object for creating a view. Merges display styles with a seed view if the options.useSeedView is true
   * @param models Models to put in view props
   * @param options view creation options like camera On and skybox On
   */
  private async _createViewStateProps(models: Id64Array, categories: Id64Array, modelExtents: Range3d, options?: ViewCreator3dOptions): Promise<ViewStateProps> {
    // Use dictionary model in all props
    const dictionaryId = IModel.dictionaryId;

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
            backgroundMap: this._imodel.isGeoLocated,
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
   * Helper function to execute ECSql queries.
   */
  private _executeQuery = async (query: string) => {
    const rows = [];
    for await (const row of this._imodel.createQueryReader(query, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }))
      rows.push(row.id);

    return rows;
  };
}
