/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModels */

import { Id64, Id64Arg, Id64Props, Id64Set, Logger, OpenMode, BentleyStatus, BeEvent, assert } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import {
  CodeSpec, ElementProps, EntityQueryParams, IModel, IModelToken, IModelError, IModelStatus, ModelProps, ModelQueryParams,
  IModelVersion, AxisAlignedBox3d, ViewQueryParams, ViewDefinitionProps, FontMap,
  IModelReadRpcInterface, IModelWriteRpcInterface, StandaloneIModelRpcInterface, IModelTileRpcInterface,
  TileId, TileTreeProps, TileProps,
} from "@bentley/imodeljs-common";
import { IModelUnitTestRpcInterface } from "@bentley/imodeljs-common/lib/rpc/IModelUnitTestRpcInterface"; // not part of the "barrel"
import { HilitedSet, SelectionSet } from "./SelectionSet";
import { ViewState, SpatialViewState, OrthographicViewState, ViewState2d, DrawingViewState, SheetViewState } from "./ViewState";
import { CategorySelectorState } from "./CategorySelectorState";
import { DisplayStyle3dState, DisplayStyle2dState } from "./DisplayStyleState";
import { ModelSelectorState } from "./ModelSelectorState";
import { ModelState, SpatialModelState, SectionDrawingModelState, DrawingModelState, SheetModelState } from "./ModelState";
import { IModelApp } from "./IModelApp";

const loggingCategory = "imodeljs-frontend.IModelConnection";

/** A connection to an iModel database hosted on the backend. */
export class IModelConnection extends IModel {
  /** The [[Model]] entities in this IModel */
  public readonly models: IModelConnectionModels;
  public readonly elements: IModelConnectionElements;
  public readonly codeSpecs: IModelConnectionCodeSpecs;
  public readonly views: IModelConnectionViews;
  public readonly hilited: HilitedSet;
  public readonly selectionSet: SelectionSet;
  public readonly tiles: IModelConnectionTiles;
  public readonly openMode: OpenMode;

  /** Check if this iModel has been opened read-only or not. */
  public isReadonly(): boolean { return this.openMode === OpenMode.Readonly; }

  /**
   * Event called immediately before an IModelConnection is closed.
   * <em>note:</em> Be careful not to perform any asynchronous operations on the IModelConnection because it will close before they are processed.
   */
  public static readonly onClose = new BeEvent<(_imodel: IModelConnection) => void>();

  /** The font map for this IModelConnection. Only valid after calling #loadFontMap and waiting for the returned promise to be fulfilled. */
  public fontMap?: FontMap;

  /**
   * Load the FontMap for this IModelConnection.
   * @returns Returns a Promise<FontMap> that is fulfilled when the FontMap member of this IModelConnection is valid.
   */
  public async loadFontMap(): Promise<FontMap> {
    return this.fontMap || (this.fontMap = new FontMap(JSON.parse(await IModelReadRpcInterface.getClient().readFontJson(this.iModelToken))));
  }

  private constructor(iModel: IModel, openMode: OpenMode) {
    super(iModel.iModelToken);
    super.initialize(iModel.name, iModel);
    this.openMode = openMode;
    this.models = new IModelConnectionModels(this);
    this.elements = new IModelConnectionElements(this);
    this.codeSpecs = new IModelConnectionCodeSpecs(this);
    this.views = new IModelConnectionViews(this);
    this.hilited = new HilitedSet(this);
    this.selectionSet = new SelectionSet(this);
    this.tiles = new IModelConnectionTiles(this);
  }

  /** Open an IModelConnection to an iModel */
  public static async open(accessToken: AccessToken, contextId: string, iModelId: string, openMode: OpenMode = OpenMode.Readonly, version: IModelVersion = IModelVersion.latest()): Promise<IModelConnection> {
    if (!IModelApp.initialized)
      throw new IModelError(BentleyStatus.ERROR, "Call IModelApp.startup() before calling open");

    let changeSetId: string = await version.evaluateChangeSet(accessToken, iModelId, IModelApp.iModelHubClient);
    if (!changeSetId)
      changeSetId = "0"; // The first version is arbitrarily setup to have changeSetId = "0" since it is required by the RPC interface API.

    const iModelToken = new IModelToken(undefined, contextId, iModelId, changeSetId);
    let openResponse: IModel;
    if (openMode === OpenMode.ReadWrite)
      openResponse = await IModelWriteRpcInterface.getClient().openForWrite(accessToken, iModelToken);
    else
      openResponse = await IModelReadRpcInterface.getClient().openForRead(accessToken, iModelToken);

    Logger.logTrace(loggingCategory, "IModelConnection.open", () => ({ iModelId, openMode, changeSetId }));

    // todo: Setup userId if it is a readWrite open - this is necessary to reopen the same exact briefcase at the backend
    return new IModelConnection(openResponse, openMode);
  }

