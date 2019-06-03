/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */
import {
  ClientRequestContext, BeEvent, BentleyStatus, DbResult, AuthStatus, Guid, GuidString, Id64, Id64Arg, Id64Set,
  Id64String, JsonUtils, Logger, OpenMode, PerfLogger, BeDuration,
} from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, UlasClient, UsageLogEntry, UsageType } from "@bentley/imodeljs-clients";
import {
  AxisAlignedBox3d, CategorySelectorProps, Code, CodeSpec, CreateIModelProps, DisplayStyleProps, EcefLocation, ElementAspectProps,
  ElementLoadProps, ElementProps, EntityMetaData, EntityProps, EntityQueryParams, FilePropertyProps, FontMap, FontMapProps, FontProps,
  IModel, IModelError, IModelNotFoundResponse, IModelProps, IModelStatus, IModelToken, IModelVersion, ModelProps, ModelSelectorProps,
  PropertyCallback, SheetProps, SnapRequestProps, SnapResponseProps, ThumbnailProps, TileTreeProps, ViewDefinitionProps, ViewQueryParams,
  ViewStateProps, IModelCoordinatesResponseProps, GeoCoordinatesResponseProps, QueryResponseStatus, QueryResponse, QueryPriority, QueryLimit, QueryQuota, RpcPendingResponse,
} from "@bentley/imodeljs-common";
import * as path from "path";
import * as os from "os";
import { BriefcaseEntry, BriefcaseId, BriefcaseManager, KeepBriefcase } from "./BriefcaseManager";
import { ClassRegistry, MetaDataRegistry } from "./ClassRegistry";
import { CodeSpecs } from "./CodeSpecs";
import { ConcurrencyControl } from "./ConcurrencyControl";
import { ECSqlStatement, ECSqlStatementCache } from "./ECSqlStatement";
import { Element, Subject } from "./Element";
import { ElementAspect } from "./ElementAspect";
import { Entity } from "./Entity";
import { ExportGraphicsProps } from "./ExportGraphics";
import { IModelJsFs } from "./IModelJsFs";
import { IModelJsNative } from "./IModelJsNative";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { Model } from "./Model";
import { Relationship, RelationshipProps, Relationships } from "./Relationship";
import { CachedSqliteStatement, SqliteStatement, SqliteStatementCache } from "./SqliteStatement";
import { SheetViewDefinition, ViewDefinition } from "./ViewDefinition";
import { IModelHost } from "./IModelHost";
import { PollStatus, PostStatus } from "./ConcurrentQuery";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/** A string that identifies a Txn.
 * @public
 */
export type TxnIdString = string;

/** The signature of a function that can supply a description of local Txns in the specified briefcase up to and including the specified endTxnId.
 * @public
 */
export type ChangeSetDescriber = (endTxnId: TxnIdString) => string;

/** Operations allowed when synchronizing changes between the IModelDb and the iModel Hub
 * @public
 */
export enum SyncMode { FixedVersion = 1, PullAndPush = 2 }

/** Parameters to open an IModelDb
 * @public
 */
export class OpenParams {
  // Constructor
  public constructor(
    /** Mode to Open the IModelDb */
    public readonly openMode: OpenMode,

    /** Operations allowed when synchronizing changes between the IModelDb and IModelHub */
    public readonly syncMode?: SyncMode,

    /** Timeout (in milliseconds) before the open operations throws a RpcPendingResponse exception
     * after queuing up the open. If undefined, waits for the open to complete.
     */
    public timeout?: number,
  ) {
    this.validate();
  }

  /** Returns true if the open params open a snapshot Db */
  public get isStandalone(): boolean { return this.syncMode === undefined; }

  private validate() {
    if (this.isStandalone && this.syncMode !== undefined)
      throw new IModelError(BentleyStatus.ERROR, "Invalid parameters - only openMode can be defined if opening a standalone Db");

    if (this.openMode === OpenMode.Readonly && this.syncMode === SyncMode.PullAndPush) {
      throw new IModelError(BentleyStatus.ERROR, "Cannot pull or push changes into/from a ReadOnly IModel");
    }
  }

  /** Create parameters to open the Db as of a fixed version in a readonly mode */
  public static fixedVersion(): OpenParams { return new OpenParams(OpenMode.Readonly, SyncMode.FixedVersion); }

  /** Create parameters to open the Db to make edits and push changes to the Hub */
  public static pullAndPush(): OpenParams { return new OpenParams(OpenMode.ReadWrite, SyncMode.PullAndPush); }

  /** Create parameters to open a standalone Db
   * @deprecated The confusing concept of *standalone* is being replaced by the more strict concept of a read-only iModel *snapshot*.
   */
  public static standalone(openMode: OpenMode) { return new OpenParams(openMode); }
  /** Returns true if equal and false otherwise */
  public equals(other: OpenParams) {
    return other.openMode === this.openMode && other.syncMode === this.syncMode;
  }
}

/** An iModel database file. The database file is either a local copy (briefcase) of an iModel managed by iModelHub or a read-only *snapshot* used for archival and data transfer purposes.
 *
 * IModelDb raises a set of events to allow apps and subsystems to track IModelDb object life cycle, including [[onOpen]] and [[onOpened]].
 * @see [learning about IModelDb]($docs/learning/backend/IModelDb.md)
 * @public
 */
export class IModelDb extends IModel {
  public static readonly defaultLimit = 1000; // default limit for batching queries
  public static readonly maxLimit = 10000; // maximum limit for batching queries
  /** Event called after a changeset is applied to this IModelDb. */
  public readonly onChangesetApplied = new BeEvent<() => void>();
  public readonly models = new IModelDb.Models(this);
  public readonly elements = new IModelDb.Elements(this);
  public readonly views = new IModelDb.Views(this);
  public readonly tiles = new IModelDb.Tiles(this);
  /** @beta */
  public readonly txns = new TxnManager(this);
  private _relationships?: Relationships;
  private _concurrentQueryInitialized: boolean = false;
  private readonly _statementCache = new ECSqlStatementCache();
  private readonly _sqliteStatementCache = new SqliteStatementCache();
  private _codeSpecs?: CodeSpecs;
  private _classMetaDataRegistry?: MetaDataRegistry;
  private _concurrency?: ConcurrencyControl;
  protected _fontMap?: FontMap;
  private readonly _snaps = new Map<string, IModelJsNative.SnapRequest>();

  public readFontJson(): string { return this.nativeDb.readFontMap(); }
  public get fontMap(): FontMap { return this._fontMap || (this._fontMap = new FontMap(JSON.parse(this.readFontJson()) as FontMapProps)); }
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
  public static readonly onOpen = new BeEvent<(_requestContext: AuthorizedClientRequestContext, _contextId: string, _iModelId: string, _openParams: OpenParams, _version: IModelVersion) => void>();

  /** Event raised just after an IModelDb is opened.
   * @note This event is *not* raised for snapshot IModelDbs.
   *
   * **Example:**
   * ``` ts
   * [[include:IModelDb.onOpened]]
   * ```
   */
  public static readonly onOpened = new BeEvent<(_requestContext: AuthorizedClientRequestContext, _imodelDb: IModelDb) => void>();
  /** Event raised just before an IModelDb is created in iModelHub. This event is raised only for iModel access initiated by this app only. This event is not raised for snapshot IModelDbs. */
  public static readonly onCreate = new BeEvent<(_requestContext: AuthorizedClientRequestContext, _contextId: string, _args: CreateIModelProps) => void>();
  /** Event raised just after an IModelDb is created in iModelHub. This event is raised only for iModel access initiated by this app only. This event is not raised for snapshot IModelDbs. */
  public static readonly onCreated = new BeEvent<(_imodelDb: IModelDb) => void>();

  private _briefcase?: BriefcaseEntry;

  /** @internal */
  public get briefcase(): BriefcaseEntry { return this._briefcase!; }

  /** Check if this iModel has been opened read-only or not. */
  public get isReadonly(): boolean { return this.openParams.openMode === OpenMode.Readonly; }

  private constructor(briefcaseEntry: BriefcaseEntry, iModelToken: IModelToken, openParams: OpenParams) {
    super(iModelToken);
    this.openParams = openParams;
    this.setupBriefcaseEntry(briefcaseEntry);
    this.initializeIModelDb();
  }

  private initializeIModelDb() {
    const props = JSON.parse(this.nativeDb.getIModelProps()) as IModelProps;
    const name = props.rootSubject ? props.rootSubject.name : path.basename(this.briefcase.pathname);
    super.initialize(name, props);
  }

  private static constructIModelDb(briefcaseEntry: BriefcaseEntry, openParams: OpenParams, contextId?: string): IModelDb {
    if (briefcaseEntry.iModelDb)
      return briefcaseEntry.iModelDb; // If there's an IModelDb already associated with the briefcase, that should be reused.
    const iModelToken = new IModelToken(briefcaseEntry.getKey(), contextId, briefcaseEntry.iModelId, briefcaseEntry.currentChangeSetId, openParams.openMode);
    return new IModelDb(briefcaseEntry, iModelToken, openParams);
  }

  /** Create an *empty* local iModel *snapshot* file. Snapshots are disconnected from iModelHub so do not have a change timeline. Snapshots are typically used for archival or data transfer purposes.
   * > Note: A *snapshot* cannot be modified after [[closeSnapshot]] is called.
   * @param snapshotFile The file that will contain the new iModel *snapshot*
   * @param args The parameters that define the new iModel *snapshot*
   * @beta
   */
  public static createSnapshot(snapshotFile: string, args: CreateIModelProps): IModelDb {
    const briefcaseEntry: BriefcaseEntry = BriefcaseManager.createStandalone(snapshotFile, args);
    return IModelDb.constructIModelDb(briefcaseEntry, OpenParams.standalone(briefcaseEntry.openParams.openMode));
  }

