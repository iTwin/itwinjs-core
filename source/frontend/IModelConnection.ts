/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, Id64Arg } from "@bentley/bentleyjs-core/lib/Id";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { CodeSpec } from "../common/Code";
import { ElementProps, ViewDefinitionProps } from "../common/ElementProps";
import { EntityQueryParams } from "../common/EntityProps";
import { Model2dState } from "../common/EntityState";
import { IModel, IModelToken, IModelProps } from "../common/IModel";
import { IModelError, IModelStatus } from "../common/IModelError";
import { ModelProps } from "../common/ModelProps";
import { IModelGateway } from "../gateway/IModelGateway";
import { IModelVersion } from "../common/IModelVersion";
import { DrawingViewState, OrthographicViewState, SheetViewState, SpatialViewState, ViewState, ViewState2d } from "../common/ViewState";
import { AxisAlignedBox3d } from "../common/geometry/Primitives";
import { HilitedSet, SelectionSet } from "./SelectionSet";
import { DisplayStyle3dState, DisplayStyle2dState } from "../common/DisplayStyleState";
import { ModelSelectorState } from "../common/ModelSelectorState";
import { CategorySelectorState } from "../common/CategorySelectorState";

const loggingCategory = "imodeljs-backend.IModelConnection";

/** A connection to an iModel database hosted on the backend. */
export class IModelConnection extends IModel {
  /** Get access to the [[Model]] entities in this IModel */
  public readonly models: IModelConnectionModels;
  public readonly elements: IModelConnectionElements;
  public readonly codeSpecs: IModelConnectionCodeSpecs;
  public readonly views: IModelConnectionViews;
  public readonly hilited: HilitedSet;
  public readonly selectionSet: SelectionSet;

  private constructor(iModelToken: IModelToken, name: string, props: IModelProps) {
    super(iModelToken, name, props);
    this.models = new IModelConnectionModels(this);
    this.elements = new IModelConnectionElements(this);
    this.codeSpecs = new IModelConnectionCodeSpecs(this);
    this.views = new IModelConnectionViews(this);
    this.hilited = new HilitedSet(this);
    this.selectionSet = new SelectionSet(this);
  }

  private static create(iModel: IModel): IModelConnection {
    return new IModelConnection(iModel.iModelToken, iModel.name, iModel);
  }

  /** Open an iModel from iModelHub */
  public static async open(accessToken: AccessToken, contextId: string, iModelId: string, openMode: OpenMode = OpenMode.Readonly, version: IModelVersion = IModelVersion.latest()): Promise<IModelConnection> {
    let changeSetId: string = await version.evaluateChangeSet(accessToken, iModelId);
    if (!changeSetId)
      changeSetId = "0"; // The first version is arbitrarily setup to have changeSetId = "0" since it's required by the gateway API.

    const iModelToken = IModelToken.create(iModelId, changeSetId, openMode, accessToken.getUserProfile()!.userId, contextId);
    let openResponse: IModel;
    if (openMode === OpenMode.ReadWrite)
      openResponse = await IModelGateway.getProxy().openForWrite(accessToken, iModelToken);
    else
      openResponse = await IModelGateway.getProxy().openForRead(accessToken, iModelToken);

    Logger.logTrace(loggingCategory, "IModelConnection.open", () => ({ iModelId, openMode, changeSetId }));

    // todo: Setup userId if it's a readWrite open - this is necessary to reopen the same exact briefcase at the backend
    return IModelConnection.create(openResponse);
  }

  /** Close this iModel */
  public async close(accessToken: AccessToken): Promise<void> {
    if (!this.iModelToken)
      return;
    try {
      await IModelGateway.getProxy().close(accessToken, this.iModelToken);
    } finally {
      (this.token as any) = undefined; // prevent closed connection from being reused
    }
  }