  /** Close this IModelConnection */
  public async close(accessToken: AccessToken): Promise<void> {
    if (!this.iModelToken)
      return;
    IModelConnection.onClose.raiseEvent(this);
    try {
      await IModelReadRpcInterface.getClient().close(accessToken, this.iModelToken);
    } finally {
      (this.token as any) = undefined; // prevent closed connection from being reused
    }
  }

  /**
   * Open an IModelConnection to a standalone iModel (not managed by iModelHub) from a file name that is resolved by the backend.
   * This method is intended for desktop or mobile applications and should not be used for web applications.
   */
  public static async openStandalone(fileName: string, openMode = OpenMode.Readonly): Promise<IModelConnection> {
    const openResponse: IModel = await StandaloneIModelRpcInterface.getClient().openStandalone(fileName, openMode);
    Logger.logTrace(loggingCategory, "IModelConnection.openStandalone", () => ({ fileName, openMode }));
    return new IModelConnection(openResponse, openMode);
  }

  /** Close this standalone IModelConnection */
  public async closeStandalone(): Promise<void> {
    if (!this.iModelToken)
      return;
    IModelConnection.onClose.raiseEvent(this);
    try {
      await StandaloneIModelRpcInterface.getClient().closeStandalone(this.iModelToken);
    } finally {
      (this.token as any) = undefined; // prevent closed connection from being reused
    }
  }

  /**
   * Execute a query against the iModel.
   * The result of the query is returned as an array of JavaScript objects where every array element represents an
   * [ECSQL row]($docs/learning/ECSQLRowFormat).
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/frontend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/frontend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL to execute
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * The section "[iModelJs Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" describes the
   * iModelJs types to be used for the different ECSQL parameter types.
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameters.
   * @returns Returns the query result as an array of the resulting rows or an empty array if the query has returned no rows
   * @throws [IModelError]($common) if the ECSQL is invalid
   */
  public async executeQuery(ecsql: string, bindings?: any[] | object): Promise<any[]> {
    Logger.logTrace(loggingCategory, "IModelConnection.executeQuery", () => ({ iModelId: this.iModelToken.iModelId, ecsql, bindings }));
    return await IModelReadRpcInterface.getClient().executeQuery(this.iModelToken, ecsql, bindings);
  }

  /** query for a set of ids that satisfy the supplied query params  */
  public async queryEntityIds(params: EntityQueryParams): Promise<Id64Set> { return IModelReadRpcInterface.getClient().queryEntityIds(this.iModelToken, params); }

  /**
   * Update the project extents of this iModel.
   * @param newExtents The new project extents as an AxisAlignedBox3d
   * @throws [[IModelError]] if the IModelConnection is read-only or there is a problem updating the extents.
   */
  public async updateProjectExtents(newExtents: AxisAlignedBox3d): Promise<void> {
    Logger.logTrace(loggingCategory, "IModelConnection.updateProjectExtents", () => ({ iModelId: this.iModelToken.iModelId, newExtents }));
    if (OpenMode.ReadWrite !== this.openMode)
      return Promise.reject(new IModelError(IModelStatus.ReadOnly));
    await IModelWriteRpcInterface.getClient().updateProjectExtents(this.iModelToken, newExtents);
  }

  /**
   * Commit pending changes to this iModel
   * @param description Optional description of the changes
   * @throws [[IModelError]] if the IModelConnection is read-only or there is a problem saving changes.
   */
  public async saveChanges(description?: string): Promise<void> {
    Logger.logTrace(loggingCategory, "IModelConnection.saveChanges", () => ({ iModelId: this.iModelToken.iModelId, description }));
    if (OpenMode.ReadWrite !== this.openMode)
      return Promise.reject(new IModelError(IModelStatus.ReadOnly));
    return await IModelWriteRpcInterface.getClient().saveChanges(this.iModelToken, description);
  }