  /** Create a local iModel *snapshot* file using this iModel as a *seed* or starting point.
   * Snapshots are disconnected from iModelHub so do not have a change timeline. Snapshots are typically used for archival or data transfer purposes.
   * > Note: A *snapshot* cannot be modified after [[closeSnapshot]] is called.
   * @param snapshotFile The file that will contain the new iModel *snapshot*
   * @returns A writeable IModelDb
   * @beta
   */
  public createSnapshot(snapshotFile: string): IModelDb {
    IModelJsFs.copySync(this.briefcase.pathname, snapshotFile);
    const briefcaseEntry: BriefcaseEntry = BriefcaseManager.openStandalone(snapshotFile, OpenMode.ReadWrite, false);
    const isSeedFileMaster: boolean = BriefcaseId.Master === briefcaseEntry.briefcaseId;
    const isSeedFileSnapshot: boolean = BriefcaseId.Snapshot === briefcaseEntry.briefcaseId;
    // Replace iModelId if seedFile is a master or snapshot, preserve iModelId if seedFile is an iModelHub-managed briefcase
    if ((isSeedFileMaster) || (isSeedFileSnapshot)) {
      briefcaseEntry.iModelId = Guid.createValue();
    }
    briefcaseEntry.briefcaseId = BriefcaseId.Snapshot;
    const snapshotDb: IModelDb = IModelDb.constructIModelDb(briefcaseEntry, OpenParams.standalone(OpenMode.ReadWrite)); // WIP: clean up copied file on error?
    if (isSeedFileMaster) {
      snapshotDb.setGuid(briefcaseEntry.iModelId);
    } else {
      snapshotDb.setAsMaster(briefcaseEntry.iModelId);
    }
    snapshotDb.nativeDb.setBriefcaseId(briefcaseEntry.briefcaseId);
    return snapshotDb;
  }

  /** Create an iModel on iModelHub */
  public static async create(requestContext: AuthorizedClientRequestContext, contextId: string, iModelName: string, args: CreateIModelProps): Promise<IModelDb> {
    requestContext.enter();
    IModelDb.onCreate.raiseEvent(requestContext, contextId, args);
    const iModelId: string = await BriefcaseManager.create(requestContext, contextId, iModelName, args);
    requestContext.enter();
    return IModelDb.open(requestContext, contextId, iModelId);
  }

  /** Open an iModel from a local file.
   * @param pathname The pathname of the iModel
   * @param openMode Open mode for database
   * @param enableTransactions Enable tracking of transactions in this standalone iModel
   * @throws [[IModelError]]
   * @see [[open]], [[openSnapshot]]
   * @deprecated iModelHub manages the change history of an iModel, so writing changes to a local/unmanaged file doesn't make sense. Callers should migrate to [[openSnapshot]] or [[open]] instead.
   * @internal
   */
  public static openStandalone(pathname: string, openMode: OpenMode = OpenMode.ReadWrite, enableTransactions: boolean = false): IModelDb {
    const briefcaseEntry: BriefcaseEntry = BriefcaseManager.openStandalone(pathname, openMode, enableTransactions);
    return IModelDb.constructIModelDb(briefcaseEntry, OpenParams.standalone(openMode));
  }

  /** Open a local iModel *snapshot*. Once created, *snapshots* are read-only and are typically used for archival or data transfer purposes.
   * @see [[open]]
   * @throws [IModelError]($common) If the file is not found or is not a valid *snapshot*.
   * @beta
   */
  public static openSnapshot(filePath: string): IModelDb {
    const iModelDb: IModelDb = this.openStandalone(filePath, OpenMode.Readonly, false);
    const briefcaseId: number = iModelDb.getBriefcaseId().value;
    if ((BriefcaseId.Snapshot === briefcaseId) || (BriefcaseId.Master === briefcaseId)) {
      return iModelDb;
    }
    throw new IModelError(IModelStatus.BadRequest, "IModelDb.openSnapshot cannot be used to open a briefcase", Logger.logError, loggerCategory);
  }

  /** Open an iModel from iModelHub. IModelDb files are cached locally. The requested version may be downloaded from iModelHub to the
   * cache, or a previously downloaded version re-used from the cache - this behavior can optionally be configured through OpenParams.
   * Every open call must be matched with a call to close the IModelDb.
   * @param requestContext The client request context.
   * @param contextId Id of the Connect Project or Asset containing the iModel
   * @param iModelId Id of the iModel
   * @param version Version of the iModel to open
   * @param openParams Parameters to open the iModel
   */
  public static async open(requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: string, openParams: OpenParams = OpenParams.pullAndPush(), version: IModelVersion = IModelVersion.latest()): Promise<IModelDb> {
    requestContext.enter();
    const perfLogger = new PerfLogger("Opening iModel", () => ({ contextId, iModelId, ...openParams }));

    IModelDb.onOpen.raiseEvent(requestContext, contextId, iModelId, openParams, version);

    let briefcaseEntry: BriefcaseEntry;
    let timedOut = false;
    try {
      briefcaseEntry = await BriefcaseManager.open(requestContext, contextId, iModelId, openParams, version);
      requestContext.enter();

      if (briefcaseEntry.isPending) {
        if (typeof openParams.timeout === "undefined")
          await briefcaseEntry.isPending;
        else {
          const waitPromise = BeDuration.wait(openParams.timeout).then(() => {
            timedOut = true;
          });
          await Promise.race([briefcaseEntry.isPending, waitPromise]);
        }
      }
    } catch (error) {
      requestContext.enter();
      Logger.logError(loggerCategory, "Failed IModelDb.open", () => ({ token: requestContext.accessToken.toTokenString(), contextId, iModelId, ...openParams }));
      throw error;
    }

    if (timedOut) {
      Logger.logTrace(loggerCategory, "Issuing pending status in IModelDb.open", () => ({ contextId, iModelId, ...openParams }));
      throw new RpcPendingResponse();
    }

    const imodelDb = IModelDb.constructIModelDb(briefcaseEntry, openParams, contextId);
    try {
      const client = new UlasClient();
      const ulasEntry = new UsageLogEntry(os.hostname(), UsageType.Trial, contextId);
      await client.logUsage(requestContext, ulasEntry);
      requestContext.enter();
    } catch (error) {
      requestContext.enter();
      Logger.logError(loggerCategory, "Could not log usage information", () => ({ errorStatus: error.status, errorMessage: error.Message, iModelToken: imodelDb.iModelToken }));
    }
    IModelDb.onOpened.raiseEvent(requestContext, imodelDb);

    perfLogger.dispose();
    return imodelDb;
  }

  /**
   * Returns true if this is a standalone iModel
   * @deprecated The confusing concept of *standalone* is being replaced by the more strict concept of a read-only iModel *snapshot*.
   */
  public get isStandalone(): boolean {
    return this.briefcase.openParams.isStandalone;
  }

  /** Close this standalone iModel, if it is currently open
   * @throws IModelError if the iModel is not open, or is not standalone
   * @see [[closeSnapshot]]
   * @deprecated The confusing concept of *standalone* is being replaced by the more strict concept of a read-only iModel *snapshot*. Callers should migrate to [[closeSnapshot]].
   * @internal
   */
  public closeStandalone(): void {
    if (!this.briefcase)
      throw this.newNotOpenError();
    if (!this.isStandalone)
      throw new IModelError(BentleyStatus.ERROR, "Cannot use to close a managed iModel. Use IModelDb.close() instead");
    BriefcaseManager.closeStandalone(this.briefcase);
    this.clearBriefcaseEntry();
  }

  /** Close this local read-only iModel *snapshot*, if it is currently open.
   * > Note: A *snapshot* cannot be modified after this function is called.
   * @throws IModelError if the iModel is not open, or is not a *snapshot*.
   * @beta
   */
  public closeSnapshot(): void {
    this.closeStandalone();
  }

