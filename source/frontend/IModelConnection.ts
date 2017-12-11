/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { AxisAlignedBox3d } from "../common/geometry/Primitives";
import { CodeSpec } from "../common/Code";
import { ElementProps } from "../common/ElementProps";
import { EntityQueryParams } from "../common/EntityProps";
import { IModel, IModelToken } from "../common/IModel";
import { IModelError, IModelStatus } from "../common/IModelError";
import { IModelVersion } from "../common/IModelVersion";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { ModelProps } from "../common/ModelProps";
import { IModelGateway, IModelGatewayOpenResponse } from "../gateway/IModelGateway";

/** A connection to an iModel database hosted on the backend. */
export class IModelConnection extends IModel {
  /** Get access to the [[Model]] entities in this IModel */
  public readonly models: IModelConnectionModels;
  public readonly elements: IModelConnectionElements;
  public readonly codeSpecs: IModelConnectionCodeSpecs;

  private constructor(iModelToken: IModelToken, name: string, description: string, private readonly extents: AxisAlignedBox3d) {
    super(iModelToken, name, description);
    this.extents = extents;
    this.models = new IModelConnectionModels(this);
    this.elements = new IModelConnectionElements(this);
    this.codeSpecs = new IModelConnectionCodeSpecs(this);
  }

  private static create({token, name, description, extents}: IModelGatewayOpenResponse): IModelConnection {
    const extentsObj = new AxisAlignedBox3d();
    extentsObj.setFromJSON(extents);
    return new IModelConnection(token as IModelToken, name, description, extentsObj);
  }

  /** Open an iModel from iModelHub */
  public static async open(accessToken: AccessToken, contextId: string, iModelId: string, openMode: OpenMode = OpenMode.Readonly, version: IModelVersion = IModelVersion.latest()): Promise<IModelConnection> {
    if (OpenMode.Readonly !== openMode)
      return Promise.reject(new IModelError(IModelStatus.NotEnabled, "IModelConnection does not support read/write access yet"));
       // WIP: waiting for decisions on how to manage read/write briefcases on the backend.

    const openResponse: IModelGatewayOpenResponse = await IModelGateway.getProxy().openForRead(accessToken, contextId, iModelId, version);
    Logger.logInfo("IModelConnection.open", () => ({ iModelId, openMode, version }));

    // todo: Setup userId if it's a readWrite open - this is necessary to reopen the same exact briefcase at the backend
    return IModelConnection.create(openResponse);
  }

  /** Ask the backend to open a standalone iModel (not managed by iModelHub) from a file name that is resolved by the backend.
   * This method is designed for desktop or mobile applications and typically should not be used for web applications.
   */
  public static async openStandalone(fileName: string, openMode = OpenMode.Readonly): Promise<IModelConnection> {
    const openResponse: IModelGatewayOpenResponse = await IModelGateway.getProxy().openStandalone(fileName, openMode);
    Logger.logInfo("IModelConnection.openStandalone", () => ({ fileName, openMode }));
    return IModelConnection.create(openResponse);
  }

  /** Close this iModel */
  public async close(accessToken: AccessToken): Promise<void> { // WIP: remove AccessToken parameter
    if (!this.iModelToken)
      return;
    await IModelGateway.getProxy().close(accessToken, this.iModelToken);
  }

  /** Extents of the iModel */
  public getExtents(): AxisAlignedBox3d {
    return this.extents;
  }

  /** Execute a query against the iModel.
   * @param sql The ECSql to execute
   * @param bindings Optional values to bind to placeholders in the statement.
   * @returns All rows as an array or an empty array if nothing was selected
   * @throws [[IModelError]] if the ECSql is invalid
   */
  public async executeQuery(sql: string, bindings?: any): Promise<any[]> {
    Logger.logInfo("IModelConnection.executeQuery", () => ({ iModelId: this.iModelToken.iModelId, sql, bindings }));
    return await IModelGateway.getProxy().executeQuery(this.iModelToken, sql, bindings);
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
    for (const modelJson of modelJsonArray) {
      const modelProps = JSON.parse(modelJson) as ModelProps;
      models.push(modelProps);
    }
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
  public async getElementProps(elementIds: Id64[]): Promise<ElementProps[]> {
    const elementJsonArray: any[] = await IModelGateway.getProxy().getElementProps(this._iModel.iModelToken, elementIds.map((id: Id64) => id.value));
    const elements: ElementProps[] = [];
    for (const elementJson of elementJsonArray) {
      const elementProps = JSON.parse(elementJson) as ElementProps;
      elements.push(elementProps);
    }
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
      return Promise.reject(new IModelError(IModelStatus.InvalidId, "Invalid codeSpecId", Logger.logWarning, () => ({ codeSpecId })));

    await this._loadAllCodeSpecs(); // ensure all codeSpecs have been downloaded
    const found: CodeSpec | undefined = this._loaded.find((codeSpec: CodeSpec) => codeSpec.id === codeSpecId);
    if (!found)
      return Promise.reject(new IModelError(IModelStatus.NotFound, "CodeSpec not found", Logger.logWarning));

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
      return Promise.reject(new IModelError(IModelStatus.NotFound, "CodeSpec not found", Logger.logWarning));

    return found;
  }
}
