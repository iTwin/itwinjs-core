/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module IModelDb */
import { Guid, Id64, Id64Set, LRUMap, OpenMode, DbResult, Logger, BeEvent, assert, Id64Props } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import {
  Code, CodeSpec, ElementProps, ElementAspectProps, IModel, IModelProps, IModelVersion, ModelProps, IModelToken,
  IModelError, IModelStatus, AxisAlignedBox3d, EntityQueryParams, EntityProps, ViewDefinitionProps,
  FontMap, FontMapProps, ElementLoadProps, CreateIModelProps, FilePropertyProps,
} from "@bentley/imodeljs-common";
import { ClassRegistry, MetaDataRegistry } from "./ClassRegistry";
import { Element, Subject } from "./Element";
import { ElementAspect, ElementMultiAspect, ElementUniqueAspect } from "./ElementAspect";
import { Model } from "./Model";
import { BriefcaseEntry, BriefcaseManager, KeepBriefcase, BriefcaseId } from "./BriefcaseManager";
import { ECSqlStatement, ECSqlStatementCache } from "./ECSqlStatement";
import { CodeSpecs } from "./CodeSpecs";
import { Entity, EntityMetaData } from "./Entity";
import * as path from "path";
import { IModelDbLinkTableRelationships } from "./LinkTableRelationship";
import { ConcurrencyControl } from "./ConcurrencyControl";

/** @hidden */
const loggingCategory = "imodeljs-backend.IModelDb";

/** The signature of a function that can supply a description of local Txns in the specified briefcase up to and including the specified endTxnId. */
export type ChangeSetDescriber = (endTxnId: TxnManager.TxnId) => string;

/** Represents a physical copy (briefcase) of an iModel that can be accessed as a file on the local computer.
 *
 * An IModelDb is used by a service or by the "back end" of an app.
 * "Front end" code uses an [[IModelConnection]] to access an iModel indirectly, via a service or backend.
 *
 * Use [[IModelDb.open]] to obtain and open an IModelDb from iModelHub.
 *
 * An IModelDb provides access to the content of the iModel through the following collections:
 *  * [[IModelDb.elements]] for Elements
 *  * [[IModelDb.models]] for Models
 *
 * An IModelDb is a full-featured database.
 * Use [[ECSqlStatement]] to write custom queries on the contents of an IModelDb.
 *
 * As a local copy, an IModelDb represents a version of an iModel.
 * Use [[IModelDb.pullAndMergeChanges]] to update a local IModelDb to incorporate recent changes made by others.
 *
 * An IModelDb also serves as a staging area where an app can change the content of an iModel and then later submit the changes to iModelHub.
 * Use [[IModelDb.saveChanges]] to commit changes locally. [[IModelDb.txns]] manages local transactions, and it supports local undo/redo.
 * Use [[IModelDb.pushChanges]] to push local changes to iModelHub as a changeset, so that others can see them. After
 * being pushed to iModelHub, a changeset becomes part of the iModel's permanent history.
 * An app that modifies models, elements or codes in an IModelDb must use [[ConcurrencyControl]] to coordinate with other users.
 *
 * IModelDb raises a set of events to allow apps and subsystems to track IModelDb object life cycle, including [[onOpen]] and [[onOpened]].
 *
 */
export class IModelDb extends IModel {
  public static readonly defaultLimit = 1000;
  public static readonly maxLimit = 10000;
  private static _accessTokens?: Map<string, AccessToken>;
  /** Event called after a changeset is applied to this IModelDb. */
  public readonly onChangesetApplied = new BeEvent<() => void>();
  public models: IModelDbModels = new IModelDbModels(this);
  public elements: IModelDbElements = new IModelDbElements(this);
  public views: IModelDbViews = new IModelDbViews(this);
  private _linkTableRelationships?: IModelDbLinkTableRelationships;
  private readonly statementCache: ECSqlStatementCache = new ECSqlStatementCache();
  private _codeSpecs?: CodeSpecs;
  private _classMetaDataRegistry?: MetaDataRegistry;
  private _concurrency?: ConcurrencyControl;
  private _txnManager?: TxnManager;
  protected _fontMap?: FontMap;
  public readFontJson(): string { return this.briefcase!.nativeDb.readFontMap(); }
  public getFontMap(): FontMap { return this._fontMap || (this._fontMap = new FontMap(JSON.parse(this.readFontJson()) as FontMapProps)); }
  //  public embedFont(prop: FontProps): FontProps { return JSON.parse(this.briefcase!.nativeDb.embedFont(JSON.stringify(prop))) as FontProps; }

  /** Event raised just before a connected IModelDb is opened.<p><em>Example:</em>
   * ``` ts
   * [[include:IModelDb.onOpen]]
   * ```
   */
  public static readonly onOpen = new BeEvent<(_accessToken: AccessToken, _contextId: string, _iModelId: string, _openMode: OpenMode, _version: IModelVersion) => void>();
  /** Event raised just after a connected IModelDb is opened. This event is raised only for iModel access initiated by this app only.
   * This event is not raised for standalone IModelDbs. <p><em>Example:</em>
   * ``` ts
   * [[include:IModelDb.onOpened]]
   * ```
   */
  public static readonly onOpened = new BeEvent<(_imodelDb: IModelDb) => void>();
  /** Event raised just before an IModelDb is created in iModelHub. This event is raised only for iModel access initiated by this app only. This event is not raised for standalone IModelDbs. */
  public static readonly onCreate = new BeEvent<(_accessToken: AccessToken, _contextId: string, _args: CreateIModelProps) => void>();
  /** Event raised just after an IModelDb is created in iModelHub. This event is raised only for iModel access initiated by this app only. This event is not raised for standalone IModelDbs. */
  public static readonly onCreated = new BeEvent<(_imodelDb: IModelDb) => void>();