  /** Close this iModel, if it is currently open.
   * @param requestContext The client request context.
   * @param keepBriefcase Hint to discard or keep the briefcase for potential future use.
   * @throws IModelError if the iModel is not open, or is really a snapshot iModel
   */
  public async close(requestContext: AuthorizedClientRequestContext, keepBriefcase: KeepBriefcase = KeepBriefcase.Yes): Promise<void> {
    requestContext.enter();
    if (!this.briefcase)
      throw this.newNotOpenError();
    if (this.isStandalone)
      throw new IModelError(BentleyStatus.ERROR, "Cannot use IModelDb.close() to close a snapshot iModel. Use IModelDb.closeSnapshot() instead");

    try {
      await BriefcaseManager.close(requestContext, this.briefcase, keepBriefcase);
    } catch (error) {
      throw error;
    } finally {
      requestContext.enter();
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

  private onBriefcaseVersionUpdatedHandler() { this.iModelToken.changeSetId = this.briefcase.currentChangeSetId; }

  /** Event called when the iModel is about to be closed */
  public readonly onBeforeClose = new BeEvent<() => void>();

  /** Get the in-memory handle of the native Db
   * @internal
   */
  public get nativeDb(): IModelJsNative.DgnDb { return this.briefcase.nativeDb; }

  /** Get the briefcase Id of this iModel */
  public getBriefcaseId(): BriefcaseId { return new BriefcaseId(this.briefcase === undefined ? BriefcaseId.Illegal : this.briefcase.briefcaseId); }

  /** Returns a new IModelError with errorNumber, message, and meta-data set properly for a *not open* error.
   * @internal
   */
  public newNotOpenError() {
    return new IModelError(IModelStatus.NotOpen, "IModelDb not open", Logger.logError, loggerCategory, () => ({ name: this.name, ...this.iModelToken }));
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
    if (cachedStatement)
      this._statementCache.replace(ecsql, stmt);
    else
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
    const release = () => {
      if (stmt.isShared)
        this._statementCache.release(stmt);
      else
        stmt.dispose();
    };

    try {
      const val: T = callback(stmt);
      if (val instanceof Promise) {
        val.then(release, release);
      } else {
        release();
      }
      return val;
    } catch (err) {
      release();
      Logger.logError(loggerCategory, err.toString());
      throw err;
    }
  }
  /** Compute number of rows that would be returned by the ECSQL.
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameters.
   * See "[iModel.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @returns Return row count.
   * @throws [IModelError]($common) If the statement is invalid
   */
  public async queryRowCount(ecsql: string, bindings?: any[] | object): Promise<number> {
    for await (const row of this.query(`select count(*) nRows from (${ecsql})`, bindings)) {
      return row.nRows;
    }
    throw new IModelError(DbResult.BE_SQLITE_ERROR, "Failed to get row count");
  }

  /** Execute a query against this ECDb but restricted by quota and limit settings. This is intended to be used internally
   * The result of the query is returned as an array of JavaScript objects where every array element represents an
   * [ECSQL row]($docs/learning/ECSQLRowFormat).
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameters.
   * See "[iModel.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @param limitRows Specify upper limit for rows that can be returned by the query.
   * @param quota Specify non binding quota. These values are constrained by global setting
   * but never the less can be specified to narrow down the quota constraint for the query but staying under global settings.
   * @param priority Specify non binding priority for the query. It can help user to adjust
   * priority of query in queue so that small and quicker queries can be prioritized over others.
   * @returns Returns structure containing rows and status.
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @internal
   */
  public async queryRows(ecsql: string, bindings?: any[] | object, limit?: QueryLimit, quota?: QueryQuota, priority?: QueryPriority): Promise<QueryResponse> {
    if (!this._concurrentQueryInitialized) {
      this._concurrentQueryInitialized = this.nativeDb.concurrentQueryInit(IModelHost.configuration!.concurrentQuery);
    }
    if (!bindings) bindings = [];
    if (!limit) limit = {};
    if (!quota) quota = {};
    if (!priority) priority = QueryPriority.Normal;
    const base64Header = "encoding=base64;";
    // handle binary type
    const reviver = (_name: string, value: any) => {
      if (typeof value === "string") {
        if (value.length >= base64Header.length && value.startsWith(base64Header)) {
          const out = value.substr(base64Header.length);
          const buffer = Buffer.from(out, "base64");
          return new Uint8Array(buffer);
        }
      }
      return value;
    };
    // handle binary type
    const replacer = (_name: string, value: any) => {
      if (value && value.constructor === Uint8Array) {
        const buffer = Buffer.from(value);
        return base64Header + buffer.toString("base64");
      }
      return value;
    };
    return new Promise<QueryResponse>((resolve) => {
      const postrc = this.nativeDb.postConcurrentQuery(ecsql, JSON.stringify(bindings, replacer), limit!, quota!, priority!);
      if (postrc.status !== PostStatus.Done)
        resolve({ status: QueryResponseStatus.PostError, rows: [] });

      const poll = () => {
        const pollrc = this.nativeDb.pollConcurrentQuery(postrc.taskId);
        if (pollrc.status === PollStatus.Done)
          resolve({ status: QueryResponseStatus.Done, rows: JSON.parse(pollrc.result, reviver) });
        else if (pollrc.status === PollStatus.Partial)
          resolve({ status: QueryResponseStatus.Partial, rows: JSON.parse(pollrc.result, reviver) });
        else if (pollrc.status === PollStatus.Timeout)
          resolve({ status: QueryResponseStatus.Timeout, rows: [] });
        else if (pollrc.status === PollStatus.Pending)
          setTimeout(() => { poll(); }, IModelHost.configuration!.concurrentQuery.pollInterval);
        else
          resolve({ status: QueryResponseStatus.Error, rows: [pollrc.result] });
      };
      setTimeout(() => { poll(); }, IModelHost.configuration!.concurrentQuery.pollInterval);
    });
  }
  /** Execute a query and stream its results
   * The result of the query is async iterator over the rows. The iterator will get next page automatically once rows in current page has been read.
   * [ECSQL row]($docs/learning/ECSQLRowFormat).
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameters.
   * See "[iModel.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @param limitRows Specify upper limit for rows that can be returned by the query.
   * @param quota Specify non binding quota. These values are constrained by global setting
   * but never the less can be specified to narrow down the quota constraint for the query but staying under global settings.
   * @param priority Specify non binding priority for the query. It can help user to adjust
   * priority of query in queue so that small and quicker queries can be prioritized over others.
   * @returns Returns the query result as an *AsyncIterableIterator<any>*  which lazy load result as needed
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If there was any error while submitting, preparing or stepping into query
   */
  public async * query(ecsql: string, bindings?: any[] | object, limitRows?: number, quota?: QueryQuota, priority?: QueryPriority): AsyncIterableIterator<any> {
    let result: QueryResponse;
    let offset: number = 0;
    let rowsToGet = limitRows ? limitRows : -1;
    do {
      result = await this.queryRows(ecsql, bindings, { maxRowAllowed: rowsToGet, startRowOffset: offset }, quota, priority);
      while (result.status === QueryResponseStatus.Timeout) {
        result = await this.queryRows(ecsql, bindings, { maxRowAllowed: rowsToGet, startRowOffset: offset }, quota, priority);
      }

      if (result.status === QueryResponseStatus.Error)
        throw new IModelError(DbResult.BE_SQLITE_ERROR, result.rows.length > 0 ? result.rows[0] : "Failed to execute ECSQL");

      if (rowsToGet > 0) {
        rowsToGet -= result.rows.length;
      }
      offset += result.rows.length;

      for (const row of result.rows)
        yield row;

    } while (result.status !== QueryResponseStatus.Done);
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
   * See "[iModel.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @returns Returns the query result as an array of the resulting rows or an empty array if the query has returned no rows.
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If the statement is invalid or [IModelDb.maxLimit]($backend) exceeded when collecting ids.
   * @deprecated use withPreparedStatement or query or queryPage instead
   */
  public executeQuery(ecsql: string, bindings?: any[] | object): any[] {
    return this.withPreparedStatement(ecsql, (stmt: ECSqlStatement) => {
      if (bindings)
        stmt.bindValues(bindings);
      const rows: any[] = [];
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        rows.push(stmt.getRow());
        if (rows.length > IModelDb.maxLimit) {
          throw new IModelError(IModelStatus.BadRequest, "Max LIMIT exceeded in SELECT statement", Logger.logError, loggerCategory);
        }
      }
      return rows;
    });
  }

  /** Use a prepared SQLite SQL statement. This function takes care of preparing the statement and then releasing it.
   * As preparing statements can be costly, they get cached. When calling this method again with the same ECSQL,
   * the already prepared statement from the cache will be reused.
   * @param sql The SQLite SQL statement to execute
   * @param callback the callback to invoke on the prepared statement
   * @returns the value returned by cb
   * @internal
   */
  public withPreparedSqliteStatement<T>(sql: string, callback: (stmt: SqliteStatement) => T): T {
    const stmt = this.getPreparedSqlStatement(sql);
    const release = () => {
      if (stmt.isShared)
        this._sqliteStatementCache.release(stmt);
      else
        stmt.dispose();
    };
    try {
      const val: T = callback(stmt);
      if (val instanceof Promise) {
        val.then(release, release);
      } else {
        release();
      }
      return val;
    } catch (err) {
      release();
      Logger.logError(loggerCategory, err.toString());
      throw err;
    }
  }

  /** Prepare an SQLite SQL statement.
   * @param sql The SQLite SQL statement to prepare
   * @throws [[IModelError]] if there is a problem preparing the statement.
   * @internal
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

    this._sqliteStatementCache.removeUnusedStatementsIfNecessary();
    const stmt: SqliteStatement = this.prepareSqliteStatement(sql);
    if (cachedStatement)
      this._sqliteStatementCache.replace(sql, stmt);
    else
      this._sqliteStatementCache.add(sql, stmt);
    return stmt;
  }

  /** Query for a set of entity ids, given an EntityQueryParams
   * @param params The query parameters. The `limit` and `offset` members should be used to page results.
   * @returns an Id64Set with results of query
   * @throws [IModelError]($common) if the generated statement is invalid or [IModelDb.maxLimit]($backend) exceeded when collecting ids.
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
        if (row.id !== undefined) {
          ids.add(row.id);
          if (ids.size > IModelDb.maxLimit) {
            throw new IModelError(IModelStatus.BadRequest, "Max LIMIT exceeded in SELECT statement", Logger.logError, loggerCategory);
          }
        }
      }
    });
    return ids;
  }

  /** Empty the [ECSqlStatementCache]($backend) for this iModel. */
  public clearStatementCache(): void { this._statementCache.clear(); }

  /** Empty the [SqliteStatementCache]($backend) for this iModel. */
  public clearSqliteStatementCache(): void { this._sqliteStatementCache.clear(); }

  /** Get the GUID of this iModel.  */
  public getGuid(): GuidString { return this.nativeDb.getDbGuid(); }

  /** Set the GUID of this iModel. */
  public setGuid(guid: GuidString): DbResult { return this.nativeDb.setDbGuid(guid); }

  /** Update the project extents for this iModel.
   * <p><em>Example:</em>
   * ``` ts
   * [[include:IModelDb.updateProjectExtents]]
   * ```
   */
  public updateProjectExtents(newExtents: AxisAlignedBox3d) {
    this.projectExtents = newExtents;
    this.updateIModelProps();
  }

  /** Update the [EcefLocation]($docs/learning/glossary#eceflocation) of this iModel.  */
  public updateEcefLocation(ecef: EcefLocation) {
    this.setEcefLocation(ecef);
    this.updateIModelProps();
  }

  /** Update the IModelProps of this iModel in the database. */
  public updateIModelProps() { this.nativeDb.updateIModelProps(JSON.stringify(this.toJSON())); }

  /**
   * Commit pending changes to this iModel.
   * @note If this IModelDb is connected to an iModel, then you must call [[ConcurrencyControl.request]] before attempting to save changes.
   * @param _description Optional description of the changes
   * @throws [[IModelError]] if there is a problem saving changes or if there are pending, un-processed lock or code requests.
   */
  public saveChanges(description?: string) {
    if (this.openParams.openMode === OpenMode.Readonly)
      throw new IModelError(IModelStatus.ReadOnly, "IModelDb was opened read-only", Logger.logError, loggerCategory);

    // TODO: this.Txns.onSaveChanges => validation, rules, indirect changes, etc.
    this.concurrencyControl.onSaveChanges();

    const stat = this.nativeDb.saveChanges(description);
    if (DbResult.BE_SQLITE_OK !== stat)
      throw new IModelError(stat, "Problem saving changes", Logger.logError, loggerCategory);

    this.concurrencyControl.onSavedChanges();
  }

  /** Abandon pending changes in this iModel */
  public abandonChanges() {
    this.concurrencyControl.abandonRequest();
    this.nativeDb.abandonChanges();
  }

  /** Pull and Merge changes from iModelHub
   * @param requestContext The client request context.
   * @param version Version to pull and merge to.
   * @throws [[IModelError]] If the pull and merge fails.
   * @beta
   */
  public async pullAndMergeChanges(requestContext: AuthorizedClientRequestContext, version: IModelVersion = IModelVersion.latest()): Promise<void> {
    requestContext.enter();
    this.concurrencyControl.onMergeChanges();
    await BriefcaseManager.pullAndMergeChanges(requestContext, this.briefcase, version);
    requestContext.enter();
    this.concurrencyControl.onMergedChanges();
    this._token.changeSetId = this.briefcase.currentChangeSetId;
    this.initializeIModelDb();
  }

  /** Push changes to iModelHub
   * @param requestContext The client request context.
   * @param describer A function that returns a description of the changeset. Defaults to the combination of the descriptions of all local Txns.
   * @throws [[IModelError]] If the pull and merge fails.
   * @beta
   */
  public async pushChanges(requestContext: AuthorizedClientRequestContext, describer?: ChangeSetDescriber): Promise<void> {
    requestContext.enter();
    const description = describer ? describer(this.txns.getCurrentTxnId()) : this.txns.describeChangeSet();
    await BriefcaseManager.pushChanges(requestContext, this.briefcase, description);
    requestContext.enter();
    this._token.changeSetId = this.briefcase.currentChangeSetId;
    this.initializeIModelDb();
  }

  /** Reverse a previously merged set of changes
   * @param requestContext The client request context.
   * @param version Version to reverse changes to.
   * @throws [[IModelError]] If the reversal fails.
   * @beta
   */
  public async reverseChanges(requestContext: AuthorizedClientRequestContext, version: IModelVersion = IModelVersion.latest()): Promise<void> {
    requestContext.enter();
    await BriefcaseManager.reverseChanges(requestContext, this.briefcase, version);
    requestContext.enter();
    this.initializeIModelDb();
  }

  /** Reinstate a previously reversed set of changes
   * @param requestContext The client request context.
   * @param version Version to reinstate changes to.
   * @throws [[IModelError]] If the reinstate fails.
   * @beta
   */
  public async reinstateChanges(requestContext: AuthorizedClientRequestContext, version: IModelVersion = IModelVersion.latest()): Promise<void> {
    requestContext.enter();
    await BriefcaseManager.reinstateChanges(requestContext, this.briefcase, version);
    requestContext.enter();
    this.initializeIModelDb();
  }

  /** Set iModel as Master copy.
   * @param guid Optionally provide db guid. If its not provided the method would generate one.
   */
  public setAsMaster(guid?: GuidString): void {
    if (guid === undefined) {
      if (DbResult.BE_SQLITE_OK !== this.nativeDb.setAsMaster())
        throw new IModelError(IModelStatus.SQLiteError, "", Logger.logWarning, loggerCategory);
    } else {
      if (DbResult.BE_SQLITE_OK !== this.nativeDb.setAsMaster(guid!))
        throw new IModelError(IModelStatus.SQLiteError, "", Logger.logWarning, loggerCategory);
    }
  }

  /** Import an ECSchema. On success, the schema definition is stored in the iModel.
   * This method is asynchronous (must be awaited) because, in the case where this IModelId is a briefcase,
   * this method must first obtain the schema lock from the IModel server.
   * You must import a schema into an iModel before you can insert instances of the classes in that schema. See [[Element]]
   * @param requestContext The client request context
   * @param schemaFileName  Full path to an ECSchema.xml file that is to be imported.
   * @throws IModelError if the schema lock cannot be obtained.
   * @see containsClass
   */
  public async importSchema(requestContext: ClientRequestContext | AuthorizedClientRequestContext, schemaFileName: string): Promise<void> {
    requestContext.enter();
    if (!this.briefcase)
      throw this.newNotOpenError();

    if (this.isStandalone) {
      const status = this.briefcase.nativeDb.importSchema(schemaFileName);
      if (DbResult.BE_SQLITE_OK !== status)
        throw new IModelError(status, "Error importing schema", Logger.logError, loggerCategory, () => ({ schemaFileName }));
      return;
    }

    if (!(requestContext instanceof AuthorizedClientRequestContext))
      throw new IModelError(AuthStatus.Error, "Importing the schema requires an AuthorizedClientRequestContext");
    await this.concurrencyControl.lockSchema(requestContext);
    requestContext.enter();

    const stat = this.briefcase.nativeDb.importSchema(schemaFileName);
    if (DbResult.BE_SQLITE_OK !== stat) {
      throw new IModelError(stat, "Error importing schema", Logger.logError, loggerCategory, () => ({ schemaFileName }));
    }

    try {
      // The schema import logic and/or imported Domains may have created new elements and models.
      // Make sure we have the supporting locks and codes.
      if (!(requestContext instanceof AuthorizedClientRequestContext))
        throw new IModelError(AuthStatus.Error, "Importing the schema requires an AuthorizedClientRequestContext");
      await this.concurrencyControl.request(requestContext);
      requestContext.enter();
    } catch (err) {
      requestContext.enter();
      this.abandonChanges();
      throw err;
    }
  }

  /** Find an already open IModelDb. Used by the remoting logic.
   * @throws [[IModelError]] if an open IModelDb matching the token is not found.
   */
  public static find(iModelToken: IModelToken): IModelDb {
    const briefcaseEntry = BriefcaseManager.findBriefcaseByToken(iModelToken);
    if (!briefcaseEntry || !briefcaseEntry.iModelDb) {
      Logger.logError(loggerCategory, "IModelDb not found in briefcase cache", () => iModelToken);
      throw new IModelNotFoundResponse();
    }
    Logger.logTrace(loggerCategory, "IModelDb found in briefcase cache", () => iModelToken);
    return briefcaseEntry.iModelDb;
  }

  /** Get the ClassMetaDataRegistry for this iModel.
   * @internal
   */
  public get classMetaDataRegistry(): MetaDataRegistry {
    if (this._classMetaDataRegistry === undefined) this._classMetaDataRegistry = new MetaDataRegistry();
    return this._classMetaDataRegistry;
  }

  /** Get the linkTableRelationships for this IModel */
  public get relationships(): Relationships { return this._relationships || (this._relationships = new Relationships(this)); }

  /** Get the ConcurrencyControl for this IModel.
   * @beta
   */
  public get concurrencyControl(): ConcurrencyControl { return (this._concurrency !== undefined) ? this._concurrency : (this._concurrency = new ConcurrencyControl(this)); }

  /** Get the CodeSpecs in this IModel. */
  public get codeSpecs(): CodeSpecs { return (this._codeSpecs !== undefined) ? this._codeSpecs : (this._codeSpecs = new CodeSpecs(this)); }

  /** @internal */
  public insertCodeSpec(codeSpec: CodeSpec): Id64String {
    if (!this.briefcase) throw this.newNotOpenError();
    const { error, result } = this.nativeDb.insertCodeSpec(codeSpec.name, codeSpec.specScopeType, codeSpec.scopeReq);
    if (error) throw new IModelError(error.status, "inserting CodeSpec" + codeSpec, Logger.logWarning, loggerCategory);
    return Id64.fromJSON(result);
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
  public constructEntity<T extends Entity>(props: EntityProps): T {
    const jsClass = this.getJsClass(props.classFullName);
    return new jsClass(props, this) as T;
  }

  /** Get the JavaScript class that handles a given entity class.  */
  public getJsClass<T extends typeof Entity>(classFullName: string): T {
    try {
      return ClassRegistry.getClass(classFullName, this) as T;
    } catch (err) {
      if (!ClassRegistry.isNotFoundError(err)) {
        Logger.logError(loggerCategory, err.toString());
        throw err;
      }

      this.loadMetaData(classFullName);
      return ClassRegistry.getClass(classFullName, this) as T;
    }
  }

  /** Get metadata for a class. This method will load the metadata from the iModel into the cache as a side-effect, if necessary.
   * @throws [IModelError]($common) if the metadata cannot be found nor loaded.
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

  /*** @internal */
  private loadMetaData(classFullName: string) {
    if (this.classMetaDataRegistry.find(classFullName))
      return;

    const className = classFullName.split(":");
    if (className.length !== 2)
      throw new IModelError(IModelStatus.BadArg, "Invalid classFullName", Logger.logError, loggerCategory, () => ({ ...this._token, classFullName }));

    const val = this.nativeDb.getECClassMetaData(className[0], className[1]);
    if (val.error)
      throw new IModelError(val.error.status, "Error getting class meta data for: " + classFullName, Logger.logError, loggerCategory, () => ({ ...this._token, classFullName }));

    const metaData = new EntityMetaData(JSON.parse(val.result!));
    this.classMetaDataRegistry.add(classFullName, metaData);

    // Recursive, to make sure that base classes are cached.
    if (metaData.baseClasses !== undefined && metaData.baseClasses.length > 0)
      metaData.baseClasses.forEach((baseClassName: string) => this.loadMetaData(baseClassName));
  }

  /** Query if this iModel contains the definition of the specified class.
   * @param classFullName The full name of the class, for example, SomeSchema:SomeClass
   * @returns true if the iModel contains the class definition or false if not.
   * @see importSchema
   */
  public containsClass(classFullName: string): boolean {
    const className = classFullName.split(":");
    return className.length === 2 && this.nativeDb.getECClassMetaData(className[0], className[1]).error === undefined;
  }

  /** Query a "file property" from this iModel, as a string.
   * @returns the property string or undefined if the property is not present.
   */
  public queryFilePropertyString(prop: FilePropertyProps): string | undefined { return this.nativeDb.queryFileProperty(JSON.stringify(prop), true) as string | undefined; }

  /** Query a "file property" from this iModel, as a blob.
   * @returns the property blob or undefined if the property is not present.
   */
  public queryFilePropertyBlob(prop: FilePropertyProps): Uint8Array | undefined { return this.nativeDb.queryFileProperty(JSON.stringify(prop), false) as Uint8Array | undefined; }

  /** Save a "file property" to this iModel
   * @param prop the FilePropertyProps that describes the new property
   * @param value either a string or a blob to save as the file property
   * @returns 0 if successful, status otherwise
   */
  public saveFileProperty(prop: FilePropertyProps, strValue: string | undefined, blobVal?: Uint8Array): DbResult { return this.nativeDb.saveFileProperty(JSON.stringify(prop), strValue, blobVal); }

  /** delete a "file property" from this iModel
   * @param prop the FilePropertyProps that describes the property
   * @returns 0 if successful, status otherwise
   */
  public deleteFileProperty(prop: FilePropertyProps): DbResult { return this.nativeDb.saveFileProperty(JSON.stringify(prop), undefined, undefined); }

  /** Query for the next available major id for a "file property" from this iModel.
   * @param prop the FilePropertyProps that describes the property
   * @returns the next available (that is, an unused) id for prop. If none are present, will return 0.
   */
  public queryNextAvailableFileProperty(prop: FilePropertyProps) { return this.nativeDb.queryNextAvailableFileProperty(JSON.stringify(prop)); }

  public async requestSnap(requestContext: ClientRequestContext, sessionId: string, props: SnapRequestProps): Promise<SnapResponseProps> {
    requestContext.enter();
    let request = this._snaps.get(sessionId);
    if (undefined === request) {
      request = new IModelHost.platform.SnapRequest();
      this._snaps.set(sessionId, request);
    } else
      request.cancelSnap();

    return new Promise<SnapResponseProps>((resolve, reject) => {
      request!.doSnap(this.nativeDb, JsonUtils.toObject(props), (ret: IModelJsNative.ErrorStatusOrResult<IModelStatus, SnapResponseProps>) => {
        this._snaps.delete(sessionId);
        if (ret.error !== undefined)
          reject(new Error(ret.error.message));
        else
          resolve(ret.result);
      });
    });
  }

  /** Cancel a previously requested snap. */
  public cancelSnap(sessionId: string): void {
    const request = this._snaps.get(sessionId);
    if (undefined !== request) {
      request.cancelSnap();
      this._snaps.delete(sessionId);
    }
  }

  /** Get the IModel coordinate corresponding to each GeoCoordinate point in the input */
  public async getIModelCoordinatesFromGeoCoordinates(requestContext: ClientRequestContext, props: string): Promise<IModelCoordinatesResponseProps> {
    requestContext.enter();
    const resultString: string = this.nativeDb.getIModelCoordinatesFromGeoCoordinates(props);
    return JSON.parse(resultString) as IModelCoordinatesResponseProps;
  }

  /** Get the GeoCoordinate (longitude, latitude, elevation) corresponding to each IModel Coordinate point in the input */
  public async getGeoCoordinatesFromIModelCoordinates(requestContext: ClientRequestContext, props: string): Promise<GeoCoordinatesResponseProps> {
    requestContext.enter();
    const resultString: string = this.nativeDb.getGeoCoordinatesFromIModelCoordinates(props);
    return JSON.parse(resultString) as GeoCoordinatesResponseProps;
  }

  /** Export meshes suitable for graphics APIs from arbitrary geometry in elements in this IModelDb.
   *  * Requests can be slow when processing many elements so it is expected that this function be used on a dedicated backend.
   *  * Vertices are exported in the IModelDb's world coordinate system, which is right-handed with Z pointing up.
   *  * The results of changing [ExportGraphicsProps]($imodeljs-backend) during the [ExportGraphicsProps.onGraphics]($imodeljs-backend) callback are not defined.
   *
   * Example that prints the mesh for element 1 to stdout in [OBJ format](https://en.wikipedia.org/wiki/Wavefront_.obj_file)
   * ```
   * const onGraphics: ExportGraphicsFunction = (info: ExportGraphicsInfo) => {
   *   const mesh: ExportGraphicsMesh = info.mesh;
   *   for (let i = 0; i < mesh.points.length; i += 3) {
   *     process.stdout.write(`v ${mesh.points[i]} ${mesh.points[i + 1]} ${mesh.points[i + 2]}\n`);
   *     process.stdout.write(`vn ${mesh.normals[i]} ${mesh.normals[i + 1]} ${mesh.normals[i + 2]}\n`);
   *   }
   *
   *   for (let i = 0; i < mesh.params.length; i += 2) {
   *     process.stdout.write(`vt ${mesh.params[i]} ${mesh.params[i + 1]}\n`);
   *   }
   *
   *   for (let i = 0; i < mesh.indices.length; i += 3) {
   *     const p1 = mesh.indices[i];
   *     const p2 = mesh.indices[i + 1];
   *     const p3 = mesh.indices[i + 2];
   *     process.stdout.write(`f ${p1}/${p1}/${p1} ${p2}/${p2}/${p2} ${p3}/${p3}/${p3}\n`);
   *   }
   * };
   *
   * iModel.exportGraphics(({ onGraphics, elementIdArray: ["0x1"] }));
   * ```
   * @returns 0 if successful, status otherwise
   * @beta Waiting for feedback from community before finalizing.
   */
  public exportGraphics(exportProps: ExportGraphicsProps): DbResult {
    return this.nativeDb.exportGraphics(exportProps);
  }
}

/** @public */
export namespace IModelDb {

  /** The collection of models in an [[IModelDb]].
   * @public
   */
  export class Models {
    /** @internal */
    public constructor(private _iModel: IModelDb) { }

    /** Get the Model with the specified identifier.
     * @param modelId The Model identifier.
     * @throws [[IModelError]]
     */
    public getModelProps<T extends ModelProps>(modelId: Id64String): T {
      const json = this.getModelJson(JSON.stringify({ id: modelId.toString() }));
      return JSON.parse(json) as T;
    }

    /** Get the Model with the specified identifier.
     * @param modelId The Model identifier.
     * @throws [[IModelError]]
     */
    public getModel<T extends Model>(modelId: Id64String): T { return this._iModel.constructEntity<T>(this.getModelProps(modelId)); }

    /**
     * Read the properties for a Model as a json string.
     * @param modelIdArg a json string with the identity of the model to load. Must have either "id" or "code".
     * @return a json string with the properties of the model.
     */
    public getModelJson(modelIdArg: string): string {
      if (!this._iModel.briefcase) throw this._iModel.newNotOpenError();
      const val = this._iModel.nativeDb.getModel(modelIdArg);
      if (val.error)
        throw new IModelError(val.error.status, "Model=" + modelIdArg);
      return val.result!;
    }

    /** Get the sub-model of the specified Element.
     * See [[IModelDb.Elements.queryElementIdByCode]] for more on how to find an element by Code.
     * @param modeledElementId Identifies the modeled element.
     * @throws [[IModelError]]
     */
    public getSubModel<T extends Model>(modeledElementId: Id64String | GuidString | Code): T {
      const modeledElement = this._iModel.elements.getElement(modeledElementId);
      if (modeledElement.id === IModel.rootSubjectId)
        throw new IModelError(IModelStatus.NotFound, "Root subject does not have a sub-model", Logger.logWarning, loggerCategory);

      return this.getModel<T>(modeledElement.id);
    }

    /** Create a new model in memory.
     * See the example in [[InformationPartitionElement]].
     * @param modelProps The properties to use when creating the model.
     * @throws [[IModelError]] if there is a problem creating the model.
     */
    public createModel<T extends Model>(modelProps: ModelProps): T { return this._iModel.constructEntity<T>(modelProps); }

    /** Insert a new model.
     * @param props The data for the new model.
     * @returns The newly inserted model's Id.
     * @throws [[IModelError]] if unable to insert the model.
     */
    public insertModel(props: ModelProps): Id64String {
      if (props.isPrivate === undefined) // temporarily work around bug in addon
        props.isPrivate = false;

      const jsClass = this._iModel.getJsClass<typeof Model>(props.classFullName);
      if (IModelStatus.Success !== jsClass.onInsert(props))
        return Id64.invalid;

      const val = this._iModel.nativeDb.insertModel(JSON.stringify(props));
      if (val.error)
        throw new IModelError(val.error.status, "inserting model", Logger.logWarning, loggerCategory);

      props.id = Id64.fromJSON(JSON.parse(val.result!).id);
      jsClass.onInserted(props.id);
      return props.id;
    }

    /** Update an existing model.
     * @param props the properties of the model to change
     * @throws [[IModelError]] if unable to update the model.
     */
    public updateModel(props: ModelProps): void {
      const jsClass = this._iModel.getJsClass<typeof Model>(props.classFullName);
      if (IModelStatus.Success !== jsClass.onUpdate(props))
        return;

      const error = this._iModel.nativeDb.updateModel(JSON.stringify(props));
      if (error !== IModelStatus.Success)
        throw new IModelError(error, "updating model id=" + props.id, Logger.logWarning, loggerCategory);

      jsClass.onUpdated(props);
    }

    /** Delete one or more existing models.
     * @param ids The Ids of the models to be deleted
     * @throws [[IModelError]]
     */
    public deleteModel(ids: Id64Arg): void {
      Id64.toIdSet(ids).forEach((id) => {
        const props = this.getModelProps(id);
        const jsClass = this._iModel.getJsClass<typeof Model>(props.classFullName);
        if (IModelStatus.Success !== jsClass.onDelete(props))
          return;

        const error = this._iModel.nativeDb.deleteModel(id);
        if (error !== IModelStatus.Success)
          throw new IModelError(error, "", Logger.logWarning, loggerCategory);

        jsClass.onDeleted(props);
      });
    }
  }

  /** The collection of elements in an [[IModelDb]].
   * @public
   */
  export class Elements {
    /** @internal */
    public constructor(private _iModel: IModelDb) { }

    /**
     * Read element data from iModel as a json string
     * @param elementIdArg a json string with the identity of the element to load. Must have one of "id", "federationGuid", or "code".
     * @return a json string with the properties of the element.
     */
    public getElementJson<T extends ElementProps>(elementIdArg: string): T {
      const val = this._iModel.nativeDb.getElement(elementIdArg);
      if (val.error)
        throw new IModelError(val.error.status, "reading element=" + elementIdArg, Logger.logWarning, loggerCategory);
      return val.result! as T;
    }

    /**
     * Get properties of an Element by Id, FederationGuid, or Code
     * @throws [[IModelError]] if the element is not found.
     */
    public getElementProps<T extends ElementProps>(elementId: Id64String | GuidString | Code | ElementLoadProps): T {
      if (typeof elementId === "string")
        elementId = Id64.isId64(elementId) ? { id: elementId } : { federationGuid: elementId };
      else if (elementId instanceof Code)
        elementId = { code: elementId };

      return this.getElementJson<T>(JSON.stringify(elementId));
    }

    /**
     * Get an element by Id, FederationGuid, or Code
     * @param elementId either the element's Id, Code, or FederationGuid, or an ElementLoadProps
     * @throws [[IModelError]] if the element is not found.
     */
    public getElement<T extends Element>(elementId: Id64String | GuidString | Code | ElementLoadProps): T {
      if (typeof elementId === "string")
        elementId = Id64.isId64(elementId) ? { id: elementId } : { federationGuid: elementId };
      else if (elementId instanceof Code)
        elementId = { code: elementId };

      return this._iModel.constructEntity<T>(this.getElementJson(JSON.stringify(elementId)));
    }

    /**
     * Query for the Id of the element that has a specified code.
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
    public queryElementIdByCode(code: Code): Id64String | undefined {
      if (Id64.isInvalid(code.spec))
        throw new IModelError(IModelStatus.InvalidCodeSpec, "Invalid CodeSpec", Logger.logWarning, loggerCategory);

      if (code.value === undefined)
        throw new IModelError(IModelStatus.InvalidCode, "Invalid Code", Logger.logWarning, loggerCategory);

      return this._iModel.withPreparedStatement(`SELECT ECInstanceId FROM ${Element.classFullName} WHERE CodeSpec.Id=? AND CodeScope.Id=? AND CodeValue=?`, (stmt: ECSqlStatement) => {
        stmt.bindId(1, code.spec);
        stmt.bindId(2, Id64.fromString(code.scope));
        stmt.bindString(3, code.value!);
        if (DbResult.BE_SQLITE_ROW !== stmt.step())
          return undefined;

        return Id64.fromJSON(stmt.getRow().id);
      });
    }

    /**
     * Create a new instance of an element.
     * @param elProps The properties of the new element.
     * @throws [[IModelError]] if there is a problem creating the element.
     */
    public createElement<T extends Element>(elProps: ElementProps): T { return this._iModel.constructEntity<T>(elProps); }

    /**
     * Insert a new element into the iModel.
     * @param elProps The properties of the new element.
     * @returns The newly inserted element's Id.
     * @throws [[IModelError]] if unable to insert the element.
     */
    public insertElement(elProps: ElementProps): Id64String {
      const iModel = this._iModel;
      const jsClass = iModel.getJsClass(elProps.classFullName) as unknown as typeof Element;
      if (IModelStatus.Success !== jsClass.onInsert(elProps, iModel))
        return Id64.invalid;

      const val = iModel.nativeDb.insertElement(JSON.stringify(elProps));
      if (val.error)
        throw new IModelError(val.error.status, "Problem inserting element", Logger.logWarning, loggerCategory);

      elProps.id = Id64.fromJSON(JSON.parse(val.result!).id);
      jsClass.onInserted(elProps, iModel);
      return elProps.id;
    }

    /** Update some properties of an existing element.
     * @param el the properties of the element to update.
     * @throws [[IModelError]] if unable to update the element.
     */
    public updateElement(elProps: ElementProps): void {
      const iModel = this._iModel;
      const jsClass = iModel.getJsClass<typeof Element>(elProps.classFullName);
      if (IModelStatus.Success !== jsClass.onUpdate(elProps, iModel))
        return;

      const error = iModel.nativeDb.updateElement(JSON.stringify(elProps));
      if (error !== IModelStatus.Success)
        throw new IModelError(error, "", Logger.logWarning, loggerCategory);

      jsClass.onUpdated(elProps, iModel);
    }

    /**
     * Delete one or more elements from this iModel.
     * @param ids The set of Ids of the element(s) to be deleted
     * @throws [[IModelError]]
     */
    public deleteElement(ids: Id64Arg): void {
      const iModel = this._iModel;
      Id64.toIdSet(ids).forEach((id) => {
        const props = this.getElementProps(id);
        const jsClass = iModel.getJsClass<typeof Element>(props.classFullName);
        if (IModelStatus.Success !== jsClass.onDelete(props, iModel))
          return;

        const error = iModel.nativeDb.deleteElement(id);
        if (error !== IModelStatus.Success)
          throw new IModelError(error, "", Logger.logWarning, loggerCategory);

        jsClass.onDeleted(props, iModel);
      });
    }

    /** Query for the child elements of the specified element.
     * @returns Returns an array of child element identifiers.
     * @throws [[IModelError]]
     */
    public queryChildren(elementId: Id64String): Id64String[] {
      const rows: any[] = this._iModel.executeQuery(`SELECT ECInstanceId FROM ${Element.classFullName} WHERE Parent.Id=?`, [elementId]);
      const childIds: Id64String[] = [];
      for (const row of rows)
        childIds.push(Id64.fromJSON(row.id));
      return childIds;
    }

    /** Get the root subject element. */
    public getRootSubject(): Subject { return this.getElement(IModel.rootSubjectId); }

    /** Query for aspects of a particular class (polymorphically) associated with this element.
     * @throws [[IModelError]]
     */
    private _queryAspects(elementId: Id64String, aspectClassName: string): ElementAspect[] {
      const rows = this._iModel.executeQuery(`SELECT * FROM ${aspectClassName} WHERE Element.Id=?`, [elementId]);
      if (rows.length === 0) {
        return [];
      }
      const aspects: ElementAspect[] = [];
      for (const row of rows) {
        aspects.push(this._queryAspect(row.id, row.className.replace(".", ":")));
      }
      return aspects;
    }

    /** Query for aspect by ECInstanceId
     * @throws [[IModelError]]
     */
    private _queryAspect(aspectInstanceId: Id64String, aspectClassName: string): ElementAspect {
      const rows = this._iModel.executeQuery(`SELECT * FROM ${aspectClassName} WHERE ECInstanceId=?`, [aspectInstanceId]);
      if (rows.length !== 1) {
        throw new IModelError(IModelStatus.NotFound, "ElementAspect not found", Logger.logError, loggerCategory, () => ({ aspectInstanceId, aspectClassName }));
      }
      const aspectProps: ElementAspectProps = rows[0]; // start with everything that SELECT * returned
      aspectProps.classFullName = aspectProps.className.replace(".", ":"); // add in property required by EntityProps
      aspectProps.className = undefined; // clear property from SELECT * that we don't want in the final instance
      return this._iModel.constructEntity<ElementAspect>(aspectProps);
    }

    /** Get the ElementAspect instances (by class name) that are related to the specified element.
     * @throws [[IModelError]]
     */
    public getAspects(elementId: Id64String, aspectClassName: string): ElementAspect[] {
      const aspects: ElementAspect[] = this._queryAspects(elementId, aspectClassName);
      return aspects;
    }

    /** Insert a new ElementAspect into the iModel.
     * @param aspectProps The properties of the new ElementAspect.
     * @throws [[IModelError]] if unable to insert the ElementAspect.
     */
    public insertAspect(aspectProps: ElementAspectProps): void {
      if (!this._iModel.briefcase)
        throw this._iModel.newNotOpenError();

      const status = this._iModel.nativeDb.insertElementAspect(JSON.stringify(aspectProps));
      if (status !== IModelStatus.Success)
        throw new IModelError(status, "Error inserting ElementAspect", Logger.logWarning, loggerCategory);
    }

    /** Update an exist ElementAspect within the iModel.
     * @param aspectProps The properties to use to update the ElementAspect.
     * @throws [[IModelError]] if unable to update the ElementAspect.
     */
    public updateAspect(aspectProps: ElementAspectProps): void {
      if (!this._iModel.briefcase)
        throw this._iModel.newNotOpenError();

      const status = this._iModel.nativeDb.updateElementAspect(JSON.stringify(aspectProps));
      if (status !== IModelStatus.Success)
        throw new IModelError(status, "Error updating ElementAspect", Logger.logWarning, loggerCategory);
    }

    /** Delete one or more ElementAspects from this iModel.
     * @param ids The set of Ids of the element(s) to be deleted
     * @throws [[IModelError]]
     */
    public deleteAspect(ids: Id64Arg): void {
      Id64.toIdSet(ids).forEach((id) => {
        const status = this._iModel.nativeDb.deleteElementAspect(id);
        if (status !== IModelStatus.Success)
          throw new IModelError(status, "Error deleting ElementAspect", Logger.logWarning, loggerCategory);
      });
    }
  }

  /** The collection of views in an [[IModelDb]].
   * @public
   */
  export class Views {
    /** @internal */
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
          props.push(imodel.elements.getElementProps<ViewDefinitionProps>(id));
        } catch (err) { }
      });

      return props;
    }

