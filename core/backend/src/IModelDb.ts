/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import * as fs from "fs";
import { join } from "path";
import * as touch from "touch";
import { IModelJsNative } from "@bentley/imodeljs-native";
import {
  AccessToken, assert, BeEvent, BentleyStatus, ChangeSetStatus, DbConflictCause, DbConflictResolution, DbOpcode, DbResult, Guid, GuidString, Id64, Id64Arg, Id64Array, Id64Set, Id64String,
  IModelStatus, JsonUtils, Logger, LogLevel, OpenMode, UnexpectedErrors,
} from "@itwin/core-bentley";
import {
  AxisAlignedBox3d, BRepGeometryCreate, BriefcaseId, BriefcaseIdValue, CategorySelectorProps, ChangesetIdWithIndex, ChangesetIndexAndId, Code,
  CodeProps, CreateEmptySnapshotIModelProps, CreateEmptyStandaloneIModelProps, CreateSnapshotIModelProps, DbQueryRequest, DisplayStyleProps,
  DomainOptions, EcefLocation, ECJsNames, ECSchemaProps, ECSqlReader, ElementAspectProps, ElementGeometryRequest, ElementGraphicsRequestProps, ElementLoadProps,
  ElementProps, EntityMetaData, EntityProps, EntityQueryParams, FilePropertyProps, FontId, FontMap, FontType, GeoCoordinatesRequestProps,
  GeoCoordinatesResponseProps, GeometryContainmentRequestProps, GeometryContainmentResponseProps, IModel, IModelCoordinatesRequestProps,
  IModelCoordinatesResponseProps, IModelError, IModelNotFoundResponse, IModelTileTreeProps, LocalFileName, MassPropertiesRequestProps,
  MassPropertiesResponseProps, ModelExtentsProps, ModelLoadProps, ModelProps, ModelSelectorProps, OpenBriefcaseProps, OpenCheckpointArgs, OpenSqliteArgs,
  ProfileOptions, PropertyCallback, QueryBinder, QueryOptions, QueryOptionsBuilder, QueryRowFormat, SchemaState, SheetProps, SnapRequestProps,
  SnapResponseProps, SnapshotOpenOptions, SpatialViewDefinitionProps, SubCategoryResultRow, TextureData, TextureLoadProps, ThumbnailProps,
  UpgradeOptions, ViewDefinition2dProps, ViewDefinitionProps, ViewIdString, ViewQueryParams, ViewStateLoadProps, ViewStateProps, ViewStoreRpc,
} from "@itwin/core-common";
import { Range3d } from "@itwin/core-geometry";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BriefcaseManager, PullChangesArgs, PushChangesArgs } from "./BriefcaseManager";
import { ChannelAdmin, ChannelControl } from "./ChannelControl";
import { CheckpointManager, CheckpointProps, V2CheckpointManager } from "./CheckpointManager";
import { ClassRegistry, MetaDataRegistry } from "./ClassRegistry";
import { CloudSqlite } from "./CloudSqlite";
import { CodeService } from "./CodeService";
import { CodeSpecs } from "./CodeSpecs";
import { ConcurrentQuery } from "./ConcurrentQuery";
import { ECSchemaXmlContext } from "./ECSchemaXmlContext";
import { ECSqlStatement } from "./ECSqlStatement";
import { Element, SectionDrawing, Subject } from "./Element";
import { ElementAspect } from "./ElementAspect";
import { generateElementGraphics } from "./ElementGraphics";
import { Entity, EntityClassType } from "./Entity";
import { ExportGraphicsOptions, ExportPartGraphicsOptions } from "./ExportGraphics";
import { GeoCoordConfig } from "./GeoCoordConfig";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { IpcHost } from "./IpcHost";
import { Model } from "./Model";
import { Relationships } from "./Relationship";
import { SchemaSync } from "./SchemaSync";
import { ServerBasedLocks } from "./ServerBasedLocks";
import { SqliteStatement, StatementCache } from "./SqliteStatement";
import { TxnManager } from "./TxnManager";
import { DrawingViewDefinition, SheetViewDefinition, ViewDefinition } from "./ViewDefinition";
import { ViewStore } from "./ViewStore";
import { BaseSettings, SettingDictionary, SettingName, SettingResolver, SettingsPriority, SettingType } from "./workspace/Settings";
import { Workspace } from "./workspace/Workspace";

import type { BlobContainer } from "./BlobContainerService";
/** @internal */
export interface ChangesetConflictArgs {
  cause: DbConflictCause;
  opcode: DbOpcode;
  indirect: boolean;
  tableName: string;
  changesetFile?: string;
  getForeignKeyConflicts: () => number;
  dump: () => void;
  setLastError: (message: string) => void;
}

// spell:ignore fontid fontmap

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/** Options for [[IModelDb.Models.updateModel]]
 * @note To mark *only* the geometry as changed, use [[IModelDb.Models.updateGeometryGuid]] instead.
 * @public
 */
export interface UpdateModelOptions extends ModelProps {
  /** If defined, update the last modify time of the Model */
  updateLastMod?: boolean;
  /** If defined, update the GeometryGuid of the Model */
  geometryChanged?: boolean;
}

/** Options supplied to [[IModelDb.computeProjectExtents]].
 * @public
 */
export interface ComputeProjectExtentsOptions {
  /** If true, the result will include `extentsWithOutliers`. */
  reportExtentsWithOutliers?: boolean;
  /** If true, the result will include `outliers`. */
  reportOutliers?: boolean;
}

/** The result of [[IModelDb.computeProjectExtents]].
 * @public
 */
export interface ComputedProjectExtents {
  /** The computed extents, excluding any outlier elements. */
  extents: Range3d;
  /** If requested by caller, the computed extents, *including* any outlier elements. */
  extentsWithOutliers?: Range3d;
  /** If requested by caller, the Ids of outlier elements excluded from the computed extents. */
  outliers?: Id64Array;
}

/**
 * Interface for acquiring element locks to coordinate simultaneous edits from multiple briefcases.
 * @beta
 */
export interface LockControl {
  /**
   * true if this LockControl uses a server-based concurrency approach.
   */
  readonly isServerBased: boolean;
  /**
   * Close the local lock control database
   * @internal
   */
  close(): void;
  /**
   * Notification that a new element was just created. Called by [[Element.onInserted]]
   * @internal
   */
  elementWasCreated(id: Id64String): void;
  /**
   * Throw if locks are required and the exclusive lock is not held on the supplied element.
   * Note: there is no need to check the shared locks on parents/models since an element cannot hold the exclusive lock without first obtaining them.
   * Called by [[Element.onUpdate]], [[Element.onDelete]], etc.
   * @internal
   */
  checkExclusiveLock(id: Id64String, type: string, operation: string): void;
  /**
   * Throw if locks are required and a shared lock is not held on the supplied element.
   * Called by [[Element.onInsert]] to ensure shared lock is held on model and parent.
   * @internal
   */
  checkSharedLock(id: Id64String, type: string, operation: string): void;
  /**
   * Determine whether the supplied element currently holds the exclusive lock
   */
  holdsExclusiveLock(id: Id64String): boolean;
  /**
   * Determine whether the supplied element currently holds a shared lock
   */
  holdsSharedLock(id: Id64String): boolean;
  /**
   * Acquire locks on one or more elements from the lock server, if required and not already held.
   * If any required lock is not available, this method throws an exception and *none* of the requested locks are acquired.
   * > Note: acquiring the exclusive lock on an element requires also obtaining a shared lock on all its owner elements. This method will
   * attempt to acquire all necessary locks for both sets of input ids.
   */
  acquireLocks(arg: {
    /** if present, one or more elements to obtain shared lock */
    shared?: Id64Arg;
    /** if present, one or more elements to obtain exclusive lock */
    exclusive?: Id64Arg;
  }): Promise<void>;
  /**
   * Release all locks currently held by this Briefcase from the lock server.
   * Not possible to release locks unless push or abandon all changes. Should only be called internally.
   * @internal
   */
  releaseAllLocks(): Promise<void>;
}

/**
 * Options for the importing of schemas
 * @public
 */
export interface SchemaImportOptions {
  /**
   * An [[ECSchemaXmlContext]] to use instead of building a default one.
   * This can be useful in rare cases where custom schema location logic is necessary
   * @internal
   */
  ecSchemaXmlContext?: ECSchemaXmlContext;
}

/** A null-implementation of LockControl that does not attempt to limit access between briefcases. This relies on change-merging to resolve conflicts. */
class NoLocks implements LockControl {
  public get isServerBased() { return false; }
  public close(): void { }
  public clearAllLocks(): void { }
  public holdsExclusiveLock(): boolean { return false; }
  public holdsSharedLock(): boolean { return false; }
  public checkExclusiveLock(): void { }
  public checkSharedLock(): void { }
  public elementWasCreated(): void { }
  public async acquireLocks() { }
  public async releaseAllLocks(): Promise<void> { }
}

/** @internal */
export enum BriefcaseLocalValue {
  StandaloneEdit = "StandaloneEdit",
  NoLocking = "NoLocking"
}

// function to open an briefcaseDb, perform an operation, and then close it.
const withBriefcaseDb = async (briefcase: OpenBriefcaseArgs, fn: (_db: BriefcaseDb) => Promise<any>) => {
  const db = await BriefcaseDb.open(briefcase);
  try {
    return await fn(db);
  } finally {
    db.close();
  }
};

/**
 * Settings for an individual iModel. May only include settings priority for iModel, iTwin and organization.
 * @note if there is more than one iModel for an iTwin or organization, they will *each* hold a copy of the settings for those priorities.
 */
class IModelSettings extends BaseSettings {
  protected override verifyPriority(priority: SettingsPriority) {
    if (priority <= SettingsPriority.application)
      throw new Error("Use IModelHost.appSettings");
  }

  // attempt to resolve a setting from this iModel's settings, otherwise use appWorkspace's settings, otherwise defaultValue.
  public override resolveSetting<T extends SettingType>(name: SettingName, resolver: SettingResolver<T>, defaultValue?: T): T | undefined {
    return super.resolveSetting(name, resolver) ?? IModelHost.appWorkspace.settings.resolveSetting(name, resolver, defaultValue);
  }
}

/** An iModel database file. The database file can either be a briefcase or a snapshot.
 * @see [Accessing iModels]($docs/learning/backend/AccessingIModels.md)
 * @see [About IModelDb]($docs/learning/backend/IModelDb.md)
 * @public
 */
export abstract class IModelDb extends IModel {
  private _initialized = false;
  /** Keep track of open imodels to support `tryFind` for RPC purposes */
  private static readonly _openDbs = new Map<string, IModelDb>();
  public static readonly defaultLimit = 1000; // default limit for batching queries
  public static readonly maxLimit = 10000; // maximum limit for batching queries
  public readonly models = new IModelDb.Models(this);
  public readonly elements = new IModelDb.Elements(this);
  public readonly views = new IModelDb.Views(this);
  public readonly tiles = new IModelDb.Tiles(this);
  /** @beta */
  public readonly channels: ChannelControl = new ChannelAdmin(this);
  private _relationships?: Relationships;
  private readonly _statementCache = new StatementCache<ECSqlStatement>();
  private readonly _sqliteStatementCache = new StatementCache<SqliteStatement>();
  private _codeSpecs?: CodeSpecs;
  private _classMetaDataRegistry?: MetaDataRegistry;
  protected _fontMap?: FontMap;
  /** @internal */
  private _workspace?: Workspace;
  private readonly _snaps = new Map<string, IModelJsNative.SnapRequest>();
  private static _shutdownListener: VoidFunction | undefined; // so we only register listener once
  /** @internal */
  protected _locks?: LockControl = new NoLocks();

  /** @internal */
  protected _codeService?: CodeService;

  /** @alpha */
  public get codeService() { return this._codeService; }

  /**
   * Get the [[LockControl]] for this iModel.
   * @beta
   */
  public get locks(): LockControl { return this._locks!; } // eslint-disable-line @typescript-eslint/no-non-null-assertion

  /**
   * Get the [[Workspace]] for this iModel.
   * @beta
   */
  public get workspace(): Workspace {
    if (undefined === this._workspace)
      this._workspace = Workspace.construct(new IModelSettings());
    return this._workspace;
  }

  /** Acquire the exclusive schema lock on this iModel.
   * > Note: To acquire the schema lock, all other briefcases must first release *all* their locks. No other briefcases
   * will be able to acquire *any* locks while the schema lock is held.
   */
  public async acquireSchemaLock(): Promise<void> {
    return this.locks.acquireLocks({ exclusive: IModel.repositoryModelId });
  }
  /** determine whether the schema lock is currently held for this iModel. */
  public get holdsSchemaLock() {
    return this.locks.holdsExclusiveLock(IModel.repositoryModelId);
  }

  /** Event called after a changeset is applied to this IModelDb. */
  public readonly onChangesetApplied = new BeEvent<() => void>();
  /** @internal */
  public notifyChangesetApplied() {
    this.changeset = this.nativeDb.getCurrentChangeset();
    this.onChangesetApplied.raiseEvent();
  }

  /** @internal */
  public restartDefaultTxn() {
    this.nativeDb.restartDefaultTxn();
  }

  public get fontMap(): FontMap {
    return this._fontMap ?? (this._fontMap = new FontMap(this.nativeDb.readFontMap()));
  }

  /** @internal */
  public clearFontMap(): void {
    this._fontMap = undefined;
  }

  /**
   * Add a new font name/type to the FontMap for this iModel and return its FontId.
   * @param name The name of the font to add
   * @param type The type of the font. Default is TrueType.
   * @returns The FontId for the newly added font. If a font by that name/type already exists, this method does not fail, it returns the existing Id.
   * @see [FontId and FontMap]($docs/learning/backend/Fonts.md#fontid-and-fontmap)
   * @beta
   */
  public addNewFont(name: string, type?: FontType): FontId {
    this.locks.checkExclusiveLock(IModel.repositoryModelId, "schema", "addNewFont");
    this.clearFontMap();
    return this.nativeDb.addNewFont({ name, type: type ?? FontType.TrueType });
  }

  /** Check if this iModel has been opened read-only or not. */
  public get isReadonly(): boolean { return this.openMode === OpenMode.Readonly; }

  /** The Guid that identifies this iModel. */
  public override get iModelId(): GuidString {
    assert(undefined !== super.iModelId);
    return super.iModelId;
  } // GuidString | undefined for the IModel superclass, but required for all IModelDb subclasses

  /** @internal*/
  public readonly nativeDb: IModelJsNative.DgnDb;

  /** Get the full path fileName of this iModelDb
   * @note this member is only valid while the iModel is opened.
   */
  public get pathName(): LocalFileName { return this.nativeDb.getFilePath(); }

  /** Get the full path to this iModel's "watch file".
   * A read-only briefcase opened with `watchForChanges: true` creates this file next to the briefcase file on open, if it doesn't already exist.
   * A writable briefcase "touches" this file if it exists whenever it commits changes to the briefcase.
   * The read-only briefcase can use a file watcher to react when the writable briefcase makes changes to the briefcase.
   * This is more reliable than watching the sqlite WAL file.
   * @internal
   */
  public get watchFilePathName(): LocalFileName { return `${this.pathName}-watch`; }

  /** @internal */
  protected constructor(args: { nativeDb: IModelJsNative.DgnDb, key: string, changeset?: ChangesetIdWithIndex }) {
    super({ ...args, iTwinId: args.nativeDb.getITwinId(), iModelId: args.nativeDb.getIModelId() });
    this.nativeDb = args.nativeDb;

    // PR https://github.com/iTwin/imodel-native/pull/558 ill-advisedly renamed closeIModel to closeFile.
    // Ideally, nobody outside of core-backend would be calling it, but somebody important is.
    // Make closeIModel available so their code doesn't break.
    (this.nativeDb as any).closeIModel = () => {
      if (!this.isReadonly)
        this.saveChanges(); // preserve old behavior of closeIModel that was removed when renamed to closeFile

      this.nativeDb.closeFile();
    };

    this.nativeDb.setIModelDb(this);

    this.loadSettingDictionaries();
    GeoCoordConfig.loadForImodel(this.workspace.settings); // load gcs data specified by iModel's settings dictionaries, must be done before calling initializeIModelDb

    this.initializeIModelDb();
    IModelDb._openDbs.set(this._fileKey, this);

    if (undefined === IModelDb._shutdownListener) { // the first time we create an IModelDb, add a listener to close any orphan files at shutdown.
      IModelDb._shutdownListener = IModelHost.onBeforeShutdown.addListener(() => {
        IModelDb._openDbs.forEach((db) => { // N.B.: db.close() removes from _openedDbs
          try {
            db.abandonChanges();
            db.close();
          } catch { }
        });
      });
    }
  }

  /** Close this IModel, if it is currently open, and save changes if it was opened in ReadWrite mode. */
  public close(): void {
    if (!this.isOpen)
      return; // don't continue if already closed

    this.beforeClose();
    IModelDb._openDbs.delete(this._fileKey);
    this._workspace?.close();
    this.locks.close();
    this._locks = undefined;
    this._codeService?.close();
    this._codeService = undefined;
    if (!this.isReadonly)
      this.saveChanges();
    this.nativeDb.closeFile();
  }

  /** @internal */
  public async refreshContainerForRpc(_userAccessToken: AccessToken): Promise<void> { }

  /** Event called when the iModel is about to be closed. */
  public readonly onBeforeClose = new BeEvent<() => void>();