  /** @hidden */
  public briefcase?: BriefcaseEntry;

  /** Get the mode used to open this iModel */
  public get openMode(): OpenMode | undefined { return this.briefcase ? this.briefcase.openMode : undefined; }

  private constructor(briefcaseEntry: BriefcaseEntry, iModelToken: IModelToken) {
    super(iModelToken);
    this.setupBriefcaseEntry(briefcaseEntry);
    this.initializeIModelDb();
  }

  private initializeIModelDb() {
    let props: any;
    try {
      props = JSON.parse(this.briefcase!.nativeDb.getIModelProps()) as IModelProps;
    } catch (error) { }

    const name = props.rootSubject ? props.rootSubject.name : path.basename(this.briefcase!.pathname);
    super.initialize(name, props);
  }

  private static constructIModelDb(briefcaseEntry: BriefcaseEntry, contextId?: string): IModelDb {
    if (briefcaseEntry.iModelDb)
      return briefcaseEntry.iModelDb; // If there's an IModelDb already associated with the briefcase, that should be reused.
    const iModelToken = new IModelToken(briefcaseEntry.getPathKey(), briefcaseEntry.isStandalone, contextId, briefcaseEntry.iModelId, briefcaseEntry.changeSetId, briefcaseEntry.openMode, briefcaseEntry.userId);
    return new IModelDb(briefcaseEntry, iModelToken);
  }

  /**
   * Get the AccessToken that is considered to be the owner of a local IModelDb.
   * Note: Call this only for IModels that are known to have been opened during the current session using [[IModelDb.open]].
   * @param iModelId The IModelID of an open IModelDb
   * @throws [[IModelError]] with [[IModelStatus.NotFound]] if no AccessToken is registered for the specified IModel. That could happen if the IModel is not currently open.
   */
  public static getAccessToken(iModelId: string): AccessToken {
    if (IModelDb._accessTokens === undefined)
      throw new IModelError(IModelStatus.NotFound);
    const token: AccessToken | undefined = IModelDb._accessTokens.get(iModelId);
    if (token === undefined)
      throw new IModelError(IModelStatus.NotFound);
    return token;
  }

  private static setFirstAccessToken(iModelId: string, accessToken: AccessToken) {
    if (IModelDb._accessTokens === undefined)
      IModelDb._accessTokens = new Map<string, AccessToken>();
    if (IModelDb._accessTokens.get(iModelId) === undefined)
      IModelDb._accessTokens.set(iModelId, accessToken);
  }

  /**
   * Change the AccessToken that should be considered the owner of the local IModelDb.
   * @param iModelId iModelId The IModelID of an open IModelDb
   * @param accessToken The AccessToken that should be considered the owner of the local IModelDb.
   */
  public static updateAccessToken(iModelId: string, accessToken: AccessToken) {
    if (IModelDb._accessTokens !== undefined)
      IModelDb._accessTokens.delete(iModelId);
    IModelDb.setFirstAccessToken(iModelId, accessToken);
  }

  /**
   * Create a standalone local Db
   * @param fileName The name for the iModel
   * @param args The parameters of the iModel
   */
  public static createStandalone(fileName: string, args: CreateIModelProps): IModelDb {
    const briefcaseEntry: BriefcaseEntry = BriefcaseManager.createStandalone(fileName, args);
    // Logger.logTrace(loggingCategory, "IModelDb.createStandalone", loggingCategory, () => ({ pathname }));
    return IModelDb.constructIModelDb(briefcaseEntry);
  }

  /** Create an iModel on the Hub */
  public static async create(accessToken: AccessToken, contextId: string, fileName: string, args: CreateIModelProps): Promise<IModelDb> {
    IModelDb.onCreate.raiseEvent(accessToken, contextId, args);
    const briefcaseEntry: BriefcaseEntry = await BriefcaseManager.create(accessToken, contextId, fileName, args);
    const imodelDb = IModelDb.constructIModelDb(briefcaseEntry, contextId);
    IModelDb.setFirstAccessToken(imodelDb.briefcase!.iModelId, accessToken);
    IModelDb.onCreated.raiseEvent(imodelDb);
    return imodelDb;
  }

  /** Open the iModel from a local file
   * @param pathname The pathname of the iModel
   * @param openMode Open mode for database
   * @param enableTransactions Enable tracking of transactions in this standalone iModel
   * @throws [[IModelError]]
   */
  public static openStandalone(pathname: string, openMode: OpenMode = OpenMode.ReadWrite, enableTransactions: boolean = false): IModelDb {
    const briefcaseEntry: BriefcaseEntry = BriefcaseManager.openStandalone(pathname, openMode, enableTransactions);
    return IModelDb.constructIModelDb(briefcaseEntry);
  }

  /**
   * Open an iModel from the iModelHub. IModelDb files are cached locally. If the requested version is already in the cache, then open will open it from there.
   * Otherwise, open will download the requested version from iModelHub and cache it.
   * <p><em>Example:</em>
   * ``` ts
   * [[include:IModelDb.open]]
   * ```
   * @param accessToken Delegation token of the authorized user.
   * @param contextId Id of the Connect Project or Asset containing the iModel
   * @param iModelId Id of the iModel
   * @param openMode Open mode
   * @param version Version of the iModel to open
   */
  public static async open(accessToken: AccessToken, contextId: string, iModelId: string, openMode: OpenMode = OpenMode.ReadWrite, version: IModelVersion = IModelVersion.latest()): Promise<IModelDb> {
    IModelDb.onOpen.raiseEvent(accessToken, contextId, iModelId, openMode, version);
    const briefcaseEntry: BriefcaseEntry = await BriefcaseManager.open(accessToken, contextId, iModelId, openMode, version);
    Logger.logTrace(loggingCategory, "IModelDb.open", () => ({ iModelId, openMode }));
    const imodelDb = IModelDb.constructIModelDb(briefcaseEntry, contextId);
    IModelDb.setFirstAccessToken(imodelDb.briefcase!.iModelId, accessToken);
    IModelDb.onOpened.raiseEvent(imodelDb);
    return imodelDb;
  }