    /** Default parameters for iterating/querying ViewDefinitions. Includes all subclasses of ViewDefinition, excluding only those marked 'private'. */
    public static readonly defaultQueryParams: ViewQueryParams = { from: "BisCore.ViewDefinition", where: "IsPrivate=FALSE" };

    /** Iterate all ViewDefinitions matching the supplied query.
     * @param params Specifies the query by which views are selected.
     * @param callback Function invoked for each ViewDefinition matching the query. Return false to terminate iteration, true to continue.
     * @return true if all views were iterated, false if iteration was terminated early due to callback returning false.
     *
     * **Example: Finding all views of a specific DrawingModel**
     * ``` ts
     * [[include:IModelDb.Views.iterateViews]]
     * ```
     */
    public iterateViews(params: ViewQueryParams, callback: (view: ViewDefinition) => boolean): boolean {
      const ids = this._iModel.queryEntityIds(params);
      let finished = true;
      for (const id of ids) {
        try {
          const view = this._iModel.elements.getElement(id);
          if (undefined !== view && view instanceof ViewDefinition) {
            finished = callback(view);
            if (!finished)
              break;
          }
        } catch (err) { }
      }

      return finished;
    }

    public getViewStateData(viewDefinitionId: string): ViewStateProps {
      const viewStateData: ViewStateProps = {} as any;
      const elements = this._iModel.elements;
      const viewDefinitionElement = elements.getElement<ViewDefinition>(viewDefinitionId);
      viewStateData.viewDefinitionProps = viewDefinitionElement.toJSON();
      viewStateData.categorySelectorProps = elements.getElementProps<CategorySelectorProps>(viewStateData.viewDefinitionProps.categorySelectorId);
      viewStateData.displayStyleProps = elements.getElementProps<DisplayStyleProps>(viewStateData.viewDefinitionProps.displayStyleId);
      if (viewStateData.viewDefinitionProps.modelSelectorId !== undefined)
        viewStateData.modelSelectorProps = elements.getElementProps<ModelSelectorProps>(viewStateData.viewDefinitionProps.modelSelectorId);
      else if (viewDefinitionElement instanceof SheetViewDefinition) {
        viewStateData.sheetProps = elements.getElementProps<SheetProps>(viewDefinitionElement.baseModelId);
        viewStateData.sheetAttachments = Array.from(this._iModel.queryEntityIds({
          from: "BisCore.ViewAttachment",
          where: "Model.Id=" + viewDefinitionElement.baseModelId,
        }));
      }
      return viewStateData;
    }