  /**
   * Determines whether the *Change Cache file* is attached to this iModel or not.
   *
   * See also [Change Summary Overview]($docs/learning/ChangeSummaries)
   * @returns Returns true if the *Change Cache file* is attached to the iModel. false otherwise
   */
  public async isChangeCacheAttached(): Promise<boolean> { return await IModelReadRpcInterface.getClient().isChangeCacheAttached(this.iModelToken); }

  /**
   * Attaches the *Change Cache file* to this iModel if it hasn't been attached yet.
   *
   * A new *Change Cache file* will be created for the iModel if it hasn't existed before.
   *
   * See also [Change Summary Overview]($docs/learning/ChangeSummaries)
   * @throws [IModelError]($common) if a Change Cache file has already been attached before.
   */
  public async attachChangeCache(): Promise<void> { await IModelReadRpcInterface.getClient().attachChangeCache(this.iModelToken); }

  /**
   * Detaches the *Change Cache file* to this iModel if it had been attached before.
   * > You do not have to check whether a Change Cache file had been attached before. The
   * > method does not do anything, if no Change Cache is attached.
   *
   * See also [Change Summary Overview]($docs/learning/ChangeSummaries)
   */
  public async detachChangeCache(): Promise<void> { await IModelReadRpcInterface.getClient().detachChangeCache(this.iModelToken); }

  /**
   * Execute a test by name
   * @param testName The name of the test to execute
   * @param params A JSON string containing all parameters the test requires
   * @hidden
   */
  public async executeTest(testName: string, params: any): Promise<any> { return IModelUnitTestRpcInterface.getClient().executeTest(this.iModelToken, testName, params); }
}

/** The collection of models for an [[IModelConnection]]. */
export class IModelConnectionModels {
  public loaded = new Map<string, ModelState>();

  /** @hidden */
  constructor(private _iModel: IModelConnection) { }

  /** The Id of the repository model. */
  public get repositoryModelId(): Id64 { return new Id64("0x1"); }

  /** Get a batch of [[ModelProps]] given a list of model ids. */
  public async getProps(modelIds: Id64Arg): Promise<ModelProps[]> {
    return await IModelReadRpcInterface.getClient().getModelProps(this._iModel.iModelToken, Id64.toIdSet(modelIds));
  }

  public getLoaded(id: string): ModelState | undefined { return this.loaded.get(id); }

  /** load a set of models by ModelId. After calling this method, you may get the ModelState objects by calling getLoadedModel. */
  public async load(modelIds: Id64Arg): Promise<void> {
    const notLoaded = new Set<string>();
    Id64.toIdSet(modelIds).forEach((id) => {
      const loaded = this.getLoaded(id);
      if (!loaded)
        notLoaded.add(id);
    });

    if (notLoaded.size === 0)
      return; // all requested models are already loaded

    try {
      (await this.getProps(notLoaded)).forEach((props) => {
        const names = props.classFullName.split(":"); // fullClassName is in format schema:className.
        if (names.length < 2)
          return;
        let ctor = ModelState;
        switch (names[1]) {
          case "PhysicalModel":
          case "SpatialLocationModel":
          case "WebMercatorModel":
            ctor = SpatialModelState;
            break;
          case "SectionDrawingModel":
            ctor = SectionDrawingModelState;
            break;
          case "DrawingModel":
            ctor = DrawingModelState;
            break;
          case "SheetModel":
            ctor = SheetModelState;
            break;
        }
        const modelState = new ctor(props, this._iModel);
        this.loaded.set(modelState.id.value, modelState);
      });
    } catch (err) { } // ignore error, we had nothing to do.
  }

  /**
   * Query for a set of ModelProps of the specified ModelQueryParams
   */
  public async queryProps(queryParams: ModelQueryParams): Promise<ModelProps[]> {
    const params: ModelQueryParams = Object.assign({}, queryParams); // make a copy
    params.from = queryParams.from || ModelState.sqlName; // use "BisCore.Model" as default class name
    params.where = queryParams.where || "";
    if (!queryParams.wantPrivate) {
      if (params.where.length > 0) params.where += " AND ";
      params.where += "IsPrivate=FALSE ";
    }
    if (!queryParams.wantTemplate) {
      if (params.where.length > 0) params.where += " AND ";
      params.where += "IsTemplate=FALSE ";
    }
    return await IModelReadRpcInterface.getClient().queryModelProps(this._iModel.iModelToken, params);
  }
}

