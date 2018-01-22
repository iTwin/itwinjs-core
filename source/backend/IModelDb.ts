/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Guid, Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";
import { OpenMode, DbResult, DbOpcode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { Code, CodeSpec } from "../common/Code";
import { ElementProps, ElementAspectProps, ElementLoadParams } from "../common/ElementProps";
import { IModel, IModelProps } from "../common/IModel";
import { IModelVersion } from "../common/IModelVersion";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { ModelProps } from "../common/ModelProps";
import { IModelToken } from "../common/IModel";
import { IModelError, IModelStatus } from "../common/IModelError";
import { BisCore } from "./BisCore";
import { ClassRegistry, MetaDataRegistry } from "./ClassRegistry";
import { Element } from "./Element";
import { ElementAspect, ElementMultiAspect, ElementUniqueAspect } from "./ElementAspect";
import { Model } from "./Model";
import { BriefcaseInfo, BriefcaseManager, KeepBriefcase, BriefcaseId } from "./BriefcaseManager";
import { AddonBriefcaseManagerResourcesRequest } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { ECSqlStatement, ECSqlStatementCache } from "./ECSqlStatement";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BindingValue } from "./BindingUtility";
import { CodeSpecs } from "./CodeSpecs";
import { Entity, EntityMetaData } from "./Entity";
import { IModelGatewayImpl } from "./IModelGatewayImpl";
import { RepositoryStatus } from "@bentley/bentleyjs-core/lib/BentleyError";
import * as path from "path";
import { IModelDbLinkTableRelationships, LinkTableRelationship } from "./LinkTableRelationship";
import { AxisAlignedBox3d } from "../common/geometry/Primitives";

// Register the backend implementation of IModelGateway
IModelGatewayImpl.register();

// Register the use of BisCore for the backend
BisCore.registerSchema();

/** Represents a physical copy (briefcase) of an iModel that can be accessed as a file. */
export class IModelDb extends IModel {
  public readonly models: IModelDbModels;
  public readonly elements: IModelDbElements;
  public readonly linkTableRelationships: IModelDbLinkTableRelationships;
  private readonly statementCache: ECSqlStatementCache = new ECSqlStatementCache();
  private _codeSpecs: CodeSpecs;
  private _classMetaDataRegistry: MetaDataRegistry;

  /** @hidden */
  public briefcaseInfo?: BriefcaseInfo;

  /** Get the mode used to open this iModel */
  public get openMode(): OpenMode | undefined { return this.briefcaseInfo ? this.briefcaseInfo.openMode : undefined; }

  private constructor(briefcaseInfo: BriefcaseInfo, iModelToken: IModelToken, name: string, props: IModelProps) {
    super(iModelToken, name, props);
    this.briefcaseInfo = briefcaseInfo;
    this.models = new IModelDbModels(this);
    this.elements = new IModelDbElements(this);
    this.linkTableRelationships = new IModelDbLinkTableRelationships(this);
  }

  private static create(briefcaseInfo: BriefcaseInfo, contextId?: string): IModelDb {
    const iModelToken = IModelToken.create(briefcaseInfo.iModelId, briefcaseInfo.changeSetId, briefcaseInfo.openMode, briefcaseInfo.userId, contextId);
    const props = JSON.parse(briefcaseInfo.nativeDb.getIModelProps()) as IModelProps;
    const name = props.rootSubject ? props.rootSubject.name : path.basename(briefcaseInfo.pathname);
    briefcaseInfo.iModelDb = new IModelDb(briefcaseInfo, iModelToken, name, props);
    return briefcaseInfo.iModelDb;
  }

  /** Open the iModel from a local file
   * @param pathname The pathname of the iModel
   * @param openMode Open mode for database
   * @throws [[IModelError]]
   */
  public static openStandalone(pathname: string, openMode: OpenMode = OpenMode.ReadWrite, enableTransactions: boolean = false): IModelDb {
    const briefcaseInfo: BriefcaseInfo = BriefcaseManager.openStandalone(pathname, openMode, enableTransactions);
    Logger.logInfo("IModelDb.openStandalone", () => ({ pathname, openMode }));
    return IModelDb.create(briefcaseInfo);
  }

  /** Open an iModel from the iModelHub */
  public static async open(accessToken: AccessToken, contextId: string, iModelId: string, openMode: OpenMode = OpenMode.ReadWrite, version: IModelVersion = IModelVersion.latest()): Promise<IModelDb> {
    const briefcaseInfo: BriefcaseInfo = await BriefcaseManager.open(accessToken, contextId, iModelId, openMode, version);
    Logger.logInfo("IModelDb.open", () => ({ iModelId, openMode }));
    return IModelDb.create(briefcaseInfo, contextId);
  }

