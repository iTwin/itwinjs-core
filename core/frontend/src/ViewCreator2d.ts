/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Views
 */

/*
API for creating a 2D view from a given modelId and modelType (classFullName).
Additional options (such as background color) can be passed during view creation.
*/

import { Id64Array, Id64String, IModelStatus, Logger } from "@bentley/bentleyjs-core";
import { CategorySelectorProps, Code, ColorDef, DisplayStyleProps, IModel, IModelError, ModelSelectorProps, SheetProps, ViewDefinition2dProps, ViewStateProps } from "@bentley/imodeljs-common";
import { Range3d } from "@bentley/geometry-core";
import { DrawingModelState, SectionDrawingModelState, SheetModelState } from "./ModelState";
import { IModelConnection } from "./IModelConnection";
import { ViewState, ViewState2d } from "./ViewState";
import { DrawingViewState } from "./DrawingViewState";
import { SheetViewState } from "./SheetViewState";
import { loggerCategory } from "./imodeljs-frontend";

/** @beta Options for creating a 2d [[ViewState]] via [[ViewCreator2d]] */
export interface ViewCreator2dOptions {
  /** vpAspect aspect ratio of vp to create fit view. */
  vpAspect?: number;
  /** background color for view (default is white). */
  bgColor?: ColorDef;
  /** if iModel already has a view for given 2D model, merge in its props */
  useSeedView?: boolean;
}

/** @beta API for creating a [[ViewState]] for a 2D model ([[GeometricModel2dState]]).
 * ```ts
 * const viewCreator = new ViewCreator2d(imodel);
 * const models = await imodel.models.queryProps({ from: "BisCore.GeometricModel2d" });
 * if (models.length > 0)
 * const view = await viewCreator.createViewForModel(models[0].id!, models[0].classFullName);
 * ```
 */
export class ViewCreator2d {

  // Types of 2D models the API supports
  private static _drawingModelClasses = [DrawingModelState.classFullName, SectionDrawingModelState.classFullName];
  private static _sheetModelClasses = [SheetModelState.classFullName];

  /**
   * Constructs ViewCreator2d with [[iModelConnection]].
   * @param _imodel [[iModelConnection]] to query for categories and/or models.
   */
  constructor(private _imodel: IModelConnection) { }

  /**
   * Checks to see if given model is of [[DrawingModelState]].
   * @param modelType classFullName of model.
   */
  public static isDrawingModelClass(modelType: string) {
    if (ViewCreator2d._drawingModelClasses.includes(modelType)) {
      return true;
    }
    return false;
  }

  /**
   * Checks to see if given model is of [[SheetModelState]].
   * @param modelType classFullName of model.
   */
  public static isSheetModelClass(modelType: string) {
    if (ViewCreator2d._sheetModelClasses.includes(modelType)) {
      return true;
    }
    return false;
  }

  /**
   * Creates and returns view for given 2D model.
   * @param modelId of target 2D model.
   * @param modelType classFullName of target 2D model.
   * @param options for view creation.
   * @throws [IModelError]($common) if modelType is not supported.
   */
  public async createViewForModel(modelId: Id64String, modelType: string, options?: ViewCreator2dOptions): Promise<ViewState> {
    const baseClassName = await this._imodel.findClassFor(modelType, undefined);

    if (baseClassName === undefined)
      throw new IModelError(IModelStatus.WrongClass, "ViewCreator2d.getViewForModel: modelType is invalid", Logger.logError, loggerCategory, () => ({ modelType, modelId }));

    const viewState = await this._createViewState2d(modelId, baseClassName.classFullName, options);
    try {
      await viewState.load();
    } catch { }

    return viewState;
  }

  /**
   * Creates view from any 2D model type (Drawing/SectionDrawing/Sheet)
   * @param modelId of target model.
   * @param modelType classFullName of target 2D model.
   * @param options for view creation.
   * @throws [IModelError]($common) if modelType is not supported.
   */
  private async _createViewState2d(modelId: Id64String, modelType: string, options?: ViewCreator2dOptions): Promise<ViewState2d> {
    let viewState: ViewState2d;
    if (ViewCreator2d.isDrawingModelClass(modelType)) {
      const props = await this._createViewStateProps(modelId, options);
      viewState = DrawingViewState.createFromProps(props, this._imodel);
    } else if (ViewCreator2d.isSheetModelClass(modelType)) {
      let props = await this._createViewStateProps(modelId, options);
      props = await this._addSheetViewProps(modelId, props);
      viewState = SheetViewState.createFromProps(props, this._imodel);
    } else
      throw new IModelError(IModelStatus.WrongClass, "ViewCreator2d._createViewState2d: modelType not supported", Logger.logError, loggerCategory, () => ({ modelType, modelId }));

    return viewState;
  }