  /**
   * Called by derived classes before closing the connection
   * @internal
   */
  protected beforeClose() {
    this.onBeforeClose.raiseEvent();
    this.clearCaches();
  }

  /** @internal */
  protected initializeIModelDb() {
    const props = this.nativeDb.getIModelProps();
    super.initialize(props.rootSubject.name, props);
    if (this._initialized)
      return;

    this._initialized = true;
    const db = this.isBriefcaseDb() ? this : undefined;
    if (!db || !IpcHost.isValid)
      return;

    db.onNameChanged.addListener(() => IpcHost.notifyTxns(db, "notifyIModelNameChanged", db.name));
    db.onRootSubjectChanged.addListener(() => IpcHost.notifyTxns(db, "notifyRootSubjectChanged", db.rootSubject));

    db.onProjectExtentsChanged.addListener(() => IpcHost.notifyTxns(db, "notifyProjectExtentsChanged", db.projectExtents.toJSON()));
    db.onGlobalOriginChanged.addListener(() => IpcHost.notifyTxns(db, "notifyGlobalOriginChanged", db.globalOrigin.toJSON()));
    db.onEcefLocationChanged.addListener(() => IpcHost.notifyTxns(db, "notifyEcefLocationChanged", db.ecefLocation?.toJSON()));
    db.onGeographicCoordinateSystemChanged.addListener(() => IpcHost.notifyTxns(db, "notifyGeographicCoordinateSystemChanged", db.geographicCoordinateSystem?.toJSON()));
  }

  /** Returns true if this is a BriefcaseDb
   * @see [[BriefcaseDb.open]]
   */
  public get isBriefcase(): boolean { return false; }
  /** Type guard for instanceof [[BriefcaseDb]] */
  public isBriefcaseDb(): this is BriefcaseDb { return this.isBriefcase; }

  /** Returns true if this is a SnapshotDb
   * @see [[SnapshotDb.open]]
   */
  public get isSnapshot(): boolean { return false; }
  /** Type guard for instanceof [[SnapshotDb]] */
  public isSnapshotDb(): this is SnapshotDb { return this.isSnapshot; }

  /** Returns true if this is a *standalone* iModel
   * @see [[StandaloneDb.open]]
   * @internal
   */
  public get isStandalone(): boolean { return false; }
  /** Type guard for instanceof [[StandaloneDb]]. */
  public isStandaloneDb(): this is StandaloneDb { return this.isStandalone; }

  /** Return `true` if the underlying nativeDb is open and valid.
   * @internal
   */
  public get isOpen(): boolean { return this.nativeDb.isOpen(); }

  /** Get the briefcase Id of this iModel */
  public getBriefcaseId(): BriefcaseId { return this.isOpen ? this.nativeDb.getBriefcaseId() : BriefcaseIdValue.Illegal; }

  /**
   * Use a prepared ECSQL statement, potentially from the statement cache. If the requested statement doesn't exist
   * in the statement cache, a new statement is prepared. After the callback completes, the statement is reset and saved
   * in the statement cache so it can be reused in the future. Use this method for ECSQL statements that will be
   * reused often and are expensive to prepare. The statement cache holds the most recently used statements, discarding
   * the oldest statements as it fills. For statements you don't intend to reuse, instead use [[withStatement]].
   * @param sql The SQLite SQL statement to execute
   * @param callback the callback to invoke on the prepared statement
   * @param logErrors Determines if error will be logged if statement fail to prepare
   * @returns the value returned by `callback`.
   * @see [[withStatement]]
   * @public
   */
  public withPreparedStatement<T>(ecsql: string, callback: (stmt: ECSqlStatement) => T, logErrors = true): T {
    const stmt = this._statementCache.findAndRemove(ecsql) ?? this.prepareStatement(ecsql, logErrors);
    const release = () => this._statementCache.addOrDispose(stmt);
    try {
      const val = callback(stmt);
      if (val instanceof Promise) {
        val.then(release, release);
      } else {
        release();
      }
      return val;
    } catch (err: any) {
      release();
      throw err;
    }
  }

  /**
   * Prepared and execute a callback on an ECSQL statement. After the callback completes the statement is disposed.
   * Use this method for ECSQL statements are either not expected to be reused, or are not expensive to prepare.
   * For statements that will be reused often, instead use [[withPreparedStatement]].
   * @param sql The SQLite SQL statement to execute
   * @param callback the callback to invoke on the prepared statement
   * @param logErrors Determines if error will be logged if statement fail to prepare
   * @returns the value returned by `callback`.
   * @see [[withPreparedStatement]]
   * @public
   */
  public withStatement<T>(ecsql: string, callback: (stmt: ECSqlStatement) => T, logErrors = true): T {
    const stmt = this.prepareStatement(ecsql, logErrors);
    const release = () => stmt.dispose();
    try {
      const val = callback(stmt);
      if (val instanceof Promise) {
        val.then(release, release);
      } else {
        release();
      }
      return val;
    } catch (err: any) {
      release();
      throw err;
    }
  }
  /** Allow to execute query and read results along with meta data. The result are streamed.
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   * - [ECSQL Row Format]($docs/learning/ECSQLRowFormat)
   *
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * @param config Allow to specify certain flags which control how query is executed.
   * @returns Returns an [ECSqlReader]($common) which helps iterate over the result set and also give access to metadata.
   * @public
   * */
  public createQueryReader(ecsql: string, params?: QueryBinder, config?: QueryOptions): ECSqlReader {
    if (!this.nativeDb.isOpen())
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "db not open");

    const executor = {
      execute: async (request: DbQueryRequest) => {
        return ConcurrentQuery.executeQueryRequest(this.nativeDb, request);
      },
    };
    return new ECSqlReader(executor, ecsql, params, config);
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
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * @param options Allow to specify certain flags which control how query is executed.
   * @returns Returns the query result as an *AsyncIterableIterator<any>*  which lazy load result as needed. The row format is determined by *rowFormat* parameter.
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If there was any error while submitting, preparing or stepping into query
   * @deprecated in 3.7. Use [[createQueryReader]] instead; it accepts the same parameters.
   */
  public async * query(ecsql: string, params?: QueryBinder, options?: QueryOptions): AsyncIterableIterator<any> {
    const builder = new QueryOptionsBuilder(options);
    const reader = this.createQueryReader(ecsql, params, builder.getOptions());
    while (await reader.step())
      yield reader.formatCurrentRow();

  }

  /** Compute number of rows that would be returned by the ECSQL.
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * See "[iTwin.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @returns Return row count.
   * @throws [IModelError]($common) If the statement is invalid
   * @deprecated in 3.7. Count the number of results using `count(*)` where the original query is a subquery instead. E.g., `SELECT count(*) FROM (<query-whose-rows-to-count>)`.
   */
  public async queryRowCount(ecsql: string, params?: QueryBinder): Promise<number> {
    for await (const row of this.createQueryReader(`SELECT count(*) FROM (${ecsql})`, params)) {
      return row[0] as number;
    }
    throw new IModelError(DbResult.BE_SQLITE_ERROR, "Failed to get row count");
  }

  /** Cancel any previous query with same token and run execute the current specified query.
   * The result of the query is async iterator over the rows. The iterator will get next page automatically once rows in current page has been read.
   * [ECSQL row]($docs/learning/ECSQLRowFormat).
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param token None empty restart token. The previous query with same token would be cancelled. This would cause
   * exception which user code must handle.
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * @param options Allow to specify certain flags which control how query is executed.
   * @returns Returns the query result as an *AsyncIterableIterator<any>*  which lazy load result as needed. The row format is determined by *rowFormat* parameter.
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If there was any error while submitting, preparing or stepping into query
   * @deprecated in 3.7. Use [[createQueryReader]] instead. Pass in the restart token as part of the `config` argument; e.g., `{ restartToken: myToken }` or `new QueryOptionsBuilder().setRestartToken(myToken).getOptions()`.
   */
  public async * restartQuery(token: string, ecsql: string, params?: QueryBinder, options?: QueryOptions): AsyncIterableIterator<any> {
    for await (const row of this.createQueryReader(ecsql, params, new QueryOptionsBuilder(options).setRestartToken(token).getOptions())) {
      yield row;
    }
  }

  /**
   * Use a prepared SQL statement, potentially from the statement cache. If the requested statement doesn't exist
   * in the statement cache, a new statement is prepared. After the callback completes, the statement is reset and saved
   * in the statement cache so it can be reused in the future. Use this method for SQL statements that will be
   * reused often and are expensive to prepare. The statement cache holds the most recently used statements, discarding
   * the oldest statements as it fills. For statements you don't intend to reuse, instead use [[withSqliteStatement]].
   * @param sql The SQLite SQL statement to execute
   * @param callback the callback to invoke on the prepared statement
   * @param logErrors Determine if errors are logged or not
   * @returns the value returned by `callback`.
   * @see [[withPreparedStatement]]
   * @public
   */
  public withPreparedSqliteStatement<T>(sql: string, callback: (stmt: SqliteStatement) => T, logErrors = true): T {
    const stmt = this._sqliteStatementCache.findAndRemove(sql) ?? this.prepareSqliteStatement(sql, logErrors);
    const release = () => this._sqliteStatementCache.addOrDispose(stmt);
    try {
      const val: T = callback(stmt);
      if (val instanceof Promise) {
        val.then(release, release);
      } else {
        release();
      }
      return val;
    } catch (err: any) {
      release();
      throw err;
    }
  }

  /**
   * Prepared and execute a callback on a SQL statement. After the callback completes the statement is disposed.
   * Use this method for SQL statements are either not expected to be reused, or are not expensive to prepare.
   * For statements that will be reused often, instead use [[withPreparedSqliteStatement]].
   * @param sql The SQLite SQL statement to execute
   * @param callback the callback to invoke on the prepared statement
   * @param logErrors Determine if errors are logged or not
   * @returns the value returned by `callback`.
   * @public
   */
  public withSqliteStatement<T>(sql: string, callback: (stmt: SqliteStatement) => T, logErrors = true): T {
    const stmt = this.prepareSqliteStatement(sql, logErrors);
    const release = () => stmt.dispose();
    try {
      const val: T = callback(stmt);
      if (val instanceof Promise) {
        val.then(release, release);
      } else {
        release();
      }
      return val;
    } catch (err: any) {
      release();
      throw err;
    }
  }

  /** Prepare an SQL statement.
   * @param sql The SQL statement to prepare
   * @throws [[IModelError]] if there is a problem preparing the statement.
   * @internal
   */
  public prepareSqliteStatement(sql: string, logErrors = true): SqliteStatement {
    const stmt = new SqliteStatement(sql);
    stmt.prepare(this.nativeDb, logErrors);
    return stmt;
  }