  /** Close this iModel, if it is currently open */
  public closeStandalone(): void {
    if (!this.briefcaseInfo)
      return;
    this.clearStatementCacheOnClose();
    BriefcaseManager.closeStandalone(this.briefcaseInfo);
    this.briefcaseInfo.iModelDb = undefined;
    this.briefcaseInfo = undefined;
  }

  /** Close this iModel, if it is currently open. */
  public close(accessToken: AccessToken, keepBriefcase: KeepBriefcase = KeepBriefcase.Yes): void {
    if (!this.briefcaseInfo)
      return;
    this.clearStatementCacheOnClose();
    BriefcaseManager.close(accessToken, this.briefcaseInfo, keepBriefcase);
    this.briefcaseInfo.iModelDb = undefined;
    this.briefcaseInfo = undefined;
  }

  /** Get the in-memory handle of the native Db */
  public get nativeDb(): any {
    if (!this.briefcaseInfo)
      return undefined;
    return this.briefcaseInfo.nativeDb;
  }

  /** Get the briefcase ID of this iModel */
  public getBriefcaseId(): BriefcaseId {
    if (!this.briefcaseInfo)
      return new BriefcaseId(BriefcaseId.Illegal);
    return new BriefcaseId(this.briefcaseInfo.briefcaseId);
  }

  /** See Model.buildResourcesRequest */
  public buildResourcesRequestForModel(req: BriefcaseManager.ResourcesRequest, model: Model, opcode: DbOpcode): void {
    if (!this.briefcaseInfo)
      throw new IModelError(IModelStatus.BadRequest);
    const rc: RepositoryStatus = this.briefcaseInfo.nativeDb.buildBriefcaseManagerResourcesRequestForModel(req as AddonBriefcaseManagerResourcesRequest, JSON.stringify(model.id), opcode);
    if (rc !== RepositoryStatus.Success)
      throw new IModelError(rc);
  }

  /** See Element.buildResourcesRequest */
  public buildResourcesRequestForElement(req: BriefcaseManager.ResourcesRequest, element: Element, opcode: DbOpcode): void {
    if (!this.briefcaseInfo)
      throw new IModelError(IModelStatus.BadRequest);
    let rc: RepositoryStatus;
    if (element.id === undefined || opcode === DbOpcode.Insert)
      rc = this.briefcaseInfo.nativeDb.buildBriefcaseManagerResourcesRequestForElement(req as AddonBriefcaseManagerResourcesRequest, JSON.stringify({ modelid: element.model, code: element.code }), opcode);
    else
      rc = this.briefcaseInfo.nativeDb.buildBriefcaseManagerResourcesRequestForElement(req as AddonBriefcaseManagerResourcesRequest, JSON.stringify(element.id), opcode);
    if (rc !== RepositoryStatus.Success)
      throw new IModelError(rc);
  }

  /** See LinkTableRelationship.buildResourcesRequest */
  public buildResourcesRequestForLinkTableRelationship(req: BriefcaseManager.ResourcesRequest, instance: LinkTableRelationship, opcode: DbOpcode): void {
    if (!this.briefcaseInfo)
      throw new IModelError(IModelStatus.BadRequest);
    const rc: RepositoryStatus = this.briefcaseInfo.nativeDb.buildBriefcaseManagerResourcesRequestForLinkTableRelationship(req as AddonBriefcaseManagerResourcesRequest, JSON.stringify(instance), opcode);
    if (rc !== RepositoryStatus.Success)
      throw new IModelError(rc);
  }

  /** See CodeSpec.buildResourcesRequest */
  public buildResourcesRequestForCodeSpec(req: BriefcaseManager.ResourcesRequest, instance: CodeSpec, opcode: DbOpcode): void {
    if (!this.briefcaseInfo)
      throw new IModelError(IModelStatus.BadRequest);
    const rc: RepositoryStatus = this.briefcaseInfo.nativeDb.buildBriefcaseManagerResourcesRequestForCodeSpec(req as AddonBriefcaseManagerResourcesRequest, JSON.stringify(instance.id), opcode);
    if (rc !== RepositoryStatus.Success)
      throw new IModelError(rc);
  }

