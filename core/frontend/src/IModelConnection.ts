/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module IModelConnection */

import { Id64, Id64Arg, Id64Props, Id64Set, TransientIdSequence, Logger, OpenMode, BentleyStatus, BeEvent, assert, Guid } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import {
  CodeSpec, ElementProps, EntityQueryParams, IModel, IModelToken, IModelError, IModelStatus, ModelProps, ModelQueryParams,
  IModelVersion, AxisAlignedBox3d, ViewQueryParams, ViewDefinitionProps, FontMap,
  IModelReadRpcInterface, IModelWriteRpcInterface, StandaloneIModelRpcInterface, IModelTileRpcInterface,
  TileId, TileTreeProps, TileProps, RpcRequest, RpcRequestEvent, RpcOperation, RpcNotFoundResponse, IModelNotFoundResponse, SnapRequestProps, SnapResponseProps,
} from "@bentley/imodeljs-common";
import { IModelUnitTestRpcInterface } from "@bentley/imodeljs-common/lib/rpc/IModelUnitTestRpcInterface"; // not part of the "barrel"
import { HilitedSet, SelectionSet } from "./SelectionSet";
import { ViewState, SpatialViewState, OrthographicViewState, ViewState2d, DrawingViewState, SheetViewState } from "./ViewState";
import { CategorySelectorState } from "./CategorySelectorState";
import { DisplayStyle3dState, DisplayStyle2dState } from "./DisplayStyleState";
import { ModelSelectorState } from "./ModelSelectorState";
import { ModelState } from "./ModelState";
import { IModelApp } from "./IModelApp";

const loggingCategory = "imodeljs-frontend.IModelConnection";

/** A connection to an iModel database hosted on the backend. */
export class IModelConnection extends IModel {
  /** The [[OpenMode]] used for this IModelConnection. */
  public readonly openMode: OpenMode;
  /** The [[ModelState]]s in this IModelConnection. */
  public readonly models: IModelConnection.Models;
  /** The [[ElementState]]s in this IModelConnection. */
  public readonly elements: IModelConnection.Elements;
  /** The [[CodeSpec]]s in this IModelConnection. */
  public readonly codeSpecs: IModelConnection.CodeSpecs;
  /** The [[ViewState]]s in this IModelConnection. */
  public readonly views: IModelConnection.Views;
  /** The set of currently hilited elements for this IModelConnection. */
  public readonly hilited: HilitedSet;
  /** The set of currently selected elements for this IModelConnection. */
  public readonly selectionSet: SelectionSet;
  /** The set of [[Tile]]s for this IModelConnection. */
  public readonly tiles: IModelConnection.Tiles;
  /** Generator for unique Ids of transient graphics for this IModelConnection. */
  public readonly transientIds = new TransientIdSequence();
  /** A unique Id of this IModelConnection. */
  public readonly connectionId = Guid.createValue();
  /** The maximum time (in milliseconds) to wait before timing out the request to open a connection to a new iModel */
  private static connectionTimeout: number = 5 * 60 * 1000;
  private openAccessToken?: AccessToken;

  /** Check the [[openMode]] of this IModelConnection to see if it was opened read-only. */
  public isReadonly(): boolean { return this.openMode === OpenMode.Readonly; }

  /**
   * Event called immediately before an IModelConnection is closed.
   * @note Be careful not to perform any asynchronous operations on the IModelConnection because it will close before they are processed.
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

  private constructor(iModel: IModel, openMode: OpenMode, accessToken?: AccessToken) {
    super(iModel.iModelToken);
    super.initialize(iModel.name, iModel);
    this.openMode = openMode;
    this.models = new IModelConnection.Models(this);
    this.elements = new IModelConnection.Elements(this);
    this.codeSpecs = new IModelConnection.CodeSpecs(this);
    this.views = new IModelConnection.Views(this);
    this.hilited = new HilitedSet(this);
    this.selectionSet = new SelectionSet(this);
    this.tiles = new IModelConnection.Tiles(this);
    this.openAccessToken = accessToken;
  }

  /** Open an IModelConnection to an iModel */
  public static async open(accessToken: AccessToken, contextId: string, iModelId: string, openMode: OpenMode = OpenMode.Readonly, version: IModelVersion = IModelVersion.latest()): Promise<IModelConnection> {
    if (!IModelApp.initialized)
      throw new IModelError(BentleyStatus.ERROR, "Call IModelApp.startup() before calling open");

    let changeSetId: string = await version.evaluateChangeSet(accessToken, iModelId, IModelApp.iModelClient);
    if (!changeSetId)
      changeSetId = "0"; // The first version is arbitrarily setup to have changeSetId = "0" since it is required by the RPC interface API.

    const iModelToken = new IModelToken(undefined, contextId, iModelId, changeSetId);
    const openResponse: IModel = await IModelConnection.callOpen(accessToken, iModelToken, openMode);
    const connection = new IModelConnection(openResponse, openMode, accessToken);
    RpcRequest.notFoundHandlers.addListener(connection.reopenConnectionHandler);
    return connection;
  }