  /**
   * Close this standalone iModel, if it is currently open
   */
  public closeStandalone(): void {
    if (!this.briefcase)
      return;
    BriefcaseManager.closeStandalone(this.briefcase);
    this.clearBriefcaseEntry();
  }

  /**
   * Close this iModel, if it is currently open.
   * @param accessToken Delegation token of the authorized user.
   * @param keepBriefcase Hint to discard or keep the briefcase for potential future use.
   */
  public async close(accessToken: AccessToken, keepBriefcase: KeepBriefcase = KeepBriefcase.Yes): Promise<void> {
    if (!this.briefcase)
      return;
    await BriefcaseManager.close(accessToken, this.briefcase, keepBriefcase);
    this.clearBriefcaseEntry();
  }

  private forwardChangesetApplied() { this.onChangesetApplied.raiseEvent(); }
  private setupBriefcaseEntry(briefcaseEntry: BriefcaseEntry) {
    this.briefcase = briefcaseEntry;
    this.briefcase.iModelDb = this;
    this.briefcase.onBeforeClose.addListener(this.onBriefcaseCloseHandler, this);
    this.briefcase.onBeforeVersionUpdate.addListener(this.onBriefcaseVersionUpdatedHandler, this);
    this.briefcase.onChangesetApplied.addListener(this.forwardChangesetApplied, this);
  }
  private clearBriefcaseEntry(): void {
    this.briefcase!.onBeforeClose.removeListener(this.onBriefcaseCloseHandler, this);
    this.briefcase!.onBeforeVersionUpdate.removeListener(this.onBriefcaseVersionUpdatedHandler, this);
    this.briefcase!.onChangesetApplied.removeListener(this.forwardChangesetApplied, this);
    this.briefcase!.iModelDb = undefined;
    this.briefcase = undefined;
  }

  private onBriefcaseCloseHandler() {
    this.onBeforeClose.raiseEvent();
    this.clearStatementCache();
  }

  private onBriefcaseVersionUpdatedHandler() { this.iModelToken.changeSetId = this.briefcase!.changeSetId; }

  /** Event called when the iModel is about to be closed */
  public readonly onBeforeClose = new BeEvent<() => void>();

  /** Get the in-memory handle of the native Db */
  public get nativeDb(): any { return (this.briefcase === undefined) ? undefined : this.briefcase.nativeDb; }

  /** Get the briefcase ID of this iModel */
  public getBriefcaseId(): BriefcaseId { return new BriefcaseId(this.briefcase === undefined ? BriefcaseId.Illegal : this.briefcase.briefcaseId); }

  /** Returns a new IModelError with errorNumber, message, and meta-data set properly for a *not open* error.
   * @hidden
   */
  public _newNotOpenError() {
    return new IModelError(IModelStatus.NotOpen, "IModelDb not open" + this.name, Logger.logError, loggingCategory, () => ({ iModelId: this.iModelToken.iModelId }));
  }

  /** Get a prepared ECSQL statement - may require preparing the statement, if not found in the cache.
   * @param ecsql The ECSQL statement to prepare
   * @returns the prepared statement
   * @throws IModelError if the statement cannot be prepared. Normally, prepare fails due to ECSQL syntax errors or references to tables or properties that do not exist. The error.message property will describe the property.
   */
  private getPreparedStatement(ecsql: string): ECSqlStatement {
    const cachedStatement = this.statementCache.find(ecsql);
    if (cachedStatement !== undefined && cachedStatement.useCount === 0) {  // we can only recycle a previously cached statement if nobody is currently using it.
      cachedStatement.useCount++;
      return cachedStatement.statement;
    }

    this.statementCache.removeUnusedStatementsIfNecessary();
    const stmt = this.prepareStatement(ecsql);
    this.statementCache.add(ecsql, stmt);
    return stmt;
  }
  private releasePreparedStatement(stmt: ECSqlStatement): void { this.statementCache.release(stmt); }

  /** Use a prepared statement. This function takes care of preparing the statement and then releasing it.
   * @param ecsql The ECSQL statement to execute
   * @param callback the callback to invoke on the prepared statement
   * @returns the value returned by cb
   */
  public withPreparedStatement<T>(ecsql: string, callback: (stmt: ECSqlStatement) => T): T {
    const stmt = this.getPreparedStatement(ecsql);
    try {
      const val = callback(stmt);
      this.releasePreparedStatement(stmt);
      return val;
    } catch (err) {
      this.releasePreparedStatement(stmt); // always release statement
      Logger.logError(loggingCategory, err.toString());
      throw err;
    }
  }