  /**
   * Try to acquire the requested resources from iModelHub.
   * This function may fulfill some requests and fail to fulfill others. This function returns a zero status
   * if all requests were fulfilled. It returns a non-zero status if some or all requests could not be fulfilled.
   * This function updates req to remove the requests that were successfully fulfilled. Therefore, if a non-zero
   * status is returned, the caller can look at req to see which requests failed.
   * @param req On input, this is the list of resource requests to be fulfilled. On return, this is the list of
   * requests that could not be fulfilled.
   * @return BentleyStatus.SUCCESS if all resources were acquired or non-zero if some could not be acquired.
   */
  public requestResources(_req: BriefcaseManager.ResourcesRequest) {
    if (!this.briefcaseInfo)
      throw new IModelError(IModelStatus.BadRequest);
    // throw new Error("TBD");
  }

  /**
   * Check to see if *all* of the requested resources could be acquired from iModelHub.
   * @param req the list of resource requests to be fulfilled.
   * @return true if all resources could be acquired or false if any could not be acquired.
   */
  public areResourcesAvailable(_req: BriefcaseManager.ResourcesRequest): boolean {
    if (!this.briefcaseInfo)
      throw new IModelError(IModelStatus.BadRequest);
    // throw new Error("TBD");
    return false; // *** TBD
  }

  /** Set the concurrency control policy.
   * Before changing from optimistic to pessimistic, all local changes must be saved and uploaded to iModelHub.
   * Before changing the locking policy of the pessimistic concurrency policy, all local changes must be saved to the local briefcase.
   * @param policy The policy to used
   * @throws IModelError if the policy cannot be set.
   */
  public setConcurrencyControlPolicy(policy: BriefcaseManager.PessimisticConcurrencyControlPolicy | BriefcaseManager.OptimisticConcurrencyControlPolicy): void {
    if (!this.briefcaseInfo)
      throw new IModelError(IModelStatus.BadRequest);
    let rc: RepositoryStatus = RepositoryStatus.Success;
    if (policy as BriefcaseManager.OptimisticConcurrencyControlPolicy) {
      const oc: BriefcaseManager.OptimisticConcurrencyControlPolicy = policy as BriefcaseManager.OptimisticConcurrencyControlPolicy;
      rc = this.briefcaseInfo.nativeDb.setBriefcaseManagerOptimisticConcurrencyControlPolicy(oc.conflictResolution);
    } else {
      rc = this.briefcaseInfo.nativeDb.setBriefcaseManagerPessimisticConcurrencyControlPolicy();
    }
    if (RepositoryStatus.Success !== rc) {
      throw new IModelError(rc);
    }
  }

  /**
   * Start a bulk update operation. This allows apps to write entities and codes to the local briefcase without first acquiring locks.
   * The transaction manager then attempts to acquire all needed locks and codes before saving the changes to the local briefcase.
   * The transaction manager will roll back all pending changes if any lock or code cannot be acquired at save time. Lock and code acquisition will fail if another user
   * has push changes to the same entities or used the same codes as the local transaction.
   * This policy does prevent conflicts and is the easiest way to implement the pessimistic locking policy efficiently.
   * It however carries the risk that local changes could be rolled back, and so it can only be used safely in special cases, where
   * contention for locks and codes is not a risk. Normally, that is only possible when writing to a model that is exclusively locked and where codes
   * are scoped to that model.
   * See saveChanges and endBulkUpdateMode.
   */
  public startBulkUpdateMode(): void {
    if (!this.briefcaseInfo)
      throw new IModelError(IModelStatus.BadRequest);
    const rc: RepositoryStatus = this.briefcaseInfo.nativeDb.briefcaseManagerStartBulkOperation();
    if (RepositoryStatus.Success !== rc)
      throw new IModelError(rc);
  }

  /**
   * Call this if you want to acquire locks and codes *before* the end of the transaction.
   * Note that saveChanges automatically calls this function to end the bulk operation and acquire locks and codes.
   * If successful, this terminates the bulk operation.
   * If not successful, the caller should abandon all changes.
   */
  public endBulkUpdateMode(): void {
    if (!this.briefcaseInfo)
      throw new IModelError(IModelStatus.BadRequest);
    const rc: RepositoryStatus = this.briefcaseInfo.nativeDb.briefcaseManagerEndBulkOperation();
    if (RepositoryStatus.Success !== rc)
      throw new IModelError(rc);
  }

  /** Returns a new IModelError with errorNumber, message, and meta-data set properly for a *not open* error.
   * @hidden
   */
  public _newNotOpenError(): IModelError {
    return new IModelError(IModelStatus.NotOpen, "IModelDb not open", Logger.logError, () => ({ iModelId: this.iModelToken.iModelId }));
  }