  /** Ask the backend to open a standalone iModel (not managed by iModelHub) from a file name that is resolved by the backend.
   * This method is designed for desktop or mobile applications and typically should not be used for web applications.
   */
  public static async openStandalone(fileName: string, openMode = OpenMode.Readonly): Promise<IModelConnection> {
    const openResponse: IModel = await IModelGateway.getProxy().openStandalone(fileName, openMode);
    Logger.logTrace(loggingCategory, "IModelConnection.openStandalone", () => ({ fileName, openMode }));
    return IModelConnection.create(openResponse);
  }

  /** Close this standalone iModel */
  public async closeStandalone(): Promise<void> {
    if (!this.iModelToken)
      return;
    try {
      await IModelGateway.getProxy().closeStandalone(this.iModelToken);
    } finally {
      (this.token as any) = undefined; // prevent closed connection from being reused
    }
  }

  /** Execute a query against the iModel.
   * @param ecsql The ECSQL to execute
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an array if the parameters are positional. Pass an object of the values keyed on the parameter name
   * for named parameters.
   * The values in either the array or object must match the respective types of the parameters.
   * Supported types:
   * boolean, Blob, DateTime, NavigationValue, number, XY, XYZ, string
   * For struct parameters pass an object with key value pairs of struct property name and values of the supported types
   * For array parameters pass an array of the supported types.
   * @returns All rows as an array or an empty array if nothing was selected
   * @throws [[IModelError]] if the ECSQL is invalid
   */
  public async executeQuery(ecsql: string, bindings?: any[] | object): Promise<any[]> {
    Logger.logTrace(loggingCategory, "IModelConnection.executeQuery", () => ({ iModelId: this.iModelToken.iModelId, ecsql, bindings }));
    return await IModelGateway.getProxy().executeQuery(this.iModelToken, ecsql, bindings);
  }

  /**
   * Update the project extents of this iModel.
   * @param newExtents The new project extents as an AxisAlignedBox3d
   */
  public async updateProjectExtents(newExtents: AxisAlignedBox3d): Promise<void> {
    Logger.logTrace(loggingCategory, "IModelConnection.updateProjectExtents", () => ({ iModelId: this.iModelToken.iModelId, newExtents }));
    await IModelGateway.getProxy().updateProjectExtents(this.iModelToken, newExtents);
  }

  /**
   * Commit pending changes to this iModel
   * @param description Optional description of the changes
   * @throws [[IModelError]] if there is a problem saving changes.
   */
  public async saveChanges(description?: string): Promise<void> {
    Logger.logTrace(loggingCategory, "IModelConnection.saveChanges", () => ({ iModelId: this.iModelToken.iModelId, description }));
    return await IModelGateway.getProxy().saveChanges(this.iModelToken, description);
  }

  // !!! TESTING METHOD
  /**
   * Execute a test known to exist using the id recognized by the addon's test execution handler
   * @param id The id of the test to execute
   * @param params A JSON string containing all parameters the test requires
   * @hidden
   */
  public async executeTestById(id: number, params: any): Promise<any> {
    return await IModelGateway.getProxy().executeTestById(this.iModelToken, id, params);
  }
}

/** The collection of models for an [[IModelConnection]]. */
export class IModelConnectionModels {
  private _iModel: IModelConnection;

  /** @hidden */
  public constructor(iModel: IModelConnection) { this._iModel = iModel; }

  /** The Id of the repository model. */
  public get repositoryModelId(): Id64 { return new Id64("0x1"); }

  /** Ask the backend for a batch of [[ModelProps]] given a list of model ids. */
  public async getModelProps(modelIds: Id64[]): Promise<ModelProps[]> {
    const modelJsonArray = await IModelGateway.getProxy().getModelProps(this._iModel.iModelToken, modelIds.map((id: Id64) => id.value));
    const models: ModelProps[] = [];
    for (const modelJson of modelJsonArray)
      models.push(JSON.parse(modelJson) as ModelProps);
    return models;
  }
}