  private static async callOpen(accessToken: AccessToken, iModelToken: IModelToken, openMode: OpenMode): Promise<IModel> {
    // Try opening the iModel repeatedly accommodating any pending responses from the backend
    // After the first attempt wait for 500 ms.On subsequent attempts, double the wait time the
    // timeout period has reached
    let connectionRetryTime: number = 500; // milliseconds
    connectionRetryTime = Math.min(connectionRetryTime, IModelConnection.connectionTimeout);

    let openForReadOperation: RpcOperation | undefined;
    let openForWriteOperation: RpcOperation | undefined;
    if (openMode === OpenMode.Readonly) {
      openForReadOperation = RpcOperation.lookup(IModelReadRpcInterface, "openForRead");
      if (!openForReadOperation)
        throw new IModelError(BentleyStatus.ERROR, "IModelReadRpcInterface.openForRead() is not available");
      openForReadOperation.policy.retryInterval = () => connectionRetryTime;
    } else {
      openForWriteOperation = RpcOperation.lookup(IModelWriteRpcInterface, "openForWrite");
      if (!openForWriteOperation)
        throw new IModelError(BentleyStatus.ERROR, "IModelWriteRpcInterface.openForWrite() is not available");
      openForWriteOperation.policy.retryInterval = () => connectionRetryTime;
    }

    Logger.logTrace(loggingCategory, `Received open request in IModelConnection.open`, () => ({ ...iModelToken, openMode }));
    Logger.logTrace(loggingCategory, `Setting open connection retry interval to ${connectionRetryTime} milliseconds in IModelConnection.open`, () => ({ ...iModelToken, openMode }));

    const startTime = Date.now();

    const removeListener = RpcRequest.events.addListener((type: RpcRequestEvent, request: RpcRequest) => {
      if (type !== RpcRequestEvent.PendingUpdateReceived)
        return;
      if (!(openForReadOperation && request.operation === openForReadOperation) && !(openForWriteOperation && request.operation === openForWriteOperation))
        return;

      Logger.logTrace(loggingCategory, "Received pending open notification in IModelConnection.open", () => ({ ...iModelToken, openMode }));

      if (Date.now() - startTime > IModelConnection.connectionTimeout) {
        Logger.logTrace(loggingCategory, `Timed out opening connection in IModelConnection.open (took longer than ${IModelConnection.connectionTimeout} milliseconds)`, () => ({ ...iModelToken, openMode }));
        throw new IModelError(BentleyStatus.ERROR, "Opening a connection was timed out"); // NEEDS_WORK: More specific error status
      }

      connectionRetryTime = connectionRetryTime * 2;
      request.retryInterval = connectionRetryTime;
      Logger.logTrace(loggingCategory, `Adjusted open connection retry interval to ${request.retryInterval} milliseconds in IModelConnection.open`, () => ({ ...iModelToken, openMode }));
    });

    let openResponse: IModel;
    try {
      if (openMode === OpenMode.ReadWrite)
        openResponse = await IModelWriteRpcInterface.getClient().openForWrite(accessToken, iModelToken);
      else
        openResponse = await IModelReadRpcInterface.getClient().openForRead(accessToken, iModelToken);
    } finally {
      removeListener();
    }

    Logger.logTrace(loggingCategory, "Completed open request in IModelConnection.open", () => ({ ...iModelToken, openMode }));
    return openResponse;
  }