    private getViewThumbnailArg(viewDefinitionId: Id64String): string {
      const viewProps: FilePropertyProps = { namespace: "dgn_View", name: "Thumbnail", id: viewDefinitionId };
      return JSON.stringify(viewProps);
    }

    /** Get the thumbnail for a view.
     * @param viewDefinitionId The Id of the view for thumbnail
     * @return the ThumbnailProps, or undefined if no thumbnail exists.
     */
    public getThumbnail(viewDefinitionId: Id64String): ThumbnailProps | undefined {
      const viewArg = this.getViewThumbnailArg(viewDefinitionId);
      const sizeProps = this._iModel.nativeDb.queryFileProperty(viewArg, true) as string;
      if (undefined === sizeProps)
        return undefined;

      const out = JSON.parse(sizeProps) as ThumbnailProps;
      out.image = this._iModel.nativeDb.queryFileProperty(viewArg, false) as Uint8Array;
      return out;
    }

    /** Save a thumbnail for a view.
     * @param viewDefinitionId The Id of the view for thumbnail
     * @param thumbnail The thumbnail data.
     * @returns 0 if successful
     */
    public saveThumbnail(viewDefinitionId: Id64String, thumbnail: ThumbnailProps): number {
      const viewArg = this.getViewThumbnailArg(viewDefinitionId);
      const props = { format: thumbnail.format, height: thumbnail.height, width: thumbnail.width };
      return this._iModel.nativeDb.saveFileProperty(viewArg, JSON.stringify(props), thumbnail.image);
    }