  /** Get a prepared ECSql statement - may require preparing the statement, if not found in the cache.
   * @param ecsql The ECSql statement to prepare
   * @return the prepared statement
   * @throws IModelError if the statement cannot be prepared. Normally, prepare fails due to ECSql syntax errors or references to tables or properties that do not exist. The error.message property will describe the property.
   */
  public getPreparedStatement(ecsql: string): ECSqlStatement {
    const cs = this.statementCache.find(ecsql);
    if (cs !== undefined && cs.useCount === 0) {  // we can only recycle a previously cached statement if nobody is currently using it.
      assert(cs.statement.isShared());
      assert(cs.statement.isPrepared());
      cs.useCount++;
      return cs.statement;
    }

    this.statementCache.removeUnusedStatementsIfNecessary();

    const stmt = this.prepareStatement(ecsql);
    this.statementCache.add(ecsql, stmt);
    return stmt;
  }

  /** Use a prepared statement. This function takes care of preparing the statement and then releasing it.
   * @param ecsql The ECSql statement to execute
   * @param cb the callback to invoke on the prepared statement
   * @return the value returned by cb
   */
  public withPreparedStatement<T>(ecsql: string, cb: (stmt: ECSqlStatement) => T): T {
    const stmt = this.getPreparedStatement(ecsql);
    try {
      const val: T = cb(stmt);
      this.releasePreparedStatement(stmt);
      return val;
    } catch (err) {
      this.releasePreparedStatement(stmt);
      Logger.logError(err.toString());
      throw err;
    }
  }