  private reopenConnectionHandler = async (request: RpcRequest<RpcNotFoundResponse>, response: IModelNotFoundResponse, resubmit: () => void, reject: (reason: any) => void) => {
    if (!(response instanceof IModelNotFoundResponse))
      return;

    const iModelToken: IModelToken = request.parameters[0];
    if (this.token.key !== iModelToken.key)
      return; // The handler is called for a different connection than this

    try {
      Logger.logTrace(loggingCategory, "Attempting to reopen connection", () => ({ iModelId: iModelToken.iModelId, changeSetId: iModelToken.changeSetId, key: iModelToken.key }));
      const openResponse: IModel = await IModelConnection.callOpen(this.openAccessToken!, iModelToken, this.openMode);
      this.token = openResponse.iModelToken;
    } catch (error) {
      reject(error.message);
    }

    Logger.logTrace(loggingCategory, "Resubmitting original request after reopening connection", () => ({ iModelId: iModelToken.iModelId, changeSetId: iModelToken.changeSetId, key: iModelToken.key }));
    request.parameters[0] = this.token; // Modify the token of the original request before resubmitting it.
    resubmit();
  }

  /** Close this IModelConnection */
  public async close(accessToken: AccessToken): Promise<void> {
    if (!this.iModelToken)
      return;
    RpcRequest.notFoundHandlers.removeListener(this.reopenConnectionHandler);
    IModelConnection.onClose.raiseEvent(this);
    this.models.onIModelConnectionClose();  // free WebGL resources if rendering
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
    this.models.onIModelConnectionClose();  // free WebGL resources if rendering
    try {
      await StandaloneIModelRpcInterface.getClient().closeStandalone(this.iModelToken);
    } finally {
      (this.token as any) = undefined; // prevent closed connection from being reused
    }
  }

  /** Load a file from the native asset directory of the backend.
   * @param assetName Name of the asset file, with path relative to the *Assets* directory
   */
  public async loadNativeAsset(assetName: string): Promise<Uint8Array> {
    const val = await IModelReadRpcInterface.getClient().loadNativeAsset(this.iModelToken, assetName);
    return new Uint8Array(atob(val).split("").map((c) => c.charCodeAt(0)));
  }

  /**
   * Execute an ECSQL query against the iModel.
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

  /** Query for a set of element ids that satisfy the supplied query params  */
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

  private _snapPending = false;
  public async requestSnap(props: SnapRequestProps): Promise<SnapResponseProps> {
    this._snapPending = true; // save flag indicating we're in the process of generating a snap
    const response = IModelReadRpcInterface.getClient().requestSnap(this.iModelToken, this.connectionId, props);
    await response; // after snap completes, turn off flag
    this._snapPending = false;
    return response; // return fulfilled promise
  }
  public async cancelSnap(): Promise<void> {
    if (this._snapPending) { // if we're waiting for a snap, cancel it.
      this._snapPending = false;
      return IModelReadRpcInterface.getClient().cancelSnap(this.iModelToken, this.connectionId); // this will throw an exception in previous stack.
    }
  }
}

export namespace IModelConnection {

  /** The id/name/class of a ViewDefinition. Returned by [[IModelConnection.Views.getViewList]] */
  export interface ViewSpec {
    /** The element id of the ViewDefinition. This string may be passed to [[IModelConnection.Views.load]]. */
    id: string;
    /** The name of the view. This string may be used to create a list with the possible view names. */
    name: string;
    /** The fullClassName of the ViewDefinition. Useful for sorting the list of views. */
    class: string;
  }

  /** The collection of loaded ModelState objects for an [[IModelConnection]]. */
  export class Models {
    /** The set of loaded models for this IModelConnection, indexed by Id. */
    public loaded = new Map<string, ModelState>();

    /** Registry of className to ModelState class */
    private static _registry = new Map<string, typeof ModelState>();

    /** Register a class by classFullName */
    public static registerClass(className: string, classType: typeof ModelState) { this._registry.set(className, classType); }

    private static findClass(className: string) { return this._registry.get(className); }

    /** @hidden */
    constructor(private _iModel: IModelConnection) { }

    /** The Id of the [RepositoryModel]($backend). */
    public get repositoryModelId(): Id64 { return new Id64("0x1"); }

    /** Get a batch of [[ModelProps]] given a list of Model ids. */
    public async getProps(modelIds: Id64Arg): Promise<ModelProps[]> {
      return await IModelReadRpcInterface.getClient().getModelProps(this._iModel.iModelToken, Id64.toIdSet(modelIds));
    }

    public getLoaded(id: string): ModelState | undefined { return this.loaded.get(id); }