  /** Execute a query against this IModelDb. This is just a convenience method that calls [[withPreparedStatement]], [[ECSqlStatement.bindValues]], [[ECSqlStatement.step]],
   * and [[ECSqlStatement.getRow]].
   * @param ecsql The ECSQL statement to execute
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an array if the parameters are positional. Pass an object of the values keyed on the parameter name
   * for named parameters.
   * The values in either the array or object must match the respective types of the parameters.
   * See [[ECSqlStatement.bindValues]] for details.
   * @returns Returns the query result as an array of the resulting rows or an empty array if the query has returned no rows.
   * See [[ECSqlStatement.getRow]] for details about the format of the returned rows.
   * @throws [[IModelError]] If the statement is invalid
   */
  public executeQuery(ecsql: string, bindings?: any[] | object): any[] {
    return this.withPreparedStatement(ecsql, (stmt: ECSqlStatement) => {
      if (bindings)
        stmt.bindValues(bindings);
      const rows: any[] = [];
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        rows.push(stmt.getRow());
        if (rows.length >= IModelDb.maxLimit)
          break; // don't let a "rogue" query consume too many resources
      }
      return rows;
    });
  }

  /**
   * Query for a set of entity ids, given an EntityQueryParams
   * @param params the EntityQueryParams for query
   * @returns an Id64Set with results of query
   */
  public queryEntityIds(params: EntityQueryParams): Id64Set {
    let sql = "SELECT ECInstanceId FROM ";
    if (params.only)
      sql += "ONLY ";
    sql += params.from;
    if (params.where) sql += " WHERE " + params.where;
    if (typeof params.limit === "number" && params.limit > 0) sql += " LIMIT " + params.limit;
    if (typeof params.offset === "number" && params.offset > 0) sql += " OFFSET " + params.offset;
    if (params.orderBy) sql += " ORDER BY " + params.orderBy;

    const ids = new Set<string>();
    this.withPreparedStatement(sql, (stmt) => {
      for (const row of stmt) {
        if (row.id !== undefined)
          ids.add(row.id);
      }
    });
    return ids;
  }

  public clearStatementCache(): void { this.statementCache.clear(); }

  /** Get the GUID of this iModel. */
  public getGuid(): Guid {
    if (!this.briefcase)
      throw this._newNotOpenError();
    const guidStr = this.briefcase.nativeDb.getDbGuid();
    return new Guid(guidStr);
  }

  /** Set the GUID of this iModel. */
  public setGuid(guid: Guid) {
    if (!this.briefcase)
      throw this._newNotOpenError();
    const guidStr = guid.toString();
    return this.briefcase.nativeDb.setDbGuid(guidStr);
  }

  /** Update the imodel project extents.
   * <p><em>Example:</em>
   * ``` ts
   * [[include:IModelDb.updateProjectExtents]]
   * ```
   */
  public updateProjectExtents(newExtents: AxisAlignedBox3d) {
    if (!this.briefcase)
      throw this._newNotOpenError();
    this.projectExtents.setFrom(newExtents);
    const extentsJson = newExtents.toJSON();
    this.briefcase.nativeDb.updateProjectExtents(JSON.stringify(extentsJson));
  }

  /**
   * Commit pending changes to this iModel.
   * <em>note:</em> If this IModelDb is connected to an iModel, then you must call [[ConcurrencyControl.request]] before attempting to save changes.
   * @param _description Optional description of the changes
   * @throws [[IModelError]] if there is a problem saving changes or if there are pending, un-processed lock or code requests.
   */
  public saveChanges(description?: string) {
    if (this.openMode === OpenMode.Readonly)
      throw new IModelError(IModelStatus.ReadOnly, "", Logger.logError);

    if (!this.briefcase)
      throw this._newNotOpenError();

    // TODO: this.Txns.onSaveChanges => validation, rules, indirect changes, etc.
    this.concurrencyControl.onSaveChanges();

    const stat = this.briefcase.nativeDb.saveChanges(description);
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
    if (!this.briefcase) throw this._newNotOpenError();
    await BriefcaseManager.pullAndMergeChanges(accessToken, this.briefcase, version);
    this.token.changeSetId = this.briefcase.changeSetId;
    this.initializeIModelDb();
  }

  /**
   * Push changes to the iModelHub
   * @param accessToken Delegation token of the authorized user.
   * @param describer A function that returns a description of the changeset. Defaults to the combination of the descriptions of all local Txns.
   * @throws [[IModelError]] If the pull and merge fails.
   */
  public async pushChanges(accessToken: AccessToken, describer?: ChangeSetDescriber): Promise<void> {
    if (!this.briefcase) throw this._newNotOpenError();
    const description = describer ? describer(this.txns.getCurrentTxnId()) : this.txns.describeChangeSet();
    await BriefcaseManager.pushChanges(accessToken, this.briefcase, description);
    this.token.changeSetId = this.briefcase.changeSetId;
    this.initializeIModelDb();
  }

  /**
   * Reverse a previously merged set of changes
   * @param accessToken Delegation token of the authorized user.
   * @param version Version to reverse changes to.
   * @throws [[IModelError]] If the reversal fails.
   */
  public async reverseChanges(accessToken: AccessToken, version: IModelVersion = IModelVersion.latest()): Promise<void> {
    if (!this.briefcase) throw this._newNotOpenError();
    await BriefcaseManager.reverseChanges(accessToken, this.briefcase, version);
    this.initializeIModelDb();
  }

  /**
   * Reinstate a previously reversed set of changes
   * @param accessToken Delegation token of the authorized user.
   * @param version Version to reinstate changes to.
   * @throws [[IModelError]] If the reinstate fails.
   */
  public async reinstateChanges(accessToken: AccessToken, version: IModelVersion = IModelVersion.latest()): Promise<void> {
    if (!this.briefcase) throw this._newNotOpenError();
    await BriefcaseManager.reinstateChanges(accessToken, this.briefcase, version);
    this.initializeIModelDb();
  }

  /**
   * Abandon pending changes to this iModel
   */
  public abandonChanges() {
    if (!this.briefcase) throw this._newNotOpenError();
    this.concurrencyControl.abandonRequest();
    this.briefcase.nativeDb.abandonChanges();
  }

  /** Import an ECSchema. On success, the schema definition is stored in the iModel.
   * You must import a schema into an iModel before you can insert instances of the classes in that schema. See [[Element]]
   * @param schemaFileName  Full path to an ECSchema.xml file that is to be imported.
   */
  public importSchema(schemaFileName: string) {
    if (!this.briefcase) throw this._newNotOpenError();
    const stat = this.briefcase.nativeDb.importSchema(schemaFileName);
    if (DbResult.BE_SQLITE_OK !== stat)
      throw new IModelError(stat, "Error importing schema", Logger.logError, loggingCategory, () => ({ schemaFileName }));
  }

  /** Find an already open IModelDb. Used by the remoting logic.
   * @throws [[IModelError]] if an open IModelDb matching the token is not found.
   */
  public static find(iModelToken: IModelToken): IModelDb {
    const briefcaseEntry = BriefcaseManager.findBriefcaseByToken(iModelToken);
    if (!briefcaseEntry)
      throw new IModelError(IModelStatus.NotFound, undefined, Logger.logError, loggingCategory, () => ({ iModelId: iModelToken.iModelId }));
    assert(!!briefcaseEntry.iModelDb);
    return briefcaseEntry.iModelDb!;
  }

  /** Get the ClassMetaDataRegistry for this iModel. */
  public get classMetaDataRegistry(): MetaDataRegistry {
    if (this._classMetaDataRegistry === undefined) this._classMetaDataRegistry = new MetaDataRegistry();
    return this._classMetaDataRegistry;
  }

  /** Get the linkTableRelationships for this IModel */
  public get linkTableRelationships(): IModelDbLinkTableRelationships { return this._linkTableRelationships || (this._linkTableRelationships = new IModelDbLinkTableRelationships(this)); }

  /** Get the ConcurrencyControl for this IModel. */
  public get concurrencyControl(): ConcurrencyControl { return (this._concurrency !== undefined) ? this._concurrency : (this._concurrency = new ConcurrencyControl(this)); }

  /** Get the TxnManager for this IModelDb. */
  public get txns(): TxnManager { return (this._txnManager !== undefined) ? this._txnManager : (this._txnManager = new TxnManager(this)); }

  /** Get the CodeSpecs in this IModel. */
  public get codeSpecs(): CodeSpecs { return (this._codeSpecs !== undefined) ? this._codeSpecs : (this._codeSpecs = new CodeSpecs(this)); }

  /** @hidden */
  public insertCodeSpec(codeSpec: CodeSpec): Id64 {
    if (!this.briefcase) throw this._newNotOpenError();
    const { error, result } = this.briefcase.nativeDb.insertCodeSpec(codeSpec.name, codeSpec.specScopeType, codeSpec.scopeReq);
    if (error) throw new IModelError(error.status, "inserting CodeSpec" + codeSpec, Logger.logWarning, loggingCategory);
    return new Id64(result);
  }

  /** deprecated */
  public getElementPropertiesForDisplay(elementId: string): string {
    if (!this.briefcase)
      throw this._newNotOpenError();

    const { error, result: idHexStr } = this.briefcase.nativeDb.getElementPropertiesForDisplay(elementId);
    if (error)
      throw new IModelError(error.status, error.message, Logger.logError, loggingCategory, () => ({ iModelId: this.token.iModelId, elementId }));

    return idHexStr!;
  }

  /** Prepare an ECSQL statement.
   * @param sql The ECSQL statement to prepare
   * @throws [[IModelError]] if there is a problem preparing the statement.
   */
  public prepareStatement(sql: string): ECSqlStatement {
    if (!this.briefcase)
      throw this._newNotOpenError();
    const stmt = new ECSqlStatement();
    stmt.prepare(this.briefcase.nativeDb, sql);
    return stmt;
  }

  /** Construct an entity (element or model). This utility method knows how to fetch the required class metadata
   * if necessary in order to get the entity's class defined as a prerequisite.
   * @throws [[IModelError]] if the entity cannot be constructed.
   */
  public constructEntity(props: EntityProps): Entity {
    let entity: Entity;
    try {
      entity = ClassRegistry.createInstance(props, this);
    } catch (err) {
      if (!ClassRegistry.isNotFoundError(err)) {
        Logger.logError(loggingCategory, err.toString());
        throw err;
      }

      // Probably, we have not yet loaded the metadata for this class and/or its superclasses. Do that now, and retry the create.
      this.loadMetaData(props.classFullName!);
      entity = ClassRegistry.createInstance(props, this);
    }
    return entity;
  }

  /** Get metadata for a class. This method will load the metadata from the iModel into the cache as a side-effect, if necessary.
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
    if (!this.briefcase)
      throw this._newNotOpenError();

    if (this.classMetaDataRegistry.find(classFullName))
      return;
    const className = classFullName.split(":");
    if (className.length !== 2)
      throw new IModelError(IModelStatus.BadArg, undefined, Logger.logError, loggingCategory, () => ({ iModelId: this.token.iModelId, classFullName }));

    const { error, result: metaDataJson } = this.briefcase.nativeDb.getECClassMetaData(className[0], className[1]);
    if (error)
      throw new IModelError(error.status, undefined, Logger.logError, loggingCategory, () => ({ iModelId: this.token.iModelId, classFullName }));

    const metaData = new EntityMetaData(JSON.parse(metaDataJson!));
    this.classMetaDataRegistry.add(classFullName, metaData);
    // Recursive, to make sure that base class is cached.
    if (metaData.baseClasses !== undefined && metaData.baseClasses.length > 0) {
      metaData.baseClasses.forEach((baseClassName: string) => {
        this.loadMetaData(baseClassName);
      });
    }
  }

  /** query a "file property" from this iModel, as a string.
   * @returns the property string or undefined if the property is not present.
   */
  public queryFilePropertyString(prop: FilePropertyProps): string | undefined { return this.briefcase!.nativeDb.queryFileProperty(JSON.stringify(prop), true) as string | undefined; }

  /** query a "file property" from this iModel, as a blob.
   * @returns the property blob or undefined if the property is not present.
   */
  public queryFilePropertyBlob(prop: FilePropertyProps): ArrayBuffer | undefined { return this.briefcase!.nativeDb.queryFileProperty(JSON.stringify(prop), false) as ArrayBuffer | undefined; }

  /** save a "file property" to this iModel
   * @param prop the FilePropertyProps that describes the new property
   * @param value either a string or a blob to save as the file property
   * @returns 0 if successful, status otherwise
   */
  public saveFileProperty(prop: FilePropertyProps, value: string | ArrayBuffer): DbResult { return this.briefcase!.nativeDb.saveFileProperty(JSON.stringify(prop), value); }

  /** delete a "file property" from this iModel
   * @param prop the FilePropertyProps that describes the property
   * @returns 0 if successful, status otherwise
   */
  public deleteFileProperty(prop: FilePropertyProps): DbResult { return this.briefcase!.nativeDb.saveFileProperty(JSON.stringify(prop), undefined); }

  /** query for the next available major id for a "file property" from this iModel.
   * @param prop the FilePropertyProps that describes the property
   * @returns the next available (that is, an unused) id for prop. If none are present, will return 0.
   */
  public queryNextAvailableFileProperty(prop: FilePropertyProps) { return this.briefcase!.nativeDb.queryNextAvailableFileProperty(JSON.stringify(prop)); }

  /** Execute a test from native code
   * @param testName The name of the test
   * @param params parameters for the test
   * @hidden
   */
  public executeTest(testName: string, params: any): any { return JSON.parse(this.briefcase!.nativeDb.executeTest(testName, JSON.stringify(params))); }
}