  /**
   * queries the BisCore.SubCategory table for the entries that are children of the passed categoryIds
   * @param categoryIds categoryIds to query
   * @returns array of SubCategoryResultRow
   * @internal
   */
  public async querySubCategories(categoryIds: Iterable<Id64String>): Promise<SubCategoryResultRow[]> {
    const result: SubCategoryResultRow[] = [];

    const where = [...categoryIds].join(",");
    const query = `SELECT ECInstanceId as id, Parent.Id as parentId, Properties as appearance FROM BisCore.SubCategory WHERE Parent.Id IN (${where})`;
    try {
      for await (const row of this.createQueryReader(query, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
        result.push(row.toRow() as SubCategoryResultRow);
      }
    } catch {
      // We can ignore the error here, and just return whatever we were able to query.
    }
    return result;
  }

  /** Query for a set of entity ids, given an EntityQueryParams
   * @param params The query parameters. The `limit` and `offset` members should be used to page results.
   * @returns an Id64Set with results of query
   * @throws [[IModelError]] if the generated statement is invalid or [IModelDb.maxLimit]($backend) exceeded when collecting ids.
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
    if (params.where)
      sql += ` WHERE ${params.where}`;

    if (params.orderBy)
      sql += ` ORDER BY ${params.orderBy}`;

    if (typeof params.limit === "number" && params.limit > 0)
      sql += ` LIMIT ${params.limit}`;

    if (typeof params.offset === "number" && params.offset > 0)
      sql += ` OFFSET ${params.offset}`;

    const ids = new Set<string>();
    this.withPreparedStatement(sql, (stmt) => {
      if (params.bindings)
        stmt.bindValues(params.bindings);
      for (const row of stmt) {
        if (row.id !== undefined) {
          ids.add(row.id);
          if (ids.size > IModelDb.maxLimit) {
            throw new IModelError(IModelStatus.BadRequest, "Max LIMIT exceeded in SELECT statement");
          }
        }
      }
    });
    return ids;
  }

  /** Clear all in-memory caches held in this IModelDb. */
  public clearCaches() {
    this._statementCache.clear();
    this._sqliteStatementCache.clear();
    this._classMetaDataRegistry = undefined;
  }

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

  /** Compute an appropriate project extents for this iModel based on the ranges of all spatial elements.
   * Typically, the result is simply the union of the ranges of all spatial elements. However, the algorithm also detects "outlier elements",
   * whose placements locate them so far from the rest of the spatial geometry that they are considered statistically insignificant. The
   * range of an outlier element does not contribute to the computed extents.
   * @param options Specifies the level of detail desired in the return value.
   * @returns the computed extents.
   * @note This method does not modify the IModel's stored project extents. @see [[updateProjectExtents]].
   */
  public computeProjectExtents(options?: ComputeProjectExtentsOptions): ComputedProjectExtents {
    const wantFullExtents = true === options?.reportExtentsWithOutliers;
    const wantOutliers = true === options?.reportOutliers;
    const result = this.nativeDb.computeProjectExtents(wantFullExtents, wantOutliers);
    return {
      extents: Range3d.fromJSON(result.extents),
      extentsWithOutliers: result.fullExtents ? Range3d.fromJSON(result.fullExtents) : undefined,
      outliers: result.outliers,
    };
  }

  /** Update the [EcefLocation]($docs/learning/glossary#eceflocation) of this iModel.  */
  public updateEcefLocation(ecef: EcefLocation) {
    this.setEcefLocation(ecef);
    this.updateIModelProps();
  }

  /** Update the IModelProps of this iModel in the database. */
  public updateIModelProps(): void {
    this.nativeDb.updateIModelProps(this.toJSON());
  }

  /** Commit pending changes to this iModel.
   * @param description Optional description of the changes
   * @throws [[IModelError]] if there is a problem saving changes or if there are pending, un-processed lock or code requests.
   */
  public saveChanges(description?: string): void {
    if (this.openMode === OpenMode.Readonly)
      throw new IModelError(IModelStatus.ReadOnly, "IModelDb was opened read-only");

    const stat = this.nativeDb.saveChanges(description);
    if (DbResult.BE_SQLITE_OK !== stat)
      throw new IModelError(stat, `Could not save changes (${description})`);
  }

  /** Abandon pending changes in this iModel. */
  public abandonChanges(): void {
    this.nativeDb.abandonChanges();
  }

  /**
   * Save all changes and perform a [checkpoint](https://www.sqlite.org/c3ref/wal_checkpoint_v2.html) on this IModelDb.
   * This ensures that all changes to the database since it was opened are saved to its file and the WAL file is truncated.
   * @note Checkpoint automatically happens when IModelDbs are closed. However, the checkpoint
   * operation itself can take some time. It may be useful to call this method prior to closing so that the checkpoint "penalty" is paid earlier.
   * @note Another use for this function is to permit the file to be copied while it is open for write. iModel files should
   * rarely be copied, and even less so while they're opened. But this scenario is sometimes encountered for tests.
   */
  public performCheckpoint() {
    if (!this.isReadonly) {
      this.saveChanges();
      this.nativeDb.performCheckpoint();
    }
  }

  /** @internal */
  public reverseTxns(numOperations: number): IModelStatus {
    return this.nativeDb.reverseTxns(numOperations);
  }

  /** @internal */
  public reinstateTxn(): IModelStatus {
    return this.nativeDb.reinstateTxn();
  }

  /** @internal */
  public restartTxnSession(): void {
    return this.nativeDb.restartTxnSession();
  }

  /** Import an ECSchema. On success, the schema definition is stored in the iModel.
   * This method is asynchronous (must be awaited) because, in the case where this IModelDb is a briefcase, this method first obtains the schema lock from the iModel server.
   * You must import a schema into an iModel before you can insert instances of the classes in that schema. See [[Element]]
   * @param schemaFileName  array of Full paths to ECSchema.xml files to be imported.
   * @param {SchemaImportOptions} options - options during schema import.
   * @throws [[IModelError]] if the schema lock cannot be obtained or there is a problem importing the schema.
   * @note Changes are saved if importSchemas is successful and abandoned if not successful.
   * @see querySchemaVersion
   */
  public async importSchemas(schemaFileNames: LocalFileName[], options?: SchemaImportOptions): Promise<void> {
    if (schemaFileNames.length === 0)
      return;

    const maybeCustomNativeContext = options?.ecSchemaXmlContext?.nativeContext;
    if (this.nativeDb.schemaSyncEnabled()) {

      await SchemaSync.withLockedAccess(this, { openMode: OpenMode.Readonly, operationName: "schema sync" }, async (syncAccess) => {
        const schemaSyncDbUri = syncAccess.getUri();
        this.saveChanges();
        let stat = this.nativeDb.importSchemas(schemaFileNames, { schemaLockHeld: false, ecSchemaXmlContext: maybeCustomNativeContext, schemaSyncDbUri });
        if (DbResult.BE_SQLITE_ERROR_SchemaLockFailed === stat) {
          this.abandonChanges();
          if (this.nativeDb.getITwinId() !== Guid.empty)
            await this.acquireSchemaLock();
          stat = this.nativeDb.importSchemas(schemaFileNames, { schemaLockHeld: true, ecSchemaXmlContext: maybeCustomNativeContext, schemaSyncDbUri });
        }
        if (DbResult.BE_SQLITE_OK !== stat)
          throw new IModelError(stat, "Error importing schema");
      });
    } else {
      const nativeImportOptions: IModelJsNative.SchemaImportOptions = {
        schemaLockHeld: true,
        ecSchemaXmlContext: maybeCustomNativeContext,
      };

      if (this.nativeDb.getITwinId() !== Guid.empty) // if this iModel is associated with an iTwin, importing schema requires the schema lock
        await this.acquireSchemaLock();

      const stat = this.nativeDb.importSchemas(schemaFileNames, nativeImportOptions);
      if (DbResult.BE_SQLITE_OK !== stat)
        throw new IModelError(stat, "Error importing schema");
    }
    this.clearCaches();
  }

  /** Import ECSchema(s) serialized to XML. On success, the schema definition is stored in the iModel.
   * This method is asynchronous (must be awaited) because, in the case where this IModelDb is a briefcase, this method first obtains the schema lock from the iModel server.
   * You must import a schema into an iModel before you can insert instances of the classes in that schema. See [[Element]]
   * @param serializedXmlSchemas  The xml string(s) created from a serialized ECSchema.
   * @throws [[IModelError]] if the schema lock cannot be obtained or there is a problem importing the schema.
   * @note Changes are saved if importSchemaStrings is successful and abandoned if not successful.
   * @see querySchemaVersion
   * @alpha
   */
  public async importSchemaStrings(serializedXmlSchemas: string[]): Promise<void> {
    if (serializedXmlSchemas.length === 0)
      return;

    if (this.nativeDb.schemaSyncEnabled()) {
      await SchemaSync.withLockedAccess(this, { openMode: OpenMode.Readonly, operationName: "schemaSync" }, async (syncAccess) => {
        const schemaSyncDbUri = syncAccess.getUri();
        this.saveChanges();
        let stat = this.nativeDb.importXmlSchemas(serializedXmlSchemas, { schemaLockHeld: false, schemaSyncDbUri });
        if (DbResult.BE_SQLITE_ERROR_SchemaLockFailed === stat) {
          this.abandonChanges();
          if (this.nativeDb.getITwinId() !== Guid.empty)
            await this.acquireSchemaLock();
          stat = this.nativeDb.importXmlSchemas(serializedXmlSchemas, { schemaLockHeld: true, schemaSyncDbUri });
        }
        if (DbResult.BE_SQLITE_OK !== stat)
          throw new IModelError(stat, "Error importing schema");
      });
    } else {
      if (this.iTwinId && this.iTwinId !== Guid.empty) // if this iModel is associated with an iTwin, importing schema requires the schema lock
        await this.acquireSchemaLock();

      const stat = this.nativeDb.importXmlSchemas(serializedXmlSchemas, { schemaLockHeld: true });
      if (DbResult.BE_SQLITE_OK !== stat)
        throw new IModelError(stat, "Error importing schema");
    }
    this.clearCaches();
  }

  /** Find an opened instance of any subclass of IModelDb, by filename
   * @note this method returns an IModelDb if the filename is open for *any* subclass of IModelDb
  */
  public static findByFilename(fileName: LocalFileName): IModelDb | undefined {
    for (const entry of this._openDbs) {
      if (entry[1].pathName === fileName)
        return entry[1];
    }
    return undefined;
  }

  /** Find an open IModelDb by its key.
   * @note This method is mainly for use by RPC implementations.
   * @throws [[IModelNotFoundResponse]] if an open IModelDb matching the key is not found.
   * @see [IModel.key]($common)
   */
  public static findByKey(key: string): IModelDb {
    const iModelDb = this.tryFindByKey(key);
    if (undefined === iModelDb)
      throw new IModelNotFoundResponse(); // a very specific status for the RpcManager

    return iModelDb;
  }

  /** Attempt to find an open IModelDb by key.
   * @returns The matching IModelDb or `undefined`.
   */
  public static tryFindByKey(key: string): IModelDb | undefined {
    return this._openDbs.get(key);
  }

  /** @internal */
  public static openDgnDb(file: { path: LocalFileName, key?: string }, openMode: OpenMode, upgradeOptions?: UpgradeOptions, props?: SnapshotOpenOptions & CloudContainerArgs & OpenSqliteArgs): IModelJsNative.DgnDb {
    file.key = file.key ?? Guid.createValue();
    if (this.tryFindByKey(file.key))
      throw new IModelError(IModelStatus.AlreadyOpen, `key [${file.key}] for file [${file.path}] is already in use`);

    const isUpgradeRequested = upgradeOptions?.domain === DomainOptions.Upgrade || upgradeOptions?.profile === ProfileOptions.Upgrade;
    if (isUpgradeRequested && openMode !== OpenMode.ReadWrite)
      throw new IModelError(IModelStatus.UpgradeFailed, "Cannot upgrade a Readonly Db");

    try {
      const nativeDb = new IModelHost.platform.DgnDb();
      const container = props?.container;
      if (container) {
        // temp files for cloud-based Dbs should be in the profileDir in a subdirectory named for their container
        const baseDir = join(IModelHost.profileDir, "CloudDbTemp", container.containerId);
        IModelJsFs.recursiveMkDirSync(baseDir);
        props = { ...props, tempFileBase: join(baseDir, file.path) };
      }
      nativeDb.openIModel(file.path, openMode, upgradeOptions, props, props?.container, props);
      return nativeDb;
    } catch (err: any) {
      throw new IModelError(err.errorNumber, `${err.message}, ${file.path}`);
    }
  }

  /**
   * Determines if the schemas in the Db must or can be upgraded by comparing them with those included in the
   * current version of the software.
   * @param filePath Full name of the briefcase including path
   * @param forReadWrite Pass true if validating for read-write scenarios - note that the schema version requirements
   * for opening the DgnDb read-write is more stringent than when opening the database read-only
   * @throws [[IModelError]] If the Db was in an invalid state and that causes a problem with validating schemas
   * @see [[BriefcaseDb.upgradeSchemas]] or [[StandaloneDb.upgradeSchemas]]
   * @see ($docs/learning/backend/IModelDb.md#upgrading-schemas-in-an-imodel)
   */
  public static validateSchemas(filePath: LocalFileName, forReadWrite: boolean): SchemaState {
    const openMode = forReadWrite ? OpenMode.ReadWrite : OpenMode.Readonly;
    const file = { path: filePath };
    let result = DbResult.BE_SQLITE_OK;
    try {
      const upgradeOptions: UpgradeOptions = {
        domain: DomainOptions.CheckRecommendedUpgrades,
      };
      const nativeDb = this.openDgnDb(file, openMode, upgradeOptions);
      nativeDb.closeFile();
    } catch (err: any) {
      result = err.errorNumber;
    }

    let schemaState: SchemaState = SchemaState.UpToDate;
    switch (result) {
      case DbResult.BE_SQLITE_OK:
        schemaState = SchemaState.UpToDate;
        break;
      case DbResult.BE_SQLITE_ERROR_ProfileTooOld:
      case DbResult.BE_SQLITE_ERROR_ProfileTooOldForReadWrite:
      case DbResult.BE_SQLITE_ERROR_SchemaTooOld:
        schemaState = SchemaState.TooOld;
        break;
      case DbResult.BE_SQLITE_ERROR_ProfileTooNew:
      case DbResult.BE_SQLITE_ERROR_ProfileTooNewForReadWrite:
      case DbResult.BE_SQLITE_ERROR_SchemaTooNew:
        schemaState = SchemaState.TooNew;
        break;
      case DbResult.BE_SQLITE_ERROR_SchemaUpgradeRecommended:
        schemaState = SchemaState.UpgradeRecommended;
        break;
      case DbResult.BE_SQLITE_ERROR_SchemaUpgradeRequired:
        schemaState = SchemaState.UpgradeRequired;
        break;
      case DbResult.BE_SQLITE_ERROR_InvalidProfileVersion:
        throw new IModelError(DbResult.BE_SQLITE_ERROR_InvalidProfileVersion, "The profile of the Db is invalid. Cannot upgrade or open the Db.");
      default:
        throw new IModelError(DbResult.BE_SQLITE_ERROR, "Error validating schemas. Cannot upgrade or open the Db.");
    }
    return schemaState;
  }

  /** The registry of entity metadata for this iModel.
   * @internal
   */
  public get classMetaDataRegistry(): MetaDataRegistry {
    if (this._classMetaDataRegistry === undefined)
      this._classMetaDataRegistry = new MetaDataRegistry();

    return this._classMetaDataRegistry;
  }

  /** Get the linkTableRelationships for this IModel */
  public get relationships(): Relationships {
    return this._relationships || (this._relationships = new Relationships(this));
  }

  /** Get the CodeSpecs in this IModel. */
  public get codeSpecs(): CodeSpecs {
    return (this._codeSpecs !== undefined) ? this._codeSpecs : (this._codeSpecs = new CodeSpecs(this));
  }
  /** Prepare an ECSQL statement.
   * @param sql The ECSQL statement to prepare
   * @param logErrors Determines if error will be logged if statement fail to prepare
   * @throws [[IModelError]] if there is a problem preparing the statement.
   */
  public prepareStatement(sql: string, logErrors = true): ECSqlStatement {
    const stmt = new ECSqlStatement();
    stmt.prepare(this.nativeDb, sql, logErrors);
    return stmt;
  }

  /** Prepare an ECSQL statement.
   * @param sql The ECSQL statement to prepare
   * @returns `undefined` if there is a problem preparing the statement.
   */
  public tryPrepareStatement(sql: string): ECSqlStatement | undefined {
    const statement = new ECSqlStatement();
    const result = statement.tryPrepare(this.nativeDb, sql);
    return DbResult.BE_SQLITE_OK === result.status ? statement : undefined;
  }

  /** Construct an entity (Element or Model) from an iModel.
   * @throws [[IModelError]] if the entity cannot be constructed.
   */
  public constructEntity<T extends Entity, P extends EntityProps = EntityProps>(props: P): T {
    const jsClass = this.getJsClass(props.classFullName);
    return Entity.instantiate(jsClass, props, this) as T;
  }

  /** Get the JavaScript class that handles a given entity class.  */
  public getJsClass<T extends typeof Entity>(classFullName: string): T {
    try {
      return ClassRegistry.getClass(classFullName, this) as T;
    } catch (err) {
      if (!ClassRegistry.isNotFoundError(err)) {
        throw err;
      }

      this.loadMetaData(classFullName);
      return ClassRegistry.getClass(classFullName, this) as T;
    }
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

  /** Invoke a callback on each property of the specified class, optionally including superclass properties.
   * @param iModel  The IModel that contains the schema
   * @param classFullName The full class name to load the metadata, if necessary
   * @param wantSuper If true, superclass properties will also be processed
   * @param func The callback to be invoked on each property
   * @param includeCustom If true (default), include custom-handled properties in the iteration. Otherwise, skip custom-handled properties.
   * @note Custom-handled properties are core properties that have behavior enforced by C++ handlers.
   */
  public static forEachMetaData(iModel: IModelDb, classFullName: string, wantSuper: boolean, func: PropertyCallback, includeCustom: boolean = true) {
    iModel.forEachMetaData(classFullName, wantSuper, func, includeCustom);
  }

  /** Invoke a callback on each property of the specified class, optionally including superclass properties.
   * @param classFullName The full class name to load the metadata, if necessary
   * @param wantSuper If true, superclass properties will also be processed
   * @param func The callback to be invoked on each property
   * @param includeCustom If true (default), include custom-handled properties in the iteration. Otherwise, skip custom-handled properties.
   * @note Custom-handled properties are core properties that have behavior enforced by C++ handlers.
   */
  public forEachMetaData(classFullName: string, wantSuper: boolean, func: PropertyCallback, includeCustom: boolean = true) {
    const meta = this.getMetaData(classFullName); // will load if necessary
    for (const propName in meta.properties) { // eslint-disable-line guard-for-in
      const propMeta = meta.properties[propName];
      if (includeCustom || !propMeta.isCustomHandled || propMeta.isCustomHandledOrphan)
        func(propName, propMeta);
    }

    if (wantSuper && meta.baseClasses && meta.baseClasses.length > 0)
      meta.baseClasses.forEach((baseClass) => this.forEachMetaData(baseClass, true, func, includeCustom));
  }

  /** @internal */
  private loadMetaData(classFullName: string) {
    if (this.classMetaDataRegistry.find(classFullName))
      return;

    const className = classFullName.split(":");
    if (className.length !== 2)
      throw new IModelError(IModelStatus.BadArg, `Invalid classFullName: ${classFullName}`);

    const val = this.nativeDb.getECClassMetaData(className[0], className[1]);
    if (val.error)
      throw new IModelError(val.error.status, `Error getting class meta data for: ${classFullName}`);

    assert(undefined !== val.result);
    const metaData = new EntityMetaData(JSON.parse(val.result));
    this.classMetaDataRegistry.add(classFullName, metaData);

    // Recursive, to make sure that base classes are cached.
    if (metaData.baseClasses !== undefined && metaData.baseClasses.length > 0)
      metaData.baseClasses.forEach((baseClassName: string) => this.loadMetaData(baseClassName));
  }

  /** Returns the full schema for the input name.
   * @param name The name of the schema e.g. 'BisCore'
   * @returns The SchemaProps for the requested schema
   * @throws if the schema can not be found or loaded.
   */
  public getSchemaProps(name: string): ECSchemaProps {
    return this.nativeDb.getSchemaProps(name);
  }

  /** Query if this iModel contains the definition of the specified class.
   * @param classFullName The full name of the class, for example, SomeSchema:SomeClass
   * @returns true if the iModel contains the class definition or false if not.
   * @see querySchemaVersion
   * @see importSchema
   */
  public containsClass(classFullName: string): boolean {
    const classNameParts = classFullName.replace(".", ":").split(":");
    return classNameParts.length === 2 && this.nativeDb.getECClassMetaData(classNameParts[0], classNameParts[1]).error === undefined;
  }

  /** Query for a schema of the specified name in this iModel.
   * @returns The schema version as a semver-compatible string or `undefined` if the schema has not been imported.
   */
  public querySchemaVersion(schemaName: string): string | undefined {
    const sql = `SELECT VersionMajor,VersionWrite,VersionMinor FROM ECDbMeta.ECSchemaDef WHERE Name=:schemaName LIMIT 1`;
    return this.withPreparedStatement(sql, (statement: ECSqlStatement): string | undefined => {
      statement.bindString("schemaName", schemaName);
      if (DbResult.BE_SQLITE_ROW === statement.step()) {
        const versionMajor: number = statement.getValue(0).getInteger(); // ECSchemaDef.VersionMajor --> semver.major
        const versionWrite: number = statement.getValue(1).getInteger(); // ECSchemaDef.VersionWrite --> semver.minor
        const versionMinor: number = statement.getValue(2).getInteger(); // ECSchemaDef.VersionMinor --> semver.patch
        return `${versionMajor}.${versionWrite}.${versionMinor}`;
      }
      return undefined;
    });
  }

  /** Retrieve a named texture image from this iModel, as a TextureData.
   * @param props the texture load properties which must include the name of the texture to load
   * @returns the TextureData or undefined if the texture image is not present.
   * @alpha
   */
  public async queryTextureData(props: TextureLoadProps): Promise<TextureData | undefined> {
    return this.nativeDb.queryTextureData(props);
  }

  /** Query a "file property" from this iModel, as a string.
   * @returns the property string or undefined if the property is not present.
   */
  public queryFilePropertyString(prop: FilePropertyProps): string | undefined {
    return this.nativeDb.queryFileProperty(prop, true) as string | undefined;
  }

  /** Query a "file property" from this iModel, as a blob.
   * @returns the property blob or undefined if the property is not present.
   */
  public queryFilePropertyBlob(prop: FilePropertyProps): Uint8Array | undefined {
    return this.nativeDb.queryFileProperty(prop, false) as Uint8Array | undefined;
  }

  /** Save a "file property" to this iModel
   * @param prop the FilePropertyProps that describes the new property
   * @param value either a string or a blob to save as the file property
   */
  public saveFileProperty(prop: FilePropertyProps, strValue: string | undefined, blobVal?: Uint8Array): void {
    this.nativeDb.saveFileProperty(prop, strValue, blobVal);
  }

  /** delete a "file property" from this iModel
   * @param prop the FilePropertyProps that describes the property
   */
  public deleteFileProperty(prop: FilePropertyProps): void {
    this.nativeDb.saveFileProperty(prop, undefined, undefined);
  }

  /** Query for the next available major id for a "file property" from this iModel.
   * @param prop the FilePropertyProps that describes the property
   * @returns the next available (that is, an unused) id for prop. If none are present, will return 0.
   */
  public queryNextAvailableFileProperty(prop: FilePropertyProps) { return this.nativeDb.queryNextAvailableFileProperty(prop); }

  /** @internal */
  public async requestSnap(sessionId: string, props: SnapRequestProps): Promise<SnapResponseProps> {
    let request = this._snaps.get(sessionId);
    if (undefined === request) {
      request = new IModelHost.platform.SnapRequest();
      this._snaps.set(sessionId, request);
    } else
      request.cancelSnap();

    try {
      return await request.doSnap(this.nativeDb, JsonUtils.toObject(props));
    } finally {
      this._snaps.delete(sessionId);
    }
  }

  /** Cancel a previously requested snap.
   * @internal
   */
  public cancelSnap(sessionId: string): void {
    const request = this._snaps.get(sessionId);
    if (undefined !== request) {
      request.cancelSnap();
      this._snaps.delete(sessionId);
    }
  }

  /** Get the clip containment status for the supplied elements. */
  public async getGeometryContainment(props: GeometryContainmentRequestProps): Promise<GeometryContainmentResponseProps> {
    return this.nativeDb.getGeometryContainment(JsonUtils.toObject(props));
  }

  /** Get the mass properties for the supplied elements. */
  public async getMassProperties(props: MassPropertiesRequestProps): Promise<MassPropertiesResponseProps> {
    return this.nativeDb.getMassProperties(JsonUtils.toObject(props));
  }

  /** Get the IModel coordinate corresponding to each GeoCoordinate point in the input */
  public async getIModelCoordinatesFromGeoCoordinates(props: IModelCoordinatesRequestProps): Promise<IModelCoordinatesResponseProps> {
    return this.nativeDb.getIModelCoordinatesFromGeoCoordinates(props);
  }

  /** Get the GeoCoordinate (longitude, latitude, elevation) corresponding to each IModel Coordinate point in the input */
  public async getGeoCoordinatesFromIModelCoordinates(props: GeoCoordinatesRequestProps): Promise<GeoCoordinatesResponseProps> {
    return this.nativeDb.getGeoCoordinatesFromIModelCoordinates(props);
  }

  /** Export meshes suitable for graphics APIs from arbitrary geometry in elements in this IModelDb.
   *  * Requests can be slow when processing many elements so it is expected that this function be used on a dedicated backend,
   *    or that shared backends export a limited number of elements at a time.
   *  * Vertices are exported in the IModelDb's world coordinate system, which is right-handed with Z pointing up.
   *  * The results of changing [ExportGraphicsOptions]($core-backend) during the [ExportGraphicsOptions.onGraphics]($core-backend) callback are not defined.
   *
   * Example that prints the mesh for element 1 to stdout in [OBJ format](https://en.wikipedia.org/wiki/Wavefront_.obj_file)
   * ```ts
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
   * @public
   */
  public exportGraphics(exportProps: ExportGraphicsOptions): DbResult {
    return this.nativeDb.exportGraphics(exportProps);
  }

  /**
   * Exports meshes suitable for graphics APIs from a specified [GeometryPart]($core-backend)
   * in this IModelDb.
   * The expected use case is to call [IModelDb.exportGraphics]($core-backend) and supply the
   * optional partInstanceArray argument, then call this function for each unique GeometryPart from
   * that list.
   *  * The results of changing [ExportPartGraphicsOptions]($core-backend) during the
   *    [ExportPartGraphicsOptions.onPartGraphics]($core-backend) callback are not defined.
   *  * See export-gltf under test-apps in the iTwin.js monorepo for a working reference.
   * @returns 0 is successful, status otherwise
   * @public
   */
  public exportPartGraphics(exportProps: ExportPartGraphicsOptions): DbResult {
    return this.nativeDb.exportPartGraphics(exportProps);
  }

  /** Request geometry stream information from an element in binary format instead of json.
   * @returns IModelStatus.Success if successful
   * @beta
   */
  public elementGeometryRequest(requestProps: ElementGeometryRequest): IModelStatus {
    return this.nativeDb.processGeometryStream(requestProps);
  }

  /** Create brep geometry for inclusion in an element's geometry stream.
   * @returns IModelStatus.Success if successful
   * @throws [[IModelError]] to report issues with input geometry or parameters
   * @alpha
   */
  public createBRepGeometry(createProps: BRepGeometryCreate): IModelStatus {
    return this.nativeDb.createBRepGeometry(createProps);
  }

  /** Generate graphics for an element or geometry stream.
   * @see [readElementGraphics]($frontend) to convert the result to a [RenderGraphic]($frontend) for display.
   */
  public async generateElementGraphics(request: ElementGraphicsRequestProps): Promise<Uint8Array | undefined> {
    return generateElementGraphics(request, this);
  }

  private static _settingPropNamespace = "settings";

  /** Save a `SettingDictionary` in this iModel that will be loaded into [[workspace.settings]] every time this iModel is opened in future sessions.
   * @param name The name for the SettingDictionary. If a dictionary by that name already exists in the iModel, its value is replaced.
   * @param dict The SettingDictionary object to stringify and save.
   * @note All saved `SettingDictionary`s are loaded into [[workspace.settings]] every time an iModel is opened.
   * @beta
   */
  public saveSettingDictionary(name: string, dict: SettingDictionary) {
    this.withSqliteStatement("REPLACE INTO be_Prop(id,SubId,TxnMode,Namespace,Name,strData) VALUES(0,0,0,?,?,?)", (stmt) => {
      stmt.bindString(1, IModelDb._settingPropNamespace);
      stmt.bindString(2, name);
      stmt.bindString(3, JSON.stringify(dict));
      stmt.stepForWrite();
    });
    this.saveChanges("add settings");
  }

  /** Delete a SettingDictionary, previously added with [[saveSettingDictionary]], from this iModel.
   * @param name The name of the dictionary to delete.
   * @beta
   */
  public deleteSettingDictionary(name: string) {
    this.withSqliteStatement("DELETE FROM be_Prop WHERE Namespace=? AND Name=?", (stmt) => {
      stmt.bindString(1, IModelDb._settingPropNamespace);
      stmt.bindString(2, name);
      stmt.stepForWrite();
    });
    this.saveChanges("delete settings");
  }

  /** Load all setting dictionaries in this iModel into `this.workspace.settings` */
  private loadSettingDictionaries() {
    if (!this.nativeDb.isOpen())
      return;

    this.withSqliteStatement("SELECT Name,StrData FROM be_Prop WHERE Namespace=?", (stmt) => {
      stmt.bindString(1, IModelDb._settingPropNamespace);
      while (stmt.nextRow()) {
        try {
          const dict = JSON.parse(stmt.getValueString(1));
          this.workspace.settings.addDictionary(stmt.getValueString(0), SettingsPriority.iModel, dict);
        } catch (e) {
          UnexpectedErrors.handle(e);
        }
      }
    });
  }

  /**
   * Controls how [Code]($common)s are copied from this iModel into another iModel, to work around problems with iModels created by older connectors. The [imodel-transformer](https://github.com/iTwin/imodel-transformer) sets this appropriately on your behalf - you should never need to set or interrogate this property yourself.
   * @public
   */
  public get codeValueBehavior(): "exact" | "trim-unicode-whitespace" {
    return this.nativeDb.getCodeValueBehavior();
  }

  public set codeValueBehavior(newBehavior: "exact" | "trim-unicode-whitespace") {
    this.nativeDb.setCodeValueBehavior(newBehavior);
  }
}

/** @public */
export namespace IModelDb { // eslint-disable-line no-redeclare

  /** The collection of models in an [[IModelDb]].
   * @public
   */
  export class Models {
    /** @internal */
    public constructor(private _iModel: IModelDb) { }

    /** Get the ModelProps with the specified identifier.
     * @param modelId The Model identifier.
     * @throws [[IModelError]] if the model is not found or cannot be loaded.
     * @see tryGetModelProps
     */
    public getModelProps<T extends ModelProps>(id: Id64String): T {
      return this.getModelJson<T>({ id });
    }

    /** Get the ModelProps with the specified identifier.
     * @param modelId The Model identifier.
     * @returns The ModelProps or `undefined` if the model is not found.
     * @throws [[IModelError]] if the model cannot be loaded.
     * @note Useful for cases when a model may or may not exist and throwing an `Error` would be overkill.
     * @see getModelProps
     */
    public tryGetModelProps<T extends ModelProps>(id: Id64String): T | undefined {
      return this.tryGetModelJson({ id });
    }

    /** Query for the last modified time for a [[Model]].
     * @param modelId The Id of the model.
     * @throws IModelError if `modelId` does not identify a model in the iModel.
     */
    public queryLastModifiedTime(modelId: Id64String): string {
      const sql = `SELECT LastMod FROM ${Model.classFullName} WHERE ECInstanceId=:modelId`;
      return this._iModel.withPreparedStatement(sql, (statement) => {
        statement.bindId("modelId", modelId);
        if (DbResult.BE_SQLITE_ROW === statement.step()) {
          return statement.getValue(0).getDateTime();
        }
        throw new IModelError(IModelStatus.InvalidId, `Can't get lastMod time for Model ${modelId}`);
      });
    }

    /** Get the Model with the specified identifier.
     * @param modelId The Model identifier.
     * @param modelClass Optional class to validate instance against. This parameter can accept abstract or concrete classes, but should be the same as the template (`T`) parameter.
     * @throws [[IModelError]] if the model is not found, cannot be loaded, or fails validation when `modelClass` is specified.
     * @see tryGetModel
     */
    public getModel<T extends Model>(modelId: Id64String, modelClass?: EntityClassType<Model>): T {
      const model: T | undefined = this.tryGetModel(modelId, modelClass);
      if (undefined === model) {
        throw new IModelError(IModelStatus.NotFound, `Model=${modelId}`);
      }
      return model;
    }

    /** Get the Model with the specified identifier.
     * @param modelId The Model identifier.
     * @param modelClass Optional class to validate instance against. This parameter can accept abstract or concrete classes, but should be the same as the template (`T`) parameter.
     * @returns The Model or `undefined` if the model is not found or fails validation when `modelClass` is specified.
     * @throws [[IModelError]] if the model cannot be loaded.
     * @note Useful for cases when a model may or may not exist and throwing an `Error` would be overkill.
     * @see getModel
     */
    public tryGetModel<T extends Model>(modelId: Id64String, modelClass?: EntityClassType<Model>): T | undefined {
      const modelProps = this.tryGetModelProps<ModelProps>(modelId);
      if (undefined === modelProps)
        return undefined; // no Model with that modelId found

      const model = this._iModel.constructEntity<T>(modelProps);
      if (undefined === modelClass)
        return model; // modelClass was not specified, cannot call instanceof to validate

      return model instanceof modelClass ? model : undefined;
    }

    /** Read the properties for a Model as a json string.
     * @param modelIdArg a json string with the identity of the model to load. Must have either "id" or "code".
     * @returns a json string with the properties of the model.
     * @throws [[IModelError]] if the model is not found or cannot be loaded.
     * @see tryGetModelJson
     * @internal
     */
    public getModelJson<T extends ModelProps>(modelIdArg: ModelLoadProps): T {
      const modelJson = this.tryGetModelJson<T>(modelIdArg);
      if (undefined === modelJson) {
        throw new IModelError(IModelStatus.NotFound, `Model=${modelIdArg}`);
      }
      return modelJson;
    }

    /** Read the properties for a Model as a json string.
     * @param modelIdArg a json string with the identity of the model to load. Must have either "id" or "code".
     * @returns a json string with the properties of the model or `undefined` if the model is not found.
     * @see getModelJson
     */
    private tryGetModelJson<T extends ModelProps>(modelIdArg: ModelLoadProps): T | undefined {
      try {
        return this._iModel.nativeDb.getModel(modelIdArg) as T;
      } catch (err: any) {
        return undefined;
      }
    }

    /** Get the sub-model of the specified Element.
     * See [[IModelDb.Elements.queryElementIdByCode]] for more on how to find an element by Code.
     * @param modeledElementId Identifies the modeled element.
     * @param modelClass Optional class to validate instance against. This parameter can accept abstract or concrete classes, but should be the same as the template (`T`) parameter.
     * @throws [[IModelError]] if the sub-model is not found, cannot be loaded, or fails validation when `modelClass` is specified.
     * @see tryGetSubModel
     */
    public getSubModel<T extends Model>(modeledElementId: Id64String | GuidString | Code, modelClass?: EntityClassType<Model>): T {
      const modeledElementProps = this._iModel.elements.getElementProps<ElementProps>(modeledElementId);
      if (undefined === modeledElementProps.id || modeledElementProps.id === IModel.rootSubjectId)
        throw new IModelError(IModelStatus.NotFound, "Root subject does not have a sub-model");
      return this.getModel<T>(modeledElementProps.id, modelClass);
    }

    /** Get the sub-model of the specified Element.
     * See [[IModelDb.Elements.queryElementIdByCode]] for more on how to find an element by Code.
     * @param modeledElementId Identifies the modeled element.
     * @param modelClass Optional class to validate instance against. This parameter can accept abstract or concrete classes, but should be the same as the template (`T`) parameter.
     * @returns The sub-model or `undefined` if the specified element does not have a sub-model or fails validation when `modelClass` is specified.
     * @see getSubModel
     */
    public tryGetSubModel<T extends Model>(modeledElementId: Id64String | GuidString | Code, modelClass?: EntityClassType<Model>): T | undefined {
      const modeledElementProps = this._iModel.elements.tryGetElementProps(modeledElementId);
      if (undefined === modeledElementProps?.id || (IModel.rootSubjectId === modeledElementProps.id))
        return undefined;

      return this.tryGetModel<T>(modeledElementProps.id, modelClass);
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
      try {
        return props.id = this._iModel.nativeDb.insertModel(props);
      } catch (err: any) {
        throw new IModelError(err.errorNumber, `Error inserting model [${err.message}], class=${props.classFullName}`);
      }
    }

    /** Update an existing model.
     * @param props the properties of the model to change
     * @throws [[IModelError]] if unable to update the model.
     */
    public updateModel(props: UpdateModelOptions): void {
      try {
        this._iModel.nativeDb.updateModel(props);
      } catch (err: any) {
        throw new IModelError(err.errorNumber, `error updating model [${err.message}] id=${props.id}`);
      }
    }
    /** Mark the geometry of [[GeometricModel]] as having changed, by recording an indirect change to its GeometryGuid property.
     * Typically the GeometryGuid changes automatically when [[GeometricElement]]s within the model are modified, but
     * explicitly updating it is occasionally useful after modifying definition elements like line styles or materials that indirectly affect the appearance of
     * [[GeometricElement]]s that reference those definition elements in their geometry streams.
     * Cached [Tile]($frontend)s are only invalidated after the geometry guid of the model changes.
     * @note This will throw IModelError with [IModelStatus.VersionTooOld]($core-bentley) if a version of the BisCore schema older than 1.0.11 is present in the iModel.
     * @throws IModelError if unable to update the geometry guid.
     * @see [[TxnManager.onModelGeometryChanged]] for the event emitted in response to such a change.
     */
    public updateGeometryGuid(modelId: Id64String): void {
      const error = this._iModel.nativeDb.updateModelGeometryGuid(modelId);
      if (error !== IModelStatus.Success)
        throw new IModelError(error, `updating geometry guid for model ${modelId}`);
    }

    /** Delete one or more existing models.
     * @param ids The Ids of the models to be deleted
     * @throws [[IModelError]]
     */
    public deleteModel(ids: Id64Arg): void {
      Id64.toIdSet(ids).forEach((id) => {
        try {
          this._iModel.nativeDb.deleteModel(id);
        } catch (err: any) {
          throw new IModelError(err.errorNumber, `error deleting model [${err.message}] id ${id}`);
        }
      });
    }

    /** For each specified [[GeometricModel]], attempts to obtain the union of the volumes of all geometric elements within that model.
     * @param ids The Id or Ids of the [[GeometricModel]]s for which to obtain the extents.
     * @returns An array of results, one per supplied Id, in the order in which the Ids were supplied. If the extents could not be obtained, the
     * corresponding results entry's `extents` will be a "null" range (@see [Range3d.isNull]($geometry)) and its `status` will indicate
     * why the extents could not be obtained (e.g., because the Id did not identify a [[GeometricModel]]).
     * @see [[queryRange]] to obtain the union of all of the models' extents.
     */
    public async queryExtents(ids: Id64String | Id64String[]): Promise<ModelExtentsProps[]> {
      ids = typeof ids === "string" ? [ids] : ids;
      if (ids.length === 0)
        return [];

      return this._iModel.nativeDb.queryModelExtentsAsync(ids);
    }

    /** Computes the union of the volumes of all geometric elements within one or more [[GeometricModel]]s, specified by model Id.
     * @see [[queryExtents]] to obtain discrete volumes for each model.
     */
    public async queryRange(ids: Id64String | Id64String[]): Promise<AxisAlignedBox3d> {
      const results = await this.queryExtents(ids);
      const range = new Range3d();
      for (const result of results)
        range.union(Range3d.fromJSON(result.extents), range);

      return range;
    }
  }

  export interface GuidMapper {
    getFederationGuidFromId(id: Id64String): GuidString | undefined;
    getIdFromFederationGuid(guid?: GuidString): Id64String | undefined;
  }

  /** The collection of elements in an [[IModelDb]].
   * @public
   */
  export class Elements implements GuidMapper {
    /** @internal */
    public constructor(private _iModel: IModelDb) { }

    public getFederationGuidFromId(id: Id64String): GuidString | undefined {
      return this._iModel.withPreparedSqliteStatement(`SELECT FederationGuid FROM bis_Element WHERE Id=?`, (stmt) => {
        stmt.bindId(1, id);
        return stmt.nextRow() ? stmt.getValueGuid(0) : undefined;
      });
    }

    public getIdFromFederationGuid(guid?: GuidString): Id64String | undefined {
      return guid ? this._iModel.withPreparedSqliteStatement(`SELECT Id FROM bis_Element WHERE FederationGuid=?`, (stmt) => {
        stmt.bindGuid(1, guid);
        return !stmt.nextRow() ? undefined : stmt.getValueId(0);
      }) : undefined;
    }

    /** Read element data from the iModel as JSON
     * @param elementIdArg a json string with the identity of the element to load. Must have one of "id", "federationGuid", or "code".
     * @returns The JSON properties of the element.
     * @throws [[IModelError]] if the element is not found or cannot be loaded.
     * @see tryGetElementJson
     * @internal
     */
    public getElementJson<T extends ElementProps>(elementId: ElementLoadProps): T {
      const elementProps = this.tryGetElementJson<T>(elementId);
      if (undefined === elementProps)
        throw new IModelError(IModelStatus.NotFound, `reading element=${elementId}`);
      return elementProps;
    }

    /** Read element data from the iModel as JSON
     * @param loadProps - a json string with the identity of the element to load. Must have one of "id", "federationGuid", or "code".
     * @returns The JSON properties of the element or `undefined` if the element is not found.
     * @throws [[IModelError]] if the element exists, but cannot be loaded.
     * @see getElementJson
     */
    private tryGetElementJson<T extends ElementProps>(loadProps: ElementLoadProps): T | undefined {
      try {
        return this._iModel.nativeDb.getElement(loadProps) as T;
      } catch (err: any) {
        return undefined;
      }
    }

    /** Get properties of an Element by Id, FederationGuid, or Code
     * @throws [[IModelError]] if the element is not found or cannot be loaded.
     * @see tryGetElementProps
     */
    public getElementProps<T extends ElementProps>(props: Id64String | GuidString | Code | ElementLoadProps): T {
      if (typeof props === "string") {
        props = Id64.isId64(props) ? { id: props } : { federationGuid: props };
      } else if (props instanceof Code) {
        props = { code: props };
      }
      try {
        return this._iModel.nativeDb.getElement(props) as T;
      } catch (err: any) {
        throw new IModelError(err.errorNumber, err.message);
      }
    }

    /** Get properties of an Element by Id, FederationGuid, or Code
     * @returns The properties of the element or `undefined` if the element is not found.
     * @throws [[IModelError]] if the element exists, but cannot be loaded.
     * @note Useful for cases when an element may or may not exist and throwing an `Error` would be overkill.
     * @see getElementProps
     */
    public tryGetElementProps<T extends ElementProps>(elementId: Id64String | GuidString | Code | ElementLoadProps): T | undefined {
      if (typeof elementId === "string") {
        elementId = Id64.isId64(elementId) ? { id: elementId } : { federationGuid: elementId };
      } else if (elementId instanceof Code) {
        elementId = { code: elementId };
      }
      return this.tryGetElementJson<T>(elementId);
    }

    /** Get an element by Id, FederationGuid, or Code
     * @param elementId either the element's Id, Code, or FederationGuid, or an ElementLoadProps
     * @param elementClass Optional class to validate instance against. This parameter can accept abstract or concrete classes, but should be the same as the template (`T`) parameter.
     * @throws [[IModelError]] if the element is not found, cannot be loaded, or fails validation when `elementClass` is specified.
     * @see tryGetElement
     */
    public getElement<T extends Element>(elementId: Id64String | GuidString | Code | ElementLoadProps, elementClass?: EntityClassType<Element>): T {
      const element = this.tryGetElement<T>(elementId, elementClass);
      if (undefined === element)
        throw new IModelError(IModelStatus.NotFound, `Element=${elementId}`);
      return element;
    }

    /** Get an element by Id, FederationGuid, or Code
     * @param elementId either the element's Id, Code, or FederationGuid, or an ElementLoadProps
     * @param elementClass Optional class to validate instance against. This parameter can accept abstract or concrete classes, but should be the same as the template (`T`) parameter.
     * @returns The element or `undefined` if the element is not found or fails validation when `elementClass` is specified.
     * @throws [[IModelError]] if the element exists, but cannot be loaded.
     * @note Useful for cases when an element may or may not exist and throwing an `Error` would be overkill.
     * @see getElement
     */
    public tryGetElement<T extends Element>(elementId: Id64String | GuidString | Code | ElementLoadProps, elementClass?: EntityClassType<Element>): T | undefined {
      if (typeof elementId === "string")
        elementId = Id64.isId64(elementId) ? { id: elementId } : { federationGuid: elementId };
      else if (elementId instanceof Code)
        elementId = { code: elementId };
      else
        elementId.onlyBaseProperties = false; // we must load all properties to construct the element.

      const elementProps = this.tryGetElementJson<ElementProps>(elementId);
      if (undefined === elementProps)
        return undefined; // no Element with that elementId found

      const element = this._iModel.constructEntity<T>(elementProps);
      if (undefined === elementClass)
        return element; // elementClass was not specified, cannot call instanceof to validate

      return element instanceof elementClass ? element : undefined;
    }

    /** Query for the Id of the element that has a specified code.
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
    public queryElementIdByCode(code: Required<CodeProps>): Id64String | undefined {
      if (Id64.isInvalid(code.spec))
        throw new IModelError(IModelStatus.InvalidCodeSpec, "Invalid CodeSpec");

      if (code.value === undefined)
        throw new IModelError(IModelStatus.InvalidCode, "Invalid Code");

      return this._iModel.withPreparedStatement("SELECT ECInstanceId FROM BisCore:Element WHERE CodeSpec.Id=? AND CodeScope.Id=? AND CodeValue=?", (stmt: ECSqlStatement) => {
        stmt.bindId(1, code.spec);
        stmt.bindId(2, Id64.fromString(code.scope));
        stmt.bindString(3, code.value);
        if (DbResult.BE_SQLITE_ROW !== stmt.step())
          return undefined;

        return stmt.getValue(0).getId();
      });
    }

    /** Query for an [[Element]]'s last modified time.
     * @param elementId The Id of the element.
     * @throws IModelError if `elementId` does not identify an element in the iModel.
     */
    public queryLastModifiedTime(elementId: Id64String): string {
      const sql = "SELECT LastMod FROM BisCore:Element WHERE ECInstanceId=:elementId";
      return this._iModel.withPreparedStatement<string>(sql, (statement: ECSqlStatement): string => {
        statement.bindId("elementId", elementId);
        if (DbResult.BE_SQLITE_ROW === statement.step())
          return statement.getValue(0).getDateTime();
        throw new IModelError(IModelStatus.InvalidId, `Can't get lastMod time for Element ${elementId}`);
      });
    }

    /** Create a new instance of an element.
     * @param elProps The properties of the new element.
     * @throws [[IModelError]] if there is a problem creating the element.
     */
    public createElement<T extends Element>(elProps: ElementProps): T { return this._iModel.constructEntity<T>(elProps); }

    /** Insert a new element into the iModel.
     * @param elProps The properties of the new element.
     * @returns The newly inserted element's Id.
     * @throws [[IModelError]] if unable to insert the element.
     * @note For convenience, the value of `elProps.id` is updated to reflect the resultant element's id.
     * However when `elProps.federationGuid` is not present or undefined, a new Guid will be generated and stored on the resultant element. But
     * the value of `elProps.federationGuid` is *not* updated. Generally, it is best to re-read the element after inserting (e.g. via [[getElementProps]])
     * if you intend to continue working with it. That will ensure its values reflect the persistent state.
     */
    public insertElement(elProps: ElementProps): Id64String {
      try {
        return elProps.id = this._iModel.nativeDb.insertElement(elProps);
      } catch (err: any) {
        err.message = `Error inserting element [${err.message}]`;
        err.metadata = { elProps };
        throw err;
      }
    }

    /** Update some properties of an existing element.
     * To support clearing a property value, every property name that is present in the `elProps` object will be updated even if the value is `undefined`.
     * To keep an individual element property unchanged, it should either be excluded from the `elProps` parameter or set to its current value.
     * @param elProps the properties of the element to update.
     * @note As described above, this is a special case where there is a difference between a property being excluded and a property being present in `elProps` but set to `undefined`.
     * @throws [[IModelError]] if unable to update the element.
     */
    public updateElement(elProps: ElementProps): void {
      try {
        this._iModel.nativeDb.updateElement(elProps);
      } catch (err: any) {
        err.message = `Error updating element [${err.message}], id: ${elProps.id}`;
        err.metadata = { elProps };
        throw err;
      }
    }

    /** Delete one or more elements from this iModel.
     * @param ids The set of Ids of the element(s) to be deleted
     * @throws [[IModelError]]
     * @see deleteDefinitionElements
     */
    public deleteElement(ids: Id64Arg): void {
      const iModel = this._iModel;
      Id64.toIdSet(ids).forEach((id) => {
        try {
          iModel.nativeDb.deleteElement(id);
        } catch (err: any) {
          err.message = `Error deleting element [${err.message}], id: ${id}`;
          err.metadata = { elementId: id };
          throw err;
        }
      });
    }

    /** DefinitionElements can only be deleted if it can be determined that they are not referenced by other Elements.
     * This *usage query* can be expensive since it may involve scanning the GeometryStreams of all GeometricElements.
     * Since [[deleteElement]] does not perform these additional checks, it fails in order to prevent potentially referenced DefinitionElements from being deleted.
     * This method performs those expensive checks and then calls *delete* if not referenced.
     * @param ids The Ids of the DefinitionElements to attempt to delete. To prevent multiple passes over the same GeometricElements, it is best to pass in the entire array of
     * DefinitionElements rather than calling this method separately for each one. Ids that are not valid DefinitionElements will be ignored.
     * @returns An IdSet of the DefinitionElements that are used and were therefore not deleted.
     * @see deleteElement
     * @beta
     */
    public deleteDefinitionElements(definitionElementIds: Id64Array): Id64Set {
      const usageInfo = this._iModel.nativeDb.queryDefinitionElementUsage(definitionElementIds);
      if (!usageInfo) {
        throw new IModelError(IModelStatus.BadRequest, "Error querying for DefinitionElement usage");
      }

      const usedIdSet = usageInfo.usedIds ? Id64.toIdSet(usageInfo.usedIds) : new Set<Id64String>();
      const deleteIfUnused = (ids: Id64Array | undefined, used: Id64Set): void => {
        if (ids) {
          ids.forEach((id) => {
            if (!used.has(id))
              this._iModel.elements.deleteElement(id);
          });
        }
      };

      try {
        this._iModel.nativeDb.beginPurgeOperation();
        deleteIfUnused(usageInfo.spatialCategoryIds, usedIdSet);
        deleteIfUnused(usageInfo.drawingCategoryIds, usedIdSet);
        deleteIfUnused(usageInfo.viewDefinitionIds, usedIdSet);
        deleteIfUnused(usageInfo.geometryPartIds, usedIdSet);
        deleteIfUnused(usageInfo.lineStyleIds, usedIdSet);
        deleteIfUnused(usageInfo.renderMaterialIds, usedIdSet);
        deleteIfUnused(usageInfo.subCategoryIds, usedIdSet);
        deleteIfUnused(usageInfo.textureIds, usedIdSet);
        deleteIfUnused(usageInfo.displayStyleIds, usedIdSet);
        deleteIfUnused(usageInfo.categorySelectorIds, usedIdSet);
        deleteIfUnused(usageInfo.modelSelectorIds, usedIdSet);
        if (usageInfo.otherDefinitionElementIds) {
          this._iModel.elements.deleteElement(usageInfo.otherDefinitionElementIds);
        }
      } finally {
        this._iModel.nativeDb.endPurgeOperation();
      }

      if (usageInfo.viewDefinitionIds) {
        // take another pass in case a deleted ViewDefinition was the only usage of these view-related DefinitionElements
        let viewRelatedIds: Id64Array = [];
        if (usageInfo.displayStyleIds)
          viewRelatedIds = viewRelatedIds.concat(usageInfo.displayStyleIds.filter((id) => usedIdSet.has(id)));

        if (usageInfo.categorySelectorIds)
          viewRelatedIds = viewRelatedIds.concat(usageInfo.categorySelectorIds.filter((id) => usedIdSet.has(id)));

        if (usageInfo.modelSelectorIds)
          viewRelatedIds = viewRelatedIds.concat(usageInfo.modelSelectorIds.filter((id) => usedIdSet.has(id)));

        if (viewRelatedIds.length > 0) {
          const viewRelatedUsageInfo = this._iModel.nativeDb.queryDefinitionElementUsage(viewRelatedIds);
          if (viewRelatedUsageInfo) {
            const usedViewRelatedIdSet: Id64Set = viewRelatedUsageInfo.usedIds ? Id64.toIdSet(viewRelatedUsageInfo.usedIds) : new Set<Id64String>();
            try {
              this._iModel.nativeDb.beginPurgeOperation();
              deleteIfUnused(viewRelatedUsageInfo.displayStyleIds, usedViewRelatedIdSet);
              deleteIfUnused(viewRelatedUsageInfo.categorySelectorIds, usedViewRelatedIdSet);
              deleteIfUnused(viewRelatedUsageInfo.modelSelectorIds, usedViewRelatedIdSet);
            } finally {
              this._iModel.nativeDb.endPurgeOperation();
            }

            viewRelatedIds.forEach((id) => {
              if (!usedViewRelatedIdSet.has(id))
                usedIdSet.delete(id);
            });
          }
        }
      }

      return usedIdSet;
    }

    /** Query for the child elements of the specified element.
     * @returns Returns an array of child element identifiers.
     * @throws [[IModelError]]
     */
    public queryChildren(elementId: Id64String): Id64String[] {
      const sql = "SELECT ECInstanceId FROM BisCore:Element WHERE Parent.Id=:elementId";
      return this._iModel.withPreparedStatement(sql, (statement: ECSqlStatement): Id64String[] => {
        statement.bindId("elementId", elementId);
        const childIds: Id64String[] = [];
        while (DbResult.BE_SQLITE_ROW === statement.step()) {
          childIds.push(statement.getValue(0).getId());
        }
        return childIds;
      });
    }

    /** Query for the parent of the specified element.
     * @param elementId The element to check for a parent
     * @returns The identifier of the element's parent or undefined if the element has no parent
     * @throws [[IModelError]] if the element does not exist
     */
    public queryParent(elementId: Id64String): Id64String | undefined {
      return this._iModel.withPreparedStatement(`select parent.id from ${Element.classFullName} where ecinstanceid=?`, (stmt) => {
        stmt.bindId(1, elementId);
        if (stmt.step() !== DbResult.BE_SQLITE_ROW)
          throw new IModelError(IModelStatus.NotFound, `Element=${elementId}`);
        const value = stmt.getValue(0);
        return value.isNull ? undefined : value.getId();
      });
    }

    /** Returns true if the specified Element has a sub-model.
     * @see [[IModelDb.Models.getSubModel]]
     */
    public hasSubModel(elementId: Id64String): boolean {
      if (IModel.rootSubjectId === elementId)
        return false; // Special case since the RepositoryModel does not sub-model the root Subject

      // A sub-model will have the same Id value as the element it is describing
      const sql = "SELECT ECInstanceId FROM BisCore:Model WHERE ECInstanceId=:elementId";
      return this._iModel.withPreparedStatement(sql, (statement: ECSqlStatement): boolean => {
        statement.bindId("elementId", elementId);
        return DbResult.BE_SQLITE_ROW === statement.step();
      });
    }

    /** Get the root subject element. */
    public getRootSubject(): Subject { return this.getElement(IModel.rootSubjectId); }

    /** Query for aspects of a particular class (polymorphically) associated with this element.
     * @throws [[IModelError]]
     * @note Most cases should use the [[getAspects]] wrapper rather than calling this method directly.
     * @internal
     */
    public _queryAspects(elementId: Id64String, fromClassFullName: string, excludedClassFullNames?: Set<string>): ElementAspect[] { // eslint-disable-line @typescript-eslint/naming-convention
      const sql = `SELECT ECInstanceId,ECClassId FROM ${fromClassFullName} WHERE Element.Id=:elementId ORDER BY ECClassId,ECInstanceId`; // ORDER BY to maximize statement reuse
      return this._iModel.withPreparedStatement(sql, (statement: ECSqlStatement): ElementAspect[] => {
        statement.bindId("elementId", elementId);
        const aspects: ElementAspect[] = [];
        while (DbResult.BE_SQLITE_ROW === statement.step()) {
          const aspectInstanceId: Id64String = statement.getValue(0).getId();
          const aspectClassFullName: string = statement.getValue(1).getClassNameForClassId().replace(".", ":");
          if ((undefined === excludedClassFullNames) || (!excludedClassFullNames.has(aspectClassFullName))) {
            aspects.push(this._queryAspect(aspectInstanceId, aspectClassFullName));
          }
        }
        return aspects;
      });
    }

    /** Query for aspect by ECInstanceId
     * @throws [[IModelError]]
     */
    private _queryAspect(aspectInstanceId: Id64String, aspectClassName: string): ElementAspect {
      const sql = `SELECT * FROM ${aspectClassName} WHERE ECInstanceId=:aspectInstanceId`;
      const aspect: ElementAspectProps | undefined = this._iModel.withPreparedStatement(sql, (statement: ECSqlStatement): ElementAspectProps | undefined => {
        statement.bindId("aspectInstanceId", aspectInstanceId);
        if (DbResult.BE_SQLITE_ROW === statement.step()) {
          const aspectProps: ElementAspectProps = statement.getRow(); // start with everything that SELECT * returned
          aspectProps.classFullName = (aspectProps as any).className.replace(".", ":"); // add in property required by EntityProps
          (aspectProps as any).className = undefined; // clear property from SELECT * that we don't want in the final instance
          return aspectProps;
        }
        return undefined;
      });
      if (undefined === aspect) {
        throw new IModelError(IModelStatus.NotFound, `ElementAspect not found ${aspectInstanceId}, ${aspectClassName}`);
      }
      return this._iModel.constructEntity<ElementAspect>(aspect);
    }

    /** Get a single ElementAspect by its instance Id.
     * @throws [[IModelError]]
     */
    public getAspect(aspectInstanceId: Id64String): ElementAspect {
      const sql = "SELECT ECClassId FROM BisCore:ElementAspect WHERE ECInstanceId=:aspectInstanceId";
      const aspectClassFullName = this._iModel.withPreparedStatement(sql, (statement: ECSqlStatement): string | undefined => {
        statement.bindId("aspectInstanceId", aspectInstanceId);
        return (DbResult.BE_SQLITE_ROW === statement.step()) ? statement.getValue(0).getClassNameForClassId().replace(".", ":") : undefined;
      });
      if (undefined === aspectClassFullName) {
        throw new IModelError(IModelStatus.NotFound, `ElementAspect not found ${aspectInstanceId}`);
      }
      return this._queryAspect(aspectInstanceId, aspectClassFullName);
    }

    private static classMap = new Map<string, string>();

    private runInstanceQuery(sql: string, elementId: Id64String, excludedClassFullNames?: Set<string>): ElementAspect[] {
      return this._iModel.withPreparedStatement(sql, (statement: ECSqlStatement) => {
        statement.bindId("elementId", elementId);
        const aspects: ElementAspect[] = [];
        while (DbResult.BE_SQLITE_ROW === statement.step()) {
          const row: object = {};
          const parsedRow = JSON.parse(statement.getValue(0).getString());
          // eslint-disable-next-line guard-for-in
          for (const key in parsedRow) {
            const jsName = ECJsNames.toJsName(key[0].toUpperCase() + key.substring(1));
            Object.defineProperty(row, jsName, { enumerable: true, configurable: true, writable: true, value: parsedRow[key] });
          }
          const aspectProps: ElementAspectProps = row as any;
          aspectProps.classFullName = (aspectProps as any).className.replace(".", ":"); // add in property required by EntityProps
          (aspectProps as any).className = undefined; // clear property from SELECT $ that we don't want in the final instance
          if ((undefined === excludedClassFullNames) || !excludedClassFullNames.has(aspectProps.classFullName))
            aspects.push(this._iModel.constructEntity<ElementAspect>(aspectProps));
        }
        return aspects;
      });
    }

    /** Get the ElementAspect instances that are owned by the specified element.
     * @param elementId Get ElementAspects associated with this Element
     * @param aspectClassFullName Optionally filter ElementAspects polymorphically by this class name
     * @param excludedClassFullNames Optional filter to exclude aspects from classes in the given set.
     * @throws [[IModelError]]
     */
    public getAspects(elementId: Id64String, aspectClassFullName?: string, excludedClassFullNames?: Set<string>): ElementAspect[] {
      if (aspectClassFullName === undefined) {
        const allAspects: ElementAspect[] = this.runInstanceQuery(`SELECT $ FROM (
          SELECT ECInstanceId, ECClassId FROM Bis.ElementMultiAspect WHERE Element.Id = :elementId
            UNION ALL
          SELECT ECInstanceId, ECClassId FROM Bis.ElementUniqueAspect WHERE Element.Id = :elementId) OPTIONS USE_JS_PROP_NAMES DO_NOT_TRUNCATE_BLOB`, elementId, excludedClassFullNames);
        if (allAspects.length === 0)
          Logger.logError(BackendLoggerCategory.ECDb, `No aspects found for class ${aspectClassFullName} and element ${elementId}`);
        return allAspects;
      }

      // Check if class is abstract
      const fullClassName = aspectClassFullName.replace(".", ":").split(":");
      const val = this._iModel.nativeDb.getECClassMetaData(fullClassName[0], fullClassName[1]);
      if (val.result !== undefined) {
        const metaData = new EntityMetaData(JSON.parse(val.result));
        if (metaData.modifier !== "Abstract") // Class is not abstract, use normal query to retrieve aspects
          return this._queryAspects(elementId, aspectClassFullName, excludedClassFullNames);
      }
      // If class specified is abstract, get the list of all classes derived from it
      let classIdList = IModelDb.Elements.classMap.get(aspectClassFullName);
      if (classIdList === undefined) {
        const classIds: string[] = [];
        this._iModel.withPreparedStatement(`select SourceECInstanceId from meta.ClassHasAllBaseClasses where TargetECInstanceId = (select ECInstanceId from meta.ECClassDef where Name='${fullClassName[1]}'
        and Schema.Id = (select ECInstanceId from meta.ECSchemaDef where Name='${fullClassName[0]}')) and SourceECInstanceId != TargetECInstanceId`, (statement: ECSqlStatement) => {
          while (statement.step() === DbResult.BE_SQLITE_ROW)
            classIds.push(statement.getValue(0).getId());
        });
        if (classIds.length > 0) {
          classIdList = classIds.join(",");
          IModelDb.Elements.classMap.set(aspectClassFullName, classIdList);
        }
      }
      if (classIdList === undefined) {
        Logger.logError(BackendLoggerCategory.ECDb, `No aspects found for the class ${aspectClassFullName}`);
        return [];
      }
      // Execute an instance query to retrieve all aspects from all the derived classes
      const aspects: ElementAspect[] = this.runInstanceQuery(`SELECT $ FROM (
        SELECT ECInstanceId, ECClassId FROM Bis.ElementMultiAspect WHERE Element.Id = :elementId AND ECClassId IN (${classIdList})
          UNION ALL
        SELECT ECInstanceId, ECClassId FROM Bis.ElementUniqueAspect WHERE Element.Id = :elementId AND ECClassId IN (${classIdList})
        ) OPTIONS USE_JS_PROP_NAMES DO_NOT_TRUNCATE_BLOB`, elementId, excludedClassFullNames);
      if (aspects.length === 0)
        Logger.logError(BackendLoggerCategory.ECDb, `No aspects found for class ${aspectClassFullName} and element ${elementId}`);
      return aspects;
    }

    /** Insert a new ElementAspect into the iModel.
     * @param aspectProps The properties of the new ElementAspect.
     * @throws [[IModelError]] if unable to insert the ElementAspect.
     * @returns the id of the newly inserted aspect.
     * @note Aspect Ids may collide with element Ids, so don't put both in a container like Set or Map
     *       use [EntityReference]($common) for that instead.
     */
    public insertAspect(aspectProps: ElementAspectProps): Id64String {
      try {
        return this._iModel.nativeDb.insertElementAspect(aspectProps);
      } catch (err: any) {
        throw new IModelError(err.errorNumber, `Error inserting ElementAspect [${err.message}], class: ${aspectProps.classFullName}`);
      }
    }

    /** Update an exist ElementAspect within the iModel.
     * @param aspectProps The properties to use to update the ElementAspect.
     * @throws [[IModelError]] if unable to update the ElementAspect.
     */
    public updateAspect(aspectProps: ElementAspectProps): void {
      try {
        this._iModel.nativeDb.updateElementAspect(aspectProps);
      } catch (err: any) {
        throw new IModelError(err.errorNumber, `Error updating ElementAspect [${err.message}], id: ${aspectProps.id}`);
      }
    }

    /** Delete one or more ElementAspects from this iModel.
     * @param aspectInstanceIds The set of instance Ids of the ElementAspect(s) to be deleted
     * @throws [[IModelError]] if unable to delete the ElementAspect.
     */
    public deleteAspect(aspectInstanceIds: Id64Arg): void {
      const iModel = this._iModel;
      Id64.toIdSet(aspectInstanceIds).forEach((aspectInstanceId) => {
        try {
          iModel.nativeDb.deleteElementAspect(aspectInstanceId);
        } catch (err: any) {
          throw new IModelError(err.errorNumber, `Error deleting ElementAspect [${err.message}], id: ${aspectInstanceId}`);
        }
      });
    }
  }

  /** The collection of views in an [[IModelDb]].
   * @public
   */
  export class Views {
    /** @internal */
    public constructor(private _iModel: IModelDb) { }
    private static viewStoreProperty = { namespace: "itwinjs", name: "DefaultViewStore" };
    private _viewStore?: ViewStore.CloudAccess;
    public get hasViewStore(): boolean { return undefined !== this._viewStore; }

    /** @beta */
    public get viewStore(): ViewStore.CloudAccess {
      if (undefined === this._viewStore)
        throw new IModelError(IModelStatus.BadRequest, "No ViewStore available");
      return this._viewStore;
    }
    public set viewStore(viewStore: ViewStore.CloudAccess) {
      this._viewStore = viewStore;
    }
    /** @beta */
    public async accessViewStore(args: { userToken?: AccessToken, props?: CloudSqlite.ContainerProps, accessLevel?: BlobContainer.RequestAccessLevel }): Promise<ViewStore.CloudAccess> {
      let props = args.props;
      if (undefined === props) {
        const propsString = this._iModel.queryFilePropertyString(Views.viewStoreProperty);
        if (!propsString)
          throw new Error("iModel does not have a default ViewStore");

        props = JSON.parse(propsString) as CloudSqlite.ContainerProps;
      }
      const accessToken = await CloudSqlite.requestToken({
        ...props,
        userToken: args.userToken,
        accessLevel: args.accessLevel,
      });
      if (!this._viewStore)
        this._viewStore = new ViewStore.CloudAccess({ ...props, accessToken, iModel: this._iModel });

      this._viewStore.container.accessToken = accessToken;
      return this._viewStore;
    }

    /** @beta */
    public saveDefaultViewStore(arg: CloudSqlite.ContainerProps): void {
      const props = { baseUri: arg.baseUri, containerId: arg.containerId, storageType: arg.storageType }; // sanitize to only known properties
      this._iModel.saveFileProperty(Views.viewStoreProperty, JSON.stringify(props));
      this._iModel.saveChanges("update default ViewStore");
    }

    /** Query for the array of ViewDefinitionProps of the specified class and matching the specified IsPrivate setting.
     * @param className Query for view definitions of this class.
     * @param wantPrivate If true, include private view definitions.
     */
    public queryViewDefinitionProps(className: string = "BisCore.ViewDefinition", limit = IModelDb.defaultLimit, offset = 0, wantPrivate: boolean = false): ViewDefinitionProps[] {
      const where = (wantPrivate === false) ? "IsPrivate=FALSE" : "";
      const ids = this._iModel.queryEntityIds({ from: className, limit, offset, where });

      const props: ViewDefinitionProps[] = [];
      const imodel = this._iModel;
      ids.forEach((id) => {
        try {
          props.push(imodel.elements.getElementProps<ViewDefinitionProps>(id));
        } catch (err: any) { }
      });

      return props;
    }

    /** Default parameters for iterating/querying ViewDefinitions. Includes all subclasses of ViewDefinition, excluding only those marked 'private'. */
    public static readonly defaultQueryParams: ViewQueryParams = { from: "BisCore.ViewDefinition", where: "IsPrivate=FALSE" };

    /** Iterate all ViewDefinitions matching the supplied query.
     * @param params Specifies the query by which views are selected.
     * @param callback Function invoked for each ViewDefinition matching the query. Return false to terminate iteration, true to continue.
     * @returns true if all views were iterated, false if iteration was terminated early due to callback returning false.
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
        } catch (err: any) { }
      }

      return finished;
    }

    private loadViewData(viewId: ViewIdString, options?: ViewStateLoadProps): ViewStateProps {
      const iModel = this._iModel;
      const elements = iModel.elements;
      const loader = (() => {
        if (ViewStoreRpc.isViewStoreId(viewId)) {
          const reader = this.viewStore.reader;
          return {
            loadView: () => reader.getViewDefinitionSync({ viewId }),
            loadCategorySelector: (id: ViewIdString) => reader.getCategorySelectorSync({ id, bindings: options?.queryBindings?.categorySelector }),
            loadDisplayStyle: (id: ViewIdString) => reader.getDisplayStyleSync({ id, opts: options?.displayStyle }),
            loadModelSelector: (id: ViewIdString) => reader.getModelSelectorSync({ id, bindings: options?.queryBindings?.modelSelector }),
          };
        }
        return {
          loadView: () => elements.getElementProps<ViewDefinitionProps>(viewId),
          loadCategorySelector: (id: Id64String) => elements.getElementProps<CategorySelectorProps>(id),
          loadDisplayStyle: (id: Id64String) => elements.getElementProps<DisplayStyleProps>({ id, displayStyle: options?.displayStyle }),
          loadModelSelector: (id: Id64String) => elements.getElementProps<ModelSelectorProps>(id),
        };
      })();

      const props = {} as ViewStateProps;
      props.viewDefinitionProps = loader.loadView();
      props.categorySelectorProps = loader.loadCategorySelector(props.viewDefinitionProps.categorySelectorId);
      props.displayStyleProps = loader.loadDisplayStyle(props.viewDefinitionProps.displayStyleId);
      const modelSelectorId = (props.viewDefinitionProps as SpatialViewDefinitionProps).modelSelectorId;
      if (modelSelectorId !== undefined)
        props.modelSelectorProps = loader.loadModelSelector(modelSelectorId);

      const viewClass = iModel.getJsClass(props.viewDefinitionProps.classFullName);
      const baseModelId = (props.viewDefinitionProps as ViewDefinition2dProps).baseModelId;
      if (viewClass.is(SheetViewDefinition)) {
        props.sheetProps = elements.getElementProps<SheetProps>(baseModelId);
        props.sheetAttachments = Array.from(iModel.queryEntityIds({
          from: "BisCore.ViewAttachment",
          where: `Model.Id=${baseModelId}`,
        }));
      } else if (viewClass.is(DrawingViewDefinition)) {
        // Include information about the associated [[SectionDrawing]], if any.
        // NB: The SectionDrawing ECClass may not exist in the iModel's version of the BisCore ECSchema.
        const sectionDrawing = iModel.elements.tryGetElement<SectionDrawing>(baseModelId);
        if (sectionDrawing && sectionDrawing.spatialView && Id64.isValidId64(sectionDrawing.spatialView.id)) {
          props.sectionDrawing = {
            spatialView: sectionDrawing.spatialView.id,
            displaySpatialView: true === sectionDrawing.jsonProperties.displaySpatialView,
            drawingToSpatialTransform: sectionDrawing.jsonProperties.drawingToSpatialTransform,
          };
        }
      }
      return props;
    }

    /** @deprecated in 3.x. use [[getViewStateProps]]. */
    public getViewStateData(viewDefinitionId: ViewIdString, options?: ViewStateLoadProps): ViewStateProps {
      const viewStateData = this.loadViewData(viewDefinitionId, options);
      const baseModelId = (viewStateData.viewDefinitionProps as ViewDefinition2dProps).baseModelId;
      if (baseModelId) {
        const drawingExtents = Range3d.fromJSON(this._iModel.nativeDb.queryModelExtents({ id: baseModelId }).modelExtents);
        if (!drawingExtents.isNull)
          viewStateData.modelExtents = drawingExtents.toJSON();
      }
      return viewStateData;
    }

    /** Obtain a [ViewStateProps]($common) for a [[ViewDefinition]] specified by ViewIdString. */
    public async getViewStateProps(viewDefinitionId: ViewIdString, options?: ViewStateLoadProps): Promise<ViewStateProps> {
      const viewStateData = this.loadViewData(viewDefinitionId, options);
      const baseModelId = (viewStateData.viewDefinitionProps as ViewDefinition2dProps).baseModelId;
      if (baseModelId) {
        const drawingExtents = await this._iModel.models.queryRange(baseModelId);
        if (!drawingExtents.isNull)
          viewStateData.modelExtents = drawingExtents.toJSON();
      }
      return viewStateData;
    }

    private getViewThumbnailArg(viewDefinitionId: ViewIdString): FilePropertyProps {
      if (!Id64.isValid(viewDefinitionId))
        throw new Error("illegal thumbnail id");

      return { namespace: "dgn_View", name: "Thumbnail", id: viewDefinitionId };
    }

    /** Get the thumbnail for a view.
     * @param viewDefinitionId The Id of the view for thumbnail
     * @returns the ThumbnailProps, or undefined if no thumbnail exists.
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
      this._iModel.nativeDb.saveFileProperty(viewArg, JSON.stringify(props), thumbnail.image);
      return 0;
    }

    /** Set the default view property the iModel.
     * @param viewId The Id of the ViewDefinition to use as the default
     * @deprecated in 4.2.x. Avoid setting this property - it is not practical for one single view to serve the needs of the many applications
     * that might wish to view the contents of the iModel.
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
    public async requestTileTreeProps(id: string): Promise<IModelTileTreeProps> {

      return new Promise<IModelTileTreeProps>((resolve, reject) => {
        this._iModel.nativeDb.getTileTree(id, (ret: IModelJsNative.ErrorStatusOrResult<IModelStatus, any>) => {
          if (undefined !== ret.error)
            reject(new IModelError(ret.error.status, `TreeId=${id}`));
          else
            resolve(ret.result as IModelTileTreeProps);
        });
      });
    }

    private pollTileContent(resolve: (arg0: IModelJsNative.TileContent) => void, reject: (err: unknown) => void, treeId: string, tileId: string) {

      let ret;
      try {
        ret = this._iModel.nativeDb.pollTileContent(treeId, tileId);
      } catch (err) {
        // Typically "imodel not open".
        reject(err);
        return;
      }

      if (ret.error) {
        reject(new IModelError(ret.error.status, `TreeId=${treeId} TileId=${tileId}`));
      } else if (ret.result && typeof ret.result !== "number") { // if type is not a number, it's the TileContent interface
        const res = ret.result;
        const iModelId = this._iModel.iModelId;

        const tileSizeThreshold = IModelHost.logTileSizeThreshold;
        const tileSize = res.content.length;
        if (tileSize > tileSizeThreshold) {
          Logger.logWarning(loggerCategory, "Tile size (in bytes) larger than specified threshold", () => ({ tileSize, tileSizeThreshold, treeId, tileId, iModelId }));
        }

        const loadTimeThreshold = IModelHost.logTileLoadTimeThreshold;
        const loadTime = res.elapsedSeconds;
        if (loadTime > loadTimeThreshold) {
          Logger.logWarning(loggerCategory, "Tile load time (in seconds) greater than specified threshold", () => ({ loadTime, loadTimeThreshold, treeId, tileId, iModelId }));
        }

        resolve(res);
      } else { // if the type is a number, it's the TileContentState enum
        // ###TODO: Decide appropriate timeout interval. May want to switch on state (new vs loading vs pending)
        setTimeout(() => this.pollTileContent(resolve, reject, treeId, tileId), 10);
      }
    }

    /** @internal */
    public async requestTileContent(treeId: string, tileId: string): Promise<IModelJsNative.TileContent> {
      return new Promise<IModelJsNative.TileContent>((resolve, reject) => {
        this.pollTileContent(resolve, reject, treeId, tileId);
      });
    }

    /** @internal */
    public async getTileContent(treeId: string, tileId: string): Promise<Uint8Array> {
      const ret = await new Promise<IModelJsNative.ErrorStatusOrResult<any, Uint8Array>>((resolve) => {
        this._iModel.nativeDb.getTileContent(treeId, tileId, resolve);
      });

      if (undefined !== ret.error) {
        throw new IModelError(ret.error.status, `TreeId=${treeId} TileId=${tileId}`);
      }

      assert(undefined !== ret.result);
      return ret.result;
    }
  }
}

/**
 * Argument to a function that can accept a valid access token.
 * @public
 */
export interface TokenArg {
  /** If present, the access token for the requested operation. If not present, use [[IModelHost.getAccessToken]] */
  readonly accessToken?: AccessToken;
}

/** Augments a [[SnapshotDbOpenArgs]] or [[OpenBriefcaseArgs]] with a [CloudContainer]($docs/learning/backend/Workspace.md).
 * The properties are this interface are reserved for internal use only.
 * @public
 */
export interface CloudContainerArgs {
  /** @internal */
  container?: CloudSqlite.CloudContainer;
}

/** Options to open a [SnapshotDb]($backend).
 * @public
 */
export type SnapshotDbOpenArgs = SnapshotOpenOptions & CloudContainerArgs & OpenSqliteArgs;

/**
 * Arguments to open a BriefcaseDb
 * @public
 */
export type OpenBriefcaseArgs = OpenBriefcaseProps & CloudContainerArgs & OpenSqliteArgs;

/**
 * A local copy of an iModel from iModelHub that can pull and potentially push changesets.
 * BriefcaseDb raises a set of events to allow apps and subsystems to track its object life cycle, including [[onOpen]] and [[onOpened]].
 * @public
 */
export class BriefcaseDb extends IModelDb {
  /** Manages local changes to this briefcase. */
  public readonly txns: TxnManager = new TxnManager(this);

  /** override superclass method */
  public override get isBriefcase(): boolean { return true; }

  /* the BriefcaseId of the briefcase opened with this BriefcaseDb */
  public readonly briefcaseId: BriefcaseId;

  /**
   * Event raised just before a BriefcaseDb is opened. Supplies the arguments that will be used to open the BriefcaseDb.
   * Throw an exception to stop the open.
   *
   * **Example:**
   * ``` ts
   * [[include:BriefcaseDb.onOpen]]
   * ```
   */
  public static readonly onOpen = new BeEvent<(_args: OpenBriefcaseArgs) => void>();

  /**
   * Event raised just after a BriefcaseDb is opened. Supplies the newly opened BriefcaseDb and the arguments that were used to open it.
   *
   * **Example:**
   * ``` ts
   * [[include:BriefcaseDb.onOpened]]
   * ```
   */
  public static readonly onOpened = new BeEvent<(_iModelDb: BriefcaseDb, _args: OpenBriefcaseArgs) => void>();

  /** Event raised after a BriefcaseDb has been closed. */
  public readonly onClosed = new BeEvent<() => void>();

  /** @alpha */
  public static readonly onCodeServiceCreated = new BeEvent<(briefcase: BriefcaseDb) => void>();

  public static override findByKey(key: string): BriefcaseDb {
    return super.findByKey(key) as BriefcaseDb;
  }

  public static override tryFindByKey(key: string): BriefcaseDb | undefined {
    const db = super.tryFindByKey(key);
    return db?.isBriefcaseDb() ? db : undefined;
  }

  /**
   * The Guid that identifies the *context* that owns this iModel.
   * GuidString | undefined for the superclass, but required for BriefcaseDb
   * */
  public override get iTwinId(): GuidString { return super.iTwinId!; } // eslint-disable-line @typescript-eslint/no-non-null-assertion

  /**
   * Determine whether this BriefcaseDb should use a lock server.
   * All must be true:
   * - file is open for write
   * - has an assigned briefcaseId
   * - the "no locking" flag is not present. This is a property of an iModel, established when the iModel is created in IModelHub.
   */
  protected get useLockServer(): boolean {
    return !this.isReadonly && (this.briefcaseId !== BriefcaseIdValue.Unassigned) && (undefined === this.nativeDb.queryLocalValue(BriefcaseLocalValue.NoLocking));
  }

  protected constructor(args: { nativeDb: IModelJsNative.DgnDb, key: string, openMode: OpenMode, briefcaseId: number }) {
    super({ ...args, changeset: args.nativeDb.getCurrentChangeset() });
    this._openMode = args.openMode;
    this.briefcaseId = args.briefcaseId;

    if (this.useLockServer) // if the iModel uses a lock server, create a ServerBasedLocks LockControl for this BriefcaseDb.
      this._locks = new ServerBasedLocks(this);
  }

  /** Upgrades the profile or domain schemas. File must be closed before this call and is always left closed. */
  private static async doUpgrade(briefcase: OpenBriefcaseArgs, upgradeOptions: UpgradeOptions, description: string): Promise<void> {
    const nativeDb = this.openDgnDb({ path: briefcase.fileName }, OpenMode.ReadWrite, upgradeOptions); // performs the upgrade
    const wasChanges = nativeDb.hasPendingTxns();
    nativeDb.closeFile();

    if (wasChanges)
      await withBriefcaseDb(briefcase, async (db) => db.pushChanges({ ...briefcase, description, retainLocks: true }));
  }

  /** Upgrades the schemas in the iModel based on the current version of the software. Follows a sequence of operations -
   * * Acquires a schema lock to prevent other users from making any other changes while upgrade is happening
   * * Updates the local briefcase with the schema changes.
   * * Pushes the resulting changeset(s) to iModelHub.
   * Note that the upgrade requires that the local briefcase be closed, and may result in one or two change sets depending on whether both
   * profile and domain schemas need to get upgraded.
   * @see ($docs/learning/backend/IModelDb.md#upgrading-schemas-in-an-imodel)
  */
  public static async upgradeSchemas(briefcase: OpenBriefcaseArgs): Promise<void> {
    // upgrading schemas involves closing and reopening the file repeatedly. That's because the process of upgrading
    // happens on a file open. We have to open-and-close the file at *each* of these steps:
    // - acquire schema lock
    // - upgrade profile
    // - push changes
    // - upgrade domain
    // - push changes
    // - release schema lock
    // good thing computers are fast. Fortunately upgrading should be rare (and the push time will dominate anyway.) Don't try to optimize any of this away.
    await withBriefcaseDb(briefcase, async (db) => db.acquireSchemaLock()); // may not really acquire lock if iModel uses "noLocks" mode.
    try {
      await this.doUpgrade(briefcase, { profile: ProfileOptions.Upgrade, schemaLockHeld: true }, "Upgraded profile");
      await this.doUpgrade(briefcase, { domain: DomainOptions.Upgrade, schemaLockHeld: true }, "Upgraded domain schemas");
    } finally {
      await withBriefcaseDb(briefcase, async (db) => db.locks.releaseAllLocks());
    }
  }

  /** Open a briefcase file and return a new BriefcaseDb to interact with it.
   * @param args parameters that specify the file name, and options for opening the briefcase file
   */
  public static async open(args: OpenBriefcaseArgs): Promise<BriefcaseDb> {
    this.onOpen.raiseEvent(args);

    const file = { path: args.fileName, key: args.key };
    const openMode = (args.readonly || args.watchForChanges) ? OpenMode.Readonly : OpenMode.ReadWrite;
    const nativeDb = this.openDgnDb(file, openMode, undefined, args);
    const briefcaseDb = new BriefcaseDb({ nativeDb, key: file.key ?? Guid.createValue(), openMode, briefcaseId: nativeDb.getBriefcaseId() });

    // If they asked to watch for changes, set an fs.watch on the "-watch" file (only it is modified while we hold this connection.)
    // Whenever there are changes, restart our defaultTxn. That loads the changes from the other connection and sends
    // notifications as if they happened on this connection. Note: the watcher is called only when the backend event loop cycles.
    if (args.watchForChanges && undefined === args.container) {
      // Must touch the file synchronously - cannot watch a file until it exists.
      touch.sync(briefcaseDb.watchFilePathName);

      // Restart default txn to trigger events when watch file is changed by some other process.
      const watcher = fs.watch(briefcaseDb.watchFilePathName, { persistent: false }, () => {
        nativeDb.restartDefaultTxn();
      });

      // Stop the watcher when we close this connection.
      briefcaseDb.onBeforeClose.addOnce(() => {
        watcher.close();
      });
    }

    if (openMode === OpenMode.ReadWrite && CodeService.createForIModel) {
      try {
        briefcaseDb._codeService = await CodeService.createForIModel(briefcaseDb);
        this.onCodeServiceCreated.raiseEvent(briefcaseDb);
      } catch (e: any) {
        if ((e as CodeService.Error).errorId !== "NoCodeIndex") // no code index means iModel isn't enforcing codes.
          throw e;
      }
    }

    this.onOpened.raiseEvent(briefcaseDb, args);
    return briefcaseDb;
  }

  /* This is called by native code when applying a changeset */
  private onChangesetConflict(args: ChangesetConflictArgs): DbConflictResolution | undefined {
    // returning undefined will result in native handler to resolve conflict

    const category = "DgnCore";
    const interpretConflictCause = (cause: DbConflictCause) => {
      switch (cause) {
        case DbConflictCause.Data:
          return "data";
        case DbConflictCause.NotFound:
          return "not found";
        case DbConflictCause.Conflict:
          return "conflict";
        case DbConflictCause.Constraint:
          return "constraint";
        case DbConflictCause.ForeignKey:
          return "foreign key";
      }
    };

    if (args.cause === DbConflictCause.Data && !args.indirect) {
      /*
      * From SQLite Docs CHANGESET_DATA as the second argument
      * when processing a DELETE or UPDATE change if a row with the required
      * PRIMARY KEY fields is present in the database, but one or more other
      * (non primary-key) fields modified by the update do not contain the
      * expected "before" values.
      *
      * The conflicting row, in this case, is the database row with the matching
      * primary key.
      *
      * Another reason this will be invoked is when SQLITE_CHANGESETAPPLY_FKNOACTION
      * is passed ApplyChangeset(). The flag will disable CASCADE action and treat
      * them as CASCADE NONE resulting in conflict handler been called.
      */
      if (!this.txns.hasPendingTxns) {
        // This changeset is bad. However, it is already in the timeline. We must allow services such as
        // checkpoint-creation, change history, and other apps to apply any changeset that is in the timeline.
        Logger.logWarning(category, "UPDATE/DELETE before value do not match with one in db or CASCADE action was triggered.");
        args.dump();
      } else {
        const msg = "UPDATE/DELETE before value do not match with one in db or CASCADE action was triggered.";
        args.setLastError(msg);
        Logger.logError(category, msg);
        args.dump();
        return DbConflictResolution.Abort;
      }
    }

    // Handle some special cases
    if (args.cause === DbConflictCause.Conflict) {
      // From the SQLite docs: "CHANGESET_CONFLICT is passed as the second argument to the conflict handler while processing an INSERT change if the operation would result in duplicate primary key values."
      // This is always a fatal error - it can happen only if the app started with a briefcase that is behind the tip and then uses the same primary key values (e.g., ElementIds)
      // that have already been used by some other app using the SAME briefcase ID that recently pushed changes. That can happen only if the app makes changes without first pulling and acquiring locks.
      if (!this.txns.hasPendingTxns) {
        // This changeset is bad. However, it is already in the timeline. We must allow services such as
        // checkpoint-creation, change history, and other apps to apply any changeset that is in the timeline.
        Logger.logWarning(category, "PRIMARY KEY INSERT CONFLICT - resolved by replacing the existing row with the incoming row");
        args.dump();
      } else {
        const msg = "PRIMARY KEY INSERT CONFLICT - rejecting this changeset";
        args.setLastError(msg);
        Logger.logError(category, msg);
        args.dump();
        return DbConflictResolution.Abort;
      }
    }

    if (args.cause === DbConflictCause.ForeignKey) {
      // Note: No current or conflicting row information is provided if it's a FKey conflict
      // Since we abort on FKey conflicts, always try and provide details about the error
      const nConflicts = args.getForeignKeyConflicts();

      // Note: There is no performance implication of follow code as it happen toward end of
      // apply_changeset only once so we be querying value for 'DebugAllowFkViolations' only once.
      if (this.nativeDb.queryLocalValue("DebugAllowFkViolations")) {
        Logger.logError(category, `Detected ${nConflicts} foreign key conflicts in changeset. Continuing merge as 'DebugAllowFkViolations' flag is set. Run 'PRAGMA foreign_key_check' to get list of violations.`);
        return DbConflictResolution.Skip;
      } else {
        const msg = `Detected ${nConflicts} foreign key conflicts in ChangeSet. Aborting merge.`;
        args.setLastError(msg);
        return DbConflictResolution.Abort;
      }
    }

    if (args.cause === DbConflictCause.NotFound) {
      /*
       * Note: If DbConflictCause = NotFound, the primary key was not found, and returning DbConflictResolution::Replace is
       * not an option at all - this will cause a BE_SQLITE_MISUSE error.
       */
      return DbConflictResolution.Skip;
    }

    if (args.cause === DbConflictCause.Constraint) {
      if (Logger.isEnabled(category, LogLevel.Info)) {
        Logger.logInfo(category, "------------------------------------------------------------------");
        Logger.logInfo(category, `Conflict detected - Cause: ${interpretConflictCause(args.cause)}`);
        args.dump();
      }

      Logger.logWarning(category, "Constraint conflict handled by rejecting incoming change. Constraint conflicts are NOT expected. These happen most often when two clients both insert elements with the same code. That indicates a bug in the client or the code server.");
      return DbConflictResolution.Skip;
    }

    /*
     * If we don't have a control, we always accept the incoming revision in cases of conflicts:
     *
     * + In a briefcase with no local changes, the state of a row in the Db (i.e., the final state of a previous revision)
     *   may not exactly match the initial state of the incoming revision. This will cause a conflict.
     *      - The final state of the incoming (later) revision will always be setup exactly right to accommodate
     *        cases where dependency handlers won't be available (for instance on the server), and we have to rely on
     *        the revision to correctly set the final state of the row in the Db. Therefore it's best to resolve the
     *        conflict in favor of the incoming change.
     * + In a briefcase with local changes, the state of relevant dependent properties (due to propagated indirect changes)
     *   may not correspond with the initial state of these properties in an incoming revision. This will cause a conflict.
     *      - Resolving the conflict in favor of the incoming revision may cause some dependent properties to be set
     *        incorrectly, but the dependency handlers will run anyway and set this right. The new changes will be part of
     *        a subsequent revision generated from that briefcase.
     *
     * + Note that conflicts can NEVER happen between direct changes made locally and direct changes in the incoming revision.
     *      - Only one user can make a direct change at one time, and the next user has to pull those changes before getting a
     *        lock to the same element
     *
     * + Also see comments in TxnManager::MergeDataChanges()
     */
    if (Logger.isEnabled(category, LogLevel.Info)) {
      Logger.logInfo(category, "------------------------------------------------------------------");
      Logger.logInfo(category, `Conflict detected - Cause: ${interpretConflictCause(args.cause)}`);
      args.dump();
      Logger.logInfo(category, "Conflicting resolved by replacing the existing entry with the change");
    }
    return DbConflictResolution.Replace;
  }

  /** If the briefcase is read-only, reopen the native briefcase for writing.
   * Execute the supplied function.
   * If the briefcase was read-only, reopen the native briefcase as read-only.
   * @note this._openMode is not changed from its initial value.
   * @internal Exported strictly for tests.
   */
  public async executeWritable(func: () => Promise<void>): Promise<void> {
    const fileName = this.pathName;

    try {
      if (this.isReadonly)
        this.closeAndReopen(OpenMode.ReadWrite, fileName);

      await func();
    } finally {
      if (this.isReadonly)
        this.closeAndReopen(OpenMode.Readonly, fileName);
    }
  }

  private closeAndReopen(openMode: OpenMode, fileName: string) {
    // Unclosed statements will produce BUSY error when attempting to close.
    this.clearCaches();

    // The following resets the native db's pointer to this JavaScript object.
    this.nativeDb.closeFile();
    this.nativeDb.openIModel(fileName, openMode);

    // Restore the native db's pointer to this JavaScript object.
    this.nativeDb.setIModelDb(this);
  }

  /** Pull and apply changesets from iModelHub */
  public async pullChanges(arg?: PullChangesArgs): Promise<void> {
    await this.executeWritable(async () => {
      await BriefcaseManager.pullAndApplyChangesets(this, arg ?? {});
      this.initializeIModelDb();
    });

    IpcHost.notifyTxns(this, "notifyPulledChanges", this.changeset as ChangesetIndexAndId);
  }

  /** Push changes to iModelHub. */
  public async pushChanges(arg: PushChangesArgs): Promise<void> {
    if (this.briefcaseId === BriefcaseIdValue.Unassigned)
      return;

    if (this.nativeDb.hasUnsavedChanges())
      throw new IModelError(ChangeSetStatus.HasUncommittedChanges, "Cannot push with unsaved changes");
    if (!this.nativeDb.hasPendingTxns())
      return; // nothing to push

    await BriefcaseManager.pullMergePush(this, arg);
    this.initializeIModelDb();

    const changeset = this.changeset as ChangesetIndexAndId;
    IpcHost.notifyTxns(this, "notifyPushedChanges", changeset);
  }

  public override close() {
    super.close();
    this.onClosed.raiseEvent();
  }
}

/** Used to reattach Daemon from a user's accessToken for V2 checkpoints.
 * @note Reattach only happens if the previous access token either has expired or is about to expire within an application-supplied safety duration.
 */
class RefreshV2CheckpointSas {
  /** the time at which the current token should be refreshed (its expiry minus safetySeconds) */
  private _timestamp = 0;
  /** while a refresh is happening, all callers get this promise. */
  private _promise: Promise<void> | undefined;
  /** Time, in seconds, before the current token expires to obtain a new token. Default is 1 hour. */
  private _safetySeconds: number;

  constructor(sasToken: string, safetySeconds?: number) {
    this._safetySeconds = safetySeconds ?? 60 * 60; // default to 1 hour
    this.setTimestamp(sasToken);
  }

  private async performRefresh(accessToken: AccessToken, iModel: IModelDb): Promise<void> {
    this._timestamp = 0; // everyone needs to wait until token is valid

    // we're going to request that the checkpoint manager use this user's accessToken to obtain a new access token for this checkpoint's storage account.
    Logger.logInfo(BackendLoggerCategory.Authorization, "attempting to refresh sasToken for checkpoint");
    try {
      // this exchanges the supplied user accessToken for an expiring blob-store token to read the checkpoint.
      const container = iModel.nativeDb.cloudContainer;
      if (!container)
        throw new Error("checkpoint is not from a cloud container");

      assert(undefined !== iModel.iTwinId);
      const props = await IModelHost.hubAccess.queryV2Checkpoint({ accessToken, iTwinId: iModel.iTwinId, iModelId: iModel.iModelId, changeset: iModel.changeset });
      if (!props)
        throw new Error("can't reset checkpoint sas token");

      container.accessToken = props.sasToken;
      this.setTimestamp(props.sasToken);

      Logger.logInfo(BackendLoggerCategory.Authorization, "refreshed checkpoint sasToken successfully");
    } finally {
      this._promise = undefined;
    }
  }

  private setTimestamp(sasToken: string) {
    const exp = new URLSearchParams(sasToken).get("se");
    const sasTokenExpiry = exp ? Date.parse(exp) : 0;
    this._timestamp = sasTokenExpiry - (this._safetySeconds * 1000);
    if (this._timestamp < Date.now())
      Logger.logError(BackendLoggerCategory.Authorization, "attached with timestamp that expires before safety interval");
  }

  public async refreshSas(accessToken: AccessToken, iModel: IModelDb): Promise<void> {
    if (this._timestamp > Date.now())
      return; // current token is fine

    if (undefined === this._promise) // has reattach already begun?
      this._promise = this.performRefresh(accessToken, iModel); // no, start it

    return this._promise;
  }

}
/** A *snapshot* iModel database file that is used for archival and data transfer purposes.
 * @see [Snapshot iModels]($docs/learning/backend/AccessingIModels.md#snapshot-imodels)
 * @see [About IModelDb]($docs/learning/backend/IModelDb.md)
 * @public
 */
export class SnapshotDb extends IModelDb {
  public override get isSnapshot() { return true; }
  private _refreshSas: RefreshV2CheckpointSas | undefined;
  /** Timer used to restart the default txn on the SnapshotDb after some inactivity. This is only used for checkpoints.
   *  Restarting the default txn lets CloudSqlite know that any blocks that may have been read may now be ejected.
   *  Without restarting the default txn, CloudSQLite can get into a state where it can not evict any blocks to make space for more blocks.
   */
  private _restartDefaultTxnTimer?: NodeJS.Timeout;
  private _createClassViewsOnClose?: boolean;
  public static readonly onOpen = new BeEvent<(path: LocalFileName, opts?: SnapshotDbOpenArgs) => void>();
  public static readonly onOpened = new BeEvent<(_iModelDb: SnapshotDb) => void>();

  private constructor(nativeDb: IModelJsNative.DgnDb, key: string) {
    super({ nativeDb, key, changeset: nativeDb.getCurrentChangeset() });
    this._openMode = nativeDb.isReadonly() ? OpenMode.Readonly : OpenMode.ReadWrite;
  }

  public static override findByKey(key: string): SnapshotDb {
    return super.findByKey(key) as SnapshotDb;
  }

  public static override tryFindByKey(key: string): SnapshotDb | undefined {
    const db = super.tryFindByKey(key);
    return db?.isSnapshotDb() ? db : undefined;
  }

  /** Create an *empty* local [Snapshot]($docs/learning/backend/AccessingIModels.md#snapshot-imodels) iModel file.
   * Snapshots are not synchronized with iModelHub, so do not have a change timeline.
   * > Note: A *snapshot* cannot be modified after [[close]] is called.
   * @param filePath The file that will contain the new iModel *snapshot*
   * @param options The parameters that define the new iModel *snapshot*
   * @returns A writeable SnapshotDb
   * @see [Snapshot iModels]($docs/learning/backend/AccessingIModels.md#snapshot-imodels)
   */
  public static createEmpty(filePath: LocalFileName, options: CreateEmptySnapshotIModelProps): SnapshotDb {
    const nativeDb = new IModelHost.platform.DgnDb();
    nativeDb.createIModel(filePath, options);
    nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);

    const snapshotDb = new SnapshotDb(nativeDb, Guid.createValue());
    if (options.createClassViews)
      snapshotDb._createClassViewsOnClose = true; // save flag that will be checked when close() is called
    return snapshotDb;
  }

  /** Create a local [Snapshot]($docs/learning/backend/AccessingIModels.md#snapshot-imodels) iModel file, using this iModel as a *seed* or starting point.
   * Snapshots are not synchronized with iModelHub, so do not have a change timeline.
   * > Note: A *snapshot* cannot be modified after [[close]] is called.
   * @param iModelDb The snapshot will be initialized from the current contents of this iModelDb
   * @param snapshotFile The file that will contain the new iModel *snapshot*
   * @param options Optional properties that determine how the snapshot iModel is created.
   * @returns A writeable SnapshotDb
   * @see [Snapshot iModels]($docs/learning/backend/AccessingIModels.md#snapshot-imodels)
   */
  public static createFrom(iModelDb: IModelDb, snapshotFile: string, options?: CreateSnapshotIModelProps): SnapshotDb {
    iModelDb.performCheckpoint();
    IModelJsFs.copySync(iModelDb.pathName, snapshotFile);

    const nativeDb = new IModelHost.platform.DgnDb();
    nativeDb.openIModel(snapshotFile, OpenMode.ReadWrite, undefined, options);
    nativeDb.vacuum();

    // Replace iModelId if seedFile is a snapshot, preserve iModelId if seedFile is an iModelHub-managed briefcase
    if (!BriefcaseManager.isValidBriefcaseId(nativeDb.getBriefcaseId()))
      nativeDb.setIModelId(Guid.createValue());

    nativeDb.deleteLocalValue(BriefcaseLocalValue.StandaloneEdit);
    nativeDb.saveChanges();
    nativeDb.deleteAllTxns();
    nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);

    const snapshotDb = new SnapshotDb(nativeDb, Guid.createValue());
    if (options?.createClassViews)
      snapshotDb._createClassViewsOnClose = true; // save flag that will be checked when close() is called

    return snapshotDb;
  }