  /** Execute a query against this IModelDb.
   * @param ecsql The ECSql statement to execute
   * @param bindings Optional values to bind to placeholders in the statement.
   * @returns all rows as an array or an empty array if nothing was selected
   * @throws [[IModelError]] If the statement is invalid
   */
  public executeQuery(ecsql: string, bindings?: BindingValue[] | Map<string, BindingValue> | any): any[] {
    return this.withPreparedStatement(ecsql, (stmt: ECSqlStatement) => {
      if (bindings)
        stmt.bindValues(bindings);
      const rows: any[] = [];
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        rows.push(stmt.getRow());
      }
      return rows;
    });
  }

  public releasePreparedStatement(stmt: ECSqlStatement): void {
    this.statementCache.release(stmt);
  }

  public clearStatementCacheOnClose(): void {
    this.statementCache.clearOnClose();
  }

  /** Get the GUID of this iModel. */
  public getGuid(): Guid {
    if (!this.briefcaseInfo)
      throw this._newNotOpenError();
    const guidStr = this.briefcaseInfo.nativeDb.getDbGuid();
    return new Guid(guidStr);
  }

  /** Set the GUID of this iModel. */
  public setGuid(guid: Guid) {
    if (!this.briefcaseInfo)
      throw this._newNotOpenError();
    const guidStr = guid.toString();
    return this.briefcaseInfo.nativeDb.setDbGuid(guidStr);
  }

  /** Update the imodel project extents. */
  public updateProjectExtents(newExtents: AxisAlignedBox3d) {
    if (!this.briefcaseInfo)
      throw this._newNotOpenError();
    this.projectExtents.setFrom(newExtents);
    const extentsJson = newExtents.toJSON();
    this.briefcaseInfo.nativeDb.updateProjectExtents(JSON.stringify(extentsJson));
  }

  /**
   * Commit pending changes to this iModel
   * @param _description Optional description of the changes
   * @throws [[IModelError]] if there is a problem saving changes.
   */
  public saveChanges(description?: string) {
    if (!this.briefcaseInfo)
      throw this._newNotOpenError();

    const stat = this.briefcaseInfo.nativeDb.saveChanges(description);
    if (DbResult.BE_SQLITE_OK !== stat)
      throw new IModelError(stat, "Problem saving changes", Logger.logError);
  }

  /** Import an ECSchema. */
  public importSchema(schemaFileName: string) {
    if (!this.briefcaseInfo)
      throw this._newNotOpenError();

    const stat = this.briefcaseInfo.nativeDb.importSchema(schemaFileName);
    if (DbResult.BE_SQLITE_OK !== stat)
      throw new IModelError(stat, "Error importing schema", Logger.logError, () => ({ schemaFileName }));
  }

  /** Find an already open IModelDb. Used by the remoting logic.
   * @throws [[IModelError]] if an open IModelDb matching the token is not found.
   */
  public static find(iModelToken: IModelToken): IModelDb {
    const briefcaseInfo = BriefcaseManager.findBriefcase(iModelToken);
    if (!briefcaseInfo)
      throw new IModelError(IModelStatus.NotFound, undefined, Logger.logError, () => ({ iModelId: iModelToken.iModelId }));
    assert(!!briefcaseInfo.iModelDb);
    return briefcaseInfo.iModelDb!;
  }

  /** Get the ClassMetaDataRegistry for this iModel. */
  public get classMetaDataRegistry(): MetaDataRegistry {
    if (!this._classMetaDataRegistry)
      this._classMetaDataRegistry = new MetaDataRegistry();
    return this._classMetaDataRegistry;
  }

  /** Get access to the CodeSpecs in this IModel. */
  public get codeSpecs(): CodeSpecs {
    if (this._codeSpecs === undefined)
      this._codeSpecs = new CodeSpecs(this);
    return this._codeSpecs;
  }

  /** @private */
  public insertCodeSpec(codeSpec: CodeSpec): Id64 {
    if (!this.briefcaseInfo)
      throw this._newNotOpenError();

    const { error, result: idHexStr } = this.briefcaseInfo.nativeDb.insertCodeSpec(codeSpec.name, codeSpec.specScopeType, codeSpec.scopeReq);
    if (error)
      throw new IModelError(error.status, "Problem inserting CodeSpec", Logger.logWarning);

    return new Id64(idHexStr);
  }

  /** @deprecated */
  public getElementPropertiesForDisplay(elementId: string): string {
    if (!this.briefcaseInfo)
      throw this._newNotOpenError();

    const { error, result: idHexStr } = this.briefcaseInfo.nativeDb.getElementPropertiesForDisplay(elementId);
    if (error)
        throw new IModelError(error.status, error.message, Logger.logError, () => ({ iModelId: this.token.iModelId, elementId }));

    return idHexStr!;
  }

  /** Prepare an ECSql statement.
   * @param sql The ECSql statement to prepare
   * @throws [[IModelError]] if there is a problem preparing the statement.
   */
  public prepareStatement(sql: string): ECSqlStatement {
    if (!this.briefcaseInfo)
      throw this._newNotOpenError();

    const stmt = new ECSqlStatement();
    stmt.prepare(this.briefcaseInfo.nativeDb, sql);
    return stmt;
  }

  /** Construct an entity (element or model). This utility method knows how to fetch the required class metadata
   * if necessary in order to get the entity's class defined as a prerequisite.
   * @throws [[IModelError]] if the entity cannot be constructed.
   */
  public constructEntity(props: any): Entity {
    let entity: Entity;
    try {
      entity = ClassRegistry.createInstance(props, this);
    } catch (err) {
      if (!ClassRegistry.isClassNotFoundError(err) && !ClassRegistry.isMetaDataNotFoundError(err)) {
        Logger.logError(err.toString());
        throw err;
      }

      // Probably, we have not yet loaded the metadata for this class and/or its superclasses. Do that now, and retry the create.
      this.loadMetaData(props.classFullName!);
      entity = ClassRegistry.createInstance(props, this);
    }
    return entity;
  }

  /** Get metadata for a class. This method will load the metadata from the AddonDgnDb into the cache as a side-effect, if necessary.
   * @throws [[IModelError]] if the metadata cannot be found nor loaded.
   */
  public getMetaData(classFullName: string): EntityMetaData {
    let metadata = this.classMetaDataRegistry.find(classFullName);
    if (metadata === undefined) {
      this.loadMetaData(classFullName);
      metadata = this.classMetaDataRegistry.find(classFullName);
      if (metadata === undefined)
        throw ClassRegistry.makeMetaDataNotFoundError(); // do not log
    }
    return metadata;
  }

  /*** @hidden */
  private loadMetaData(classFullName: string) {
    if (!this.briefcaseInfo)
      throw this._newNotOpenError();

    if (this.classMetaDataRegistry.find(classFullName))
      return;
    const className = classFullName.split(":");
    if (className.length !== 2)
      throw new IModelError(IModelStatus.BadArg, undefined, Logger.logError, () => ({ iModelId: this.token.iModelId, classFullName }));

    const { error, result: metaDataJson } = this.briefcaseInfo.nativeDb.getECClassMetaData(className[0], className[1]);
    if (error)
      throw new IModelError(error.status, undefined, Logger.logError, () => ({ iModelId: this.token.iModelId, classFullName }));

    const metaData = new EntityMetaData(JSON.parse(metaDataJson!));
    this.classMetaDataRegistry.add(classFullName, metaData);
    // Recursive, to make sure that base class is cached.
    if (metaData.baseClasses !== undefined && metaData.baseClasses.length > 0)
      this.loadMetaData(metaData.baseClasses[0]);
  }

  // !!! TEST FUNCTION
  /**
   * Execute a test known to exist using the id recognized by the addon's test execution handler
   * @param id The id of the test you wish to execute
   * @param params A JSON string that should all of the data/parameters the test needs to function correctly
   */
  public executeTestById(testId: number, params: any): any {
    if (!this.briefcaseInfo)
      throw this._newNotOpenError();

    const retVal: string = this.briefcaseInfo.nativeDb.executeTestById(testId, JSON.stringify(params));
    if (retVal.length === 0)
      return {};
    return JSON.parse(retVal);
  }
}