/** The collection of models in an [[IModelDb]]. */
export class IModelDbModels {
  private readonly loaded = new LRUMap<string, Model>(500);

  /** @hidden */
  public constructor(private _iModel: IModelDb, max: number = 500) {
    this.loaded.limit = max;
    this._iModel.onChangesetApplied.addListener(() => this.loaded.clear());
  }

  /** Get the Model with the specified identifier.
   * @param modelId The Model identifier.
   * @throws [[IModelError]]
   */
  public getModel(modelId: Id64): Model {
    // first see if the model is already in the local cache.
    const loaded = this.loaded.get(modelId.value);
    if (loaded)
      return loaded;

    const json = this.getModelJson(JSON.stringify({ id: modelId }));
    const props = JSON.parse(json!) as ModelProps;
    props.iModel = this._iModel;
    const model = this._iModel.constructEntity(props) as Model;

    // We have created the model. Cache it before we return it.
    model.setPersistent(); // models in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
    this.loaded.set(model.id.value, model);
    return model;
  }

  /**
   * Read the properties for a Model as a json string
   * @param modelIdArg a json string with the identity of the model to load. Must have either "id" or "code".
   * @return a json string with the properties of the model.
   */
  public getModelJson(modelIdArg: string): string {
    if (!this._iModel.briefcase) throw this._iModel._newNotOpenError();
    const { error, result } = this._iModel.briefcase.nativeDb.getModel(modelIdArg);
    if (error) throw new IModelError(error.status, "Model=" + modelIdArg);
    return result!;
  }