    /** Find the first base class of the given class that is registered. Then, register that ModelState as the handler of the given class so we won't need this method again for that class. */
    private async findRegisteredBaseClass(className: string): Promise<typeof ModelState> {
      let ctor = ModelState; // worst case, we don't find any registered base classes

      // wait until we get the full list of base classes from backend
      const baseClasses = await IModelReadRpcInterface.getClient().getClassHierarchy(this._iModel.iModelToken, className);
      // walk through the list until we find a registered base class
      baseClasses.some((baseClass: string) => {
        const test = Models.findClass(baseClass);
        if (test === undefined)
          return false; // nope, not registered

        ctor = test; // found it, save it
        Models.registerClass(className, ctor); // and register the fact that our starting class is handled by this ModelState subclass.
        return true; // stop
      });
      return ctor; // either the baseClass handler or ModelState if we didn't find a registered baseClass
    }

    /** load a set of models by Ids. After calling this method, you may get the ModelState objects by calling getLoadedModel. */
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
        (await this.getProps(notLoaded)).forEach(async (props) => {
          let ctor = Models.findClass(props.classFullName);
          if (undefined === ctor) // oops, this className doesn't have a registered handler. Walk through the baseClasses to find one
            ctor = await this.findRegisteredBaseClass(props.classFullName); // must wait for this
          const modelState = new ctor(props, this._iModel); // create a new instance of the appropriate ModelState subclass
          this.loaded.set(modelState.id.value, modelState); // save it in loaded set
        });
      } catch (err) { } // ignore error, we had nothing to do.
    }

    /** Query for a set of ModelProps of the specified ModelQueryParams. */
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

    /** Code to run when the IModelConnection has closed. */
    public onIModelConnectionClose() {
      this.loaded.forEach((value: ModelState) => {
        value.onIModelConnectionClose();
      });
    }
  }

  /** The collection of Elements for an [[IModelConnection]]. */
  export class Elements {
    /** @hidden */
    public constructor(private _iModel: IModelConnection) { }

    /** The Id of the [root subject element]($docs/bis/intro/glossary.md#subject-root) for this iModel. */
    public get rootSubjectId(): Id64 { return new Id64("0x1"); }

    /** Get a set of element ids that satisfy a query */
    public async queryIds(params: EntityQueryParams): Promise<Id64Set> { return this._iModel.queryEntityIds(params); }

    /** Get an array of [[ElementProps]] given one or more element ids. */
    public async getProps(arg: Id64Arg): Promise<ElementProps[]> {
      return await IModelReadRpcInterface.getClient().getElementProps(this._iModel.iModelToken, Id64.toIdSet(arg));
    }

    /** Get an array  of [[ElementProps]] that satisfy a query */
    public async queryProps(params: EntityQueryParams): Promise<ElementProps[]> {
      return await IModelReadRpcInterface.getClient().queryElementProps(this._iModel.iModelToken, params);
    }

    /** Ask the backend to format (for presentation) the specified list of element ids. */
    public async formatElements(elementIds: Id64Arg): Promise<any[]> {
      return await IModelReadRpcInterface.getClient().formatElements(this._iModel.iModelToken, Id64.toIdSet(elementIds));
    }
  }

  /** The collection of [[CodeSpec]] entities for an [[IModelConnection]]. */
  export class CodeSpecs {
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
  export class Views {
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

    /**
     * Get an array of the ViewSpecs for all views in this IModel that satisfy a ViewQueryParams.
     *
     * This is typically used to create a list for UI.
     *
     * For example:
     * ```ts
     * [[include:IModelConnection.Views.getViewList]]
     * ```
     * @param queryParams The parameters for the views to find.
     */
    public async getViewList(queryParams: ViewQueryParams): Promise<ViewSpec[]> {
      const views: ViewSpec[] = [];
      const viewProps: ViewDefinitionProps[] = await this.queryProps(queryParams);
      viewProps.forEach((viewProp) => { views.push({ id: viewProp.id as string, name: viewProp.code!.value!, class: viewProp.classFullName }); });
      return views;
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
  export class Tiles {
    private _iModel: IModelConnection;

    /** @hidden */
    constructor(iModel: IModelConnection) {
      this._iModel = iModel;
    }

    public async getTileTreeProps(ids: Id64Set): Promise<TileTreeProps[]> {
      return IModelTileRpcInterface.getClient().getTileTreeProps(this._iModel.iModelToken, ids);
    }

    public async getTileProps(ids: TileId[]): Promise<TileProps[]> {
      return IModelTileRpcInterface.getClient().getTileProps(this._iModel.iModelToken, ids);
    }
  }
}