  /**
   * Creates ViewStateProps for the model. ViewStateProps are composed of the 4 sets of Props below.
   * @param modelId of target model.
   * @param options for view creation.
   */
  private _createViewStateProps = async (modelId: Id64String, options?: ViewCreator2dOptions): Promise<ViewStateProps> => {
    // Use dictionary model in all props
    const dictionaryId = IModel.dictionaryId;
    const categories = await this._getAllCategories();

    // Get bg color from options or default to white
    const bgColor: ColorDef = options?.bgColor ? options.bgColor : ColorDef.white;

    // model extents
    const modelProps = await this._imodel.models.queryModelRanges(modelId);
    const modelExtents = Range3d.fromJSON(modelProps[0]);
    let originX = modelExtents.low.x;
    let originY = modelExtents.low.y;
    let deltaX = modelExtents.xLength();
    let deltaY = modelExtents.yLength();

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

    const modelSelectorProps: ModelSelectorProps = {
      models: [modelId],
      code: Code.createEmpty(),
      model: dictionaryId,
      classFullName: "BisCore:ModelSelector",
    };

    const categorySelectorProps: CategorySelectorProps = {
      categories,
      code: Code.createEmpty(),
      model: dictionaryId,
      classFullName: "BisCore:CategorySelector",
    };

    const viewDefinitionProps: ViewDefinition2dProps = {
      baseModelId: modelId,
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
      classFullName: "BisCore:DisplayStyle",
      jsonProperties: {
        styles: {
          backgroundColor: bgColor.tbgr,
        },
      },
    };

    const viewStateProps: ViewStateProps = {
      displayStyleProps,
      categorySelectorProps,
      modelSelectorProps,
      viewDefinitionProps,
      modelExtents,
    };

    // merge seed view props if needed
    return options?.useSeedView ? this._mergeSeedView(modelId, viewStateProps) : viewStateProps;
  };

  /**
   * Adds Sheet view props to given view props.
   * @param modelId of target model.
   * @param props input ViewStateProps.
   */
  private async _addSheetViewProps(modelId: Id64String, props: ViewStateProps) {
    let width = 0;
    let height = 0;
    for await (const row of this._imodel.query(`SELECT Width, Height FROM bis.Sheet WHERE ECInstanceId = ${modelId}`)) {
      width = row.width as number;
      height = row.height as number;
      break;
    }
    const sheetProps: SheetProps = {
      model: modelId,
      code: { spec: "", scope: "" },
      classFullName: "DrawingSheetModel",
      height,
      width,
    };

    props.sheetAttachments = await this._getSheetAttachments(modelId);
    props.sheetProps = sheetProps;

    return props;
  }

  /**
    * Merges a seed view in the iModel with the passed view state props. It will be a no-op if there are no 2D views for target model.
    * @param modelId of target model.
    * @param props Input view props to be merged
    */
  private async _mergeSeedView(modelId: Id64String, props: ViewStateProps): Promise<ViewStateProps> {
    const viewDefinitionId = await this._getViewDefinitionsIdForModel(modelId);
    // Return incase no viewDefinition found.
    if (viewDefinitionId === undefined)
      return props;

    const seedViewState = (await this._imodel.views.load(viewDefinitionId));
    const seedViewStateProps: ViewStateProps = {
      categorySelectorProps: seedViewState.categorySelector.toJSON(),
      viewDefinitionProps: seedViewState.toJSON(),
      displayStyleProps: seedViewState.displayStyle.toJSON(),
    };
    const mergedDisplayProps = seedViewStateProps.displayStyleProps;
    if (mergedDisplayProps.jsonProperties !== undefined) {
      mergedDisplayProps.jsonProperties.styles = {
        ...mergedDisplayProps.jsonProperties.styles,
        ...props.displayStyleProps.jsonProperties!.styles,
      };
    }

    return { ...seedViewStateProps, ...props, displayStyleProps: mergedDisplayProps };
  }

  /**
   * Get all view definitions for a given model.
   * @param modelId of target model.
   */
  private async _getViewDefinitionsIdForModel(modelId: Id64String): Promise<Id64String | undefined> {

    const query = `SELECT ECInstanceId from Bis.ViewDefinition2D WHERE BaseModel.Id = ${modelId} AND isPrivate = false LIMIT 1`;
    const viewDefinitionsId = await this._executeQuery(query);

    return (viewDefinitionsId.length) > 0 ? viewDefinitionsId[0] : undefined;
  }

  /**
   * Get all drawing categories
   */
  private async _getAllCategories(): Promise<Id64Array> {

    const query = "SELECT ECInstanceId from BisCore.DrawingCategory";
    const categories = await this._executeQuery(query);

    return categories;
  }

  /**
   * Get all sheet attachments
   * @param modelId of target model.
   */
  private async _getSheetAttachments(modelId: string): Promise<Id64Array> {

    const query = `SELECT ECInstanceId FROM Bis.ViewAttachment WHERE Model.Id = ${modelId}`;
    const attachments = await this._executeQuery(query);

    return attachments;
  }

  /**
   * Helper function to execute ECSql queries.
   * @param query statement to execute.
   */
  private _executeQuery = async (query: string) => {
    const rows = [];
    for await (const row of this._imodel.query(query))
      rows.push(row.id);

    return rows;
  };
}