/**
 * Models to be locked.
 */
export interface ModelsToLock {
  /** The models to be inserted */
  newModels?: Model[];
  /** The models to be updated */
  modelsToUpdate?: Model[];
  /** The models to be deleted */
  modelsToDelete?: Model[];
}

/**
 * Elements to be locked.
 */
export interface ElementsToLock {
  /** The Elements to be inserted */
  newElements?: Element[];
  /** The Elements to be updated */
  ElementsToUpdate?: Element[];
  /** The Elements to be deleted */
  ElementsToDelete?: Element[];
}

/** The collection of models in an [[IModelDb]]. */
export class IModelDbModels {
  private _iModel: IModelDb;
  private _loaded: LRUMap<string, Model>;

  /** @hidden */
  public constructor(iModel: IModelDb, max: number = 500) { this._iModel = iModel; this._loaded = new LRUMap<string, Model>(max); }

  /** Get the Model with the specified identifier.
   * @param modelId The Model identifier.
   * @throws [[IModelError]]
   */
  public getModel(modelId: Id64): Model {
    // first see if the model is already in the local cache.
    const loaded = this._loaded.get(modelId.toString());
    if (loaded)
      return loaded;

    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    // Must go get the model from the iModel. Start by requesting the model's data.
    const {error, result: json} = this._iModel.briefcaseInfo.nativeDb.getModel(JSON.stringify({ id: modelId }));
    if (error)
      throw new IModelError(error.status, error.message, Logger.logWarning);

    const props = JSON.parse(json!) as ModelProps;
    props.iModel = this._iModel;
    const entity = this._iModel.constructEntity(props);
    assert(entity instanceof Model);
    const model = entity as Model;

    // We have created the model. Cache it before we return it.
    model.setPersistent(); // models in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
    this._loaded.set(model.id.toString(), model);
    return model;
  }

  public getModelJson(modelIdStr: string): string {
    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    // Must go get the model from the iModel. Start by requesting the model's data.
    const {error, result: json} = this._iModel.briefcaseInfo.nativeDb.getModel(JSON.stringify({ id: modelIdStr }));
    if (error)
      throw new IModelError(error.status, error.message, Logger.logWarning);

    return json!;
  }

  /** Get the sub-model of the specified Element.
   * @param elementId The Element identifier.
   * @throws [[IModelError]]
   */
  public getSubModel(modeledElementId: Id64 | Guid | Code): Model {
    const modeledElement: Element = this._iModel.elements.getElement(modeledElementId);
    if (modeledElement.id.equals(this._iModel.elements.rootSubjectId))
      throw new IModelError(IModelStatus.NotFound, "Root subject does not have a sub-model", Logger.logWarning);

    return this.getModel(modeledElement.id);
  }

  /** The Id of the repository model. */
  public get repositoryModelId(): Id64 { return new Id64("0x1"); }

  /** Create a new model in memory.
   * @param modelProps The properties to use when creating the model.
   * @throws [[IModelError]] if there is a problem creating the model.
   */
  public createModel(modelProps: ModelProps): Model {
    const model: Model = this._iModel.constructEntity(modelProps) as Model;
    assert(model instanceof Model);
    return model;
  }

  /** Insert a new model.
   * @param model The data for the new model.
   * @returns The newly inserted model's Id.
   * @throws [[IModelError]] if unable to insert the model.
   */
  public insertModel(model: Model): Id64 {
    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    if (model.isPersistent()) {
      assert(false);
      throw new IModelError(IModelStatus.WriteError, "Cannot insert a model marked as persistent. Call copyForEdit.", Logger.logError);
    }

    const { error, result: json } = this._iModel.briefcaseInfo.nativeDb.insertModel(JSON.stringify(model));
    if (error)
      throw new IModelError(error.status, "Problem inserting model", Logger.logWarning);

    return model.id = new Id64(JSON.parse(json!).id);
  }