/** The collection of elements for an [[IModelConnection]]. */
export class IModelConnectionElements {
  private _iModel: IModelConnection;

  /** @hidden */
  public constructor(iModel: IModelConnection) { this._iModel = iModel; }

  /** The Id of the root subject element. */
  public get rootSubjectId(): Id64 { return new Id64("0x1"); }

  /** Ask the backend for a batch of [[ElementProps]] given a list of element ids. */
  public async getElementProps(arg: Id64Arg): Promise<ElementProps[]> {
    let idArray: string[] = [];
    if (Array.isArray(arg)) {
      if (arg.length > 0) {
        idArray = (typeof arg[0] === "string") ? (arg as string[]) : (arg as Id64[]).map((id: Id64) => id.value);
      }
    } else if (arg instanceof Set) {
      arg.forEach((id) => idArray.push(id));
    } else {
      idArray.push(typeof arg === "string" ? arg : arg.value);
    }

    const elementJsonArray: any[] = await IModelGateway.getProxy().getElementProps(this._iModel.iModelToken, idArray);
    const elements: ElementProps[] = [];
    for (const elementJson of elementJsonArray)
      elements.push(JSON.parse(elementJson) as ElementProps);
    return elements;
  }

  /** Ask the backend to format (for presentation) the specified list of element ids. */
  public async formatElements(elementIds: Id64[]): Promise<any[]> {
    return await IModelGateway.getProxy().formatElements(this._iModel.iModelToken, elementIds.map((id: Id64) => id.value));
  }

  /** */
  public async queryElementIds(params: EntityQueryParams): Promise<Id64[]> {
    const elementIds: string[] = await IModelGateway.getProxy().queryElementIds(this._iModel.iModelToken, params);
    return elementIds.map((elementId: string) => new Id64(elementId));
  }
}

/** The collection of [[CodeSpec]] entities for an [[IModelConnection]]. */
export class IModelConnectionCodeSpecs {
  private _iModel: IModelConnection;
  private _loaded: CodeSpec[];

  /** @hidden */
  constructor(imodel: IModelConnection) {
    this._iModel = imodel;
  }

  /** Loads all CodeSpec from the remote IModelDb. */
  private async _loadAllCodeSpecs(): Promise<void> {
    if (this._loaded)
      return;

    this._loaded = [];
    const codeSpecArray: any[] = await IModelGateway.getProxy().getAllCodeSpecs(this._iModel.iModelToken);
    for (const codeSpec of codeSpecArray) {
      this._loaded.push(new CodeSpec(this._iModel, new Id64(codeSpec.id), codeSpec.name, codeSpec.jsonProperties));
    }
  }

  /** Look up a CodeSpec by Id.
   * @param codeSpecId The Id of the CodeSpec to load
   * @returns The CodeSpec with the specified Id
   * @throws [[IModelError]] if the Id is invalid or if no CodeSpec with that Id could be found.
   */
  public async getCodeSpecById(codeSpecId: Id64): Promise<CodeSpec> {
    if (!codeSpecId.isValid())
      return Promise.reject(new IModelError(IModelStatus.InvalidId, "Invalid codeSpecId", Logger.logWarning, loggingCategory, () => ({ codeSpecId })));

    await this._loadAllCodeSpecs(); // ensure all codeSpecs have been downloaded
    const found: CodeSpec | undefined = this._loaded.find((codeSpec: CodeSpec) => codeSpec.id.equals(codeSpecId));
    if (!found)
      return Promise.reject(new IModelError(IModelStatus.NotFound, "CodeSpec not found", Logger.logWarning, loggingCategory));

    return found;
  }