  /** open this SnapshotDb read/write, strictly to apply incoming changesets. Used for creating new checkpoints.
   * @internal
   */
  public static openForApplyChangesets(path: LocalFileName, props?: SnapshotDbOpenArgs): SnapshotDb {
    const file = { path, key: props?.key };
    const nativeDb = this.openDgnDb(file, OpenMode.ReadWrite, undefined, props);
    assert(undefined !== file.key);
    return new SnapshotDb(nativeDb, file.key);
  }

  /** Open a read-only iModel *snapshot*.
   * @param path the full path of the snapshot iModel file to open.
   * @param props options for opening snapshot
   * @see [[close]]
   * @throws [[IModelError]] If the file is not found or is not a valid *snapshot*.
   */
  public static openFile(path: LocalFileName, opts?: SnapshotDbOpenArgs): SnapshotDb {
    this.onOpen.raiseEvent(path, opts);
    const file = { path, key: opts?.key };
    const nativeDb = this.openDgnDb(file, OpenMode.Readonly, undefined, opts);
    assert(undefined !== file.key);
    const db = new SnapshotDb(nativeDb, file.key);
    this.onOpened.raiseEvent(db);
    return db;
  }

  private static async attachAndOpenCheckpoint(checkpoint: CheckpointProps): Promise<SnapshotDb> {
    const { dbName, container } = await V2CheckpointManager.attach(checkpoint);
    const key = CheckpointManager.getKey(checkpoint);
    return SnapshotDb.openFile(dbName, { key, container });
  }

