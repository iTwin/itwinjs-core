/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Guid, Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";
import { OpenMode, DbResult, DbOpcode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { Code, CodeSpec } from "../common/Code";
import { ElementProps, ElementAspectProps, ElementLoadParams } from "../common/ElementProps";
import { IModel } from "../common/IModel";
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
import { NodeAddonBriefcaseManagerResourcesRequest } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { ECSqlStatement } from "./ECSqlStatement";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BindingValue } from "./BindingUtility";
import { CodeSpecs } from "./CodeSpecs";
import { Entity, EntityMetaData } from "./Entity";
import { IModelGatewayImpl } from "./IModelGatewayImpl";
import { StatusCodeWithMessage, RepositoryStatus } from "@bentley/bentleyjs-core/lib/BentleyError";
import * as path from "path";
import { AxisAlignedBox3d } from "../common/geometry/Primitives";

// Register the backend implementation of IModelGateway
IModelGatewayImpl.register();

// Register the use of BisCore for the backend
BisCore.registerSchema();

class CachedECSqlStatement {
  public statement: ECSqlStatement;
  public useCount: number;
}

class ECSqlStatementCache {
  private statements: Map<string, CachedECSqlStatement> = new Map<string, CachedECSqlStatement>();

  public add(str: string, stmt: ECSqlStatement): void {

    assert(!stmt.isShared(), "when you add a statement to the cache, the cache takes ownership of it. You can't add a statement that is already being shared in some other way");
    assert(stmt.isPrepared(), "you must cache only cached statements.");

    const existing = this.statements.get(str);
    if (existing !== undefined) {
      assert(existing.useCount > 0, "you should only add a statement if all existing copies of it are in use.");
    }
    const cs = new CachedECSqlStatement();
    cs.statement = stmt;
    cs.statement.setIsShared(true);
    cs.useCount = 1;
    this.statements.set(str, cs);
  }

  public getCount(): number {
    return this.statements.size;
  }

  public find(str: string): CachedECSqlStatement | undefined {
    return this.statements.get(str);
  }

  public release(stmt: ECSqlStatement): void {
    for (const cs of this.statements) {
      const css = cs[1];
      if (css.statement === stmt) {
        if (css.useCount > 0) {
          css.useCount--;
          if (css.useCount === 0) {
            css.statement.reset();
            css.statement.clearBindings();
          }
        } else {
          assert(false, "double-release of cached statement");
        }
        // leave the statement in the cache, even if its use count goes to zero. See removeUnusedStatements and clearOnClose.
        // *** TODO: we should remove it if it is a duplicate of another unused statement in the cache. The trouble is that we don't have the ecsql for the statement,
        //           so we can't check for other equivalent statements.
        break;
      }
    }
  }

  public removeUnusedStatements(targetCount: number) {
    const keysToRemove = [];
    for (const cs of this.statements) {
      const css = cs[1];
      assert(css.statement.isShared());
      assert(css.statement.isPrepared());
      if (css.useCount === 0) {
        css.statement.setIsShared(false);
        css.statement.dispose();
        keysToRemove.push(cs[0]);
        if (keysToRemove.length >= targetCount)
          break;
      }
    }
    for (const k of keysToRemove) {
      this.statements.delete(k);
    }
  }

  public clearOnClose() {
    for (const cs of this.statements) {
      assert(cs[1].useCount === 0, "statement was never released: " + cs[0]);
      assert(cs[1].statement.isShared());
      assert(cs[1].statement.isPrepared());
      const stmt = cs[1].statement;
      if (stmt !== undefined) {
        stmt.setIsShared(false);
        stmt.dispose();
      }
    }
    this.statements.clear();
  }
}

/** Represents a physical copy (briefcase) of an iModel that can be accessed as a file. */
export class IModelDb extends IModel {
  public readonly models: IModelDbModels;
  public readonly elements: IModelDbElements;
  private readonly statementCache: ECSqlStatementCache = new ECSqlStatementCache();
  private _maxStatementCacheCount = 20;
  private _codeSpecs: CodeSpecs;
  private _classMetaDataRegistry: MetaDataRegistry;

