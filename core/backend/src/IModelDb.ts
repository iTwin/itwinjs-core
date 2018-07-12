/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModels */
import { Guid, Id64, Id64Set, OpenMode, DbResult, Logger, BeEvent, assert, Id64Props, BentleyStatus, Id64Arg, JsonUtils } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import {
  Code, CodeSpec, ElementProps, ElementAspectProps, IModel, IModelProps, IModelVersion, ModelProps,
  IModelError, IModelStatus, AxisAlignedBox3d, EntityQueryParams, EntityProps, ViewDefinitionProps,
  FontMap, FontMapProps, FontProps, ElementLoadProps, CreateIModelProps, FilePropertyProps, IModelToken, TileTreeProps, TileProps,
  IModelNotFoundResponse, EcefLocation, SnapRequestProps, SnapResponseProps, EntityMetaData, PropertyCallback,
} from "@bentley/imodeljs-common";
import { ClassRegistry, MetaDataRegistry } from "./ClassRegistry";
import { Element, Subject } from "./Element";
import { ElementAspect, ElementMultiAspect, ElementUniqueAspect } from "./ElementAspect";
import { Model } from "./Model";
import { BriefcaseEntry, BriefcaseManager, KeepBriefcase, BriefcaseId } from "./BriefcaseManager";
import { ECSqlStatement, ECSqlStatementCache } from "./ECSqlStatement";
import { SqliteStatement, SqliteStatementCache, CachedSqliteStatement } from "./SqliteStatement";
import { CodeSpecs } from "./CodeSpecs";
import { Entity } from "./Entity";
import * as path from "path";
import { IModelDbLinkTableRelationships } from "./LinkTableRelationship";
import { ConcurrencyControl } from "./ConcurrencyControl";
import { PromiseMemoizer, QueryablePromise } from "./PromiseMemoizer";
import { ViewDefinition, SheetViewDefinition } from "./ViewDefinition";
import { SnapRequest, NativeDgnDb, ErrorStatusOrResult } from "./imodeljs-native-platform-api";
import { NativePlatformRegistry } from "./NativePlatformRegistry";
import { KnownLocations } from "./Platform";
import { IModelJsFs } from "./IModelJsFs";

/** @hidden */
const loggingCategory = "imodeljs-backend.IModelDb";

/** The signature of a function that can supply a description of local Txns in the specified briefcase up to and including the specified endTxnId. */
export type ChangeSetDescriber = (endTxnId: TxnManager.TxnId) => string;

/** Operations allowed when synchronizing changes between the IModelDb and the iModel Hub */
export enum SyncMode {
  FixedVersion = 1,
  PullOnly = 2,
  PullAndPush = 3,
}

/** Mode to access the IModelDb */
export enum AccessMode {
  Shared = 1,
  Exclusive = 2,
}

/** Parameters to open the iModelDb */
export class OpenParams {

  // Constructor
  public constructor(
    /** Mode to Open the IModelDb */
    public readonly openMode: OpenMode,

    /** Mode to access the IModelDb */
    public readonly accessMode?: AccessMode,

    /** Operations allowed when synchronizing changes between the IModelDb and the iModel Hub */
    public readonly syncMode?: SyncMode,

  ) {
    this.validate();
  }

  /** Returns true if the open params are setup to open a standalone Db */
  public isStandalone(): boolean { return this.accessMode === undefined || this.syncMode === undefined; }

  private validate() {
    if (this.isStandalone() && !(this.accessMode === undefined && this.syncMode === undefined))
      throw new IModelError(BentleyStatus.ERROR, "Invalid parameters - only openMode can be defined if opening a standalone Db");

    if (this.openMode === OpenMode.Readonly && this.syncMode && this.syncMode !== SyncMode.FixedVersion) {
      throw new IModelError(BentleyStatus.ERROR, "Cannot pull changes into a ReadOnly IModelDb");
    }

    if (this.syncMode === SyncMode.PullAndPush && this.accessMode === AccessMode.Shared) {
      throw new IModelError(BentleyStatus.ERROR, "Pushing changes from a shared IModelDb is not supported");
    }
  }

  /** Create parameters to open the Db as of a fixed version in a readonly mode */
  public static fixedVersion(accessMode: AccessMode = AccessMode.Shared): OpenParams {
    return new OpenParams(OpenMode.Readonly, accessMode, SyncMode.FixedVersion);
  }

  /** Create parameters to open the Db to allow only pulls from the Hub */
  public static pullOnly(accessMode: AccessMode = AccessMode.Exclusive): OpenParams {
    return new OpenParams(OpenMode.ReadWrite, accessMode, SyncMode.PullOnly);
  }

  /** Create parameters to open the Db to make edits and push changes to the Hub */
  public static pullAndPush(): OpenParams {
    return new OpenParams(OpenMode.ReadWrite, AccessMode.Exclusive, SyncMode.PullAndPush);
  }

  /** Create parameters to open a standalone Db */
  public static standalone(openMode: OpenMode) {
    return new OpenParams(openMode);
  }
}

/**
 * Represents a physical copy (a briefcase) of an iModel that can be accessed as a file on the local computer.
 *
 * IModelDb raises a set of events to allow apps and subsystems to track IModelDb object life cycle, including [[onOpen]] and [[onOpened]].
 * @see [learning about IModelDb]($docs/learning/backend/IModelDb.md)
 */