  /** @internal */
  public static async openCheckpointFromRpc(checkpoint: CheckpointProps): Promise<SnapshotDb> {
    const snapshot = await this.attachAndOpenCheckpoint(checkpoint);
    snapshot._iTwinId = checkpoint.iTwinId;
    try {
      CheckpointManager.validateCheckpointGuids(checkpoint, snapshot);
    } catch (err: any) {
      snapshot.close();
      throw err;
    }

    // unref timer, so it doesn't prevent a process from shutting down.
    snapshot._restartDefaultTxnTimer = setTimeout(() => {
      snapshot.restartDefaultTxn();
    }, (10 * 60) * 1000).unref(); // 10 minutes
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    snapshot._refreshSas = new RefreshV2CheckpointSas(snapshot.nativeDb.cloudContainer!.accessToken, checkpoint.reattachSafetySeconds);
    return snapshot;
  }

  /**
   * Open a Checkpoint directly from its cloud container.
   * @beta
   */
  public static async openCheckpoint(args: OpenCheckpointArgs): Promise<SnapshotDb> {
    return this.attachAndOpenCheckpoint(await CheckpointManager.toCheckpointProps(args));
  }

  /** Used to refresh the container sasToken using the current user's accessToken.
   * Also restarts the timer which causes the default txn to be restarted on db if the timer activates.
   * @internal
   */
  public override async refreshContainerForRpc(userAccessToken: AccessToken): Promise<void> {
    this._restartDefaultTxnTimer?.refresh();
    return this._refreshSas?.refreshSas(userAccessToken, this);
  }

