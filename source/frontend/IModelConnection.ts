/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { BisCore } from "../BisCore";
import { ClassRegistry } from "../ClassRegistry";
import { Element, ElementProps } from "../Element";
import { Entity, EntityMetaData, EntityQueryParams } from "../Entity";
import { IModel, IModelToken } from "../IModel";
import { IModelError, IModelStatus } from "../IModelError";
import { IModelVersion } from "../IModelVersion";
import { Model } from "../Model";

// Initialize the frontend side of remoting
import { IModelDbRemoting } from "../middle/IModelDbRemoting";
IModelDbRemoting;

// Register the use of BisCore for the frontend
BisCore.registerSchema();

/** A connection to an iModel database hosted on the backend. */
export class IModelConnection extends IModel {
  public models: IModelConnectionModels;
  public elements: IModelConnectionElements;

  private constructor(iModelToken: IModelToken) {
    super(iModelToken);
    this.models = new IModelConnectionModels(this);
    this.elements = new IModelConnectionElements(this);
  }

  /** Open an iModel from iModelHub */
  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode = OpenMode.Readonly, version: IModelVersion = IModelVersion.latest()): Promise<IModelConnection> {
    if (OpenMode.Readonly !== openMode)
      return Promise.reject(new IModelError(IModelStatus.NotEnabled, "IModelConnection does not support read/write access yet")); // WIP: waiting for decisions on how to manage read/write briefcases on the backend

    const iModelToken = await IModelDbRemoting.open(accessToken, iModelId, openMode, version);
    return new IModelConnection(iModelToken);
  }

  /** Create an IModelConnection from the token of an IModel opened on the backend. This method is for specific scenarios.
   * In most cases it is better to call [[IModelConnection.open]] instead.
   */
  public static async create(iModelToken: IModelToken) {
    return new IModelConnection(iModelToken);
  }

  /** Close this iModel */
  public async close(accessToken: AccessToken): Promise<void> { // WIP: remove AccessToken parameter
    if (!this.iModelToken)
      return;
    await IModelDbRemoting.close(accessToken, this.iModelToken);
  }

  /** Execute a query against the iModel.
   * @param sql The ECSql to execute
   * @param bindings Optional values to bind to placeholders in the statement.
   * @returns All rows as an array or an empty array if nothing was selected
   * @throws [[IModelError]] if the ECSql is invalid
   */
  public async executeQuery(sql: string, bindings?: any): Promise<any[]> {
    return await IModelDbRemoting.executeQuery(this.iModelToken, sql, bindings);
  }
}

/** The collection of models in an [[IModelConnection]]. */
export class IModelConnectionModels {
  private _iModel: IModelConnection;
  private _loaded: LRUMap<string, Model>;

  /** @hidden */
  public constructor(iModel: IModelConnection, max: number = 500) { this._iModel = iModel; this._loaded = new LRUMap<string, Model>(max); }

  /** The Id of the repository model. */
  public get repositoryModelId(): Id64 { return new Id64("0x1"); }

  /** Ask the backend for a batch of models given a list of model ids. */
  public async getModels(modelIds: Id64[]): Promise<Model[]> {
    return await IModelDbRemoting.getModels(this._iModel.iModelToken, modelIds.map((id: Id64) => id.toString()));
  }
}

/** The collection of elements in an [[IModelConnection]]. */
export class IModelConnectionElements {
  private _iModel: IModelConnection;
  private _loaded: LRUMap<string, Element>;

  /** get the map of loaded elements */
  public get loaded() { return this._loaded; }

  /** @hidden */
  public constructor(iModel: IModelConnection, maxElements: number = 2000) { this._iModel = iModel; this._loaded = new LRUMap<string, Element>(maxElements); }

  /** The Id of the root subject element. */
  public get rootSubjectId(): Id64 { return new Id64("0x1"); }

  /** Ask the backend for a batch of elements given a list of element ids. */
  public async getElements(elementIds: Id64[]): Promise<Element[]> {
    const elementJsonArray: any[] = await IModelDbRemoting.getElements(this._iModel.iModelToken, elementIds.map((id: Id64) => id.toString()));
    const elements: Element[] = [];

    for (const elementJson of elementJsonArray) {
      const elementProps = JSON.parse(elementJson) as ElementProps;
      elementProps.iModel = this._iModel;

      let entity: Entity;
      try {
        entity = ClassRegistry.createInstance(elementProps);
      } catch (error) {
        if (!ClassRegistry.isClassNotFoundError(error) && !ClassRegistry.isMetaDataNotFoundError(error))
          throw error;

        const classArray: any[] = await IModelDbRemoting.loadMetaDataForClassHierarchy(this._iModel.iModelToken, elementProps.classFullName!);
        for (const classEntry of classArray) {
          this._iModel.classMetaDataRegistry.add(classEntry.className, new EntityMetaData(classEntry.metaData));
        }
        entity = ClassRegistry.createInstance(elementProps);
      }
      const element = entity as Element;
      if (!(element instanceof Element))
        return Promise.reject(new TypeError());

      element.setPersistent(); // elements in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
      this._loaded.set(element.id.toString(), element);
      elements.push(element);
    }

    return elements;
  }

  /** Ask the backend to format (for presentation) the specified list of element ids. */
  public async formatElements(elementIds: Id64[]): Promise<any[]> {
    return await IModelDbRemoting.formatElements(this._iModel.iModelToken, elementIds.map((id: Id64) => id.toString()));
  }

  /** */
  public async queryElementIds(params: EntityQueryParams): Promise<Id64[]> {
    return await IModelDbRemoting.queryElementIds(this._iModel.iModelToken, params);
  }
}