    /** Set the default view property the iModel
     * @param viewId The Id of the ViewDefinition to use as the default
     */
    public setDefaultViewId(viewId: Id64String): void {
      const spec = { namespace: "dgn_View", name: "DefaultView" };
      const blob32 = new Uint32Array(2);
      blob32[0] = Id64.getLowerUint32(viewId);
      blob32[1] = Id64.getUpperUint32(viewId);
      const blob8 = new Uint8Array(blob32.buffer);
      this._iModel.saveFileProperty(spec, undefined, blob8);
    }
  }

  /** Represents the current state of a pollable tile content request.
   * Note: lack of a "completed" state because polling a completed request returns the content as a Uint8Array.
   * @internal
   */
  export enum TileContentState {
    New, // Request was just created and enqueued.
    Pending, // Request is enqueued but not yet being processed.
    Loading, // Request is being actively processed.
  }

  /** @internal */
  export class Tiles {
    /** @internal */
    public constructor(private _iModel: IModelDb) { }

    /** @internal */
    public async requestTileTreeProps(requestContext: ClientRequestContext, id: string): Promise<TileTreeProps> {
      requestContext.enter();
      if (!this._iModel.briefcase)
        throw this._iModel.newNotOpenError();

      return new Promise<TileTreeProps>((resolve, reject) => {
        requestContext.enter();
        this._iModel.nativeDb.getTileTree(id, (ret: IModelJsNative.ErrorStatusOrResult<IModelStatus, any>) => {
          if (undefined !== ret.error)
            reject(new IModelError(ret.error.status, "TreeId=" + id));
          else
            resolve(ret.result! as TileTreeProps);
        });
      });
    }

    private pollTileContent(resolve: (arg0: Uint8Array) => void, reject: (err: Error) => void, treeId: string, tileId: string, requestContext: ClientRequestContext) {
      requestContext.enter();
      if (!this._iModel.briefcase) {
        reject(this._iModel.newNotOpenError());
        return;
      }

      const ret = this._iModel.nativeDb.pollTileContent(treeId, tileId);
      if (undefined !== ret.error) {
        reject(new IModelError(ret.error.status, "TreeId=" + treeId + " TileId=" + tileId));
      } else if (typeof ret.result !== "number") { // if type is not a number, it's the TileContent interface
        const res = ret.result as IModelJsNative.TileContent;
        const iModelGuid = this._iModel.getGuid();

        const tileSizeThreshold = IModelHost.logTileSizeThreshold;
        const tileSize = res.content.length;
        if (tileSize > tileSizeThreshold) {
          Logger.logWarning(loggerCategory, "Tile size (in bytes) larger than specified threshold", () => ({ tileSize, tileSizeThreshold, treeId, tileId, iModelGuid }));
        }

        const loadTimeThreshold = IModelHost.logTileLoadTimeThreshold;
        const loadTime = res.elapsedSeconds;
        if (loadTime > loadTimeThreshold) {
          Logger.logWarning(loggerCategory, "Tile load time (in seconds) greater than specified threshold", () => ({ loadTime, loadTimeThreshold, treeId, tileId, iModelGuid }));
        }

        resolve(res.content);
      } else { // if the type is a number, it's the TileContentState enum
        // ###TODO: Decide appropriate timeout interval. May want to switch on state (new vs loading vs pending)
        setTimeout(() => this.pollTileContent(resolve, reject, treeId, tileId, requestContext), 10);
      }
    }

    /** @internal */
    public async requestTileContent(requestContext: ClientRequestContext, treeId: string, tileId: string): Promise<Uint8Array> {
      requestContext.enter();
      if (!this._iModel.briefcase)
        throw this._iModel.newNotOpenError();

      return new Promise<Uint8Array>((resolve, reject) => {
        this.pollTileContent(resolve, reject, treeId, tileId, requestContext);
      });
    }
  }
}