export class IModelDb extends IModel {
  public static readonly defaultLimit = 1000; // default limit for batching queries
  public static readonly maxLimit = 10000; // maximum limit for batching queries
  private static _accessTokens?: Map<string, AccessToken>;
  /** Event called after a changeset is applied to this IModelDb. */
  public readonly onChangesetApplied = new BeEvent<() => void>();
  public models = new IModelDb.Models(this);
  public elements = new IModelDb.Elements(this);
  public views = new IModelDb.Views(this);
  public tiles = new IModelDb.Tiles(this);
  private _linkTableRelationships?: IModelDbLinkTableRelationships;
  private readonly _statementCache = new ECSqlStatementCache();
  private readonly _sqliteStatementCache = new SqliteStatementCache();
  private _codeSpecs?: CodeSpecs;
  private _classMetaDataRegistry?: MetaDataRegistry;
  private _concurrency?: ConcurrencyControl;
  private _txnManager?: TxnManager;
  protected _fontMap?: FontMap;
  private readonly _snaps = new Map<string, SnapRequest>();
  public readFontJson(): string { return this.nativeDb.readFontMap(); }
  public getFontMap(): FontMap { return this._fontMap || (this._fontMap = new FontMap(JSON.parse(this.readFontJson()) as FontMapProps)); }
  public embedFont(prop: FontProps): FontProps { this._fontMap = undefined; return JSON.parse(this.nativeDb.embedFont(JSON.stringify(prop))) as FontProps; }

  /** Get the parameters used to open this iModel */
  public readonly openParams: OpenParams;

  /** Event raised just before an IModelDb is opened.
   *
   * **Example:**
   * ``` ts
   * [[include:IModelDb.onOpen]]
   * ```
   */
  public static readonly onOpen = new BeEvent<(_accessToken: AccessToken, _contextId: string, _iModelId: string, _openParams: OpenParams, _version: IModelVersion) => void>();

  /** Event raised just after an IModelDb is opened.
   * @note This event is *not* raised for standalone IModelDbs.
   *
   * **Example:**
   * ``` ts
   * [[include:IModelDb.onOpened]]
   * ```
   */
  public static readonly onOpened = new BeEvent<(_imodelDb: IModelDb) => void>();
  /** Event raised just before an IModelDb is created in iModelHub. This event is raised only for iModel access initiated by this app only. This event is not raised for standalone IModelDbs. */
  public static readonly onCreate = new BeEvent<(_accessToken: AccessToken, _contextId: string, _args: CreateIModelProps) => void>();
  /** Event raised just after an IModelDb is created in iModelHub. This event is raised only for iModel access initiated by this app only. This event is not raised for standalone IModelDbs. */
  public static readonly onCreated = new BeEvent<(_imodelDb: IModelDb) => void>();

  private _briefcase?: BriefcaseEntry;

  /** @hidden */
  public get briefcase(): BriefcaseEntry { return this._briefcase!; }

  /** Check if this iModel has been opened read-only or not. */
  public isReadonly(): boolean { return this.openParams.openMode === OpenMode.Readonly; }

  private constructor(briefcaseEntry: BriefcaseEntry, iModelToken: IModelToken, openParams: OpenParams) {
    super(iModelToken);
    this.openParams = openParams;
    this.setupBriefcaseEntry(briefcaseEntry);
    this.initializeIModelDb();
  }

  private initializeIModelDb() {
    let props: any;
    try {
      props = JSON.parse(this.nativeDb.getIModelProps()) as IModelProps;
    } catch (error) { }

    const name = props.rootSubject ? props.rootSubject.name : path.basename(this.briefcase.pathname);
    super.initialize(name, props);
  }