  /** @internal */
  public override beforeClose(): void {
    super.beforeClose();

    if (this._restartDefaultTxnTimer)
      clearTimeout(this._restartDefaultTxnTimer);

    if (this._createClassViewsOnClose) { // check for flag set during create
      if (BentleyStatus.SUCCESS !== this.nativeDb.createClassViewsInDb()) {
        throw new IModelError(IModelStatus.SQLiteError, "Error creating class views");
      } else {
        this.saveChanges();
      }
    }
  }
}

/**
 * Standalone iModels are read/write files that are not associated with an iTwin or managed by iModelHub.
 * They are relevant only for testing, or for small-scale single-user scenarios.
 * Standalone iModels are designed such that the API for Standalone iModels and Briefcase
 * iModels (those synchronized with iModelHub) are as similar and consistent as possible.
 * This leads to a straightforward process where the a user starts with StandaloneDb and can
 * optionally choose to upgrade to an iTwin.
 *
 * Some additional details. Standalone iModels:
 * - always have [Guid.empty]($bentley) for their iTwinId (they are "unassociated" files)
 * - always have BriefcaseId === [BriefcaseIdValue.Unassigned]($common)
 * - are connected to the frontend via [BriefcaseConnection.openStandalone]($frontend)
 * - may be opened without supplying any user credentials
 * - may be opened read/write
 * - cannot apply a changeset to nor generate a changesets (since there is no timeline from which to get/push changesets)
 * @public
 */