  /** Update an existing model.
   * @param model An editable copy of the model, containing the new/proposed data.
   * @throws [[IModelError]] if unable to update the model.
   */
  public updateModel(model: ModelProps): void {
    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    if ((model.isPersistent !== undefined) && model.isPersistent()) {
      assert(false);
      throw new IModelError(IModelStatus.WriteError, "Cannot update a model marked as persistent. Call copyForEdit.", Logger.logError);
    }

    const error: IModelStatus = this._iModel.briefcaseInfo.nativeDb.updateModel(JSON.stringify(model));
    if (error !== IModelStatus.Success)
      throw new IModelError(error, "", Logger.logWarning);

    // Discard from the cache, to make sure that the next fetch see the updated version.
    this._loaded.delete(model.id.toString());
  }

  /** Delete an existing model.
   * @param model The model to be deleted
   * @throws [[IModelError]]
   */
  public deleteModel(model: Model): void {
    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    const error: IModelStatus = this._iModel.briefcaseInfo.nativeDb.deleteModel(model.id.toString());
    if (error !== IModelStatus.Success)
      throw new IModelError(error, "", Logger.logWarning);

    // Discard from the cache
    this._loaded.delete(model.id.toString());
  }

}

/** The collection of elements in an [[IModelDb]]. */
export class IModelDbElements {
  private _iModel: IModelDb;
  private _loaded: LRUMap<string, Element>;

  /** get the map of loaded elements */
  public get loaded() { return this._loaded; }

  /** @hidden */
  public constructor(iModel: IModelDb, maxElements: number = 2000) { this._iModel = iModel; this._loaded = new LRUMap<string, Element>(maxElements); }

  /** Private implementation details of getElementProps */
  private _getElementProps(opts: ElementLoadParams): ElementProps {
    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    // Must go get the element from the iModel. Start by requesting the element's data.
    const {error, result: json} = this._iModel.briefcaseInfo.nativeDb.getElement(JSON.stringify(opts));
    if (error)
      throw new IModelError(error.status, error.message, Logger.logWarning);
    const props = JSON.parse(json!) as ElementProps;
    props.iModel = this._iModel;
    return props;
  }

  public getElementJson(elementIdStr: string): string {
    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    // Must go get the element from the iModel. Start by requesting the element's data.
    const {error, result: json} = this._iModel.briefcaseInfo.nativeDb.getElement(JSON.stringify({ id: elementIdStr }));
    if (error)
      throw new IModelError(error.status, error.message, Logger.logWarning);
    return json!;
  }

  /** Private implementation details of getElement */
  private _doGetElement(opts: ElementLoadParams): Element {
    // first see if the element is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }

    const props = this._getElementProps(opts);
    const el = this._iModel.constructEntity(props) as Element;

    // We have created the element. Cache it before we return it.
    el.setPersistent(); // elements in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
    this._loaded.set(el.id.value, el);
    return el;
  }

  /**
   * Get properties of an Element by Id, FederationGuid, or Code
   * @throws [[IModelError]] if the element is not found.
   */
  public getElementProps(elementId: Id64 | Guid | Code): ElementProps {
    if (elementId instanceof Id64) return this._getElementProps({ id: elementId });
    if (elementId instanceof Guid) return this._getElementProps({ federationGuid: elementId.value });
    if (elementId instanceof Code) return this._getElementProps({ code: elementId });
    throw new IModelError(IModelStatus.BadArg, undefined, Logger.logError, () => ({ elementId }));
  }

  /**
   * Get an element by Id, FederationGuid, or Code
   * @param elementId either the element's Id, Code, or FederationGuid
   * @throws [[IModelError]] if the element is not found.
   */
  public getElement(elementId: Id64 | Guid | Code): Element {
    if (elementId instanceof Id64) return this._doGetElement({ id: elementId });
    if (elementId instanceof Guid) return this._doGetElement({ federationGuid: elementId.value });
    if (elementId instanceof Code) return this._doGetElement({ code: elementId });
    throw new IModelError(IModelStatus.BadArg, undefined, Logger.logError, () => ({ elementId }));
  }