  /** Get the sub-model of the specified Element.
   * @param elementId The Element identifier.
   * @throws [[IModelError]]
   */
  public getSubModel(modeledElementId: Id64 | Guid | Code): Model {
    const modeledElement = this._iModel.elements.getElement(modeledElementId);
    if (modeledElement.id.equals(IModel.rootSubjectId))
      throw new IModelError(IModelStatus.NotFound, "Root subject does not have a sub-model", Logger.logWarning, loggingCategory);

    return this.getModel(modeledElement.id);
  }

  /** Create a new model in memory.
   * See the example in [[InformationPartitionElement]].
   * @param modelProps The properties to use when creating the model.
   * @throws [[IModelError]] if there is a problem creating the model.
   */
  public createModel(modelProps: ModelProps): Model { return this._iModel.constructEntity(modelProps) as Model; }

  /** Insert a new model.
   * @param model The data for the new model.
   * @returns The newly inserted model's Id.
   * @throws [[IModelError]] if unable to insert the model.
   */
  public insertModel(model: Model): Id64 {
    if (!this._iModel.briefcase) throw this._iModel._newNotOpenError();
    if (model.isPersistent()) throw new IModelError(IModelStatus.WriteError, "Cannot insert a model marked as persistent. Call copyForEdit.", Logger.logError, loggingCategory);
    const { error, result } = this._iModel.briefcase.nativeDb.insertModel(JSON.stringify(model));
    if (error) throw new IModelError(error.status, "inserting model", Logger.logWarning, loggingCategory);
    return model.id = new Id64(JSON.parse(result!).id);
  }

  /** Update an existing model.
   * @param model An editable copy of the model, containing the new/proposed data.
   * @throws [[IModelError]] if unable to update the model.
   */
  public updateModel(model: ModelProps): void {
    if (!this._iModel.briefcase) throw this._iModel._newNotOpenError();
    const error: IModelStatus = this._iModel.briefcase.nativeDb.updateModel(JSON.stringify(model));
    if (error !== IModelStatus.Success)
      throw new IModelError(error, "updating model id=" + model.id, Logger.logWarning, loggingCategory);

    // Discard from the cache, to make sure that the next fetch see the updated version.
    if (model.id)
      this.loaded.delete(model.id.toString());
  }

  /** Delete an existing model.
   * @param model The model to be deleted
   * @throws [[IModelError]]
   */
  public deleteModel(model: Model): void {
    if (!this._iModel.briefcase)
      throw this._iModel._newNotOpenError();

    const error: IModelStatus = this._iModel.briefcase.nativeDb.deleteModel(model.id.value);
    if (error !== IModelStatus.Success)
      throw new IModelError(error, "deleting model id=" + model.id.value, Logger.logWarning, loggingCategory);

    // Discard from the cache
    this.loaded.delete(model.id.value);
  }
}