  private static constructIModelDb(briefcaseEntry: BriefcaseEntry, openParams: OpenParams, contextId?: string): IModelDb {
    if (briefcaseEntry.iModelDb)
      return briefcaseEntry.iModelDb; // If there's an IModelDb already associated with the briefcase, that should be reused.
    const iModelToken = new IModelToken(briefcaseEntry.getKey(), contextId, briefcaseEntry.iModelId, briefcaseEntry.changeSetId);
    return new IModelDb(briefcaseEntry, iModelToken, openParams);
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
   * Create a standalone local Db.
   * @param fileName The name for the iModel
   * @param args The parameters that define the new iModel
   */
  public static createStandalone(fileName: string, args: CreateIModelProps): IModelDb {
    const briefcaseEntry: BriefcaseEntry = BriefcaseManager.createStandalone(fileName, args);
    // Logger.logTrace(loggingCategory, "IModelDb.createStandalone", loggingCategory, () => ({ pathname }));
    return IModelDb.constructIModelDb(briefcaseEntry, OpenParams.standalone(briefcaseEntry.openParams!.openMode!));
  }

  /** Create an iModel on iModelHub */
  public static async create(accessToken: AccessToken, contextId: string, fileName: string, args: CreateIModelProps): Promise<IModelDb> {
    IModelDb.onCreate.raiseEvent(accessToken, contextId, args);
    const iModelId: string = await BriefcaseManager.create(accessToken, contextId, fileName, args);
    return IModelDb.open(accessToken, contextId, iModelId);
  }

  /** Open an iModel from a local file.
   * @param pathname The pathname of the iModel
   * @param openMode Open mode for database
   * @param enableTransactions Enable tracking of transactions in this standalone iModel
   * @throws [[IModelError]]
   */
  public static openStandalone(pathname: string, openMode: OpenMode = OpenMode.ReadWrite, enableTransactions: boolean = false): IModelDb {
    const briefcaseEntry: BriefcaseEntry = BriefcaseManager.openStandalone(pathname, openMode, enableTransactions);
    return IModelDb.constructIModelDb(briefcaseEntry, OpenParams.standalone(openMode));
  }

  /**
   * Open an iModel from iModelHub. IModelDb files are cached locally. If the requested version is already in the cache, then open will open it from there.
   * Otherwise, open will download the requested version from iModelHub and cache it.
   * <p><em>Example:</em>
   * ``` ts
   * [[include:IModelDb.open]]
   * ```
   * @param accessToken Delegation token of the authorized user.
   * @param contextId Id of the Connect Project or Asset containing the iModel
   * @param iModelId Id of the iModel
   * @param version Version of the iModel to open
   * @param openParams Parameters to open the iModel
   */
  public static async open(accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams = OpenParams.pullAndPush(), version: IModelVersion = IModelVersion.latest()): Promise<IModelDb> {
    IModelDb.onOpen.raiseEvent(accessToken, contextId, iModelId, openParams, version);
    const briefcaseEntry: BriefcaseEntry = await BriefcaseManager.open(accessToken, contextId, iModelId, openParams, version);
    const imodelDb = IModelDb.constructIModelDb(briefcaseEntry, openParams, contextId);
    IModelDb.setFirstAccessToken(imodelDb.briefcase.iModelId, accessToken);
    IModelDb.onOpened.raiseEvent(imodelDb);
    Logger.logTrace(loggingCategory, "IModelDb.open", () => ({ ...imodelDb.token, ...openParams }));
    return imodelDb;
  }

  /**
   * Close this standalone iModel, if it is currently open
   * @throws IModelError if the iModel is not open, or is not standalone
   */
  public closeStandalone(): void {
    if (!this.briefcase)
      throw this.newNotOpenError();
    if (!this.briefcase.isStandalone)
      throw new IModelError(BentleyStatus.ERROR, "Cannot use IModelDb.closeStandalone() to close a non-standalone iModel. Use IModelDb.close() instead");

    try {
      BriefcaseManager.closeStandalone(this.briefcase);
    } catch (error) {
      throw error;
    } finally {
      this.clearBriefcaseEntry();
    }
  }

  /**
   * Close this iModel, if it is currently open.
   * @param accessToken Delegation token of the authorized user.
   * @param keepBriefcase Hint to discard or keep the briefcase for potential future use.
   * @throws IModelError if the iModel is not open, or is really a standalone iModel
   */
  public async close(accessToken: AccessToken, keepBriefcase: KeepBriefcase = KeepBriefcase.Yes): Promise<void> {
    if (!this.briefcase)
      throw this.newNotOpenError();
    if (this.briefcase.isStandalone)
      throw new IModelError(BentleyStatus.ERROR, "Cannot use IModelDb.close() to close a standalone iModel. Use IModelDb.closeStandalone() instead");

    try {
      await BriefcaseManager.close(accessToken, this.briefcase, keepBriefcase);
    } catch (error) {
      throw error;
    } finally {
      this.clearBriefcaseEntry();
    }
  }

  private forwardChangesetApplied() { this.onChangesetApplied.raiseEvent(); }

  private setupBriefcaseEntry(briefcaseEntry: BriefcaseEntry) {
    briefcaseEntry.iModelDb = this;
    briefcaseEntry.onBeforeClose.addListener(this.onBriefcaseCloseHandler, this);
    briefcaseEntry.onBeforeVersionUpdate.addListener(this.onBriefcaseVersionUpdatedHandler, this);
    briefcaseEntry.onChangesetApplied.addListener(this.forwardChangesetApplied, this);
    this._briefcase = briefcaseEntry;
  }

  private clearBriefcaseEntry(): void {
    const briefcaseEntry = this.briefcase;
    briefcaseEntry.onBeforeClose.removeListener(this.onBriefcaseCloseHandler, this);
    briefcaseEntry.onBeforeVersionUpdate.removeListener(this.onBriefcaseVersionUpdatedHandler, this);
    briefcaseEntry.onChangesetApplied.removeListener(this.forwardChangesetApplied, this);
    briefcaseEntry.iModelDb = undefined;
    this._briefcase = undefined;
  }

  private onBriefcaseCloseHandler() {
    this.onBeforeClose.raiseEvent();
    this.clearStatementCache();
    this.clearSqliteStatementCache();
  }

  private onBriefcaseVersionUpdatedHandler() { this.iModelToken.changeSetId = this.briefcase.changeSetId; }

  /** Event called when the iModel is about to be closed */
  public readonly onBeforeClose = new BeEvent<() => void>();

  /** Get the in-memory handle of the native Db */
  public get nativeDb(): NativeDgnDb { return this.briefcase.nativeDb; }

  /** Get the briefcase Id of this iModel */
  public getBriefcaseId(): BriefcaseId { return new BriefcaseId(this.briefcase === undefined ? BriefcaseId.Illegal : this.briefcase.briefcaseId); }

  /** Returns a new IModelError with errorNumber, message, and meta-data set properly for a *not open* error.
   * @hidden
   */
  public newNotOpenError() {
    return new IModelError(IModelStatus.NotOpen, "IModelDb not open" + this.name, Logger.logError, loggingCategory, () => ({ iModelId: this.iModelToken.iModelId }));
  }

  /** Get a prepared ECSQL statement - may require preparing the statement, if not found in the cache.
   * @param ecsql The ECSQL statement to prepare
   * @returns the prepared statement
   * @throws IModelError if the statement cannot be prepared. Normally, prepare fails due to ECSQL syntax errors or references to tables or properties that do not exist. The error.message property will describe the property.
   */
  private getPreparedStatement(ecsql: string): ECSqlStatement {
    const cachedStatement = this._statementCache.find(ecsql);
    if (cachedStatement !== undefined && cachedStatement.useCount === 0) {  // we can only recycle a previously cached statement if nobody is currently using it.
      cachedStatement.useCount++;
      return cachedStatement.statement;
    }

    this._statementCache.removeUnusedStatementsIfNecessary();
    const stmt = this.prepareStatement(ecsql);
    this._statementCache.add(ecsql, stmt);
    return stmt;
  }

  /** Use a prepared ECSQL statement. This function takes care of preparing the statement and then releasing it.
   *
   * As preparing statements can be costly, they get cached. When calling this method again with the same ECSQL,
   * the already prepared statement from the cache will be reused.
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param callback the callback to invoke on the prepared statement
   * @returns the value returned by cb
   */
  public withPreparedStatement<T>(ecsql: string, callback: (stmt: ECSqlStatement) => T): T {
    const stmt = this.getPreparedStatement(ecsql);
    try {
      const val = callback(stmt);
      this._statementCache.release(stmt);
      return val;
    } catch (err) {
      this._statementCache.release(stmt); // always release statement
      Logger.logError(loggingCategory, err.toString());
      throw err;
    }
  }

  /** Execute a query against this IModelDb.
   * The result of the query is returned as an array of JavaScript objects where every array element represents an
   * [ECSQL row]($docs/learning/ECSQLRowFormat).
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL SELECT statement to execute
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameters.
   * See "[iModelJs Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @returns Returns the query result as an array of the resulting rows or an empty array if the query has returned no rows.
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If the statement is invalid
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

  /** Use a prepared SQLite SQL statement. This function takes care of preparing the statement and then releasing it.
   *
   * As preparing statements can be costly, they get cached. When calling this method again with the same ECSQL,
   * the already prepared statement from the cache will be reused.
   *
   * @param sql The SQLite SQL statement to execute
   * @param callback the callback to invoke on the prepared statement
   * @returns the value returned by cb
   */
  public withPreparedSqliteStatement<T>(sql: string, callback: (stmt: SqliteStatement) => T): T {
    const stmt = this.getPreparedSqlStatement(sql);
    try {
      const val = callback(stmt);
      this._sqliteStatementCache.release(stmt);
      return val;
    } catch (err) {
      this._sqliteStatementCache.release(stmt); // always release statement
      Logger.logError(loggingCategory, err.toString());
      throw err;
    }
  }

  /** Prepare an SQLite SQL statement.
   * @param sql The SQLite SQL statement to prepare
   * @throws [[IModelError]] if there is a problem preparing the statement.
   */
  public prepareSqliteStatement(sql: string): SqliteStatement {
    const stmt = new SqliteStatement();
    stmt.prepare(this.briefcase.nativeDb, sql);
    return stmt;
  }

  /** Get a prepared SQLite SQL statement - may require preparing the statement, if not found in the cache.
   * @param sql The SQLite SQL statement to prepare
   * @returns the prepared statement
   * @throws IModelError if the statement cannot be prepared. Normally, prepare fails due to SQL syntax errors or references to tables or properties that do not exist. The error.message property will describe the property.
   */
  private getPreparedSqlStatement(sql: string): SqliteStatement {
    const cachedStatement: CachedSqliteStatement | undefined = this._sqliteStatementCache.find(sql);
    if (cachedStatement !== undefined && cachedStatement.useCount === 0) {  // we can only recycle a previously cached statement if nobody is currently using it.
      cachedStatement.useCount++;
      return cachedStatement.statement;
    }

    this._statementCache.removeUnusedStatementsIfNecessary();
    const stmt: SqliteStatement = this.prepareSqliteStatement(sql);
    this._sqliteStatementCache.add(sql, stmt);
    return stmt;
  }

  /**
   * Query for a set of entity ids, given an EntityQueryParams
   * @param params the EntityQueryParams for query
   * @returns an Id64Set with results of query
   *
   * *Example:*
   * ``` ts
   * [[include:ECSQL-backend-queries.select-element-by-code-value-using-queryEntityIds]]
   * ```
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

  /** Empty the [ECSqlStatementCache]($backend) for this iModel. */
  public clearStatementCache(): void { this._statementCache.clear(); }

  /** Empty the [SqliteStatementCache]($backend) for this iModel. */
  public clearSqliteStatementCache(): void { this._sqliteStatementCache.clear(); }

  /** Get the GUID of this iModel.  */
  public getGuid(): Guid { return new Guid(this.nativeDb.getDbGuid()); }

  /** Set the GUID of this iModel. */
  public setGuid(guid: Guid): DbResult { return this.nativeDb.setDbGuid(guid.toString()); }

  /** Update the project extents for this iModel.
   * <p><em>Example:</em>
   * ``` ts
   * [[include:IModelDb.updateProjectExtents]]
   * ```
   */
  public updateProjectExtents(newExtents: AxisAlignedBox3d) {
    this.projectExtents.setFrom(newExtents);
    this.updateIModelProps();
  }

  /** Update the [EcefLocation]($docs/learning/glossary#eceflocation) of this iModel.  */
  public updateEcefLocation(ecef: EcefLocation) {
    this.setEcefLocation(ecef);
    this.updateIModelProps();
  }

  /** Update the IModelProps of this iModel in the database.
   *
   * Example:
   * ``` ts
   * [[include:IModelDb.updateIModelProps]]
   * ```
   */
  public updateIModelProps() { this.nativeDb.updateIModelProps(JSON.stringify(this.toJSON())); }

  /**
   * Commit pending changes to this iModel.
   * @note If this IModelDb is connected to an iModel, then you must call [[ConcurrencyControl.request]] before attempting to save changes.
   * @param _description Optional description of the changes
   * @throws [[IModelError]] if there is a problem saving changes or if there are pending, un-processed lock or code requests.
   */
  public saveChanges(description?: string) {
    if (this.openParams.openMode === OpenMode.Readonly)
      throw new IModelError(IModelStatus.ReadOnly, "", Logger.logError);

    // TODO: this.Txns.onSaveChanges => validation, rules, indirect changes, etc.
    this.concurrencyControl.onSaveChanges();

    const stat = this.nativeDb.saveChanges(description);
    if (DbResult.BE_SQLITE_OK !== stat)
      throw new IModelError(stat, "Problem saving changes", Logger.logError);

    this.concurrencyControl.onSavedChanges();
  }

  /** Abandon pending changes in this iModel */
  public abandonChanges() {
    this.concurrencyControl.abandonRequest();
    this.nativeDb.abandonChanges();
  }

  /**
   * Pull and Merge changes from the iModelHub
   * @param accessToken Delegation token of the authorized user.
   * @param version Version to pull and merge to.
   * @throws [[IModelError]] If the pull and merge fails.
   */
  public async pullAndMergeChanges(accessToken: AccessToken, version: IModelVersion = IModelVersion.latest()): Promise<void> {
    this.concurrencyControl.onMergeChanges();
    await BriefcaseManager.pullAndMergeChanges(accessToken, this.briefcase, version);
    this.concurrencyControl.onMergedChanges();
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
    await BriefcaseManager.reinstateChanges(accessToken, this.briefcase, version);
    this.initializeIModelDb();
  }

  /** Set iModel as Master copy.
   * @param guid Optionally provide db guid. If its not provided the method would generate one.
   */
  public setAsMaster(guid?: Guid): void {
    if (guid === undefined) {
      if (DbResult.BE_SQLITE_OK !== this.nativeDb.setAsMaster())
        throw new IModelError(IModelStatus.SQLiteError, "", Logger.logWarning, loggingCategory);
    } else {
      if (DbResult.BE_SQLITE_OK !== this.nativeDb.setAsMaster(guid!.toString()))
        throw new IModelError(IModelStatus.SQLiteError, "", Logger.logWarning, loggingCategory);
    }
  }

  /** Import an ECSchema. On success, the schema definition is stored in the iModel.
   * This method is asynchronous (must be awaited) because, in the case where this IModelId is a briefcase,
   * this method must first obtain the schema lock from the IModel server.
   * You must import a schema into an iModel before you can insert instances of the classes in that schema. See [[Element]]
   * @param schemaFileName  Full path to an ECSchema.xml file that is to be imported.
   * @throws IModelError if the schema lock cannot be obtained.
   * @see containsClass
   */
  public async importSchema(schemaFileName: string): Promise<void> {
    if (!this.briefcase)
      throw this.newNotOpenError();

    if (!this.briefcase.isStandalone) {
      await this.concurrencyControl.lockSchema(IModelDb.getAccessToken(this.iModelToken.iModelId!));
    }
    const stat = this.briefcase.nativeDb.importSchema(schemaFileName);
    if (DbResult.BE_SQLITE_OK !== stat) {
      throw new IModelError(stat, "Error importing schema", Logger.logError, loggingCategory, () => ({ schemaFileName }));
    }
    if (!this.briefcase.isStandalone) {
      try {
        // The schema import logic and/or imported Domains may have created new elements and models.
        // Make sure we have the supporting locks and codes.
        await this.concurrencyControl.request(IModelDb.getAccessToken(this.iModelToken.iModelId!));
      } catch (err) {
        this.abandonChanges();
        throw err;
      }
    }
  }

  /** Find an already open IModelDb. Used by the remoting logic.
   * @throws [[IModelError]] if an open IModelDb matching the token is not found.
   */
  public static find(iModelToken: IModelToken): IModelDb {
    Logger.logTrace(loggingCategory, "Finding IModelDb", () => ({ iModelId: iModelToken.iModelId, changeSetId: iModelToken.changeSetId, key: iModelToken.key }));
    const briefcaseEntry = BriefcaseManager.findBriefcaseByToken(iModelToken);
    if (!briefcaseEntry) {
      Logger.logTrace(loggingCategory, "IModelDb not found - throwing a not found response", () => ({ iModelId: iModelToken.iModelId, changeSetId: iModelToken.changeSetId, key: iModelToken.key }));
      throw new IModelNotFoundResponse();
    }
    Logger.logTrace(loggingCategory, "Found IModelDb", () => ({ iModelId: iModelToken.iModelId, changeSetId: iModelToken.changeSetId, key: iModelToken.key }));
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
    if (!this.briefcase) throw this.newNotOpenError();
    const { error, result } = this.nativeDb.insertCodeSpec(codeSpec.name, codeSpec.specScopeType, codeSpec.scopeReq);
    if (error) throw new IModelError(error.status, "inserting CodeSpec" + codeSpec, Logger.logWarning, loggingCategory);
    return new Id64(result);
  }

  /** @hidden @deprecated */
  public getElementPropertiesForDisplay(elementId: string): string {
    if (!this.briefcase)
      throw this.newNotOpenError();

    const { error, result: idHexStr } = this.nativeDb.getElementPropertiesForDisplay(elementId);
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
      throw this.newNotOpenError();
    const stmt = new ECSqlStatement();
    stmt.prepare(this.nativeDb, sql);
    return stmt;
  }

  /** Construct an entity (Element or Model) from an iModel.
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

  /**
   * Invoke a callback on each property of the specified class, optionally including superclass properties.
   * @param iModel  The IModel that contains the schema
   * @param classFullName The full class name to load the metadata, if necessary
   * @param wantSuper If true, superclass properties will also be processed
   * @param func The callback to be invoked on each property
   * @param includeCustom If true, include custom-handled properties in the iteration. Otherwise, skip custom-handled properties.
   */
  public static forEachMetaData(iModel: IModelDb, classFullName: string, wantSuper: boolean, func: PropertyCallback, includeCustom: boolean) {
    const meta = iModel.getMetaData(classFullName); // will load if necessary
    for (const propName in meta.properties) {
      if (propName) {
        const propMeta = meta.properties[propName];
        if (includeCustom || !propMeta.isCustomHandled || propMeta.isCustomHandledOrphan)
          func(propName, propMeta);
      }
    }

    if (wantSuper && meta.baseClasses && meta.baseClasses.length > 0)
      meta.baseClasses.forEach((baseClass) => this.forEachMetaData(iModel, baseClass, true, func, includeCustom));
  }

  /*** @hidden */
  private loadMetaData(classFullName: string) {
    if (!this.briefcase)
      throw this.newNotOpenError();

    if (this.classMetaDataRegistry.find(classFullName))
      return;
    const className = classFullName.split(":");
    if (className.length !== 2)
      throw new IModelError(IModelStatus.BadArg, undefined, Logger.logError, loggingCategory, () => ({ iModelId: this.token.iModelId, classFullName }));

    const { error, result: metaDataJson } = this.nativeDb.getECClassMetaData(className[0], className[1]);
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

  /** Query if this iModel contains the definition of the specified class.
   * @param classFullName The full name of the class, for example, SomeSchema:SomeClass
   * @returns true if the iModel contains the class definition or false if not.
   * @see importSchema
   */
  public containsClass(classFullName: string): boolean {
    const className = classFullName.split(":");
    if (className.length !== 2)
      throw new IModelError(IModelStatus.BadArg, undefined, Logger.logError, loggingCategory, () => ({ iModelId: this.token.iModelId, classFullName }));
    const { error } = this.nativeDb.getECClassMetaData(className[0], className[1]);
    return (error === undefined);
  }

  /** Query a "file property" from this iModel, as a string.
   * @returns the property string or undefined if the property is not present.
   */
  public queryFilePropertyString(prop: FilePropertyProps): string | undefined { return this.nativeDb.queryFileProperty(JSON.stringify(prop), true) as string | undefined; }

  /** Query a "file property" from this iModel, as a blob.
   * @returns the property blob or undefined if the property is not present.
   */
  public queryFilePropertyBlob(prop: FilePropertyProps): ArrayBuffer | undefined { return this.nativeDb.queryFileProperty(JSON.stringify(prop), false) as ArrayBuffer | undefined; }

  /** Save a "file property" to this iModel
   * @param prop the FilePropertyProps that describes the new property
   * @param value either a string or a blob to save as the file property
   * @returns 0 if successful, status otherwise
   */
  public saveFileProperty(prop: FilePropertyProps, value: string | ArrayBuffer): DbResult { return this.nativeDb.saveFileProperty(JSON.stringify(prop), value); }

  /** delete a "file property" from this iModel
   * @param prop the FilePropertyProps that describes the property
   * @returns 0 if successful, status otherwise
   */
  public deleteFileProperty(prop: FilePropertyProps): DbResult { return this.nativeDb.saveFileProperty(JSON.stringify(prop), undefined); }

  /** Query for the next available major id for a "file property" from this iModel.
   * @param prop the FilePropertyProps that describes the property
   * @returns the next available (that is, an unused) id for prop. If none are present, will return 0.
   */
  public queryNextAvailableFileProperty(prop: FilePropertyProps) { return this.nativeDb.queryNextAvailableFileProperty(JSON.stringify(prop)); }

  public requestSnap(connectionId: string, props: SnapRequestProps): Promise<SnapResponseProps> {
    let request = this._snaps.get(connectionId);
    if (undefined === request) {
      request = (new (NativePlatformRegistry.getNativePlatform()).SnapRequest()) as SnapRequest;
      this._snaps.set(connectionId, request);
    } else
      request.cancelSnap();

    return new Promise<SnapResponseProps>((resolve, reject) => {
      request!.doSnap(this.nativeDb, JsonUtils.toObject(props), (ret: ErrorStatusOrResult<IModelStatus, SnapResponseProps>) => {
        this._snaps.delete(connectionId);
        if (ret.error !== undefined)
          reject(new Error(ret.error.message));
        else
          return resolve(ret.result);
      });
    });
  }

  /** Cancel a previously requested snap. */
  public cancelSnap(connectionId: string): void {
    const request = this._snaps.get(connectionId);
    if (undefined !== request) {
      request.cancelSnap();
      this._snaps.delete(connectionId);
    }
  }

  /** Load a file from the *Assets* directory of imodeljs-native
   * @param assetName The asset file name with path relative to the *Assets* directory.
   */
  public static loadNativeAsset(assetName: string): string {
    const fileName = path.join(KnownLocations.nativeAssetsDir, assetName);
    const fileData = IModelJsFs.readFileSync(fileName) as Buffer;
    return fileData.toString("base64");
  }

  /** Execute a test from native code
   * @param testName The name of the test
   * @param params parameters for the test
   * @hidden
   */
  public executeTest(testName: string, params: any): any { return JSON.parse(this.nativeDb.executeTest(testName, JSON.stringify(params))); }
}

export namespace IModelDb {

  /** The collection of models in an [[IModelDb]]. */
  export class Models {
    /** @hidden */
    public constructor(private _iModel: IModelDb) {
    }

    /** Get the Model with the specified identifier.
     * @param modelId The Model identifier.
     * @throws [[IModelError]]
     */
    public getModel(modelId: Id64Props): Model {
      const json = this.getModelJson(JSON.stringify({ id: modelId.toString() }));
      const props = JSON.parse(json!) as ModelProps;
      return this._iModel.constructEntity(props) as Model;
    }

    /**
     * Read the properties for a Model as a json string.
     * @param modelIdArg a json string with the identity of the model to load. Must have either "id" or "code".
     * @return a json string with the properties of the model.
     */
    public getModelJson(modelIdArg: string): string {
      if (!this._iModel.briefcase) throw this._iModel.newNotOpenError();
      const { error, result } = this._iModel.nativeDb.getModel(modelIdArg);
      if (error) throw new IModelError(error.status, "Model=" + modelIdArg);
      return result!;
    }

    /** Get the sub-model of the specified Element.
     * See [[IModelDb.Elements.queryElementIdByCode]] for more on how to find an element by Code.
     * @param modeledElementId Identifies the modeled element.
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
      if (!this._iModel.briefcase) throw this._iModel.newNotOpenError();
      const { error, result } = this._iModel.nativeDb.insertModel(JSON.stringify(model));
      if (error) throw new IModelError(error.status, "inserting model", Logger.logWarning, loggingCategory);
      return model.id = new Id64(JSON.parse(result!).id);
    }

    /** Update an existing model.
     * @param model An editable copy of the model, containing the new/proposed data.
     * @throws [[IModelError]] if unable to update the model.
     */
    public updateModel(model: ModelProps): void {
      if (!this._iModel.briefcase) throw this._iModel.newNotOpenError();
      const error: IModelStatus = this._iModel.nativeDb.updateModel(JSON.stringify(model));
      if (error !== IModelStatus.Success)
        throw new IModelError(error, "updating model id=" + model.id, Logger.logWarning, loggingCategory);
    }

    /** Delete an existing model.
     * @param model The model to be deleted
     * @throws [[IModelError]]
     */
    public deleteModel(model: Model): void {
      if (!this._iModel.briefcase)
        throw this._iModel.newNotOpenError();

      const error: IModelStatus = this._iModel.nativeDb.deleteModel(model.id.value);
      if (error !== IModelStatus.Success)
        throw new IModelError(error, "deleting model id=" + model.id.value, Logger.logWarning, loggingCategory);
    }
  }

  /** The collection of elements in an [[IModelDb]]. */
  export class Elements {
    /** @hidden */
    public constructor(private _iModel: IModelDb) {
    }

    /** Private implementation details of getElementProps */
    private _getElementProps(opts: ElementLoadProps): ElementProps {
      const json = this.getElementJson(JSON.stringify(opts));
      const props = json as ElementProps;
      return props;
    }

    /**
     * Read element data from iModel as a json string
     * @param elementIdArg a json string with the identity of the element to load. Must have one of "id", "federationGuid", or "code".
     * @return a json string with the properties of the element.
     */
    public getElementJson(elementIdArg: string): any {
      const { error, result } = this._iModel.nativeDb.getElement(elementIdArg);
      if (error) throw new IModelError(error.status, "reading element=" + elementIdArg, Logger.logWarning, loggingCategory);
      return result!;
    }

    /** Private implementation details of getElement */
    private _doGetElement(opts: ElementLoadProps): Element {
      const props = this._getElementProps(opts);
      return this._iModel.constructEntity(props) as Element;
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
     * Query for the DgnElementId of the element that has the specified code.
     * This method is for the case where you know the element's Code.
     * If you only know the code *value*, then in the simplest case, you can query on that
     * and filter the results.
     * In the simple case, call [[IModelDb.queryEntityIds]], specifying the code value in the where clause of the query params.
     * Or, you can execute an ECSQL select statement. See
     * [frequently used ECSQL queries]($docs/learning/backend/ECSQL-queries.md) for an example.
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
        throw this._iModel.newNotOpenError();

      const { error, result: json } = this._iModel.nativeDb.insertElement(JSON.stringify(elProps));
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
        throw this._iModel.newNotOpenError();

      const error: IModelStatus = this._iModel.nativeDb.updateElement(JSON.stringify(props));
      if (error !== IModelStatus.Success)
        throw new IModelError(error, "", Logger.logWarning, loggingCategory);
    }

    /**
     * Delete one or more elements from this iModel.
     * @param ids The set of Ids of the element(s) to be deleted
     * @throws [[IModelError]]
     */
    public deleteElement(ids: Id64Arg): void {
      Id64.toIdSet(ids).forEach((id) => {
        const error: IModelStatus = this._iModel.nativeDb.deleteElement(id);
        if (error !== IModelStatus.Success)
          throw new IModelError(error, "", Logger.logWarning, loggingCategory);
      });
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
        const aspect = entity as ElementAspect;
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
  export class Views {
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
      const viewDefinitionElement = elements.getElement(viewDefinitionId) as ViewDefinition;
      viewStateData.viewDefinitionProps = viewDefinitionElement.toJSON();
      viewStateData.categorySelectorProps = elements.getElementProps(viewStateData.viewDefinitionProps.categorySelectorId);
      viewStateData.displayStyleProps = elements.getElementProps(viewStateData.viewDefinitionProps.displayStyleId);
      if (viewStateData.viewDefinitionProps.modelSelectorId !== undefined) {
        viewStateData.modelSelectorProps = elements.getElementProps(viewStateData.viewDefinitionProps.modelSelectorId);
      } else if (viewDefinitionElement instanceof SheetViewDefinition) {
        viewStateData.sheetProps = elements.getElementProps(viewDefinitionElement.baseModelId); // For SheetViewDefinition, include sheetProps
      }
      return viewStateData;
    }
  }

  /** @hidden */
  // NB: Very WIP.
  export class Tiles {
    /** @hidden */
    public constructor(private _iModel: IModelDb) { }

    /** @hidden */
    public getTileTreeJson(id: string): any {
      if (!this._iModel.briefcase)
        throw this._iModel.newNotOpenError();

      const { error, result } = this._iModel.nativeDb.getTileTree(id);
      if (error)
        throw new IModelError(error.status, "TreeId=" + id);

      return result!;
    }

    /** @hidden */
    public getTileTreeProps(id: string): TileTreeProps { return this.getTileTreeJson(id) as TileTreeProps; }

    /** @hidden */
    public getTilesProps(treeId: string, tileIds: string[]): TileProps[] {
      if (!this._iModel.briefcase)
        throw this._iModel.newNotOpenError();

      const { error, result } = this._iModel.nativeDb.getTiles(treeId, tileIds);
      if (error)
        throw new IModelError(error.status, "TreeId=" + treeId);

      assert(Array.isArray(result));
      return result! as TileProps[];
    }
  }
}

/**
 * Local Txns in an IModelDb. Local Txns persist only until [[IModelDb.pushChanges]] is called.
 */
export class TxnManager {
  constructor(private _iModel: IModelDb) { }

  /** Get the Id of the first transaction, if any. */
  public queryFirstTxnId(): TxnManager.TxnId { return this._iModel.nativeDb!.txnManagerQueryFirstTxnId(); }

  /** Get the successor of the specified TxnId */
  public queryNextTxnId(txnId: TxnManager.TxnId): TxnManager.TxnId { return this._iModel.nativeDb!.txnManagerQueryNextTxnId(txnId); }

  /** Get the predecessor of the specified TxnId */
  public queryPreviousTxnId(txnId: TxnManager.TxnId): TxnManager.TxnId { return this._iModel.nativeDb!.txnManagerQueryPreviousTxnId(txnId); }

  /** Get the Id of the current (tip) transaction.  */
  public getCurrentTxnId(): TxnManager.TxnId { return this._iModel.nativeDb!.txnManagerGetCurrentTxnId(); }

  /** Get the description that was supplied when the specified transaction was saved. */
  public getTxnDescription(txnId: TxnManager.TxnId): string { return this._iModel.nativeDb!.txnManagerGetTxnDescription(txnId); }

  /** Test if a TxnId is valid */
  public isTxnIdValid(txnId: TxnManager.TxnId): boolean { return this._iModel.nativeDb!.txnManagerIsTxnIdValid(txnId); }

  /** Query if there are any pending Txns in this IModelDb that are waiting to be pushed.  */
  public hasPendingTxns(): boolean { return this.isTxnIdValid(this.queryFirstTxnId()); }

  /** Query if there are any changes in memory that have yet to be saved to the IModelDb. */
  public hasUnsavedChanges(): boolean {
    return this._iModel.nativeDb!.txnManagerHasUnsavedChanges();
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
      if ((txnDesc.length === 0) || seen.has(txnDesc)) {
        txnId = this.queryNextTxnId(txnId);
        continue;
      }

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

/** Utility to cache and retrieve results of long running open IModelDb requests
 * The cache is keyed on the input arguments passed to open
 * @hidden
 */
class OpenIModelDbMemoizer extends PromiseMemoizer<IModelDb> {
  public constructor() {
    super(IModelDb.open, (accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion): string => {
      return `${accessToken.toTokenString()}:${contextId}:${iModelId}:${JSON.stringify(openParams)}:${JSON.stringify(version)}`;
    });
  }

  private superMemoize = this.memoize;
  public memoize = (accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion): QueryablePromise<IModelDb> => {
    return this.superMemoize(accessToken, contextId, iModelId, openParams, version);
  }

  private superDeleteMemoized = this.deleteMemoized;
  public deleteMemoized = (accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion) => {
    this.superDeleteMemoized(accessToken, contextId, iModelId, openParams, version);
  }
}

export const { memoize: memoizeOpenIModelDb, deleteMemoized: deleteMemoizedOpenIModelDb } = new OpenIModelDbMemoizer();