/** The collection of elements for an [[IModelConnection]]. */
export class IModelConnectionElements {
  /** @hidden */
  public constructor(private _iModel: IModelConnection) { }

  /** The Id of the root subject element. */
  public get rootSubjectId(): Id64 { return new Id64("0x1"); }

  /** get a set of element ids that satisfy a query */
  public async queryIds(params: EntityQueryParams): Promise<Id64Set> { return this._iModel.queryEntityIds(params); }

  /** Get a batch of [[ElementProps]] given one or more element ids. */
  public async getProps(arg: Id64Arg): Promise<ElementProps[]> {
    return await IModelReadRpcInterface.getClient().getElementProps(this._iModel.iModelToken, Id64.toIdSet(arg));
  }

  /** get a bach of [[ElementProps]] that satisfy a query */
  public async queryProps(params: EntityQueryParams): Promise<ElementProps[]> {
    return await IModelReadRpcInterface.getClient().queryElementProps(this._iModel.iModelToken, params);
  }

  /** Ask the backend to format (for presentation) the specified list of element ids. */
  public async formatElements(elementIds: Id64Arg): Promise<any[]> {
    return await IModelReadRpcInterface.getClient().formatElements(this._iModel.iModelToken, Id64.toIdSet(elementIds));
  }
}

/** The collection of [[CodeSpec]] entities for an [[IModelConnection]]. */
export class IModelConnectionCodeSpecs {
  private _loaded?: CodeSpec[];

  /** @hidden */
  constructor(private _iModel: IModelConnection) { }

  /** Loads all CodeSpec from the remote IModelDb. */
  private async _loadAllCodeSpecs(): Promise<void> {
    if (this._loaded)
      return;

    this._loaded = [];
    const codeSpecArray: any[] = await IModelReadRpcInterface.getClient().getAllCodeSpecs(this._iModel.iModelToken);
    for (const codeSpec of codeSpecArray) {
      this._loaded.push(new CodeSpec(this._iModel, new Id64(codeSpec.id), codeSpec.name, codeSpec.jsonProperties));
    }
  }

  /** Look up a CodeSpec by Id.
   * @param codeSpecId The Id of the CodeSpec to load
   * @returns The CodeSpec with the specified Id
   * @throws [[IModelError]] if the Id is invalid or if no CodeSpec with that Id could be found.
   */
  public async getById(codeSpecId: Id64): Promise<CodeSpec> {
    if (!codeSpecId.isValid())
      return Promise.reject(new IModelError(IModelStatus.InvalidId, "Invalid codeSpecId", Logger.logWarning, loggingCategory, () => ({ codeSpecId })));

    await this._loadAllCodeSpecs(); // ensure all codeSpecs have been downloaded
    const found: CodeSpec | undefined = this._loaded!.find((codeSpec: CodeSpec) => codeSpec.id.equals(codeSpecId));
    if (!found)
      return Promise.reject(new IModelError(IModelStatus.NotFound, "CodeSpec not found", Logger.logWarning, loggingCategory));

    return found;
  }

  /** Look up a CodeSpec by name.
   * @param name The name of the CodeSpec to load
   * @returns The CodeSpec with the specified name
   * @throws [[IModelError]] if no CodeSpec with the specified name could be found.
   */
  public async getByName(name: string): Promise<CodeSpec> {
    await this._loadAllCodeSpecs(); // ensure all codeSpecs have been downloaded
    const found: CodeSpec | undefined = this._loaded!.find((codeSpec: CodeSpec) => codeSpec.name === name);
    if (!found)
      return Promise.reject(new IModelError(IModelStatus.NotFound, "CodeSpec not found", Logger.logWarning, loggingCategory));

    return found;
  }
}

/** The collection of views for an [[IModelConnection]]. */
export class IModelConnectionViews {
  /** @hidden */
  constructor(private _iModel: IModelConnection) { }