  /**
   * Query for the DgnElementId of the element that has the specified code
   * @param code The code to look for
   * @return The element that uses the code or undefined if the code is not used.
   * @throws IModelError if the code is invalid
   */
  public queryElementIdByCode(code: Code): Id64 | undefined {
    if (!code.spec.isValid()) {
      throw new IModelError(IModelStatus.InvalidCodeSpec);
    }
    if (code.value === undefined) {
      throw new IModelError(IModelStatus.InvalidCode);
    }
    return this._iModel.withPreparedStatement("SELECT ecinstanceid as id FROM " + Element.sqlName + " WHERE CodeSpec.Id=? AND CodeScope.Id=? AND CodeValue=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, code.spec);
      stmt.bindId(2, new Id64(code.scope));
      stmt.bindString(3, code.value!);
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        return undefined;
      return new Id64(stmt.getRow().id);
    });
  }

  /**
   * Create a new instance of an element.
   * @param elProps The properties of the new element.
   * @throws [[IModelError]] if there is a problem creating the element.
   */
  public createElement(elProps: ElementProps): Element {
    const element: Element = this._iModel.constructEntity(elProps) as Element;
    assert(element instanceof Element);
    return element;
  }

  /**
   * Insert a new element into the iModel.
   * @param elProps The properties of the new element.
   * @returns The newly inserted element's Id.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public insertElement(elProps: ElementProps): Id64 {
    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    const { error, result: json } = this._iModel.briefcaseInfo.nativeDb.insertElement(JSON.stringify(elProps));
    if (error)
      throw new IModelError(error.status, "Problem inserting element", Logger.logWarning);

    return new Id64(JSON.parse(json!).id);
  }

  /** Update some properties of an existing element.
   * @param el the properties of the element to update.
   * @throws [[IModelError]] if unable to update the element.
   */
  public updateElement(props: ElementProps): void {
    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    const error: IModelStatus = this._iModel.briefcaseInfo.nativeDb.updateElement(JSON.stringify(props));
    if (error !== IModelStatus.Success)
      throw new IModelError(error, "", Logger.logWarning);

    // Discard from the cache, to make sure that the next fetch see the updated version.
    this._loaded.delete(props.id.toString());
  }

  /**
   * Delete an element from this iModel.
   * @param id The Id of the element to be deleted
   * @throws [[IModelError]]
   */
  public deleteElement(id: Id64): void {
    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    const error: IModelStatus = this._iModel.briefcaseInfo.nativeDb.deleteElement(id.toString());
    if (error !== IModelStatus.Success)
      throw new IModelError(error, "", Logger.logWarning);

    // Discard from the cache
    this._loaded.delete(id.toString());
  }

  /** Query for the child elements of the specified element.
   * @returns Returns an array of child element identifiers.
   * @throws [[IModelError]]
   */
  public queryChildren(elementId: Id64): Id64[] {
    const rows: any[] = this._iModel.executeQuery("SELECT ECInstanceId as id FROM " + Element.sqlName + " WHERE Parent.Id=?", [elementId]);
    const childIds: Id64[] = [];
    for (const row of rows) {
      childIds.push(new Id64(row.id));
    }
    return childIds;
  }

  /** The Id of the root subject element. */
  public get rootSubjectId(): Id64 { return new Id64("0x1"); }

  /** Get the root subject element. */
  public getRootSubject(): Element { return this.getElement(this.rootSubjectId); }

  /** Query for aspects rows (by aspect class name) associated with this element.
   * @throws [[IModelError]]
   */
  private _queryAspects(elementId: Id64, aspectClassName: string): ElementAspect[] {
    const name = aspectClassName.split(":");
    const rows: any[] = this._iModel.executeQuery("SELECT * FROM [" + name[0] + "].[" + name[1] + "] WHERE Element.Id=?", [elementId]);
    if (rows.length === 0)
      throw new IModelError(IModelStatus.NotFound, undefined, Logger.logWarning);

    const aspects: ElementAspect[] = [];
    for (const row of rows) {
      const aspectProps: ElementAspectProps = row; // start with everything that SELECT * returned
      aspectProps.classFullName = aspectClassName; // add in property required by EntityProps
      aspectProps.iModel = this._iModel; // add in property required by EntityProps
      aspectProps.element = elementId; // add in property required by ElementAspectProps
      aspectProps.classId = undefined; // clear property from SELECT * that we don't want in the final instance

      const entity = this._iModel.constructEntity(aspectProps);
      assert(entity instanceof ElementAspect);
      const aspect = entity as ElementAspect;
      aspect.setPersistent();
      aspects.push(aspect);
    }

    return aspects;
  }

  /** Get an ElementUniqueAspect instance (by class name) that is related to the specified element.
   * @throws [[IModelError]]
   */
  public getUniqueAspect(elementId: Id64, aspectClassName: string): ElementUniqueAspect {
    const aspects: ElementAspect[] = this._queryAspects(elementId, aspectClassName);
    assert(aspects[0] instanceof ElementUniqueAspect);
    return aspects[0];
  }

  /** Get the ElementMultiAspect instances (by class name) that are related to the specified element.
   * @throws [[IModelError]]
   */
  public getMultiAspects(elementId: Id64, aspectClassName: string): ElementMultiAspect[] {
    const aspects: ElementAspect[] = this._queryAspects(elementId, aspectClassName);
    return aspects;
  }
}