/** @public */
export enum TxnAction { None = 0, Commit = 1, Abandon = 2, Reverse = 3, Reinstate = 4, Merge = 5 }

/** An error generated during dependency validation.
 * @beta
 */
export interface ValidationError {
  /** If true, txn is aborted. */
  fatal: boolean;
  /** The type of error. */
  errorType: string;
  /** Optional description of what went wrong. */
  message?: string;
}

/** Local Txns in an IModelDb. Local Txns persist only until [[IModelDb.pushChanges]] is called.
 * @beta
 */
export class TxnManager {
  constructor(private _iModel: IModelDb) { }
  /** Array of errors from dependency propagation */
  public readonly validationErrors: ValidationError[] = [];

  private get _nativeDb() { return this._iModel.nativeDb!; }
  private _getElementClass(elClassName: string): typeof Element { return this._iModel.getJsClass(elClassName) as unknown as typeof Element; }
  private _getRelationshipClass(relClassName: string): typeof Relationship { return this._iModel.getJsClass<typeof Relationship>(relClassName); }

  /** @internal */
  protected _onBeforeOutputsHandled(elClassName: string, elId: Id64String): void { this._getElementClass(elClassName).onBeforeOutputsHandled(elId, this._iModel); }
  /** @internal */
  protected _onAllInputsHandled(elClassName: string, elId: Id64String): void { this._getElementClass(elClassName).onAllInputsHandled(elId, this._iModel); }