/** The collection of elements in an [[IModelDb]]. */
export class IModelDbElements {
  private readonly loaded: LRUMap<string, Element>;

  /** @hidden */
  public constructor(private _iModel: IModelDb, maxElements = 2000) {
    this.loaded = new LRUMap<string, Element>(maxElements);
    this._iModel.onChangesetApplied.addListener(() => this.loaded.clear());
  }

  /** Private implementation details of getElementProps */
  private _getElementProps(opts: ElementLoadProps): ElementProps {
    const json = this.getElementJson(JSON.stringify(opts));
    const props = JSON.parse(json) as ElementProps;
    props.iModel = this._iModel;
    return props;
  }

  /**
   * Read element data from iModel as a json string
   * @param elementIdArg a json string with the identity of the element to load. Must have one of "id", "federationGuid", or "code".
   * @return a json string with the properties of the element.
   */
  public getElementJson(elementIdArg: string): string {
    const { error, result } = this._iModel.briefcase!.nativeDb.getElement(elementIdArg);
    if (error) throw new IModelError(error.status, "reading element=" + elementIdArg, Logger.logWarning, loggingCategory);
    return result!;
  }

  /** Private implementation details of getElement */
  private _doGetElement(opts: ElementLoadProps): Element {
    // first see if the element is already in the local cache.
    if (opts.id) {
      const loaded = this.loaded.get(opts.id.toString());
      if (loaded)
        return loaded;
    }
    const props = this._getElementProps(opts);
    const el = this._iModel.constructEntity(props) as Element;
    // We have created the element. Cache it before we return it.
    el.setPersistent(); // elements in the cache must be immutable and in their just-loaded state. Freeze it to enforce that
    this.loaded.set(el.id.value, el);
    return el;
  }

  /**
   * Get properties of an Element by Id, FederationGuid, or Code
   * @throws [[IModelError]] if the element is not found.
   */
  public getElementProps(elementId: Id64Props | Guid | Code | ElementLoadProps): ElementProps {
    if (typeof elementId === "string" || elementId instanceof Id64) elementId = { id: elementId.toString() };
    else if (elementId instanceof Guid) elementId = { federationGuid: elementId.value };
    else if (elementId instanceof Code) elementId = { code: elementId };
    return this._getElementProps(elementId);
  }

  /**
   * Get an element by Id, FederationGuid, or Code
   * @param elementId either the element's Id, Code, or FederationGuid, or an ElementLoadProps
   * @throws [[IModelError]] if the element is not found.
   */
  public getElement(elementId: Id64Props | Guid | Code | ElementLoadProps): Element {
    if (typeof elementId === "string" || elementId instanceof Id64) elementId = { id: elementId.toString() };
    else if (elementId instanceof Guid) elementId = { federationGuid: elementId.value };
    else if (elementId instanceof Code) elementId = { code: elementId };
    return this._doGetElement(elementId);
  }