  /** Look up a CodeSpec by name.
   * @param name The name of the CodeSpec to load
   * @returns The CodeSpec with the specified name
   * @throws [[IModelError]] if no CodeSpec with the specified name could be found.
   */
  public async getCodeSpecByName(name: string): Promise<CodeSpec> {
    await this._loadAllCodeSpecs(); // ensure all codeSpecs have been downloaded
    const found: CodeSpec | undefined = this._loaded.find((codeSpec: CodeSpec) => codeSpec.name === name);
    if (!found)
      return Promise.reject(new IModelError(IModelStatus.NotFound, "CodeSpec not found", Logger.logWarning, loggingCategory));

    return found;
  }
}

/** The collection of views for an [[IModelConnection]]. */
export class IModelConnectionViews {
  private _iModel: IModelConnection;

  /** @hidden */
  constructor(iModel: IModelConnection) {
    this._iModel = iModel;
  }

  /** Query for the array of ViewDefinitionProps of the specified class and matching the specified IsPrivate setting.
   * @param className Query for view definitions of this class.
   * @param wantPrivate If true, include private view definitions.
   */
  public async queryViewDefinitionProps(className: string = "BisCore.ViewDefinition", wantPrivate: boolean = false): Promise<ViewDefinitionProps[]> {
    const viewDefinitionProps: ViewDefinitionProps[] = await IModelGateway.getProxy().queryViewDefinitionProps(this._iModel.iModelToken, className, wantPrivate);
    return viewDefinitionProps;
  }

  /** Load a [[ViewState]] object from the specified [[ViewDefinition]] id. */
  public async loadView(viewDefinitionId: Id64 | string): Promise<ViewState> {
    const viewStateData: any = await IModelGateway.getProxy().getViewStateData(this._iModel.iModelToken, typeof viewDefinitionId === "string" ? viewDefinitionId : viewDefinitionId.value);
    const categorySelectorState = new CategorySelectorState(viewStateData.categorySelectorProps, this._iModel);

    switch (viewStateData.viewDefinitionProps.classFullName) {
      case SpatialViewState.getClassFullName(): {
        const displayStyleState = new DisplayStyle3dState(viewStateData.displayStyleProps, this._iModel);
        const modelSelectorState = new ModelSelectorState(viewStateData.modelSelectorProps, this._iModel);
        return new SpatialViewState(viewStateData.viewDefinitionProps, this._iModel, categorySelectorState, displayStyleState, modelSelectorState);
      }
      case OrthographicViewState.getClassFullName(): {
        const displayStyleState = new DisplayStyle3dState(viewStateData.displayStyleProps, this._iModel);
        const modelSelectorState = new ModelSelectorState(viewStateData.modelSelectorProps, this._iModel);
        return new OrthographicViewState(viewStateData.viewDefinitionProps, this._iModel, categorySelectorState, displayStyleState, modelSelectorState);
      }
      case ViewState2d.getClassFullName(): {
        const displayStyleState = new DisplayStyle2dState(viewStateData.displayStyleProps, this._iModel);
        const baseModelState = new Model2dState(viewStateData.baseModelProps, this._iModel);
        return new ViewState2d(viewStateData.viewDefinitionProps, this._iModel, categorySelectorState, displayStyleState, baseModelState);
      }
      case DrawingViewState.getClassFullName(): {
        const displayStyleState = new DisplayStyle2dState(viewStateData.displayStyleProps, this._iModel);
        const baseModelState = new Model2dState(viewStateData.baseModelProps, this._iModel);
        return new DrawingViewState(viewStateData.viewDefinitionProps, this._iModel, categorySelectorState, displayStyleState, baseModelState);
      }
      case SheetViewState.getClassFullName(): {
        const displayStyleState = new DisplayStyle2dState(viewStateData.displayStyleProps, this._iModel);
        const baseModelState = new Model2dState(viewStateData.baseModelProps, this._iModel);
        return new SheetViewState(viewStateData.viewDefinitionProps, this._iModel, categorySelectorState, displayStyleState, baseModelState);
      }
      default:
        return Promise.reject(new IModelError(IModelStatus.WrongClass, "Invalid ViewState subclass", Logger.logError, loggingCategory, () => viewStateData));
    }
  }
}