  /** @internal */
  protected _onRootChanged(props: RelationshipProps): void { this._getRelationshipClass(props.classFullName).onRootChanged(props, this._iModel); }
  /** @internal */
  protected _onValidateOutput(props: RelationshipProps): void { this._getRelationshipClass(props.classFullName).onValidateOutput(props, this._iModel); }
  /** @internal */
  protected _onDeletedDependency(props: RelationshipProps): void { this._getRelationshipClass(props.classFullName).onDeletedDependency(props, this._iModel); }

  /** @internal */
  protected _onBeginValidate() { this.validationErrors.length = 0; }
  /** @internal */
  protected _onEndValidate() { }

  /** Dependency handlers may call method this to report a validation error.
   * @param error The error. If error.fatal === true, the transaction will cancel rather than commit.
   */
  public reportError(error: ValidationError) { this.validationErrors.push(error); this._nativeDb.logTxnError(error.fatal); }

  /** Determine whether any fatal validation errors have occurred during dependency propagation.  */
  public get hasFatalError(): boolean { return this._nativeDb.hasFatalTxnError(); }

  /** Event raised before a commit operation is performed. Initiated by a call to [[IModelDb.saveChanges]] */
  public readonly onCommit = new BeEvent<() => void>();
  /** Event raised after a commit operation has been performed. Initiated by a call to [[IModelDb.saveChanges]] */
  public readonly onCommitted = new BeEvent<() => void>();
  /** Event raised after a ChangeSet has been applied to this briefcase */
  public readonly onChangesApplied = new BeEvent<() => void>();
  /** Event raised before an undo/redo operation is performed. */
  public readonly onBeforeUndoRedo = new BeEvent<() => void>();
  /** Event raised after an undo/redo operation has been performed.
   * @param _action The action that was performed.
   */
  public readonly onAfterUndoRedo = new BeEvent<(_action: TxnAction) => void>();

  /** Determine if there are currently any reversible (undoable) changes to this IModelDb. */
  public get isUndoPossible(): boolean { return this._nativeDb.isUndoPossible(); }

  /** Determine if there are currently any reinstatable (redoable) changes to this IModelDb */
  public get isRedoPossible(): boolean { return this._nativeDb.isRedoPossible(); }

  /** Get the description of the operation that would be reversed by calling reverseTxns(1).
   * This is useful for showing the operation that would be undone, for example in a menu.
   */
  public getUndoString(): string { return this._nativeDb.getUndoString(); }

  /** Get a description of the operation that would be reinstated by calling reinstateTxn.
   * This is useful for showing the operation that would be redone, in a pull-down menu for example.
   */
  public getRedoString(): string { return this._nativeDb.getRedoString(); }

  /** Begin a new multi-Txn operation. This can be used to cause a series of Txns, that would normally
   * be considered separate actions for undo, to be grouped into a single undoable operation. This means that when reverseTxns(1) is called,
   * the entire group of changes are undone together. Multi-Txn operations can be nested, and until the outermost operation is closed,
   * all changes constitute a single operation.
   * @note This method must always be paired with a call to endMultiTxnAction.
   */
  public beginMultiTxnOperation(): DbResult { return this._nativeDb.beginMultiTxnOperation(); }

  /** End a multi-Txn operation */
  public endMultiTxnOperation(): DbResult { return this._nativeDb.endMultiTxnOperation(); }

  /** Return the depth of the multi-Txn stack. Generally for diagnostic use only. */
  public getMultiTxnOperationDepth(): number { return this._nativeDb.getMultiTxnOperationDepth(); }

  /** Reverse (undo) the most recent operation(s) to this IModelDb.
   * @param numOperations the number of operations to reverse. If this is greater than 1, the entire set of operations will
   *  be reinstated together when/if ReinstateTxn is called.
   * @note If there are any outstanding uncommitted changes, they are reversed.
   * @note The term "operation" is used rather than Txn, since multiple Txns can be grouped together via [[beginMultiTxnOperation]]. So,
   * even if numOperations is 1, multiple Txns may be reversed if they were grouped together when they were made.
   * @note If numOperations is too large only the operations are reversible are reversed.
   */
  public reverseTxns(numOperations: number): IModelStatus { return this._nativeDb.reverseTxns(numOperations); }

  /** Reverse the most recent operation. */
  public reverseSingleTxn(): IModelStatus { return this.reverseTxns(1); }

  /** Reverse all changes back to the beginning of the session. */
  public reverseAll(): IModelStatus { return this._nativeDb.reverseAll(); }

  /** Reverse all changes back to a previously saved TxnId.
   * @param txnId a TxnId obtained from a previous call to GetCurrentTxnId.
   * @returns Success if the transactions were reversed, error status otherwise.
   * @see  [[getCurrentTxnId]] [[cancelTo]]
   */
  public reverseTo(txnId: TxnIdString) { return this._nativeDb.reverseTo(txnId); }

  /** Reverse and then cancel (make non-reinstatable) all changes back to a previous TxnId.
   * @param txnId a TxnId obtained from a previous call to [[getCurrentTxnId]]
   * @returns Success if the transactions were reversed and cleared, error status otherwise.
   */
  public cancelTo(txnId: TxnIdString) { return this._nativeDb.cancelTo(txnId); }

  /** Reinstate the most recently reversed transaction. Since at any time multiple transactions can be reversed, it
   * may take multiple calls to this method to reinstate all reversed operations.
   * @returns Success if a reversed transaction was reinstated, error status otherwise.
   * @note If there are any outstanding uncommitted changes, they are reversed before the Txn is reinstated.
   */
  public reinstateTxn(): IModelStatus { return this._nativeDb.reinstateTxn(); }

  /** Get the Id of the first transaction, if any. */
  public queryFirstTxnId(): TxnIdString { return this._nativeDb.queryFirstTxnId(); }

  /** Get the successor of the specified TxnId */
  public queryNextTxnId(txnId: TxnIdString): TxnIdString { return this._nativeDb.queryNextTxnId(txnId); }

  /** Get the predecessor of the specified TxnId */
  public queryPreviousTxnId(txnId: TxnIdString): TxnIdString { return this._nativeDb.queryPreviousTxnId(txnId); }

  /** Get the Id of the current (tip) transaction.  */
  public getCurrentTxnId(): TxnIdString { return this._nativeDb.getCurrentTxnId(); }

  /** Get the description that was supplied when the specified transaction was saved. */
  public getTxnDescription(txnId: TxnIdString): string { return this._nativeDb.getTxnDescription(txnId); }

  /** Test if a TxnId is valid */
  public isTxnIdValid(txnId: TxnIdString): boolean { return this._nativeDb.isTxnIdValid(txnId); }

  /** Query if there are any pending Txns in this IModelDb that are waiting to be pushed.  */
  public get hasPendingTxns(): boolean { return this.isTxnIdValid(this.queryFirstTxnId()); }

  /** Query if there are any changes in memory that have yet to be saved to the IModelDb. */
  public get hasUnsavedChanges(): boolean { return this._nativeDb.hasUnsavedChanges(); }

  /** Query if there are un-saved or un-pushed local changes. */
  public get hasLocalChanges(): boolean { return this.hasUnsavedChanges || this.hasPendingTxns; }

  /** Make a description of the changeset by combining all local txn comments. */
  public describeChangeSet(endTxnId?: TxnIdString): string {
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