export class StandaloneDb extends BriefcaseDb {
  public override get isStandalone(): boolean { return true; }
  protected override get useLockServer() { return false; } // standalone iModels have no lock server
  public static override findByKey(key: string): StandaloneDb {
    return super.findByKey(key) as StandaloneDb;
  }

  public static override tryFindByKey(key: string): StandaloneDb | undefined {
    const db = super.tryFindByKey(key);
    return db?.isStandaloneDb() ? db : undefined;
  }

  /** Create an *empty* standalone iModel.
   * @param filePath The file path for the iModel
   * @param args The parameters that define the new iModel
   */
  public static createEmpty(filePath: LocalFileName, args: CreateEmptyStandaloneIModelProps): StandaloneDb {
    const nativeDb = new IModelHost.platform.DgnDb();
    nativeDb.createIModel(filePath, args);
    nativeDb.saveLocalValue(BriefcaseLocalValue.StandaloneEdit, args.allowEdit);
    nativeDb.setITwinId(Guid.empty);
    nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
    nativeDb.saveChanges();
    return new StandaloneDb({ nativeDb, key: Guid.createValue(), briefcaseId: BriefcaseIdValue.Unassigned, openMode: OpenMode.ReadWrite });
  }

  /**
   * Upgrades the schemas in the standalone iModel file.
   * Note that the upgrade requires that the file be closed, and will leave it back in the closed state.
   * @param filePath Full path name of the standalone iModel file.
   * @see ($docs/learning/backend/IModelDb.md#upgrading-schemas-in-an-imodel)
   * @see [[StandaloneDb.validateSchemas]]
   */
  public static upgradeStandaloneSchemas(filePath: LocalFileName) {
    let nativeDb = this.openDgnDb({ path: filePath }, OpenMode.ReadWrite, { profile: ProfileOptions.Upgrade, schemaLockHeld: true });
    nativeDb.saveChanges();
    nativeDb.closeFile();
    nativeDb = this.openDgnDb({ path: filePath }, OpenMode.ReadWrite, { domain: DomainOptions.Upgrade, schemaLockHeld: true });
    nativeDb.saveChanges();
    nativeDb.closeFile();
  }