  /** @hidden */
  public briefcaseInfo?: BriefcaseInfo;

  /** Get the mode used to open this iModel */
  public get openMode(): OpenMode | undefined { return this.briefcaseInfo ? this.briefcaseInfo.openMode : undefined; }

  private constructor(briefcaseInfo: BriefcaseInfo, iModelToken: IModelToken, name: string, description: string) {
    super(iModelToken, name, description);
    this.briefcaseInfo = briefcaseInfo;
    this.models = new IModelDbModels(this);
    this.elements = new IModelDbElements(this);
  }

  private static create(briefcaseInfo: BriefcaseInfo, contextId?: string): IModelDb {
    const iModelToken = IModelToken.create(briefcaseInfo.iModelId, briefcaseInfo.changeSetId, briefcaseInfo.openMode, briefcaseInfo.userId, contextId);

    const rootSubjectInfoStr = briefcaseInfo.nativeDb.getRootSubjectInfo();
    const rootSubjectInfo = JSON.parse(rootSubjectInfoStr);
    const name = rootSubjectInfo.name || path.basename(briefcaseInfo.pathname);
    const description = rootSubjectInfo.description;

    briefcaseInfo.iModelDb = new IModelDb(briefcaseInfo, iModelToken, name, description);
    return briefcaseInfo.iModelDb;
  }