  /**
   * Query for an array of ViewDefinitionProps
   * @param queryParams Query parameters specifying the views to return
   */
  public async queryProps(queryParams: ViewQueryParams): Promise<ViewDefinitionProps[]> {
    const params: ViewQueryParams = Object.assign({}, queryParams); // make a copy
    params.from = queryParams.from || ViewState.sqlName; // use "BisCore.ViewDefinition" as default class name
    params.where = queryParams.where || "";
    if (!queryParams.wantPrivate) {
      if (params.where.length > 0) params.where += " AND ";
      params.where += "IsPrivate=FALSE ";
    }
    const viewProps = await IModelReadRpcInterface.getClient().queryElementProps(this._iModel.iModelToken, params);
    assert((viewProps.length === 0) || ("categorySelectorId" in viewProps[0]), "invalid view definition");  // spot check that the first returned element is-a ViewDefinitionProps
    return viewProps as ViewDefinitionProps[];
  }

  /** Load a [[ViewState]] object from the specified [[ViewDefinition]] id. */
  public async load(viewDefinitionId: Id64Props): Promise<ViewState> {
    const viewStateData: any = await IModelReadRpcInterface.getClient().getViewStateData(this._iModel.iModelToken, typeof viewDefinitionId === "string" ? viewDefinitionId : viewDefinitionId.value);
    const categorySelectorState = new CategorySelectorState(viewStateData.categorySelectorProps, this._iModel);

    let viewState: ViewState;
    switch (viewStateData.viewDefinitionProps.classFullName) {
      case SpatialViewState.getClassFullName(): {
        const displayStyleState = new DisplayStyle3dState(viewStateData.displayStyleProps, this._iModel);
        const modelSelectorState = new ModelSelectorState(viewStateData.modelSelectorProps, this._iModel);
        viewState = new SpatialViewState(viewStateData.viewDefinitionProps, this._iModel, categorySelectorState, displayStyleState, modelSelectorState);
        break;
      }
      case OrthographicViewState.getClassFullName(): {
        const displayStyleState = new DisplayStyle3dState(viewStateData.displayStyleProps, this._iModel);
        const modelSelectorState = new ModelSelectorState(viewStateData.modelSelectorProps, this._iModel);
        viewState = new OrthographicViewState(viewStateData.viewDefinitionProps, this._iModel, categorySelectorState, displayStyleState, modelSelectorState);
        break;
      }
      case ViewState2d.getClassFullName(): {
        const displayStyleState = new DisplayStyle2dState(viewStateData.displayStyleProps, this._iModel);
        viewState = new ViewState2d(viewStateData.viewDefinitionProps, this._iModel, categorySelectorState, displayStyleState);
        break;
      }
      case DrawingViewState.getClassFullName(): {
        const displayStyleState = new DisplayStyle2dState(viewStateData.displayStyleProps, this._iModel);
        viewState = new DrawingViewState(viewStateData.viewDefinitionProps, this._iModel, categorySelectorState, displayStyleState);
        break;
      }
      case SheetViewState.getClassFullName(): {
        const displayStyleState = new DisplayStyle2dState(viewStateData.displayStyleProps, this._iModel);
        viewState = new SheetViewState(viewStateData.viewDefinitionProps, this._iModel, categorySelectorState, displayStyleState);
        break;
      }
      default:
        return Promise.reject(new IModelError(IModelStatus.WrongClass, "Invalid ViewState class", Logger.logError, loggingCategory, () => viewStateData));
    }

    await viewState.load(); // loads models for ModelSelector
    return viewState;
  }
}

/** @hidden */
// NB: Very WIP.
export class IModelConnectionTiles {
  private _iModel: IModelConnection;

  /** @hidden */
  constructor(iModel: IModelConnection) {
    this._iModel = iModel;
    assert(undefined !== this._iModel); // unused variable...
  }

  public async getTileTreeProps(ids: Id64Set): Promise<TileTreeProps[]> {
    return IModelTileRpcInterface.getClient().getTileTreeProps(this._iModel.iModelToken, ids);
  }

  public async getTileProps(ids: TileId[]): Promise<TileProps[]> {
    return IModelTileRpcInterface.getClient().getTileProps(this._iModel.iModelToken, ids);
  }
}