  /** Creates or updates views in the iModel to permit visualizing the EC content as ECClasses and ECProperties rather than raw database tables and columns.
   * This can be helpful when debugging the EC data, especially when the raw tables make use of shared columns or spread data across multiple tables.
   * @throws IModelError if view creation failed.
   * @note The views are strictly intended for developers and debugging purposes only - they should not be used in application code.
   * @beta
   */
  public createClassViews(): void {
    const result = this.nativeDb.createClassViewsInDb();
    if (BentleyStatus.SUCCESS !== result)
      throw new IModelError(result, "Error creating class views");
    else
      this.saveChanges();
  }

  /** Open a standalone iModel file.
   * @param filePath The path of the standalone iModel file.
   * @param openMode Optional open mode for the standalone iModel. The default is read/write.
   * @throws [[IModelError]] if the file is not a standalone iModel.
   * @see [BriefcaseConnection.openStandalone]($frontend) to open a StandaloneDb from the frontend
   */
  public static openFile(filePath: LocalFileName, openMode: OpenMode = OpenMode.ReadWrite, options?: SnapshotDbOpenArgs): StandaloneDb {
    const file = { path: filePath, key: options?.key };
    const nativeDb = this.openDgnDb(file, openMode, undefined, options);

    try {
      const iTwinId = nativeDb.getITwinId();
      if (iTwinId !== Guid.empty) // a "standalone" iModel means it is not associated with an iTwin
        throw new IModelError(IModelStatus.WrongIModel, `${filePath} is not a Standalone iModel. iTwinId=${iTwinId}`);
      assert(undefined !== file.key);
      return new StandaloneDb({ nativeDb, key: file.key, openMode, briefcaseId: BriefcaseIdValue.Unassigned });
    } catch (error) {
      nativeDb.closeFile();
      throw error;
    }

  }
}