  /**
   * Query for the DgnElementId of the element that has the specified code
   * @param code The code to look for
   * @returns The element that uses the code or undefined if the code is not used.
   * @throws IModelError if the code is invalid
   */
  public queryElementIdByCode(code: Code): Id64 | undefined {
    if (!code.spec.isValid()) throw new IModelError(IModelStatus.InvalidCodeSpec);
    if (code.value === undefined) throw new IModelError(IModelStatus.InvalidCode);

    return this._iModel.withPreparedStatement(`SELECT ECInstanceId FROM ${Element.classFullName} WHERE CodeSpec.Id=? AND CodeScope.Id=? AND CodeValue=?`, (stmt: ECSqlStatement) => {
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
  public createElement(elProps: ElementProps): Element { return this._iModel.constructEntity(elProps) as Element; }

  /**
   * Insert a new element into the iModel.
   * @param elProps The properties of the new element.
   * @returns The newly inserted element's Id.
   * @throws [[IModelError]] if unable to insert the element.
   */
  public insertElement(elProps: ElementProps): Id64 {
    if (!this._iModel.briefcase)
      throw this._iModel._newNotOpenError();

    const { error, result: json } = this._iModel.briefcase.nativeDb.insertElement(JSON.stringify(elProps));
    if (error)
      throw new IModelError(error.status, "Problem inserting element", Logger.logWarning, loggingCategory);

    return new Id64(JSON.parse(json!).id);
  }

  /** Update some properties of an existing element.
   * @param el the properties of the element to update.
   * @throws [[IModelError]] if unable to update the element.
   */
  public updateElement(props: ElementProps): void {
    if (!this._iModel.briefcase)
      throw this._iModel._newNotOpenError();

    const error: IModelStatus = this._iModel.briefcase.nativeDb.updateElement(JSON.stringify(props));
    if (error !== IModelStatus.Success)
      throw new IModelError(error, "", Logger.logWarning, loggingCategory);

    // Discard from the cache, to make sure that the next fetch see the updated version.
    if (props.id)
      this.loaded.delete(props.id.toString());
  }

  /**
   * Delete an element from this iModel.
   * @param id The Id of the element to be deleted
   * @throws [[IModelError]]
   */
  public deleteElement(id: Id64): void {
    if (!this._iModel.briefcase)
      throw this._iModel._newNotOpenError();

    const error: IModelStatus = this._iModel.briefcase.nativeDb.deleteElement(id.value);
    if (error !== IModelStatus.Success)
      throw new IModelError(error, "", Logger.logWarning, loggingCategory);

    // Discard from the cache
    this.loaded.delete(id.value);
  }

  /** Query for the child elements of the specified element.
   * @returns Returns an array of child element identifiers.
   * @throws [[IModelError]]
   */
  public queryChildren(elementId: Id64): Id64[] {
    const rows: any[] = this._iModel.executeQuery(`SELECT ECInstanceId FROM ${Element.classFullName} WHERE Parent.Id=?`, [elementId]);
    const childIds: Id64[] = [];
    for (const row of rows) {
      childIds.push(new Id64(row.id));
    }
    return childIds;
  }

  /** Get the root subject element. */
  public getRootSubject(): Subject { return this.getElement(IModel.rootSubjectId); }

  /** Query for aspects rows (by aspect class name) associated with this element.
   * @throws [[IModelError]]
   */
  private _queryAspects(elementId: Id64, aspectClassName: string): ElementAspect[] {
    const name = aspectClassName.split(":");
    const rows: any[] = this._iModel.executeQuery("SELECT * FROM [" + name[0] + "].[" + name[1] + "] WHERE Element.Id=?", [elementId]);
    if (rows.length === 0)
      throw new IModelError(IModelStatus.NotFound, undefined, Logger.logWarning, loggingCategory);

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
  /** @hidden */
  public constructor(private _iModel: IModelDb) { }

  /** Query for the array of ViewDefinitionProps of the specified class and matching the specified IsPrivate setting.
   * @param className Query for view definitions of this class.
   * @param wantPrivate If true, include private view definitions.
   */
  public queryViewDefinitionProps(className: string = "BisCore.ViewDefinition", limit = IModelDb.defaultLimit, offset = 0, wantPrivate: boolean = false): ViewDefinitionProps[] {
    const where: string = (wantPrivate === false) ? "IsPrivate=FALSE" : "";
    const ids = this._iModel.queryEntityIds({ from: className, limit, offset, where });

    const props: ViewDefinitionProps[] = [];
    const imodel = this._iModel;
    ids.forEach((id) => {
      try {
        props.push(imodel.elements.getElementProps(id) as ViewDefinitionProps);
      } catch (err) { }
    });

    return props;
  }

  public getViewStateData(viewDefinitionId: string): any {
    const viewStateData: any = {};
    const elements = this._iModel.elements;
    viewStateData.viewDefinitionProps = elements.getElementProps(viewDefinitionId) as ViewDefinitionProps;
    viewStateData.categorySelectorProps = elements.getElementProps(viewStateData.viewDefinitionProps.categorySelectorId);
    viewStateData.displayStyleProps = elements.getElementProps(viewStateData.viewDefinitionProps.displayStyleId);
    if (viewStateData.viewDefinitionProps.modelSelectorId !== undefined)
      viewStateData.modelSelectorProps = elements.getElementProps(viewStateData.viewDefinitionProps.modelSelectorId);
    return viewStateData;
  }
}

/**
 * Local Txns in an IModelDb. Local Txns persist only until [[IModelDb.pushChanges]] is called.
 */
export class TxnManager {
  constructor(private _iModel: IModelDb) { }

  /** Get the ID of the first transaction, if any. */
  public queryFirstTxnId(): TxnManager.TxnId { return this._iModel.briefcase!.nativeDb!.txnManagerQueryFirstTxnId(); }

  /** Get the successor of the specified TxnId */
  public queryNextTxnId(txnId: TxnManager.TxnId): TxnManager.TxnId { return this._iModel.briefcase!.nativeDb!.txnManagerQueryNextTxnId(txnId); }

  /** Get the predecessor of the specified TxnId */
  public queryPreviousTxnId(txnId: TxnManager.TxnId): TxnManager.TxnId { return this._iModel.briefcase!.nativeDb!.txnManagerQueryPreviousTxnId(txnId); }

  /** Get the ID of the current (tip) transaction.  */
  public getCurrentTxnId(): TxnManager.TxnId { return this._iModel.briefcase!.nativeDb!.txnManagerGetCurrentTxnId(); }

  /** Get the description that was supplied when the specified transaction was saved. */
  public getTxnDescription(txnId: TxnManager.TxnId): string { return this._iModel.briefcase!.nativeDb!.txnManagerGetTxnDescription(txnId); }

  /** Test if a TxnId is valid */
  public isTxnIdValid(txnId: TxnManager.TxnId): boolean { return this._iModel.briefcase!.nativeDb!.txnManagerIsTxnIdValid(txnId); }

  /** Query if there are any pending Txns in this IModelDb that are waiting to be pushed.  */
  public hasPendingTxns(): boolean { return this.isTxnIdValid(this.queryFirstTxnId()); }

  /** Query if there are any changes in memory that have yet to be saved to the IModelDb. */
  public hasUnsavedChanges(): boolean {
    return this._iModel.briefcase!.nativeDb!.txnManagerHasUnsavedChanges();
  }

  /** Query if there are un-saved or un-pushed local changes. */
  public hasLocalChanges(): boolean { return this.hasUnsavedChanges() || this.hasPendingTxns(); }

  /** Make a description of the changeset by combining all local txn comments. */
  public describeChangeSet(endTxnId?: TxnManager.TxnId): string {
    if (endTxnId === undefined)
      endTxnId = this.getCurrentTxnId();

    const changes = [];
    const seen = new Set<string>();
    let txnId = this.queryFirstTxnId();

    while (this.isTxnIdValid(txnId)) {
      const txnDesc = this.getTxnDescription(txnId);
      if ((txnDesc.length === 0) || seen.has(txnDesc))
        continue;

      changes.push(txnDesc);
      seen.add(txnDesc);
      txnId = this.queryNextTxnId(txnId);
    }
    return JSON.stringify(changes);
  }
}

export namespace TxnManager {
  /** Identifies a transaction that is local to a specific IModelDb. */
  export interface TxnId {
    readonly _id: string;
  }
}