  /** Open the iModel from a local file
   * @param pathname The pathname of the iModel
   * @param openMode Open mode for database
   * @throws [[IModelError]]
   */
  public static async openStandalone(pathname: string, openMode: OpenMode = OpenMode.ReadWrite, enableTransactions: boolean = false): Promise<IModelDb> {
    const briefcaseInfo: BriefcaseInfo = await BriefcaseManager.openStandalone(pathname, openMode, enableTransactions);
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
  public async close(accessToken: AccessToken, keepBriefcase: KeepBriefcase = KeepBriefcase.Yes): Promise<void> {
    if (!this.briefcaseInfo)
      return;
    this.clearStatementCacheOnClose();
    await BriefcaseManager.close(accessToken, this.briefcaseInfo, keepBriefcase);
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

 /**
  * Add the lock, code, and other resource requests that would be needed in order to carry out the specified operation.
  * @param req The request object, which accumulates requests.
  * @param modelProps The IDs of the models
  * @param opcode The operation that will be performed on the model.
  * @see BriefcaseManager.createResourcesRequest
  */
  public buildResourcesRequestForModel(req: BriefcaseManager.ResourcesRequest, model: Model, opcode: DbOpcode): void {
    if (!this.briefcaseInfo)
      throw new IModelError(IModelStatus.BadRequest);
    const rc: RepositoryStatus = this.briefcaseInfo.nativeDb.buildBriefcaseManagerResourcesRequestForModel(req as NodeAddonBriefcaseManagerResourcesRequest, JSON.stringify(model.id), opcode);
    if (rc !== RepositoryStatus.Success)
      throw new IModelError(rc);
    }

 /**
  * Add the lock, code, and other resource requests that would be needed in order to carry out the specified operation.
  * @param req The request object, which accumulates requests.
  * @param elemProps The IDs of the elements
  * @param opcode The operation that will be performed on the element.
  * @see BriefcaseManager.createResourcesRequest
  */
  public buildResourcesRequestForElement(req: BriefcaseManager.ResourcesRequest, element: Element, opcode: DbOpcode): void {
    if (!this.briefcaseInfo)
      throw new IModelError(IModelStatus.BadRequest);
    let rc: RepositoryStatus;
    if (element.id === undefined || opcode === DbOpcode.Insert)
      rc = this.briefcaseInfo.nativeDb.buildBriefcaseManagerResourcesRequestForElement(req as NodeAddonBriefcaseManagerResourcesRequest, JSON.stringify({modelid: element.model, code: element.code}), opcode);
    else
      rc = this.briefcaseInfo.nativeDb.buildBriefcaseManagerResourcesRequestForElement(req as NodeAddonBriefcaseManagerResourcesRequest, JSON.stringify(element.id), opcode);
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
   * @param sql The ECSql statement to prepare
   * @return the prepared statement
   * @throws IModelError if the statement cannot be prepared. Normally, prepare fails due to ECSql syntax errors or references to tables or properties that do not exist. The error.message property will describe the property.
   */
  public getPreparedStatement(sql: string): ECSqlStatement {
    const cs = this.statementCache.find(sql);
    if (cs !== undefined && cs.useCount === 0) {  // we can only recycle a previously cached statement if nobody is currently using it.
      assert(cs.statement.isShared());
      assert(cs.statement.isPrepared());
      cs.useCount++;
      return cs.statement;
    }

    if (this.statementCache.getCount() > this._maxStatementCacheCount) {
      this.statementCache.removeUnusedStatements(this._maxStatementCacheCount);
    }

    const stmt = this.prepareStatement(sql);
    this.statementCache.add(sql, stmt);
    return stmt;
  }

  /** Use a prepared statement. This function takes care of preparing the statement and then releasing it.
   * @param sql The ECSql statement to execute
   * @param cb the callback to invoke on the prepared statement
   * @return the value returned by cb
   */
  public withPreparedStatement<T>(sql: string, cb: (stmt: ECSqlStatement) => T): T {
    const stmt = this.getPreparedStatement(sql);
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
   * @param sql The ECSql statement to execute
   * @param bindings Optional values to bind to placeholders in the statement.
   * @returns all rows as an array or an empty array if nothing was selected
   * @throws [[IModelError]] If the statement is invalid
   */
  public async executeQuery(sql: string, bindings?: BindingValue[] | Map<string, BindingValue> | any): Promise<any[]> {
    return this.withPreparedStatement(sql, (stmt: ECSqlStatement) => {
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

  /** Get the extents of this iModel */
  public getExtents(): AxisAlignedBox3d {
    if (!this.briefcaseInfo)
      throw this._newNotOpenError();
    const extentsStr = this.briefcaseInfo.nativeDb.getExtents();
    return AxisAlignedBox3d.fromJSON(JSON.parse(extentsStr));
  }

  /**
   * Commit pending changes to this iModel
   * @param _description Optional description of the changes
   * @throws [[IModelError]] if there is a problem saving changes.
   */
  public saveChanges(_description?: string) {
    if (!this.briefcaseInfo)
      throw this._newNotOpenError();

    const stat = this.briefcaseInfo.nativeDb.saveChanges();
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

    const { error, result: idHexStr } = this.briefcaseInfo.nativeDb.insertCodeSpecSync(codeSpec.name, codeSpec.specScopeType, codeSpec.scopeReq);
    if (error)
      throw new IModelError(error.status, "Problem inserting CodeSpec", Logger.logWarning);

    return new Id64(idHexStr);
  }

  /** @deprecated */
  public async getElementPropertiesForDisplay(elementId: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!this.briefcaseInfo) {
        reject(this._newNotOpenError());
        return;
      }

      this.briefcaseInfo.nativeDb.getElementPropertiesForDisplay(elementId, (error: StatusCodeWithMessage<IModelStatus>, json: string) => {
        if (error)
          reject(new IModelError(error.status, error.message, Logger.logError, () => ({ iModelId: this._iModelToken.iModelId, elementId })));
        else
          resolve(json);
      });
    });
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

  /** Get metadata for a class. This method will load the metadata from the NodeAddonDgnDb into the cache as a side-effect, if necessary.
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
      throw new IModelError(IModelStatus.BadArg, undefined, Logger.logError, () => ({ iModelId: this._iModelToken.iModelId, classFullName }));

    const { error, result: metaDataJson } = this.briefcaseInfo.nativeDb.getECClassMetaDataSync(className[0], className[1]);
    if (error)
      throw new IModelError(error.status, undefined, Logger.logError, () => ({ iModelId: this._iModelToken.iModelId, classFullName }));

    const metaData = new EntityMetaData(JSON.parse(metaDataJson!));
    this.classMetaDataRegistry.add(classFullName, metaData);
    // Recursive, to make sure that base class is cached.
    if (metaData.baseClasses !== undefined && metaData.baseClasses.length > 0)
      this.loadMetaData(metaData.baseClasses[0]);
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
  public async getModel(modelId: Id64): Promise<Model> {
    // first see if the model is already in the local cache.
    const loaded = this._loaded.get(modelId.toString());
    if (loaded)
      return loaded;

    return new Promise<Model>((resolve, reject) => {
      if (!this._iModel.briefcaseInfo)
        return reject(this._iModel._newNotOpenError());

      // Must go get the model from the iModel. Start by requesting the model's data.
      this._iModel.briefcaseInfo.nativeDb.getModel(JSON.stringify({ id: modelId }), (error: StatusCodeWithMessage<IModelStatus>, json: string) => {
        if (error) {
          reject(new IModelError(error.status, error.message, Logger.logWarning));
          return;
        }

        const props = JSON.parse(json) as ModelProps;
        props.iModel = this._iModel;
        const entity = this._iModel.constructEntity(props);
        assert(entity instanceof Model);
        const model = entity as Model;

        // We have created the model. Cache it before we return it.
        model.setPersistent(); // models in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
        this._loaded.set(model.id.toString(), model);
        resolve(model);
      });
    });
  }

  public async getModelJson(modelIdStr: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!this._iModel.briefcaseInfo)
        return reject(this._iModel._newNotOpenError());

      this._iModel.briefcaseInfo.nativeDb.getModel(JSON.stringify({ id: modelIdStr }), (error: StatusCodeWithMessage<IModelStatus>, json: string) => {
        if (error)
          reject(new IModelError(error.status, error.message, Logger.logWarning));
        else
          resolve(json);
      });
    });
  }

  /** Get the sub-model of the specified Element.
   * @param elementId The Element identifier.
   * @throws [[IModelError]]
   */
  public async getSubModel(modeledElementId: Id64 | Guid | Code): Promise<Model> {
    const modeledElement: Element = await this._iModel.elements.getElement(modeledElementId);
    if (modeledElement.id.equals(this._iModel.elements.rootSubjectId))
      return Promise.reject(new IModelError(IModelStatus.NotFound, "Root subject does not have a sub-model", Logger.logWarning));

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

    const { error, result: json } = this._iModel.briefcaseInfo.nativeDb.insertModelSync(JSON.stringify(model));
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

    const error: IModelStatus = this._iModel.briefcaseInfo.nativeDb.updateModelSync(JSON.stringify(model));
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

    const error: IModelStatus = this._iModel.briefcaseInfo.nativeDb.deleteModelSync(model.id.toString());
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
  private async _getElementProps(opts: ElementLoadParams): Promise<ElementProps> {
    return new Promise<ElementProps>((resolve, reject) => {
      if (!this._iModel.briefcaseInfo)
        return reject(this._iModel._newNotOpenError());

      // Must go get the element from the iModel. Start by requesting the element's data.
      this._iModel.briefcaseInfo.nativeDb.getElement(JSON.stringify(opts), (error: StatusCodeWithMessage<IModelStatus>, json: string) => {
        if (error)
          reject(new IModelError(error.status, error.message, Logger.logWarning));
        else {
          const props = JSON.parse(json) as ElementProps;
          props.iModel = this._iModel;
          resolve(props);
        }
      });
    });
  }

  public async getElementJson(elementIdStr: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!this._iModel.briefcaseInfo)
        return reject(this._iModel._newNotOpenError());

      this._iModel.briefcaseInfo.nativeDb.getElement(JSON.stringify({ id: elementIdStr }), (error: StatusCodeWithMessage<IModelStatus>, json: string) => {
        if (error)
          reject(new IModelError(error.status, error.message, Logger.logWarning));
        else
          resolve(json);
      });
    });
  }

  /** Private implementation details of getElement */
  private async _doGetElement(opts: ElementLoadParams): Promise<Element> {
    // first see if the element is already in the local cache.
    if (opts.id) {
      const loaded = this._loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }

    const props = await this._getElementProps(opts);
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
  public getElementProps(elementId: Id64 | Guid | Code): Promise<ElementProps> {
    if (elementId instanceof Id64) return this._getElementProps({ id: elementId });
    if (elementId instanceof Guid) return this._getElementProps({ federationGuid: elementId.value });
    if (elementId instanceof Code) return this._getElementProps({ code: elementId });
    return Promise.reject(new IModelError(IModelStatus.BadArg, undefined, Logger.logError, () => ({ elementId })));
  }

  /**
   * Get an element by Id, FederationGuid, or Code
   * @param elementId either the element's Id, Code, or FederationGuid
   * @throws [[IModelError]] if the element is not found.
   */
  public getElement(elementId: Id64 | Guid | Code): Promise<Element> {
    if (elementId instanceof Id64) return this._doGetElement({ id: elementId });
    if (elementId instanceof Guid) return this._doGetElement({ federationGuid: elementId.value });
    if (elementId instanceof Code) return this._doGetElement({ code: elementId });
    return Promise.reject(new IModelError(IModelStatus.BadArg, undefined, Logger.logError, () => ({ elementId })));
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
      stmt.bindValues([code.spec, new Id64(code.scope), code.value!]);
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

    const { error, result: json } = this._iModel.briefcaseInfo.nativeDb.insertElementSync(JSON.stringify(elProps));
    if (error)
      throw new IModelError(error.status, "Problem inserting element", Logger.logWarning);

    return new Id64(JSON.parse(json!).id);
  }

  /**
   * Update the properties of an existing element in the iModel.
   * @param props the properties of the element to update. Any properties that are not present will be left unchanged.
   * @throws [[IModelError]] if unable to update the element.
   */
  public updateElement(props: ElementProps): void {
    if (!this._iModel.briefcaseInfo)
      throw this._iModel._newNotOpenError();

    const error: IModelStatus = this._iModel.briefcaseInfo.nativeDb.updateElementSync(JSON.stringify(props));
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

    const error: IModelStatus = this._iModel.briefcaseInfo.nativeDb.deleteElementSync(id.toString());
    if (error !== IModelStatus.Success)
      throw new IModelError(error, "", Logger.logWarning);

    // Discard from the cache
    this._loaded.delete(id.toString());
  }

  /** Query for the child elements of the specified element.
   * @returns Returns an array of child element identifiers.
   * @throws [[IModelError]]
   */
  public async queryChildren(elementId: Id64): Promise<Id64[]> {
    const rows: any[] = await this._iModel.executeQuery("SELECT ECInstanceId as id FROM " + Element.sqlName + " WHERE Parent.Id=?", [elementId]);
    const childIds: Id64[] = [];
    for (const row of rows) {
      childIds.push(new Id64(row.id));
    }
    return Promise.resolve(childIds);
  }

  /** The Id of the root subject element. */
  public get rootSubjectId(): Id64 { return new Id64("0x1"); }

  /** Get the root subject element. */
  public getRootSubject(): Promise<Element> { return this.getElement(this.rootSubjectId); }

  /** Query for aspects rows (by aspect class name) associated with this element.
   * @throws [[IModelError]]
   */
  private async _queryAspects(elementId: Id64, aspectClassName: string): Promise<ElementAspect[]> {
    const name = aspectClassName.split(":");
    const rows: any[] = await this._iModel.executeQuery("SELECT * FROM [" + name[0] + "].[" + name[1] + "] WHERE Element.Id=?", [elementId]);
    if (rows.length === 0)
      return Promise.reject(new IModelError(IModelStatus.NotFound, undefined, Logger.logWarning));

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
  public async getUniqueAspect(elementId: Id64, aspectClassName: string): Promise<ElementUniqueAspect> {
    const aspects: ElementAspect[] = await this._queryAspects(elementId, aspectClassName);
    assert(aspects[0] instanceof ElementUniqueAspect);
    return aspects[0];
  }

  /** Get the ElementMultiAspect instances (by class name) that are related to the specified element.
   * @throws [[IModelError]]
   */
  public async getMultiAspects(elementId: Id64, aspectClassName: string): Promise<ElementMultiAspect[]> {
    const aspects: ElementAspect[] = await this._queryAspects(elementId, aspectClassName);
    return aspects;
  }

}
