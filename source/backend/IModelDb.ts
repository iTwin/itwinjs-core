/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Guid, Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { LRUMap } from "@bentley/bentleyjs-core/lib/LRUMap";
import { OpenMode, DbResult, DbOpcode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients/lib/Token";
import { DeploymentEnv } from "@bentley/imodeljs-clients/lib/Clients";
import { MultiCode, IModelHubClient, CodeState } from "@bentley/imodeljs-clients/lib/IModelHubClients";
import { Code, CodeSpec } from "../common/Code";
import { ElementProps, ElementAspectProps, ElementLoadParams, ViewDefinitionProps } from "../common/ElementProps";
import { IModel, IModelProps } from "../common/IModel";
import { Configuration } from "../common/Configuration";
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
import { BriefcaseEntry, BriefcaseManager, KeepBriefcase, BriefcaseId } from "./BriefcaseManager";
import { AddonBriefcaseManagerResourcesRequest } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { ECSqlStatement, ECSqlStatementCache } from "./ECSqlStatement";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { CodeSpecs } from "./CodeSpecs";
import { Entity, EntityMetaData } from "./Entity";
import { IModelGatewayImpl } from "./IModelGatewayImpl";
import { RepositoryStatus } from "@bentley/bentleyjs-core/lib/BentleyError";
import * as path from "path";
import { IModelDbLinkTableRelationships, LinkTableRelationship } from "./LinkTableRelationship";
import { AxisAlignedBox3d } from "../common/geometry/Primitives";
import { NodeAddonRegistry } from "./NodeAddonRegistry";
import { RequestQueryOptions } from "@bentley/imodeljs-clients/lib";

// Register the backend implementation of IModelGateway
IModelGatewayImpl.register();

// Register the use of BisCore for the backend
BisCore.registerSchema();

/** Represents a physical copy (briefcase) of an iModel that can be accessed as a file. */
export class IModelDb extends IModel {
  public static readonly defaultLimit = 1000;
  public readonly models: IModelDbModels;
  public readonly elements: IModelDbElements;
  public readonly views: IModelDbViews;
  public readonly linkTableRelationships: IModelDbLinkTableRelationships;
  private readonly statementCache: ECSqlStatementCache = new ECSqlStatementCache();
  private _codeSpecs: CodeSpecs;
  private _classMetaDataRegistry: MetaDataRegistry;
  private _concurrency: ConcurrencyControl;

  /** @hidden */
  public briefcaseEntry?: BriefcaseEntry;

  /** Get the mode used to open this iModel */
  public get openMode(): OpenMode | undefined { return this.briefcaseEntry ? this.briefcaseEntry.openMode : undefined; }

  private constructor(briefcaseEntry: BriefcaseEntry, iModelToken: IModelToken, name: string, props: IModelProps) {
    super(iModelToken, name, props);
    this.setupBriefcaseEntry(briefcaseEntry);
    this.models = new IModelDbModels(this);
    this.elements = new IModelDbElements(this);
    this.views = new IModelDbViews(this);
    this.linkTableRelationships = new IModelDbLinkTableRelationships(this);
  }

  private static createIModelDb(briefcaseEntry: BriefcaseEntry, contextId?: string): IModelDb {
    if (briefcaseEntry.iModelDb)
      return briefcaseEntry.iModelDb; // If there's an IModelDb already associated with the briefcase, that should be reused.
    const iModelToken = IModelToken.create(briefcaseEntry.iModelId, briefcaseEntry.changeSetId, briefcaseEntry.openMode, briefcaseEntry.userId, contextId);
    const props = JSON.parse(briefcaseEntry.nativeDb.getIModelProps()) as IModelProps;
    const name = props.rootSubject ? props.rootSubject.name : path.basename(briefcaseEntry.pathname);
    const iModelDb = new IModelDb(briefcaseEntry, iModelToken, name, props);
    return iModelDb;
  }

  /**
   * Create a standalone local Db
   * @param pathname The pathname of the iModel
   * @param rootSubjectName Name of the root subject.
   * @param rootSubjectDescription Description of the root subject.
   */
  public static createStandalone(pathname: string, rootSubjectName: string, rootSubjectDescription?: string): IModelDb {
    const briefcaseEntry: BriefcaseEntry = BriefcaseManager.createStandalone(pathname, rootSubjectName, rootSubjectDescription);
    Logger.logInfo("IModelDb.createStandalone", () => ({ pathname }));
    return IModelDb.createIModelDb(briefcaseEntry);
  }

  public static async create(accessToken: AccessToken, contextId: string, hubName: string, rootSubjectName: string, hubDescription?: string, rootSubjectDescription?: string): Promise<IModelDb> {
    const briefcaseEntry: BriefcaseEntry = await BriefcaseManager.create(accessToken, contextId, hubName, rootSubjectName, hubDescription, rootSubjectDescription);
    return IModelDb.createIModelDb(briefcaseEntry);
  }

  /** Open the iModel from a local file
   * @param pathname The pathname of the iModel
   * @param openMode Open mode for database
   * @param enableTransactions Enable tracking of transactions in this standalone iModel
   * @throws [[IModelError]]
   */
  public static openStandalone(pathname: string, openMode: OpenMode = OpenMode.ReadWrite, enableTransactions: boolean = false): IModelDb {
    const briefcaseEntry: BriefcaseEntry = BriefcaseManager.openStandalone(pathname, openMode, enableTransactions);
    Logger.logInfo("IModelDb.openStandalone", () => ({ pathname, openMode }));
    return IModelDb.createIModelDb(briefcaseEntry);
  }

  /**
   * Open an iModel from the iModelHub
   * @param accessToken Delegation token of the authorized user.
   * @param contextId Id of the Connect Project or Asset containing the iModel
   * @param iModelId Id of the iModel
   * @param openMode Open mode
   * @param version Version of the iModel to open
   */
  public static async open(accessToken: AccessToken, contextId: string, iModelId: string, openMode: OpenMode = OpenMode.ReadWrite, version: IModelVersion = IModelVersion.latest()): Promise<IModelDb> {
    const briefcaseEntry: BriefcaseEntry = await BriefcaseManager.open(accessToken, contextId, iModelId, openMode, version);
    Logger.logInfo("IModelDb.open", () => ({ iModelId, openMode }));
    return IModelDb.createIModelDb(briefcaseEntry, contextId);
  }

  /**
   * Close this standalone iModel, if it is currently open
   */
  public closeStandalone(): void {
    if (!this.briefcaseEntry)
      return;
    BriefcaseManager.closeStandalone(this.briefcaseEntry);
    this.clearBriefcaseEntry();
  }

  /**
   * Close this iModel, if it is currently open.
   * @param accessToken Delegation token of the authorized user.
   * @param keepBriefcase Hint to discard or keep the briefcase for potential future use.
   */
  public async close(accessToken: AccessToken, keepBriefcase: KeepBriefcase = KeepBriefcase.Yes): Promise<void> {
    if (!this.briefcaseEntry)
      return;
    await BriefcaseManager.close(accessToken, this.briefcaseEntry, keepBriefcase);
    this.clearBriefcaseEntry();
  }

  private setupBriefcaseEntry(briefcaseEntry: BriefcaseEntry) {
    this.briefcaseEntry = briefcaseEntry;
    this.briefcaseEntry.iModelDb = this;
    this.briefcaseEntry.onClose.addListener(this.onBriefcaseCloseHandler, this);
    this.briefcaseEntry.onVersionUpdated.addListener(this.onBriefcaseVersionUpdatedHandler, this);
  }

  private clearBriefcaseEntry(): void {
    this.briefcaseEntry!.onClose.removeListener(this.onBriefcaseCloseHandler, this);
    this.briefcaseEntry!.onVersionUpdated.removeListener(this.onBriefcaseVersionUpdatedHandler, this);
    this.briefcaseEntry!.iModelDb = undefined;
    this.briefcaseEntry = undefined;
  }

  private onBriefcaseCloseHandler() {
    this.clearStatementCacheOnClose();
  }

  private onBriefcaseVersionUpdatedHandler() {
    this.iModelToken.changeSetId = this.briefcaseEntry!.changeSetId;
  }

  /** Get the in-memory handle of the native Db */
  public get nativeDb(): any {
    if (!this.briefcaseEntry)
      return undefined;
    return this.briefcaseEntry.nativeDb;
  }

  /** Get the briefcase ID of this iModel */
  public getBriefcaseId(): BriefcaseId {
    if (!this.briefcaseEntry)
      return new BriefcaseId(BriefcaseId.Illegal);
    return new BriefcaseId(this.briefcaseEntry.briefcaseId);
  }

  /** Returns a new IModelError with errorNumber, message, and meta-data set properly for a *not open* error.
   * @hidden
   */
  public _newNotOpenError(): IModelError {
    return new IModelError(IModelStatus.NotOpen, "IModelDb not open", Logger.logError, () => ({ iModelId: this.iModelToken.iModelId }));
  }

  /** Get a prepared ECSql statement - may require preparing the statement, if not found in the cache.
   * @param ecsql The ECSql statement to prepare
   * @returns the prepared statement
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
   * @returns the value returned by cb
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
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an array if the parameters are positional. Pass an object of the values keyed on the parameter name
   * for named parameters.
   * The values in either the array or object must match the respective types of the parameters.
   * Supported types:
   * boolean, Blob, DateTime, NavigationBindingValue, number, XY, XYZ, string
   * For struct parameters pass an object with key value pairs of struct property name and values of the supported types
   * For array parameters pass an array of the supported types.
   * @returns all rows as an array or an empty array if nothing was selected
   * @throws [[IModelError]] If the statement is invalid
   */
  public executeQuery(ecsql: string, bindings?: any[] | object): any[] {
    return this.withPreparedStatement(ecsql, (stmt: ECSqlStatement) => {
      if (bindings)
        stmt.bindValues(bindings);
      const rows: any[] = [];
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        rows.push(stmt.getRow_new());
        if (rows.length >= IModelDb.defaultLimit)
          break; // don't let a "rogue" query consume too many resources
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
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();
    const guidStr = this.briefcaseEntry.nativeDb.getDbGuid();
    return new Guid(guidStr);
  }

  /** Set the GUID of this iModel. */
  public setGuid(guid: Guid) {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();
    const guidStr = guid.toString();
    return this.briefcaseEntry.nativeDb.setDbGuid(guidStr);
  }

  /** Update the imodel project extents. */
  public updateProjectExtents(newExtents: AxisAlignedBox3d) {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();
    this.projectExtents.setFrom(newExtents);
    const extentsJson = newExtents.toJSON();
    this.briefcaseEntry.nativeDb.updateProjectExtents(JSON.stringify(extentsJson));
  }

  /**
   * Commit pending changes to this iModel.
   * @note If this IModelDb is connected to an iModel, then you must call [[ConcurrencyControl.request]] before attempting to save changes.
   * @param _description Optional description of the changes
   * @throws [[IModelError]] if there is a problem saving changes or if there are pending, un-processed lock or code requests.
   */
  public saveChanges(description?: string) {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();

    this.concurrencyControl.onSaveChanges();

    const stat = this.briefcaseEntry.nativeDb.saveChanges(description);
    if (DbResult.BE_SQLITE_OK !== stat)
      throw new IModelError(stat, "Problem saving changes", Logger.logError);

    this.concurrencyControl.onSavedChanges();
  }

  /**
   * Pull and Merge changes from the iModelHub
   * @param accessToken Delegation token of the authorized user.
   * @param version Version to pull and merge to.
   * @throws [[IModelError]] If the pull and merge fails.
   */
  public async pullAndMergeChanges(accessToken: AccessToken, version: IModelVersion = IModelVersion.latest()): Promise<void> {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();

    return BriefcaseManager.pullAndMergeChanges(accessToken, this.briefcaseEntry, version);
  }

  /**
   * Push changes to the iModelHub
   * @param accessToken Delegation token of the authorized user.
   * @throws [[IModelError]] If the pull and merge fails.
   */
  public async pushChanges(accessToken: AccessToken): Promise<void> {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();

    return BriefcaseManager.pushChanges(accessToken, this.briefcaseEntry);
  }

  /**
   * Reverse a previously merged set of changes
   * @param accessToken Delegation token of the authorized user.
   * @param version Version to reverse changes to.
   * @throws [[IModelError]] If the reversal fails.
   */
  public async reverseChanges(accessToken: AccessToken, version: IModelVersion = IModelVersion.latest()): Promise<void> {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();

    return BriefcaseManager.reverseChanges(accessToken, this.briefcaseEntry, version);
  }

  /**
   * Reinstate a previously reversed set of changes
   * @param accessToken Delegation token of the authorized user.
   * @param version Version to reinstate changes to.
   * @throws [[IModelError]] If the reinstate fails.
   */
  public async reinstateChanges(accessToken: AccessToken, version: IModelVersion = IModelVersion.latest()): Promise<void> {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();

    return BriefcaseManager.reinstateChanges(accessToken, this.briefcaseEntry, version);
  }

  /**
   * Abandon pending changes to this iModel
   */
  public abandonChanges() {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();

    this.concurrencyControl.abandonRequest();

    this.briefcaseEntry.nativeDb.abandonChanges();
  }

  /** Import an ECSchema. */
  public importSchema(schemaFileName: string) {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();

    const stat = this.briefcaseEntry.nativeDb.importSchema(schemaFileName);
    if (DbResult.BE_SQLITE_OK !== stat)
      throw new IModelError(stat, "Error importing schema", Logger.logError, () => ({ schemaFileName }));
  }

  /** Find an already open IModelDb. Used by the remoting logic.
   * @throws [[IModelError]] if an open IModelDb matching the token is not found.
   */
  public static find(iModelToken: IModelToken): IModelDb {
    const briefcaseEntry = BriefcaseManager.findBriefcaseByToken(iModelToken);
    if (!briefcaseEntry)
      throw new IModelError(IModelStatus.NotFound, undefined, Logger.logError, () => ({ iModelId: iModelToken.iModelId }));
    assert(!!briefcaseEntry.iModelDb);
    return briefcaseEntry.iModelDb!;
  }

  /** Get the ClassMetaDataRegistry for this iModel. */
  public get classMetaDataRegistry(): MetaDataRegistry {
    if (!this._classMetaDataRegistry)
      this._classMetaDataRegistry = new MetaDataRegistry();
    return this._classMetaDataRegistry;
  }

  /** Get access to the ConcurrencyControl for this IModel. */
  public get concurrencyControl(): ConcurrencyControl {
    if (this._concurrency === undefined)
      this._concurrency = new ConcurrencyControl(this);
    return this._concurrency;
  }

  /** Get access to the CodeSpecs in this IModel. */
  public get codeSpecs(): CodeSpecs {
    if (this._codeSpecs === undefined)
      this._codeSpecs = new CodeSpecs(this);
    return this._codeSpecs;
  }

  /** @hidden */
  public insertCodeSpec(codeSpec: CodeSpec): Id64 {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();

    const { error, result: idHexStr } = this.briefcaseEntry.nativeDb.insertCodeSpec(codeSpec.name, codeSpec.specScopeType, codeSpec.scopeReq);
    if (error)
      throw new IModelError(error.status, "Problem inserting CodeSpec", Logger.logWarning);

    return new Id64(idHexStr);
  }

  /** @deprecated */
  public getElementPropertiesForDisplay(elementId: string): string {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();

    const { error, result: idHexStr } = this.briefcaseEntry.nativeDb.getElementPropertiesForDisplay(elementId);
    if (error)
      throw new IModelError(error.status, error.message, Logger.logError, () => ({ iModelId: this.token.iModelId, elementId }));

    return idHexStr!;
  }

  /** Prepare an ECSql statement.
   * @param sql The ECSql statement to prepare
   * @throws [[IModelError]] if there is a problem preparing the statement.
   */
  public prepareStatement(sql: string): ECSqlStatement {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();

    const stmt = new ECSqlStatement();
    stmt.prepare(this.briefcaseEntry.nativeDb, sql);
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
      if (!ClassRegistry.isNotFoundError(err)) {
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
        throw ClassRegistry.makeMetaDataNotFoundError(classFullName); // do not log
    }
    return metadata;
  }

  /*** @hidden */
  private loadMetaData(classFullName: string) {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();

    if (this.classMetaDataRegistry.find(classFullName))
      return;
    const className = classFullName.split(":");
    if (className.length !== 2)
      throw new IModelError(IModelStatus.BadArg, undefined, Logger.logError, () => ({ iModelId: this.token.iModelId, classFullName }));

    const { error, result: metaDataJson } = this.briefcaseEntry.nativeDb.getECClassMetaData(className[0], className[1]);
    if (error)
      throw new IModelError(error.status, undefined, Logger.logError, () => ({ iModelId: this.token.iModelId, classFullName }));

    const metaData = new EntityMetaData(JSON.parse(metaDataJson!));
    this.classMetaDataRegistry.add(classFullName, metaData);
    // Recursive, to make sure that base class is cached.
    if (metaData.baseClasses !== undefined && metaData.baseClasses.length > 0)
      this.loadMetaData(metaData.baseClasses[0]);
  }

  /** TESTING ONLY - Execute a test known to exist using the id recognized by the addon's test execution handler
   * @param id The id of the test you wish to execute
   * @param params A JSON string that should all of the data/parameters the test needs to function correctly
   * @hidden
   */
  public executeTestById(testId: number, params: any): any {
    if (!this.briefcaseEntry)
      throw this._newNotOpenError();

    const retVal: string = this.briefcaseEntry.nativeDb.executeTestById(testId, JSON.stringify(params));
    if (retVal.length === 0)
      return {};
    return JSON.parse(retVal);
  }
}

/**
 * Transaction Concurrency Control.
 * <p>
 * The ConcurrencyControl class helps with making requesting locks and reserving codes.
 * See [[request]], [[ConcurrencyControl.Codes.reserve]], [[Model.buildConcurrencyControlRequest]], [[Element.buildConcurrencyControlRequest]]
 *
 * The ConcurrencyControl class has methods to set the concurrency control policy. [[setPolicy]]
 *
 */
export class ConcurrencyControl {
  private _pendingRequest: ConcurrencyControl.Request;
  private _imodel: IModelDb;
  private _codes: ConcurrencyControl.Codes;
  private _policy: ConcurrencyControl.PessimisticPolicy | ConcurrencyControl.OptimisticPolicy;

  constructor(im: IModelDb) {
    this._imodel = im;
    this._pendingRequest = ConcurrencyControl.createRequest();
  }

  /** @hidden */
  public onSaveChanges() {
    if (this.hasPendingRequests())
      throw new IModelError(IModelStatus.TransactionActive);
  }

  /** @hidden */
  public onSavedChanges() {
    this.applyTransactionOptions();
  }

  /** @hidden */
  private applyTransactionOptions() {
    if (!this._policy)
      return;
    if (!this.inBulkOperation())
      this.startBulkOperation();
  }

  /** Create an empty Request */
  public static createRequest(): ConcurrencyControl.Request {
    return new (NodeAddonRegistry.getAddon()).AddonBriefcaseManagerResourcesRequest();
  }

  /** Convert the request to any */
  public static convertRequestToAny(req: ConcurrencyControl.Request): any {
    return JSON.parse((req as AddonBriefcaseManagerResourcesRequest).toJSON());
  }

  /** @hidden [[Model.buildConcurrencyControlRequest]] */
  public buildRequestForModel(model: Model, opcode: DbOpcode): void {
    if (!this._imodel.briefcaseEntry)
      throw new IModelError(IModelStatus.BadRequest);
    const rc: RepositoryStatus = this._imodel.briefcaseEntry.nativeDb.buildBriefcaseManagerResourcesRequestForModel(this._pendingRequest as AddonBriefcaseManagerResourcesRequest, JSON.stringify(model.id), opcode);
    if (rc !== RepositoryStatus.Success)
      throw new IModelError(rc);
  }

  /** @hidden [[Element.buildConcurrencyControlRequest]] */
  public buildRequestForElement(element: Element, opcode: DbOpcode): void {
    if (!this._imodel.briefcaseEntry)
      throw new IModelError(IModelStatus.BadRequest);
    let rc: RepositoryStatus;
    if (element.id === undefined || opcode === DbOpcode.Insert)
      rc = this._imodel.briefcaseEntry.nativeDb.buildBriefcaseManagerResourcesRequestForElement(this._pendingRequest as AddonBriefcaseManagerResourcesRequest, JSON.stringify({ modelid: element.model, code: element.code }), opcode);
    else
      rc = this._imodel.briefcaseEntry.nativeDb.buildBriefcaseManagerResourcesRequestForElement(this._pendingRequest as AddonBriefcaseManagerResourcesRequest, JSON.stringify(element.id), opcode);
    if (rc !== RepositoryStatus.Success)
      throw new IModelError(rc);
  }

  /** @hidden [[LinkTableRelationship.buildConcurrencyControlRequest]] */
  public buildRequestForLinkTableRelationship(instance: LinkTableRelationship, opcode: DbOpcode): void {
    if (!this._imodel.briefcaseEntry)
      throw new IModelError(IModelStatus.BadRequest);
    const rc: RepositoryStatus = this._imodel.briefcaseEntry.nativeDb.buildBriefcaseManagerResourcesRequestForLinkTableRelationship(this._pendingRequest as AddonBriefcaseManagerResourcesRequest, JSON.stringify(instance), opcode);
    if (rc !== RepositoryStatus.Success)
      throw new IModelError(rc);
  }

  private captureBulkOpRequest() {
    if (this._imodel.briefcaseEntry)
      this._imodel.briefcaseEntry.nativeDb.extractBulkResourcesRequest(this._pendingRequest as AddonBriefcaseManagerResourcesRequest, true, true);
  }

  /** @hidden */
  public get pendingRequest(): ConcurrencyControl.Request {
    this.captureBulkOpRequest();
    return this._pendingRequest;
  }

  /** Are there pending, unprocessed requests for locks or codes? */
  public hasPendingRequests(): boolean {
    if (!this._imodel.briefcaseEntry)
      return false;
    const reqAny: any = ConcurrencyControl.convertRequestToAny(this.pendingRequest);
    return (reqAny.Codes.length !== 0) || (reqAny.Locks.length !== 0);
  }

  /**
   * @hidden
   * Take ownership of all or some of the pending request for locks and codes.
   * @param locksOnly If true, only the locks in the pending request are extracted. The default is to extract all requests.
   * @param codesOnly If true, only the codes in the pending request are extracted. The default is to extract all requests.
   */
  public extractPendingRequest(locksOnly?: boolean, codesOnly?: boolean): ConcurrencyControl.Request {
    if (!this._imodel.briefcaseEntry)
      throw new IModelError(IModelStatus.BadRequest);

    const extractLocks: boolean = !codesOnly;
    const extractCodes: boolean = !locksOnly;

    const req: ConcurrencyControl.Request = ConcurrencyControl.createRequest();
    this._imodel.briefcaseEntry.nativeDb.extractBriefcaseManagerResourcesRequest(req as AddonBriefcaseManagerResourcesRequest, this.pendingRequest as AddonBriefcaseManagerResourcesRequest, extractLocks, extractCodes);
    return req;
  }

  /**
   * Try to acquire locks and/or reserve codes from iModelHub.
   * This function may fulfill some requests and fail to fulfill others. This function returns a rejection of type RequestError if some or all requests could not be fulfilled.
   * The error object will identify the locks and/or codes that are unavailable.
   * ``` ts
   * [[include:BisCore1.sampleConcurrencyControlRequest]]
   * ```
   * @param accessToken The user's iModelHub access token
   * @param req The requests to be sent to iModelHub. If undefined, all pending requests are sent to iModelHub.
   * @throws [[RequestError]] if some or all of the request could not be fulfilled by iModelHub.
   * @throws [[IModelError]] if the IModelDb is not open or is not connected to an iModel.
   */
  public async request(accessToken: AccessToken, req?: ConcurrencyControl.Request): Promise<void> {
    if (!this._imodel.briefcaseEntry)
      return Promise.reject(this._imodel._newNotOpenError());

    if (req === undefined)
      req = this.extractPendingRequest();

    const codeResults = await this.reserveCodesFromRequest(req, this._imodel.briefcaseEntry, accessToken);
    await this.acquireLocksFromRequest(req, this._imodel.briefcaseEntry, accessToken);

    let err: ConcurrencyControl.RequestError | undefined;
    for (const code of codeResults) {
      if (code.state !== CodeState.Reserved) {
        if (err === undefined)
          err = new ConcurrencyControl.RequestError(IModelStatus.CodeNotReserved);
        err.unavailableCodes.push(code);
      }
    }

    if (err !== undefined)
      return Promise.reject(err);
  }

  private buildCodeRequest(briefcaseEntry: BriefcaseEntry, codeSpecId: string, codeScope: string): MultiCode {
    const thisReq = new MultiCode();
    thisReq.briefcaseId = briefcaseEntry.briefcaseId;
    thisReq.state = CodeState.Reserved;
    thisReq.codeSpecId = codeSpecId;
    thisReq.codeScope = codeScope;
    thisReq.values = [];
    return thisReq;
  }

  private buildCodeRequests(briefcaseEntry: BriefcaseEntry, req: ConcurrencyControl.Request): Map<string, any> | undefined {
    const reqAny: any = ConcurrencyControl.convertRequestToAny(req);

    if (!reqAny.hasOwnProperty("Codes") || reqAny.Codes.length === 0)
      return undefined;

    const bySpecId: Map<string, any> = new Map();
    for (const cReq of reqAny.Codes) {
      let byScope: Map<string, MultiCode> | undefined = bySpecId.get(cReq.Id);
      if (byScope === undefined)
        bySpecId.set(cReq.Id, (byScope = new Map()));

      let thisReq: MultiCode | undefined = byScope.get(cReq.Scope);
      if (thisReq === undefined) {
        thisReq = this.buildCodeRequest(briefcaseEntry, cReq.Id, cReq.Scope);
        byScope.set(cReq.Scope, (thisReq = thisReq));
      }

      thisReq.values!.push(cReq.Name);
    }

    return bySpecId;
  }

  private buildCodeRequestsFromCodes(briefcaseEntry: BriefcaseEntry, codes: Code[]): Map<string, any> {

    const bySpecId: Map<string, any> = new Map();
    for (const code of codes) {
      if (code.value === undefined)
        continue;
      const specId = code.spec.toString();
      let byScope: Map<string, MultiCode> | undefined = bySpecId.get(specId);
      if (byScope === undefined)
        bySpecId.set(specId, (byScope = new Map()));

      let thisReq: MultiCode | undefined = byScope.get(code.scope);
      if (thisReq === undefined) {
        thisReq = this.buildCodeRequest(briefcaseEntry, specId, code.scope);
        byScope.set(code.scope, (thisReq = thisReq));
      }

      thisReq.values!.push(code.value);
    }

    return bySpecId;
  }

  private buildLockRequests(_briefcaseInfo: BriefcaseEntry, req: ConcurrencyControl.Request): Map<string, any> | undefined {
    const reqAny: any = ConcurrencyControl.convertRequestToAny(req);

    if (!reqAny.hasOwnProperty("Locks") || reqAny.Locks.length === 0)
      return undefined;

    /*
    const bySpecId: Map<string, any> = new Map();
    for (const cReq of reqAny.Locks) {
      let byScope: Map<string, MultiCode> | undefined = bySpecId.get(cReq.Id);
      if (byScope === undefined)
        bySpecId.set(cReq.Id, (byScope = new Map()));

      let thisReq: MultiCode | undefined = byScope.get(cReq.Scope);
      if (thisReq === undefined) {
        thisReq = this.buildCodeRequest(briefcaseEntry, cReq.Id, cReq.Scope);
        byScope.set(cReq.Scope, (thisReq = thisReq));
      }

      thisReq.values.push(cReq.Name);
    }

    return bySpecId;
    */
    throw new IModelError(IModelStatus.BadRequest, "TBD locks");
  }

  private getDeploymentEnv(): DeploymentEnv {
    return Configuration.iModelHubDeployConfig;
  }

  private getIModelHubClient(): IModelHubClient {
    return new IModelHubClient(this.getDeploymentEnv());
  }

  /** process the Lock-specific part of the request. */
  private async acquireLocksFromRequest(req: ConcurrencyControl.Request, briefcaseEntry: BriefcaseEntry, _accessToken: AccessToken): Promise<void> {
    const bySpecId = this.buildLockRequests(briefcaseEntry, req);
    if (bySpecId === undefined)
      return;

    /* TODO locks

    const imodelHubClient = this.getIModelHubClient();

    for (const [, thisSpec] of bySpecId) {
      for (const [, thisReq] of thisSpec) {
        const newCodes: MultiCode = await imodelHubClient.requestMultipleCodes(accessToken, briefcaseEntry.iModelId, thisReq);
        console.log(JSON.stringify(newCodes));
      }
    }
    */
    Promise.reject(new IModelError(IModelStatus.BadRequest, "TBD locks"));
  }

  /** process a Code-reservation request. The requests in bySpecId must already be in iModelHub REST format. */
  private async reserveCodes2(bySpecId: Map<string, any>, briefcaseEntry: BriefcaseEntry, accessToken: AccessToken): Promise<MultiCode[]> {

    const imodelHubClient = this.getIModelHubClient();

    const results: MultiCode[] = [];

    for (const [, thisSpec] of bySpecId) {
      for (const [, thisReq] of thisSpec) {
        results.push(await imodelHubClient.requestMultipleCodes(accessToken, briefcaseEntry.iModelId, thisReq));
      }
    }

    return results;
  }

  /** process the Code-specific part of the request. */
  private async reserveCodesFromRequest(req: ConcurrencyControl.Request, briefcaseEntry: BriefcaseEntry, accessToken: AccessToken): Promise<MultiCode[]> {
    const bySpecId = this.buildCodeRequests(briefcaseEntry, req);
    if (bySpecId === undefined)
      return [];

    return this.reserveCodes2(bySpecId, briefcaseEntry, accessToken);
  }

  /** Reserve the specified codes */
  public async reserveCodes(accessToken: AccessToken, codes: Code[]): Promise<MultiCode[]> {
    if (this._imodel.briefcaseEntry === undefined)
      return Promise.reject(this._imodel._newNotOpenError());

    const bySpecId = this.buildCodeRequestsFromCodes(this._imodel.briefcaseEntry, codes);
    if (bySpecId === undefined)
      return Promise.reject(new IModelError(IModelStatus.NotFound));

    return this.reserveCodes2(bySpecId, this._imodel.briefcaseEntry, accessToken);
  }

  // Query the state of the Codes for the specified CodeSpec and scope.
  public async queryCodeStates(accessToken: AccessToken, specId: Id64, scopeId: string, _value?: string): Promise<MultiCode[]> {
    if (this._imodel.briefcaseEntry === undefined)
      return Promise.reject(this._imodel._newNotOpenError());

    const queryOptions: RequestQueryOptions = {
      $filter: `CodeSpecId+eq+'${specId}'+and+CodeScope+eq+'${scopeId}'`,
    };

    /* NEEDS WORK
    if (value !== undefined) {
      queryOptions.$filter += `+and+Value+eq+'${value}'`;
    }
    */

    const imodelHubClient = this.getIModelHubClient();

    return imodelHubClient.getMultipleCodes(accessToken, this._imodel.briefcaseEntry.iModelId, queryOptions);
  }

  /** Abandon any pending requests for locks or codes. */
  public abandonRequest() {
    this.extractPendingRequest();
  }

  private static anyFound(a1: string[], a2: string[]) {
    for (const a of a1) {
      if (a2.includes(a))
        return true;
    }
    return false;
  }

  /**
   * Check to see if *all* of the codes in the specified request are available.
   * @param req the list of code requests to be fulfilled. If not specified then all pending requests for codes are queried.
   * @returns true if all codes are available or false if any is not.
   */
  public async areCodesAvailable(accessToken: AccessToken, req?: ConcurrencyControl.Request): Promise<boolean> {
    if (!this._imodel.briefcaseEntry)
      return Promise.reject(this._imodel._newNotOpenError());
    // throw new Error("TBD");
    if (req === undefined)
      req = this.pendingRequest;
    const bySpecId = this.buildCodeRequests(this._imodel.briefcaseEntry, req);
    if (bySpecId !== undefined) {
      for (const [specId, thisSpec] of bySpecId) {
        for (const [scopeId, thisReq] of thisSpec) {
          // Query the state of all codes in this spec and scope
          const multiCodes = await this.queryCodeStates(accessToken, new Id64(specId), scopeId);
          for (const multiCode of multiCodes) {
            if (multiCode.state !== CodeState.Available) {
              if (ConcurrencyControl.anyFound(multiCode.values!, thisReq.values)) {
                return false;
              }
            }
          }
        }
      }
    }
    return true;
  }

  /**
   * Check to see if *all* of the requested resources could be acquired from iModelHub.
   * @param req the list of resource requests to be fulfilled. If not specified then all pending requests for locks and codes are queried.
   * @returns true if all resources could be acquired or false if any could not be acquired.
   */
  public async areAvailable(accessToken: AccessToken, req?: ConcurrencyControl.Request): Promise<boolean> {
    if (!this._imodel.briefcaseEntry)
      return Promise.reject(this._imodel._newNotOpenError());

    if (req === undefined)
      req = this.pendingRequest;

    const allCodesAreAvailable = await this.areCodesAvailable(accessToken, req);
    if (!allCodesAreAvailable)
      return false;

    // TODO: Locks

    return true;
  }

  /** Set the concurrency control policy.
   * Before changing from optimistic to pessimistic, all local changes must be saved and uploaded to iModelHub.
   * Before changing the locking policy of the pessimistic concurrency policy, all local changes must be saved to the IModelDb.
   * Here is an example of setting an optimistic policy:
   * ``` ts
   * [[include:BisCore1.sampleSetPolicy]]
   * ```
   * @param policy The policy to used
   * @throws [[IModelError]] if the policy cannot be set.
   */
  public setPolicy(policy: ConcurrencyControl.PessimisticPolicy | ConcurrencyControl.OptimisticPolicy): void {
    this._policy = policy;
    if (!this._imodel.briefcaseEntry)
      throw new IModelError(IModelStatus.BadRequest);
    let rc: RepositoryStatus = RepositoryStatus.Success;
    if (policy as ConcurrencyControl.OptimisticPolicy) {
      const oc: ConcurrencyControl.OptimisticPolicy = policy as ConcurrencyControl.OptimisticPolicy;
      rc = this._imodel.briefcaseEntry.nativeDb.setBriefcaseManagerOptimisticConcurrencyControlPolicy(oc.conflictResolution);
    } else {
      rc = this._imodel.briefcaseEntry.nativeDb.setBriefcaseManagerPessimisticConcurrencyControlPolicy();
    }
    if (RepositoryStatus.Success !== rc) {
      throw new IModelError(rc);
    }
    this.applyTransactionOptions();
  }

  /**
   * By entering bulk operation mode, an app can insert, update, and delete entities in the IModelDb without first acquiring locks.
   * When the app calls saveChanges, the transaction manager attempts to acquire all needed locks and codes.
   * The transaction manager will roll back all pending changes if any lock or code cannot be acquired at save time. Lock and code acquisition will fail if another user
   * has pushed changes to the same entities or used the same codes as the local transaction.
   * This mode can therefore be used safely only in special cases where contention for locks and codes is not a risk.
   * Normally, that is only possible when writing to a model that is exclusively locked and where codes are scoped to that model.
   * See [[request]], [[IModelDb.saveChanges]] and [[endBulkOperation]].
   * @throws [[IModelError]] if it would be illegal to enter bulk operation mode.
   */
  private startBulkOperation(): void {
    if (!this._imodel.briefcaseEntry)
      throw new IModelError(IModelStatus.BadRequest);
    const rc: RepositoryStatus = this._imodel.briefcaseEntry.nativeDb.briefcaseManagerStartBulkOperation();
    if (RepositoryStatus.Success !== rc)
      throw new IModelError(rc);
  }

  /** Check if there is a bulk operation in progress */
  private inBulkOperation(): boolean {
    if (!this._imodel.briefcaseEntry)
      return false;
    return this._imodel.briefcaseEntry.nativeDb.inBulkOperation();
  }

  /*
   * Ends the bulk operation and appends the locks and codes that it recorded to the pending request.
  private endBulkOperation() {
    if (!this._imodel.briefcaseEntry)
      return;
    this.captureBulkOpRequest();
    // Now exit bulk operation mode in the addon. It will then stop collecting (and start enforcing) lock and code requirements.
    const rc: RepositoryStatus = this._imodel.briefcaseEntry.nativeDb.briefcaseManagerEndBulkOperation();
    if (RepositoryStatus.Success !== rc)
      throw new IModelError(rc);
    this.applyTransactionOptions(); // (may re-start the bulk operation)
  }
   */

  /** API to reserve Codes and query the status of Codes */
  get codes(): ConcurrencyControl.Codes {
    if (this._codes === undefined)
      this._codes = new ConcurrencyControl.Codes(this._imodel);
    return this._codes;
  }

}

export namespace ConcurrencyControl {

  /** A request for locks and/or code reservations. */
  export class Request {
    private constructor() { }
  }

  /** How to handle a conflict. Keep this consistent with DgnPlatform/RepositoryManager.h. */
  export const enum OnConflict {
    /** Reject the incoming change */
    RejectIncomingChange = 0,
    /** Accept the incoming change */
    AcceptIncomingChange = 1,
  }

  /**
   * The options for how conflicts are to be handled during change-merging in an OptimisticConcurrencyControlPolicy.
   * The scenario is that the caller has made some changes to the *local* IModelDb. Now, the caller is attempting to
   * merge in changes from iModelHub. The properties of this policy specify how to handle the *incoming* changes from iModelHub.
   */
  export class ConflictResolutionPolicy {
    /** What to do with the incoming change in the case where the same entity was updated locally and also would be updated by the incoming change. */
    public updateVsUpdate: OnConflict;
    /** What to do with the incoming change in the case where an entity was updated locally and would be deleted by the incoming change. */
    public updateVsDelete: OnConflict;
    /** What to do with the incoming change in the case where an entity was deleted locally and would be updated by the incoming change. */
    public deleteVsUpdate: OnConflict;

    /**
     * Construct a ConflictResolutionPolicy.
     * @param updateVsUpdate - the default is ConcurrencyControl.OnConflict.RejectIncomingChange
     * @param updateVsDelete - the default is ConcurrencyControl.OnConflict.AcceptIncomingChange
     * @param deleteVsUpdate - the default is ConcurrencyControl.OnConflict.RejectIncomingChange
     */
    constructor(updateVsUpdate?: OnConflict, updateVsDelete?: OnConflict, deleteVsUpdate?: OnConflict) {
      this.updateVsUpdate = updateVsUpdate ? updateVsUpdate! : ConcurrencyControl.OnConflict.RejectIncomingChange;
      this.updateVsDelete = updateVsDelete ? updateVsDelete! : ConcurrencyControl.OnConflict.AcceptIncomingChange;
      this.deleteVsUpdate = deleteVsUpdate ? deleteVsUpdate! : ConcurrencyControl.OnConflict.RejectIncomingChange;
    }
  }

  /** Specifies an optimistic concurrency policy.
   * Optimistic concurrency allows entities to be modified in the IModelDb without first acquiring locks. Allows codes to be used in the IModelDb without first acquiring them.
   * This creates the possibility that other apps may have uploaded changeSets to iModelHub that overlap with local changes.
   * In that case, overlapping changes are merged when changeSets are downloaded from iModelHub.
   * A ConflictResolutionPolicy is then applied in cases where an overlapping change conflict with a local change.
   */
  export class OptimisticPolicy {
    public conflictResolution: ConflictResolutionPolicy;
    constructor(p?: ConflictResolutionPolicy) { this.conflictResolution = p ? p! : new ConflictResolutionPolicy(); }
  }

  /** Specifies a pessimistic concurrency policy.
   * Pessimistic concurrency means that entities must be locked and codes must be acquired before local changes can be pushed to iModelHub.
   */
  export class PessimisticPolicy {
  }

  /** Thrown when iModelHub denies or cannot process a request. */
  export class RequestError extends IModelError {
    public unavailableCodes: MultiCode[];
    public unavailableLocks: MultiCode[];
  }

  /** Code manager */
  export class Codes {
    private _imodel: IModelDb;

    constructor(im: IModelDb) {
      this._imodel = im;
    }

    /**
     * Reserve Codes. If no Codes are specified, then all of the Codes that are in currently pending requests are reserved.
     * This function may only be able to reserve some of the requested Codes. In that case, this function will return a rejection of type RequestError.
     * The error object will identify the codes that are unavailable.
     * ``` ts
     * [[include:BisCore1.sampleReserveCodesWithErrorHandling]]
     * ```
     * @param codes The Codes to reserve
     * @throws [[RequestError]]
     */
    public async reserve(accessToken: AccessToken, codes?: Code[]) {

      if (!this._imodel.briefcaseEntry)
        return Promise.reject(this._imodel._newNotOpenError());

      if (codes !== undefined) {
        await this._imodel.concurrencyControl.reserveCodes(accessToken, codes);
        // TODO: examine result and throw CodeReservationError if some codes could not be reserved
        return;
      }

      const req: ConcurrencyControl.Request = this._imodel.concurrencyControl.extractPendingRequest(false, true);
      this._imodel.briefcaseEntry.nativeDb.extractBulkResourcesRequest(req as AddonBriefcaseManagerResourcesRequest, false, true);
      this._imodel.briefcaseEntry.nativeDb.extractBriefcaseManagerResourcesRequest(req as AddonBriefcaseManagerResourcesRequest, req as AddonBriefcaseManagerResourcesRequest, false, true);
      return this._imodel.concurrencyControl.request(accessToken, req);
    }

    /**
     * Queries the state of the specified Codes in the code service.
     * @param accessToken The user's iModelHub access token
     * @param specId The CodeSpec to query
     * @param scopeId The scope to query
     * @param value Optional. The Code value to query.
     */
    public async query(accessToken: AccessToken, specId: Id64, scopeId: string, value?: string): Promise<MultiCode[]> {
      return this._imodel.concurrencyControl.queryCodeStates(accessToken, specId, scopeId, value);
    }
  }

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

    if (!this._iModel.briefcaseEntry)
      throw this._iModel._newNotOpenError();

    // Must go get the model from the iModel. Start by requesting the model's data.
    const { error, result: json } = this._iModel.briefcaseEntry.nativeDb.getModel(JSON.stringify({ id: modelId }));
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
    if (!this._iModel.briefcaseEntry)
      throw this._iModel._newNotOpenError();

    // Must go get the model from the iModel. Start by requesting the model's data.
    const { error, result: json } = this._iModel.briefcaseEntry.nativeDb.getModel(JSON.stringify({ id: modelIdStr }));
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
   * ``` ts
   * [[include:BisCore1.sampleCreateModel]]
   * ```
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
    if (!this._iModel.briefcaseEntry)
      throw this._iModel._newNotOpenError();

    if (model.isPersistent()) {
      assert(false);
      throw new IModelError(IModelStatus.WriteError, "Cannot insert a model marked as persistent. Call copyForEdit.", Logger.logError);
    }

    const { error, result: json } = this._iModel.briefcaseEntry.nativeDb.insertModel(JSON.stringify(model));
    if (error)
      throw new IModelError(error.status, "Problem inserting model", Logger.logWarning);

    return model.id = new Id64(JSON.parse(json!).id);
  }

  /** Update an existing model.
   * @param model An editable copy of the model, containing the new/proposed data.
   * @throws [[IModelError]] if unable to update the model.
   */
  public updateModel(model: ModelProps): void {
    if (!this._iModel.briefcaseEntry)
      throw this._iModel._newNotOpenError();

    if ((model.isPersistent !== undefined) && model.isPersistent()) {
      assert(false);
      throw new IModelError(IModelStatus.WriteError, "Cannot update a model marked as persistent. Call copyForEdit.", Logger.logError);
    }

    const error: IModelStatus = this._iModel.briefcaseEntry.nativeDb.updateModel(JSON.stringify(model));
    if (error !== IModelStatus.Success)
      throw new IModelError(error, "", Logger.logWarning);

    // Discard from the cache, to make sure that the next fetch see the updated version.
    if (model.id)
      this._loaded.delete(model.id.toString());
  }

  /** Delete an existing model.
   * @param model The model to be deleted
   * @throws [[IModelError]]
   */
  public deleteModel(model: Model): void {
    if (!this._iModel.briefcaseEntry)
      throw this._iModel._newNotOpenError();

    const error: IModelStatus = this._iModel.briefcaseEntry.nativeDb.deleteModel(model.id.toString());
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
    if (!this._iModel.briefcaseEntry)
      throw this._iModel._newNotOpenError();

    // Must go get the element from the iModel. Start by requesting the element's data.
    const { error, result: json } = this._iModel.briefcaseEntry.nativeDb.getElement(JSON.stringify(opts));
    if (error)
      throw new IModelError(error.status, error.message, Logger.logWarning);
    const props = JSON.parse(json!) as ElementProps;
    props.iModel = this._iModel;
    return props;
  }

  public getElementJson(elementIdStr: string): string {
    if (!this._iModel.briefcaseEntry)
      throw this._iModel._newNotOpenError();

    // Must go get the element from the iModel. Start by requesting the element's data.
    const { error, result: json } = this._iModel.briefcaseEntry.nativeDb.getElement(JSON.stringify({ id: elementIdStr }));
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
   * @returns The element that uses the code or undefined if the code is not used.
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
      return stmt.getRow_new().id;
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
    if (!this._iModel.briefcaseEntry)
      throw this._iModel._newNotOpenError();

    const { error, result: json } = this._iModel.briefcaseEntry.nativeDb.insertElement(JSON.stringify(elProps));
    if (error)
      throw new IModelError(error.status, "Problem inserting element", Logger.logWarning);

    return new Id64(JSON.parse(json!).id);
  }

  /** Update some properties of an existing element.
   * @param el the properties of the element to update.
   * @throws [[IModelError]] if unable to update the element.
   */
  public updateElement(props: ElementProps): void {
    if (!this._iModel.briefcaseEntry)
      throw this._iModel._newNotOpenError();

    const error: IModelStatus = this._iModel.briefcaseEntry.nativeDb.updateElement(JSON.stringify(props));
    if (error !== IModelStatus.Success)
      throw new IModelError(error, "", Logger.logWarning);

    // Discard from the cache, to make sure that the next fetch see the updated version.
    if (props.id)
      this._loaded.delete(props.id.toString());
  }

  /**
   * Delete an element from this iModel.
   * @param id The Id of the element to be deleted
   * @throws [[IModelError]]
   */
  public deleteElement(id: Id64): void {
    if (!this._iModel.briefcaseEntry)
      throw this._iModel._newNotOpenError();

    const error: IModelStatus = this._iModel.briefcaseEntry.nativeDb.deleteElement(id.toString());
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
      childIds.push(row.id);
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

/** The collection of views in an [[IModelDb]]. */
export class IModelDbViews {
  private _iModel: IModelDb;

  /** @hidden */
  public constructor(iModel: IModelDb) { this._iModel = iModel; }

  /** Query for the array of ViewDefinitionProps of the specified class and matching the specified IsPrivate setting.
   * @param className Query for view definitions of this class.
   * @param wantPrivate If true, include private view definitions.
   */
  public queryViewDefinitionProps(className: string = "BisCore.ViewDefinition", wantPrivate: boolean = false): ViewDefinitionProps[] {
    let sql: string = "SELECT ECInstanceId AS id FROM " + className;
    if (!wantPrivate)
      sql += " WHERE IsPrivate=FALSE";
    sql += ` LIMIT ${IModelDb.defaultLimit}`; // limit number of returned view definitions

    const viewIds: Id64[] = [];
    const statement: ECSqlStatement = this._iModel.getPreparedStatement(sql);
    try {
      for (const row of statement)
        viewIds.push(new Id64(row.id));
    } finally {
      this._iModel.releasePreparedStatement(statement);
    }
    return viewIds.map((viewId: Id64) => this._iModel.elements.getElementProps(viewId) as ViewDefinitionProps);
  }
}
