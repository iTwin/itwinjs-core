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
import { IModelJsNative, SchemaWriteStatus } from "@bentley/imodeljs-native";
import {
  AccessToken, assert, BeEvent, BentleyStatus, ChangeSetStatus, DbChangeStage, DbConflictCause, DbConflictResolution, DbResult,
  Guid, GuidString, Id64, Id64Arg, Id64Array, Id64Set, Id64String, IModelStatus, JsonUtils, Logger, LogLevel, LRUMap, OpenMode
} from "@itwin/core-bentley";
import {
  AxisAlignedBox3d, BRepGeometryCreate, BriefcaseId, BriefcaseIdValue, CategorySelectorProps, ChangesetHealthStats, ChangesetIdWithIndex, ChangesetIndexAndId, Code,
  CodeProps, CreateEmptySnapshotIModelProps, CreateEmptyStandaloneIModelProps, CreateSnapshotIModelProps, DbQueryRequest, DisplayStyleProps,
  DomainOptions, EcefLocation, ECJsNames, ECSchemaProps, ECSqlReader, ElementAspectProps, ElementGeometryCacheOperationRequestProps, ElementGeometryCacheRequestProps, ElementGeometryCacheResponseProps, ElementGeometryRequest, ElementGraphicsRequestProps, ElementLoadProps, ElementProps, EntityMetaData, EntityProps, EntityQueryParams, FilePropertyProps, FontMap,
  GeoCoordinatesRequestProps, GeoCoordinatesResponseProps, GeometryContainmentRequestProps, GeometryContainmentResponseProps, IModel,
  IModelCoordinatesRequestProps, IModelCoordinatesResponseProps, IModelError, IModelNotFoundResponse, IModelTileTreeProps, LocalFileName,
  MassPropertiesRequestProps, MassPropertiesResponseProps, ModelExtentsProps, ModelLoadProps, ModelProps, ModelSelectorProps, OpenBriefcaseProps,
  OpenCheckpointArgs, OpenSqliteArgs, ProfileOptions, PropertyCallback, QueryBinder, QueryOptions, QueryRowFormat, SaveChangesArgs, SchemaState,
  SheetProps, SnapRequestProps, SnapResponseProps, SnapshotOpenOptions, SpatialViewDefinitionProps, SubCategoryResultRow, TextureData,
  TextureLoadProps, ThumbnailProps, UpgradeOptions, ViewDefinition2dProps, ViewDefinitionProps, ViewIdString, ViewQueryParams,
  ViewStateLoadProps, ViewStateProps, ViewStoreError, ViewStoreRpc
} from "@itwin/core-common";
import { Range2d, Range3d } from "@itwin/core-geometry";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BriefcaseManager, PullChangesArgs, PushChangesArgs, RevertChangesArgs } from "./BriefcaseManager";
import { ChannelControl, ChannelUpgradeOptions } from "./ChannelControl";
import { createChannelControl } from "./internal/ChannelAdmin";
import { CheckpointManager, CheckpointProps, V2CheckpointManager } from "./CheckpointManager";
import { ClassRegistry, EntityJsClassMap, MetaDataRegistry } from "./ClassRegistry";
import { CloudSqlite } from "./CloudSqlite";
import { CodeService } from "./CodeService";
import { CodeSpecs } from "./CodeSpecs";
import { ConcurrentQuery } from "./ConcurrentQuery";
import { ECSchemaXmlContext } from "./ECSchemaXmlContext";
import { ECSqlStatement } from "./ECSqlStatement";
import { Element, SectionDrawing, Subject } from "./Element";
import { ElementAspect } from "./ElementAspect";
import { generateElementGraphics } from "./ElementGraphics";
import { ECSqlRow, Entity, EntityClassType } from "./Entity";
import { ExportGraphicsOptions, ExportPartGraphicsOptions } from "./ExportGraphics";
import { GeoCoordConfig } from "./GeoCoordConfig";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { IpcHost } from "./IpcHost";
import { Model } from "./Model";
import { Relationships } from "./Relationship";
import { SchemaSync } from "./SchemaSync";
import { createServerBasedLocks } from "./internal/ServerBasedLocks";
import { SqliteStatement, StatementCache } from "./SqliteStatement";
import { ComputeRangesForTextLayoutArgs, TextLayoutRanges } from "./annotations/TextBlockLayout";
import { TxnManager } from "./TxnManager";
import { DrawingViewDefinition, SheetViewDefinition, ViewDefinition } from "./ViewDefinition";
import { ViewStore } from "./ViewStore";
import { Setting, SettingsContainer, SettingsDictionary, SettingsPriority } from "./workspace/Settings";
import { Workspace, WorkspaceDbLoadError, WorkspaceDbLoadErrors, WorkspaceDbSettingsProps, WorkspaceSettingNames } from "./workspace/Workspace";
import { constructWorkspace, OwnedWorkspace, throwWorkspaceDbLoadErrors } from "./internal/workspace/WorkspaceImpl";
import { SettingsImpl } from "./internal/workspace/SettingsImpl";
import { DbMergeChangesetConflictArgs } from "./internal/ChangesetConflictArgs";
import { LockControl } from "./LockControl";
import { IModelNative } from "./internal/NativePlatform";
import type { BlobContainer } from "./BlobContainerService";
import { createNoOpLockControl } from "./internal/NoLocks";
import { IModelDbFonts } from "./IModelDbFonts";
import { createIModelDbFonts } from "./internal/IModelDbFontsImpl";
import { _cache, _close, _hubAccess, _instanceKeyCache, _nativeDb, _releaseAllLocks, _resetIModelDb } from "./internal/Symbols";
import { ECVersion, SchemaContext, SchemaJsonLocater } from "@itwin/ecschema-metadata";
import { SchemaMap } from "./Schema";
import { ElementLRUCache, InstanceKeyLRUCache } from "./internal/ElementLRUCache";
import { IModelIncrementalSchemaLocater } from "./IModelIncrementalSchemaLocater";
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

/** Options supposed to [[IModelDb.Elements.insertElement]].
 * @public
 */
export interface InsertElementOptions {
  /** If true, instead of assigning a new, unique Id to the inserted element, the inserted element will use the Id specified by the supplied [ElementProps]($common).
   * This is chiefly useful when applying a filtering transformation - i.e., copying some elements from a source iModel to a target iModel and adding no new elements.
   * If this option is `true` then [ElementProps.id]($common) must be a valid Id that is not already used by an element in the iModel.
   * @beta
   */
  forceUseId?: boolean;
}

/** Options supplied to [[IModelDb.clearCaches]].
 * @beta
 */
export interface ClearCachesOptions {
  /** If true, clear only instance caches. Otherwise, clear all caches. */
  instanceCachesOnly?: boolean;
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
 * Options for the importing of schemas
 * @public
 */
export interface SchemaImportOptions<T = any> {
  /**
   * An [[ECSchemaXmlContext]] to use instead of building a default one.
   * This can be useful in rare cases where custom schema location logic is necessary
   * @internal
   */
  ecSchemaXmlContext?: ECSchemaXmlContext;

  /**
   * Optional callbacks for pre/post schema import operations.
   * @beta
   */
  schemaImportCallbacks?: SchemaImportCallbacks;

  /**
   * Optional.
   * Called before any schema import operations.
   *
   * Use this to prepare the channel for schema changes.
   * This is where you should perform channel-specific upgrades that the schema import/upgrade might depend on.
   *
   * @note User is responsible to acquiring the necessary locks before performing the channel upgrades.
   * @beta
   */
  channelUpgrade?: ChannelUpgradeOptions;

  /**
   * Optional application-specific data to be used by the channel upgrade or the schema import callbacks.
   * @beta
   */
  data?: T
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
 * @note if there is more than one iModel for an iTwin or organization, they will *each* hold an independent copy of the settings for those priorities.
 */
class IModelSettings extends SettingsImpl {
  protected override verifyPriority(priority: SettingsPriority) {
    if (priority <= SettingsPriority.application)
      throw new Error("Use IModelHost.appSettings to access settings of priority 'application' or lower");
  }

  public override * getSettingEntries<T extends Setting>(name: string): Iterable<{ value: T, dictionary: SettingsDictionary }> {
    yield* super.getSettingEntries(name);
    yield* IModelHost.appWorkspace.settings.getSettingEntries(name);
  }
}

/** Arguments supplied to [[IModelDb.exportSchema]] specifying which ECSchema to write to what location on the local file system.
 * @beta
 */
export interface ExportSchemaArgs {
  /** The name of the ECSchema to export. */
  schemaName: string;
  /** The directory in which to place the created schema file. */
  outputDirectory: LocalFileName;
  /** Optionally, the name of the file to create in [[outputDirectory]].
   * Defaults to <SchemaName>.<SchemaVersion>.ecschema.xml
   */
  outputFileName?: string;
}

/** Arguments supplied to [[IModelDb.simplifyElementGeometry]].
 * @beta
 */
export interface SimplifyElementGeometryArgs {
  /** The Id of the [[GeometricElement]] or [[GeometryPart]] whose geometry is to be simplified. */
  id: Id64String;
  /** If true, simplify by converting each [BRepEntity]($common) in the element's geometry stream to a high-resolution
   * mesh or curve geometry.
   */
  convertBReps?: boolean;
}

/** The output of [[IModelDb.inlineGeometryParts]].
 * If [[numCandidateParts]], [[numRefsInlined]], and [[numPartsDeleted ]] are all the same, the operation was fully successful.
 * Otherwise, some errors occurred inlining and/or deleting one or more parts.
 * A part will not be deleted unless it is first successfully inlined.
 * @beta
 */
export interface InlineGeometryPartsResult {
  /** The number of parts that were determined to have exactly one reference, making them candidates for inlining. */
  numCandidateParts: number;
  /** The number of part references successfully inlined. */
  numRefsInlined: number;
  /** The number of candidate parts that were successfully deleted after inlining. */
  numPartsDeleted: number;
}

/**
 * Strategy for transforming data during schema import.
 * @beta
 */
export enum DataTransformationStrategy {
  /** No data transformation will be performed after schema import. */
  None = "None",

  /** Data transformation will be performed using a temporary snapshot created before schema import.
   *  Useful for complex transformations requiring full read access to complete pre-import state for lazy conversion.
   *  Note: Creates a complete copy of the briefcase file, which may be large.
   */
  Snapshot = "Snapshot",

  /** Data transformation will be performed using in-memory cached data created before schema import.
   *  Useful for lightweight transformations involving limited data.
   */
  InMemory = "InMemory",
}

/**
 * Context provided to the beforeImport callback.
 * @beta
 */
export interface PreImportContext<T = any> {
  /** The iModel being modified */
  iModel: IModelDb;

  /** Schemas about to be imported */
  schemaData: LocalFileName[] | string[];

  /** Optional user-provided data for pre-import operations */
  data?: T;
}

/**
 * Result of the pre-import callback.
 * @beta
 */
export interface PreImportCallbackResult<T = any> {
  transformStrategy: DataTransformationStrategy;

  /** Optional cached data for in-memory strategy */
  cachedData?: T;
}

/**
 * Resources available for after schema import data transformation.
 * @beta
 */
export interface DataTransformationResources extends PreImportCallbackResult {
  /** Optional snapshot for snapshot strategy */
  snapshot?: SnapshotDb;
}

/**
 * Context provided to the afterImport callback.
 * @beta
 */
export interface PostImportContext<T = any> {
  /** The iModel being modified */
  iModel: IModelDb;

  /** Resources for data transformation */
  resources: DataTransformationResources;

  /** Optional user-provided data for post-import operations */
  data?: T;
}

/**
 * Callbacks for schema import operations.
 * @beta
 */
export interface SchemaImportCallbacks<T = any> {
  /**
   * Will be executed before schemas are imported but after channel upgrades.
   * Use this to make any pre import changes to the iModel or use it to cache data or create snapshots for data transformation after the schema import/upgrade.
   *
   * @note User is responsible to acquiring the necessary locks before making any changes.
   *
   * @returns Strategy and optional cached data for transformation
   */
  preSchemaImportCallback?: (context: PreImportContext) => Promise<PreImportCallbackResult<T>>;

  /**
   * Will be executed after schemas are imported, while schema lock is still held.
   * Use this to transform data to match the new schema.
   *
   * @note Schema lock is already held after doing a schema import. No lock acquisition is necessary by the user.
   *
   * @throws If transformation fails, any changes done after the schema import are abandoned and snapshot is cleared.
   */
  postSchemaImportCallback?: (context: PostImportContext) => Promise<void>;
}

/** Options for closing an iModelDb.
 * @public
 */
export interface CloseIModelArgs {
  /** Runs the Sqlite vacuum and analyze commands before closing to defragment the database and update query optimizer statistics */
  optimize?: boolean;
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
  public readonly channels: ChannelControl = createChannelControl(this);
  private _relationships?: Relationships;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  private readonly _statementCache = new StatementCache<ECSqlStatement>();
  private readonly _sqliteStatementCache = new StatementCache<SqliteStatement>();
  private _codeSpecs?: CodeSpecs;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  private _classMetaDataRegistry?: MetaDataRegistry;
  private _jsClassMap?: EntityJsClassMap;
  private _schemaMap?: SchemaMap;
  private _schemaContext?: SchemaContext;
  /** @deprecated in 5.0.0 - will not be removed until after 2026-06-13. Use [[fonts]]. */
  protected _fontMap?: FontMap; // eslint-disable-line @typescript-eslint/no-deprecated
  private readonly _fonts: IModelDbFonts = createIModelDbFonts(this);
  private _workspace?: OwnedWorkspace;

  private readonly _snaps = new Map<string, IModelJsNative.SnapRequest>();
  private static _shutdownListener: VoidFunction | undefined; // so we only register listener once
  /** @internal */
  protected _locks?: LockControl = createNoOpLockControl();

  /** @internal */
  protected _codeService?: CodeService;

  /** @alpha */
  public get codeService() { return this._codeService; }

  /** The [[LockControl]] that orchestrates [concurrent editing]($docs/learning/backend/ConcurrencyControl.md) of this iModel. */
  public get locks(): LockControl { return this._locks!; } // eslint-disable-line @typescript-eslint/no-non-null-assertion

  /** Provides methods for interacting with [font-related information]($docs/learning/backend/Fonts.md) stored in this iModel.
   * @beta
   */
  public get fonts(): IModelDbFonts { return this._fonts; }

  /**
   * Get the [[Workspace]] for this iModel.
   * @beta
   */
  public get workspace(): Workspace {
    if (undefined === this._workspace)
      this._workspace = constructWorkspace(new IModelSettings());

    return this._workspace;
  }

  /**
   * get the cloud container for this iModel, if it was opened from one
   * @beta
   */
  public get cloudContainer(): CloudSqlite.CloudContainer | undefined {
    return this[_nativeDb].cloudContainer;
  }

  /** Acquire the exclusive schema lock on this iModel.
   * @note: To acquire the schema lock, all other briefcases must first release *all* their locks. No other briefcases
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
    this.changeset = this[_nativeDb].getCurrentChangeset();
    this.onChangesetApplied.raiseEvent();
  }

  /** @internal */
  public restartDefaultTxn() {
    this[_nativeDb].restartDefaultTxn();
  }

  /** @deprecated in 5.0.0 - will not be removed until after 2026-06-13. Use [[fonts]]. */
  public get fontMap(): FontMap { // eslint-disable-line @typescript-eslint/no-deprecated
    return this._fontMap ?? (this._fontMap = new FontMap(this[_nativeDb].readFontMap())); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** @internal */
  public clearFontMap(): void {
    this._fontMap = undefined; // eslint-disable-line @typescript-eslint/no-deprecated
    this[_nativeDb].invalidateFontMap();
  }

  /** Check if this iModel has been opened read-only or not. */
  public get isReadonly(): boolean { return this.openMode === OpenMode.Readonly; }

  /** The Guid that identifies this iModel. */
  public override get iModelId(): GuidString {
    assert(undefined !== super.iModelId);
    return super.iModelId;
  } // GuidString | undefined for the IModel superclass, but required for all IModelDb subclasses

  /** @internal*/
  public readonly [_nativeDb]: IModelJsNative.DgnDb;

  /** Get the full path fileName of this iModelDb
   * @note this member is only valid while the iModel is opened.
   */
  public get pathName(): LocalFileName { return this[_nativeDb].getFilePath(); }

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
    this[_nativeDb] = args.nativeDb;

    // it is illegal to create an IModelDb unless the nativeDb has been opened. Throw otherwise.
    if (!this.isOpen)
      throw new Error("cannot create an IModelDb unless it has already been opened");

    // PR https://github.com/iTwin/imodel-native/pull/558 renamed closeIModel to closeFile because it changed its behavior.
    // Ideally, nobody outside of core-backend would be calling it, but somebody important is.
    // Make closeIModel available so their code doesn't break.
    (this[_nativeDb] as any).closeIModel = () => {
      if (!this.isReadonly)
        this.saveChanges(); // preserve old behavior of closeIModel that was removed when renamed to closeFile

      this[_nativeDb].closeFile();
    };

    this[_nativeDb].setIModelDb(this);

    this[_resetIModelDb]();
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

  /** @internal */
  public [_resetIModelDb]() {
    this.loadIModelSettings();
    GeoCoordConfig.loadForImodel(this.workspace.settings); // load gcs data specified by iModel's settings dictionaries, must be done before calling initializeIModelDb
    this.initializeIModelDb();
  }

  /**
   * Attach an iModel file to this connection and load and register its schemas.
   * @note There are some reserve tablespace names that cannot be used. They are 'main', 'schema_sync_db', 'ecchange' & 'temp'
   * @param fileName IModel file name
   * @param alias identifier for the attached file. This identifier is used to access schema from the attached file. e.g. if alias is 'abc' then schema can be accessed using 'abc.MySchema.MyClass'
   * @example
   * [[include:IModelDb_attachDb.code]]
   */
  public attachDb(fileName: string, alias: string): void {
    if (alias.toLowerCase() === "main" || alias.toLowerCase() === "schema_sync_db" || alias.toLowerCase() === "ecchange" || alias.toLowerCase() === "temp") {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Reserved tablespace name cannot be used");
    }
    this[_nativeDb].attachDb(fileName, alias);
  }
  /**
   * Detach the attached file from this connection. The attached file is closed and its schemas are unregistered.
   * @note There are some reserve tablespace names that cannot be used. They are 'main', 'schema_sync_db', 'ecchange' & 'temp'
   * @param alias identifer that was used in the call to [[attachDb]]
   *
   * @example [[include:IModelDb_attachDb.code]]
   *
   */
  public detachDb(alias: string): void {
    if (alias.toLowerCase() === "main" || alias.toLowerCase() === "schema_sync_db" || alias.toLowerCase() === "ecchange" || alias.toLowerCase() === "temp") {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Reserved tablespace name cannot be used");
    }
    this.clearCaches();
    this[_nativeDb].detachDb(alias);
  }
  /** Close this IModel, if it is currently open, and save changes if it was opened in ReadWrite mode.
   * @param options Options for closing the iModel.
   */
  public close(options?: CloseIModelArgs): void {
    if (!this.isOpen)
      return; // don't continue if already closed

    this.beforeClose();
    if (options?.optimize)
      this.optimize();

    IModelDb._openDbs.delete(this._fileKey);
    this._workspace?.close();
    this.locks[_close]();
    this._locks = undefined;
    this._codeService?.close();
    this._codeService = undefined;
    if (!this.isReadonly)
      this.saveChanges();
    this[_nativeDb].closeFile();
  }

  /** Optimize this iModel by vacuuming, and analyzing.
   *
   * @note This operation requires exclusive access to the database and may take some time on large files.
   * @beta
   */
  public optimize(): void {
    // Vacuum to reclaim space and defragment
    this.vacuum();

    // Analyze to update statistics for query optimizer
    this.analyze();
  }

  /**
   * Vacuum the model to reclaim space and defragment.
   * @throws [[IModelError]] if the iModel is not open or is read-only.
   * @beta
   */
  public vacuum(): void {
    if (!this.isOpen || this.isReadonly)
      throw new IModelError(IModelStatus.BadRequest, "IModel is not open or is read-only");

    this[_nativeDb].clearECDbCache();
    this[_nativeDb].vacuum();
  }

  /**
   * Update SQLite query optimizer statistics for this iModel.
   * This helps SQLite choose better query plans.
   *
   * @throws [[IModelError]] if the iModel is not open or is read-only.
   * @beta
   */
  public analyze() {
    if (!this.isOpen || this.isReadonly)
      throw new IModelError(IModelStatus.BadRequest, "IModel is not open or is read-only");

    this[_nativeDb].analyze();
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
  protected initializeIModelDb(when?: "pullMerge") {
    const props = this[_nativeDb].getIModelProps(when);
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
  public get isOpen(): boolean { return this[_nativeDb].isOpen(); }

  /** Get the briefcase Id of this iModel */
  public getBriefcaseId(): BriefcaseId { return this.isOpen ? this[_nativeDb].getBriefcaseId() : BriefcaseIdValue.Illegal; }

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
   * @deprecated in 4.11 - will not be removed until after 2026-06-13.  Use [[createQueryReader]] instead.
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public withPreparedStatement<T>(ecsql: string, callback: (stmt: ECSqlStatement) => T, logErrors = true): T {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
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
   * @deprecated in 4.11 - will not be removed until after 2026-06-13.  Use [[createQueryReader]] instead.
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public withStatement<T>(ecsql: string, callback: (stmt: ECSqlStatement) => T, logErrors = true): T {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const stmt = this.prepareStatement(ecsql, logErrors);
    const release = () => stmt[Symbol.dispose]();
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
    if (!this[_nativeDb].isOpen())
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "db not open");

    const executor = {
      execute: async (request: DbQueryRequest) => {
        return ConcurrentQuery.executeQueryRequest(this[_nativeDb], request);
      },
    };
    return new ECSqlReader(executor, ecsql, params, config);
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
    const release = () => stmt[Symbol.dispose]();
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
    stmt.prepare(this[_nativeDb], logErrors);
    return stmt;
  }

  /**
   * queries the BisCore.SubCategory table for entries that are children of used spatial categories and 3D elements.
   * @returns array of SubCategoryResultRow
   * @internal
   */
  public async queryAllUsedSpatialSubCategories(): Promise<SubCategoryResultRow[]> {
    const result: SubCategoryResultRow[] = [];
    const parentCategoriesQuery = `SELECT DISTINCT Category.Id AS id FROM BisCore.GeometricElement3d WHERE Category.Id IN (SELECT ECInstanceId FROM BisCore.SpatialCategory)`;
    const parentCategories: Id64Array = [];
    for await (const row of this.createQueryReader(parentCategoriesQuery)) {
      parentCategories.push(row.id);
    };
    const where = [...parentCategories].join(",");
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

  /**
   * queries the BisCore.SubCategory table for the entries that are children of the passed categoryIds.
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
    // eslint-disable-next-line @typescript-eslint/no-deprecated
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

  /** Clear all in-memory caches held in this IModelDb.
   * @public
  */
  public clearCaches(): void;
  /** Clear all in-memory caches held in this IModelDb.
   * @param params Options that control which caches to clear. If not specified, all caches are cleared.
   * @beta
  */
  public clearCaches(params?: ClearCachesOptions): void;
  public clearCaches(params?: ClearCachesOptions) {
    if (!params?.instanceCachesOnly) {
      this._statementCache.clear();
      this._sqliteStatementCache.clear();
      this._classMetaDataRegistry = undefined;
      this._jsClassMap = undefined;
      this._schemaMap = undefined;
      this._schemaContext = undefined;
      this[_nativeDb].clearECDbCache();
    }
    this.elements[_cache].clear();
    this.models[_cache].clear();
    this.elements[_instanceKeyCache].clear();
    this.models[_instanceKeyCache].clear();
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
    const result = this[_nativeDb].computeProjectExtents(wantFullExtents, wantOutliers);
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
    this[_nativeDb].updateIModelProps(this.toJSON());
  }

  /** Commit unsaved changes in memory as a Txn to this iModelDb.
   * @param description Optional description of the changes.
   * @throws [[IModelError]] if there is a problem saving changes or if there are pending, un-processed lock or code requests.
   * @note This will not push changes to the iModelHub.
   * @note This method should not be called from {TxnManager.withIndirectTxnModeAsync}, {TxnManager.withIndirectTxnMode} or {RebaseHandler.recompute}.
   * @see [[IModelDb.pushChanges]] to push changes to the iModelHub.
   */
  public saveChanges(description?: string): void;

  /** Commit unsaved changes in memory as a Txn to this iModelDb. This is preferable for case where application like to store additional structured information with the change that could be useful later when rebasing.
   * @alpha
   * @param args Provide [[SaveChangesArgs]] of the changes.
   * @throws [[IModelError]] if there is a problem saving changes or if there are pending, un-processed lock or code requests.
   * @note This will not push changes to the iModelHub.
   * @note This method should not be called from {TxnManager.withIndirectTxnModeAsync}, {TxnManager.withIndirectTxnMode} or {RebaseHandler.recompute}.
   * @see [[IModelDb.pushChanges]] to push changes to the iModelHub.
   */
  public saveChanges(args: SaveChangesArgs): void;

  /** Commit unsaved changes in memory as a Txn to this iModelDb.
   * @internal
   * @param descriptionOrArgs Optionally provide description or [[SaveChangesArgs]] args for the changes.
   * @throws [[IModelError]] if there is a problem saving changes or if there are pending, un-processed lock or code requests.
   * @note This will not push changes to the iModelHub.
   * @note This method should not be called from {TxnManager.withIndirectTxnModeAsync}, {TxnManager.withIndirectTxnMode} or {RebaseHandler.recompute}.
   * @see [[IModelDb.pushChanges]] to push changes to the iModelHub.
   */
  public saveChanges(descriptionOrArgs?: string | SaveChangesArgs): void {
    if (this.openMode === OpenMode.Readonly)
      throw new IModelError(IModelStatus.ReadOnly, "IModelDb was opened read-only");

    if (this.isBriefcaseDb()) {
      if (this.txns.isIndirectChanges) {
        throw new IModelError(IModelStatus.BadRequest, "Cannot save changes while in an indirect change scope");
      }
    }
    const args = typeof descriptionOrArgs === "string" ? { description: descriptionOrArgs } : descriptionOrArgs;
    if (!this[_nativeDb].hasUnsavedChanges()) {
      Logger.logWarning(loggerCategory, "there are no unsaved changes", () => args);
    }

    const stat = this[_nativeDb].saveChanges(args ? JSON.stringify(args) : undefined);
    if (DbResult.BE_SQLITE_ERROR_PropagateChangesFailed === stat)
      throw new IModelError(stat, `Could not save changes due to propagation failure.`);

    if (DbResult.BE_SQLITE_OK !== stat)
      throw new IModelError(stat, `Could not save changes (${args?.description})`);
  }

  /** Abandon changes in memory that have not been saved as a Txn to this iModelDb.
   * @note This will not delete Txns that have already been saved, even if they have not yet been pushed.
  */
  public abandonChanges(): void {
    // Clears instanceKey caches only, instead of all of the backend caches, since the changes are not saved yet
    this.clearCaches({ instanceCachesOnly: true });
    this[_nativeDb].abandonChanges();
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
      this.clearCaches();
      this[_nativeDb].concurrentQueryShutdown();
      this[_nativeDb].performCheckpoint();
    }
  }

  /** @internal
   * @deprecated in 4.8 - will not be removed until after 2026-06-13. Use `txns.reverseTxns`.
   */
  public reverseTxns(numOperations: number): IModelStatus {
    return this[_nativeDb].reverseTxns(numOperations);
  }

  /** @internal */
  public reinstateTxn(): IModelStatus {
    return this[_nativeDb].reinstateTxn();
  }

  /** @internal */
  public restartTxnSession(): void {
    return this[_nativeDb].restartTxnSession();
  }

  /**
   * Get the class full name from a class Id.
   * @param classId the Id of the class to look up
   * @returns the full name of the class (e.g. "BisCore:Element")
   * @throws IModelError if the classId is invalid or the class is not found.
   * @internal
   */
  public getClassNameFromId(classId: string): Id64String {
    if (!Id64.isValid(classId))
      throw new IModelError(IModelStatus.BadRequest, `Class Id ${classId} is invalid`);
    const name = this[_nativeDb].classIdToName(classId);
    if (name === undefined)
      throw new IModelError(IModelStatus.NotFound, `Class not found: ${classId}`);
    return name;
  }

  /** Removes unused schemas from the database.
   *
   * If the removal was successful, the database is automatically saved to disk.
   * @param schemaNames Array of schema names to drop
   * @throws [IModelError]($common) if the database if the operation failed.
   * @alpha
   */
  public async dropSchemas(schemaNames: string[]): Promise<void> {
    if (schemaNames.length === 0)
      return;
    if (this[_nativeDb].schemaSyncEnabled())
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cannot drop schemas when schema sync is enabled");
    if (this[_nativeDb].hasUnsavedChanges())
      throw new IModelError(ChangeSetStatus.HasUncommittedChanges, "Cannot drop schemas with unsaved changes");
    if (this[_nativeDb].getITwinId() !== Guid.empty)
      await this.acquireSchemaLock();

    try {
      this[_nativeDb].dropSchemas(schemaNames);
      this.saveChanges(`dropped unused schemas`);
    } catch (error: any) {
      Logger.logError(loggerCategory, `Failed to drop schemas: ${error}`);
      this.abandonChanges();
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Failed to drop schemas: ${error}`);
    } finally {
      await this.locks.releaseAllLocks();
      this.clearCaches();
    }
  }

  /** Helper to clean up snapshot resources safely
   * @internal
   */
  private cleanupSnapshot(resources: DataTransformationResources): void {
    if (resources.snapshot) {
      const pathName = resources.snapshot.pathName;
      resources.snapshot.close();
      if (pathName && IModelJsFs.existsSync(pathName)) {
        IModelJsFs.removeSync(pathName);
      }
    }
  }

  private async preSchemaImportCallback(callback: SchemaImportCallbacks, context: PreImportContext): Promise<DataTransformationResources> {
    const callbackResources: DataTransformationResources = {
      transformStrategy: DataTransformationStrategy.None,
    };

    try {
      if (callback?.preSchemaImportCallback) {
        const callbackResult = await callback.preSchemaImportCallback(context);
        callbackResources.transformStrategy = callbackResult.transformStrategy;

        if (callbackResult.transformStrategy === DataTransformationStrategy.Snapshot) {
          // Create temporary snapshot file
          const snapshotDb = SnapshotDb.createFrom(this, `${this.pathName}.snapshot-${Date.now()}`);
          callbackResources.snapshot = snapshotDb;
        } else if (callbackResult.transformStrategy === DataTransformationStrategy.InMemory) {
          if (callbackResult.cachedData === undefined) {
            throw new IModelError(IModelStatus.BadRequest, "InMemory transform strategy requires cachedData to be provided.");
          }
          callbackResources.cachedData = callbackResult.cachedData;
        }

        if (this.isBriefcaseDb() && IModelHost.useSemanticRebase) {
          this.saveChanges("Save changes from schema import pre callback");
        }
      }
    } catch (callbackError: any) {
      this.abandonChanges();
      this.cleanupSnapshot(callbackResources);
      throw new IModelError(callbackError.errorNumber ?? IModelStatus.BadRequest, `Failed to execute preSchemaImportCallback: ${callbackError.message}`);
    }

    return callbackResources;
  }

  private async postSchemaImportCallback(callback: SchemaImportCallbacks, context: PostImportContext): Promise<void> {
    if (context.resources.transformStrategy === DataTransformationStrategy.Snapshot && (context.resources.snapshot === undefined || !IModelJsFs.existsSync(context.resources.snapshot.pathName))) {
      throw new IModelError(IModelStatus.BadRequest, "Snapshot transform strategy requires a snapshot to be created");
    }

    if (context.resources.transformStrategy === DataTransformationStrategy.InMemory && context.resources.cachedData === undefined) {
      throw new IModelError(IModelStatus.BadRequest, "InMemory transform strategy requires cachedData to be provided.");
    }

    try {
      if (callback?.postSchemaImportCallback)
        await callback.postSchemaImportCallback(context);
      if (this.isBriefcaseDb() && IModelHost.useSemanticRebase) {
        this.saveChanges("Save changes from schema import post callback");
      }
    } catch (callbackError: any) {
      this.abandonChanges();
      throw new IModelError(callbackError.errorNumber ?? IModelStatus.BadRequest, `Failed to execute postSchemaImportCallback: ${callbackError.message}`);
    } finally {
      // Always clean up snapshot, whether success or error
      this.cleanupSnapshot(context.resources);
    }
  }

  /** Shared implementation for importing schemas from file or string. */
  private async importSchemasInternal<T extends LocalFileName[] | string[]>(
    schemas: T,
    options: SchemaImportOptions | undefined,
    nativeImportOp: (schemas: T, importOptions: IModelJsNative.SchemaImportOptions) => void,
  ): Promise<void> {

    // BriefcaseDb-specific validation checks
    if (this.isBriefcaseDb()) {
      if (this.txns.rebaser.isRebasing) {
        throw new IModelError(IModelStatus.BadRequest, "Cannot import schemas while rebasing");
      }
      if (this.txns.isIndirectChanges) {
        throw new IModelError(IModelStatus.BadRequest, "Cannot import schemas while in an indirect change scope");
      }

      // Additional checks when semantic rebase is enabled
      if (IModelHost.useSemanticRebase) {
        if (this[_nativeDb].hasUnsavedChanges()) {
          throw new IModelError(IModelStatus.BadRequest, "Cannot import schemas with unsaved changes when useSemanticRebase flag is on");
        }
        if (this[_nativeDb].schemaSyncEnabled()) {
          throw new IModelError(IModelStatus.BadRequest, "Cannot import schemas when schema sync is enabled and also useSemanticRebase flag is on");
        }
      }
    }

    if (options?.channelUpgrade) {
      try {
        await this.channels.upgradeChannel(options.channelUpgrade, this, options.data);
        // If semantic rebase is enabled and channel upgrade made changes, save them
        if (this.isBriefcaseDb() && IModelHost.useSemanticRebase) {
          this.saveChanges();
        }
      } catch (error) {
        this.abandonChanges();
        throw error;
      }
    }

    let preSchemaImportCallbackResult: DataTransformationResources = { transformStrategy: DataTransformationStrategy.None };
    if (options?.schemaImportCallbacks?.preSchemaImportCallback)
      preSchemaImportCallbackResult = await this.preSchemaImportCallback(options.schemaImportCallbacks, { iModel: this, data: options.data, schemaData: schemas });

    const maybeCustomNativeContext = options?.ecSchemaXmlContext?.nativeContext;
    if (this[_nativeDb].schemaSyncEnabled()) {
      await SchemaSync.withLockedAccess(this, { openMode: OpenMode.Readonly, operationName: "schema sync" }, async (syncAccess) => {
        const schemaSyncDbUri = syncAccess.getUri();
        this.saveChanges();

        try {
          nativeImportOp(schemas, { schemaLockHeld: false, ecSchemaXmlContext: maybeCustomNativeContext, schemaSyncDbUri });
        } catch (outerErr: any) {
          if (DbResult.BE_SQLITE_ERROR_DataTransformRequired === outerErr.errorNumber) {
            this.abandonChanges();
            if (this[_nativeDb].getITwinId() !== Guid.empty)
              await this.acquireSchemaLock();
            try {
              nativeImportOp(schemas, { schemaLockHeld: true, ecSchemaXmlContext: maybeCustomNativeContext, schemaSyncDbUri });
            } catch (innerErr: any) {
              throw new IModelError(innerErr.errorNumber, innerErr.message);
            }
          } else {
            throw new IModelError(outerErr.errorNumber, outerErr.message);
          }
        }
      });
    } else {
      const nativeImportOptions: IModelJsNative.SchemaImportOptions = {
        schemaLockHeld: true,
        ecSchemaXmlContext: maybeCustomNativeContext,
      };

      // This check is different from isBriefcase in case of StandaloneDb, which is a briefcase but has no iTwinId.
      if (this[_nativeDb].getITwinId() !== Guid.empty) { // if this iModel is associated with an iTwin, importing schema requires the schema lock
        if (IModelHost.useSemanticRebase) {
          // Use shared lock for semantic rebase to allow concurrent schema imports
          await this.locks.acquireLocks({ shared: IModel.repositoryModelId });
        } else {
          await this.acquireSchemaLock();
        }
      }

      try {
        nativeImportOp(schemas, nativeImportOptions);
      } catch (err: any) {
        throw new IModelError(err.errorNumber, err.message);
      }
    }

    this.clearCaches();

    // Store schemas for semantic rebase (BriefcaseDb only)
    if (this.isBriefcaseDb() && IModelHost.useSemanticRebase) {
      const lastSavedTxnProps = this.txns.getLastSavedTxnProps();
      if (lastSavedTxnProps === undefined) {
        throw new IModelError(IModelStatus.BadRequest, "After schema import, no last saved transaction found");
      }
      if (lastSavedTxnProps.type !== "Schema" && lastSavedTxnProps.type !== "ECSchema") {
        throw new IModelError(IModelStatus.BadRequest, "After schema import, last saved transaction is not a Schema transaction");
      }
      BriefcaseManager.storeSchemasForSemanticRebase(this, lastSavedTxnProps.id, schemas);
    }

    if (options?.schemaImportCallbacks?.postSchemaImportCallback)
      await this.postSchemaImportCallback(options.schemaImportCallbacks, { iModel: this, resources: preSchemaImportCallbackResult, data: options.data });
  }

  /** Import an ECSchema. On success, the schema definition is stored in the iModel.
   * This method is asynchronous (must be awaited) because, in the case where this IModelDb is a briefcase, this method first obtains the schema lock from the iModel server.
   * You must import a schema into an iModel before you can insert instances of the classes in that schema. See [[Element]]
   * @param schemaFileName  array of Full paths to ECSchema.xml files to be imported.
   * @param {SchemaImportOptions} options - options during schema import.
   * @throws [[IModelError]] if the schema lock cannot be obtained or there is a problem importing the schema.
   * @note Changes are saved if importSchemas is successful and abandoned if not successful.
   * - You can use NativeLoggerCategory to turn on the native logs. You can also control [what exactly is logged by the loggers](https://www.itwinjs.org/learning/common/logging/#controlling-what-is-logged).
   * - See [Schema Versioning]($docs/bis/guide/schema-evolution/schema-versioning-and-generations.md) for more information on acceptable changes to schemas.
   * @note This method should not be called from {TxnManager.withIndirectTxnModeAsync} or {RebaseHandler.recompute}.
   * @see querySchemaVersion
   */
  public async importSchemas(schemaFileNames: LocalFileName[], options?: SchemaImportOptions): Promise<void> {
    if (schemaFileNames.length === 0)
      return;

    await this.importSchemasInternal(
      schemaFileNames,
      options,
      (schemas, importOptions) => this[_nativeDb].importSchemas(schemas, importOptions)
    );
  }

  /** Import ECSchema(s) serialized to XML. On success, the schema definition is stored in the iModel.
   * This method is asynchronous (must be awaited) because, in the case where this IModelDb is a briefcase, this method first obtains the schema lock from the iModel server.
   * You must import a schema into an iModel before you can insert instances of the classes in that schema. See [[Element]]
   * @param serializedXmlSchemas  The xml string(s) created from a serialized ECSchema.
   * @param {SchemaImportOptions} options - options during schema import.
   * @throws [[IModelError]] if the schema lock cannot be obtained or there is a problem importing the schema.
   * @note Changes are saved if importSchemaStrings is successful and abandoned if not successful.
   * @note This method should not be called from {TxnManager.withIndirectTxnModeAsync} or {RebaseHandler.recompute}.
   * @see querySchemaVersion
   * @alpha
   */
  public async importSchemaStrings(serializedXmlSchemas: string[], options?: SchemaImportOptions): Promise<void> {
    if (serializedXmlSchemas.length === 0)
      return;

    await this.importSchemasInternal(
      serializedXmlSchemas,
      options,
      (schemas, importOptions) => this[_nativeDb].importXmlSchemas(schemas, importOptions)
    );
  }

  /** Find an opened instance of any subclass of IModelDb, by filename
   * @note this method returns an IModelDb if the filename is open for *any* subclass of IModelDb
  */
  public static findByFilename(fileName: LocalFileName): IModelDb | undefined {
    for (const entry of this._openDbs) {
      // It shouldn't be possible for anything in _openDbs to not be open, but if so just skip them because `pathName` will throw an exception.
      if (entry[1].isOpen && entry[1].pathName === fileName)
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
    if (undefined === iModelDb) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw new IModelNotFoundResponse(); // a very specific status for the RpcManager
    }
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
      const nativeDb = new IModelNative.platform.DgnDb();
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
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Please use `schemaContext` from the `iModel` instead.
   *
   * @example
   * ```typescript
   * // Current usage:
   * const classMetaData: EntityMetaData | undefined = iModel.classMetaDataRegistry.find("SchemaName:ClassName");
   *
   * // Replacement:
   * const metaData: EntityClass | undefined = imodel.schemaContext.getSchemaItemSync("SchemaName.ClassName", EntityClass);
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public get classMetaDataRegistry(): MetaDataRegistry {
    if (this._classMetaDataRegistry === undefined)
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      this._classMetaDataRegistry = new MetaDataRegistry();

    return this._classMetaDataRegistry;
  }

  /**
   * Allows registering js classes mapped to ECClasses
   */
  public get jsClassMap(): EntityJsClassMap {
    if (this._jsClassMap === undefined)
      this._jsClassMap = new EntityJsClassMap();

    return this._jsClassMap;
  }

  /**
   * Allows locally registering a schema for this imodel, in constrast to [Schemas.registerSchema] which is a global operation
   */
  public get schemaMap(): SchemaMap {
    if (this._schemaMap === undefined)
      this._schemaMap = new SchemaMap();

    return this._schemaMap;
  }

  /**
   * Gets the context that allows accessing the metadata (ecschema-metadata package) of this iModel
   * @public @preview
   */
  public get schemaContext(): SchemaContext {
    if (this._schemaContext === undefined) {
      const context = new SchemaContext();
      if (IModelHost.configuration && IModelHost.configuration.incrementalSchemaLoading === "enabled") {
        context.addLocater(new IModelIncrementalSchemaLocater(this));
      }
      context.addLocater(new SchemaJsonLocater((name) => this.getSchemaProps(name)));
      this._schemaContext = context;
    }

    return this._schemaContext;
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
   * @deprecated in 4.11 - will not be removed until after 2026-06-13.  Use [IModelDb.createQueryReader]($backend) or [ECDb.createQueryReader]($backend) to query.
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public prepareStatement(sql: string, logErrors = true): ECSqlStatement {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const stmt = new ECSqlStatement();
    stmt.prepare(this[_nativeDb], sql, logErrors);
    return stmt;
  }

  /** Prepare an ECSQL statement.
   * @param sql The ECSQL statement to prepare
   * @returns `undefined` if there is a problem preparing the statement.
   * @deprecated in 4.11 - will not be removed until after 2026-06-13.  Use [IModelDb.createQueryReader]($backend) or [ECDb.createQueryReader]($backend) to query.
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public tryPrepareStatement(sql: string): ECSqlStatement | undefined {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const statement = new ECSqlStatement();
    const result = statement.tryPrepare(this[_nativeDb], sql);
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

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      this.loadMetaData(classFullName);
      return ClassRegistry.getClass(classFullName, this) as T;
    }
  }

  /** Constructs a ResolveInstanceKeyArgs from given parameters
   * @throws [[IModelError]] if the combination of supplied parameters is invalid.
   * @internal
   */
  public getInstanceArgs(instanceId?: Id64String, baseClassName?: string, federationGuid?: GuidString, code?: CodeProps): IModelJsNative.ResolveInstanceKeyArgs {
    if (instanceId && baseClassName) {
      return { partialKey: { id: instanceId, baseClassName } };
    } else if (federationGuid) {
      return { federationGuid };
    } else if (code) {
      return { code };
    } else {
      throw new IModelError(IModelStatus.InvalidId, "Either instanceId and baseClassName or federationGuid or code must be specified");
    }
  }

  /** Get metadata for a class. This method will load the metadata from the iModel into the cache as a side-effect, if necessary.
   * @throws [[IModelError]] if the metadata cannot be found nor loaded.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Please use `getSchemaItem` from `SchemaContext` class instead.
   *
   * @example
   *  * ```typescript
   * // Current usage:
   * const metaData: EntityMetaData = imodel.getMetaData("SchemaName:ClassName");
   *
   * // Replacement:
   * const metaData: EntityClass | undefined = imodel.schemaContext.getSchemaItemSync("SchemaName", "ClassName", EntityClass);
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public getMetaData(classFullName: string): EntityMetaData {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    let metadata = this.classMetaDataRegistry.find(classFullName);
    if (metadata === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      this.loadMetaData(classFullName);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      metadata = this.classMetaDataRegistry.find(classFullName);
      if (metadata === undefined)
        throw ClassRegistry.makeMetaDataNotFoundError(classFullName); // do not log
    }
    return metadata;
  }

  /** Identical to [[getMetaData]], except it returns `undefined` instead of throwing an error if the metadata cannot be found nor loaded.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Please use `getSchemaItem` from `SchemaContext` class instead.
   *
   * @example
   *  * ```typescript
   * // Current usage:
   * const metaData: EntityMetaData | undefined = imodel.tryGetMetaData("SchemaName:ClassName");
   *
   * // Replacement:
   * const metaData: EntityClass | undefined = imodel.schemaContext.getSchemaItemSync("SchemaName.ClassName", EntityClass);
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public tryGetMetaData(classFullName: string): EntityMetaData | undefined {
    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      return this.getMetaData(classFullName);
    } catch {
      return undefined;
    }
  }

  /** Invoke a callback on each property of the specified class, optionally including superclass properties.
   * @param iModel  The IModel that contains the schema
   * @param classFullName The full class name to load the metadata, if necessary
   * @param wantSuper If true, superclass properties will also be processed
   * @param func The callback to be invoked on each property
   * @param includeCustom If true (default), include custom-handled properties in the iteration. Otherwise, skip custom-handled properties.
   * @note Custom-handled properties are core properties that have behavior enforced by C++ handlers.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Please use `forEachProperty` instead.
   *
   * @example
   * ```typescript
   * // Current usage:
   * IModelDb.forEachMetaData(imodel, "BisCore:Element", true, (name: string, propMetaData: PropertyMetaData) => {
   *   console.log(`Property name: ${name}, Property type: ${propMetaData.primitiveType}`);
   * }, false);
   *
   * // Replacement:
   * await IModelDb.forEachProperty(imodel, "TestDomain.TestDomainClass", true, (propName: string, property: Property) => {
   *   console.log(`Property name: ${propName}, Property type: ${property.propertyType}`);
   * }, false);
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public static forEachMetaData(iModel: IModelDb, classFullName: string, wantSuper: boolean, func: PropertyCallback, includeCustom: boolean = true) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    iModel.forEachMetaData(classFullName, wantSuper, func, includeCustom);
  }

  /** Invoke a callback on each property of the specified class, optionally including superclass properties.
   * @param classFullName The full class name to load the metadata, if necessary
   * @param wantSuper If true, superclass properties will also be processed
   * @param func The callback to be invoked on each property
   * @param includeCustom If true (default), include custom-handled properties in the iteration. Otherwise, skip custom-handled properties.
   * @note Custom-handled properties are core properties that have behavior enforced by C++ handlers.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use `forEachProperty` from `SchemaContext` class instead.
   *
   * @example
   * ```typescript
   * // Current usage:
   * iModel.forEachMetaData("BisCore:Element", true, (name: string, propMetaData: PropertyMetaData) => {
   *   console.log(`Property name: ${name}, Property type: ${propMetaData.primitiveType}`);
   * });
   *
   * // Replacement:
   * imodel.schemaContext.forEachProperty("BisCore:Element", true, (propName: string, property: Property) => {
   *   console.log(`Property name: ${propName}, Property type: ${property.propertyType}`);
   * });
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public forEachMetaData(classFullName: string, wantSuper: boolean, func: PropertyCallback, includeCustom: boolean = true) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const meta = this.getMetaData(classFullName); // will load if necessary
    for (const propName in meta.properties) { // eslint-disable-line guard-for-in
      const propMeta = meta.properties[propName];
      if (includeCustom || !propMeta.isCustomHandled || propMeta.isCustomHandledOrphan)
        func(propName, propMeta);
    }

    if (wantSuper && meta.baseClasses && meta.baseClasses.length > 0)
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      meta.baseClasses.forEach((baseClass) => this.forEachMetaData(baseClass, true, func, includeCustom));
  }

  /**
   * @internal
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Please use `schemaContext` from `iModel` instead to get metadata.
   */
  private loadMetaData(classFullName: string) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (this.classMetaDataRegistry.find(classFullName))
      return;

    const className = classFullName.split(":");
    if (className.length !== 2)
      throw new IModelError(IModelStatus.BadArg, `Invalid classFullName: ${classFullName}`);

    const val = this[_nativeDb].getECClassMetaData(className[0], className[1]);
    if (val.error)
      throw new IModelError(val.error.status, `Error getting class meta data for: ${classFullName}`);

    assert(undefined !== val.result);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const metaData = new EntityMetaData(JSON.parse(val.result));
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this.classMetaDataRegistry.add(classFullName, metaData);

    // Recursive, to make sure that base classes are cached.
    if (metaData.baseClasses !== undefined && metaData.baseClasses.length > 0)
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      metaData.baseClasses.forEach((baseClassName: string) => this.loadMetaData(baseClassName));
  }

  /** Returns the full schema for the input name.
   * @param name The name of the schema e.g. 'BisCore'
   * @returns The SchemaProps for the requested schema
   * @throws if the schema can not be found or loaded.
   */
  public getSchemaProps(name: string): ECSchemaProps {
    return this[_nativeDb].getSchemaProps(name);
  }

  /** Query if this iModel contains the definition of the specified class.
   * @param classFullName The full name of the class, for example, SomeSchema:SomeClass
   * @returns true if the iModel contains the class definition or false if not.
   * @see querySchemaVersion
   * @see importSchema
   */
  public containsClass(classFullName: string): boolean {
    const classNameParts = classFullName.replace(".", ":").split(":");
    return classNameParts.length === 2 && this[_nativeDb].getECClassMetaData(classNameParts[0], classNameParts[1]).error === undefined;
  }

  /** Query the version of a schema of the specified name in this iModel.
   * @returns The schema version as a semver-compatible string or `undefined` if the schema has not been imported.
   */
  public querySchemaVersion(schemaName: string): string | undefined {
    const version = this.querySchemaVersionNumbers(schemaName);
    return version?.toString(false);
  }

  /** Query the version of a schema of the specified name in this iModel.
   * @returns the version numbers, or `undefined` if the schema has not been imported.
   */
  public querySchemaVersionNumbers(schemaName: string): ECVersion | undefined {
    const sql = `SELECT VersionMajor,VersionWrite,VersionMinor FROM ECDbMeta.ECSchemaDef WHERE Name=:schemaName LIMIT 1`;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return this.withPreparedStatement(sql, (statement: ECSqlStatement): ECVersion | undefined => {
      statement.bindString("schemaName", schemaName);
      if (DbResult.BE_SQLITE_ROW === statement.step()) {
        const read: number = statement.getValue(0).getInteger(); // ECSchemaDef.VersionMajor --> semver.major
        const write: number = statement.getValue(1).getInteger(); // ECSchemaDef.VersionWrite --> semver.minor
        const minor: number = statement.getValue(2).getInteger(); // ECSchemaDef.VersionMinor --> semver.patch
        return new ECVersion(read, write, minor);
      }
      return undefined;
    });
  }

  /** Returns true if the specified schema exists in the iModel and is no older than the specified minimum version.
   * @beta
   */
  public meetsMinimumSchemaVersion(schemaName: string, minimumVersion: ECVersion): boolean {
    const actualVersion = this.querySchemaVersionNumbers(schemaName);
    return undefined !== actualVersion && actualVersion.compare(minimumVersion) >= 0;
  }

  /** Throws an error if the version of the schema specified by `schemaName` is older than `minimumVersion`.
   * The error will indicate the `featureName` that requires this minimum version.
   * Use this to produce more helpful errors when interacting with APIs that operate on classes introduced as
   * schemas evolve.
   * @beta
   */
  public requireMinimumSchemaVersion(schemaName: string, minimumVersion: ECVersion, featureName: string): void {
    if (!this.meetsMinimumSchemaVersion(schemaName, minimumVersion)) {
      throw new Error(`${featureName} requires ${schemaName} v${minimumVersion.toString()} or newer`);
    }
  }

  /** Retrieve a named texture image from this iModel, as a TextureData.
   * @param props the texture load properties which must include the name of the texture to load
   * @returns the TextureData or undefined if the texture image is not present.
   * @alpha
   */
  public async queryTextureData(props: TextureLoadProps): Promise<TextureData | undefined> {
    return this[_nativeDb].queryTextureData(props);
  }

  /** Query a "file property" from this iModel, as a string.
   * @returns the property string or undefined if the property is not present.
   */
  public queryFilePropertyString(prop: FilePropertyProps): string | undefined {
    return this[_nativeDb].queryFileProperty(prop, true) as string | undefined;
  }

  /** Query a "file property" from this iModel, as a blob.
   * @returns the property blob or undefined if the property is not present.
   */
  public queryFilePropertyBlob(prop: FilePropertyProps): Uint8Array | undefined {
    return this[_nativeDb].queryFileProperty(prop, false) as Uint8Array | undefined;
  }

  /** Save a "file property" to this iModel
   * @param prop the FilePropertyProps that describes the new property
   * @param value either a string or a blob to save as the file property
   * @note This method should not be called from {TxnManager.withIndirectTxnModeAsync} or {TxnManager.withIndirectTxnMode}.
   */
  public saveFileProperty(prop: FilePropertyProps, strValue: string | undefined, blobVal?: Uint8Array): void {
    if (this.isBriefcaseDb()) {
      if (this.txns.isIndirectChanges) {
        throw new IModelError(IModelStatus.BadRequest, "Cannot save file property while in an indirect change scope");
      }
    }
    this[_nativeDb].saveFileProperty(prop, strValue, blobVal);
  }

  /** delete a "file property" from this iModel
   * @param prop the FilePropertyProps that describes the property
   * @note This method should not be called from {TxnManager.withIndirectTxnModeAsync} or {TxnManager.withIndirectTxnMode}.
   */
  public deleteFileProperty(prop: FilePropertyProps): void {
    if (this.isBriefcaseDb()) {
      if (this.txns.isIndirectChanges) {
        throw new IModelError(IModelStatus.BadRequest, "Cannot delete file property while in an indirect change scope");
      }
    }
    this[_nativeDb].saveFileProperty(prop, undefined, undefined);
  }

  /** Query for the next available major id for a "file property" from this iModel.
   * @param prop the FilePropertyProps that describes the property
   * @returns the next available (that is, an unused) id for prop. If none are present, will return 0.
   */
  public queryNextAvailableFileProperty(prop: FilePropertyProps) { return this[_nativeDb].queryNextAvailableFileProperty(prop); }

  /** @internal */
  public async requestSnap(sessionId: string, props: SnapRequestProps): Promise<SnapResponseProps> {
    let request = this._snaps.get(sessionId);
    if (undefined === request) {
      request = new IModelNative.platform.SnapRequest();
      this._snaps.set(sessionId, request);
    } else
      request.cancelSnap();

    try {
      return await request.doSnap(this[_nativeDb], JsonUtils.toObject(props));
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
    return this[_nativeDb].getGeometryContainment(JsonUtils.toObject(props));
  }

  /** Get the mass properties for the supplied elements. */
  public async getMassProperties(props: MassPropertiesRequestProps): Promise<MassPropertiesResponseProps> {
    return this[_nativeDb].getMassProperties(JsonUtils.toObject(props));
  }

  /** Get the IModel coordinate corresponding to each GeoCoordinate point in the input */
  public async getIModelCoordinatesFromGeoCoordinates(props: IModelCoordinatesRequestProps): Promise<IModelCoordinatesResponseProps> {
    const response = this[_nativeDb].getIModelCoordinatesFromGeoCoordinates(props);

    // fromCache is only meaningful on the front-end; provide it for compatibility with return type.
    response.fromCache = 0;
    // Native omits the array if the input was empty.
    response.iModelCoords = response.iModelCoords ?? [];
    return response;
  }

  /** Get the GeoCoordinate (longitude, latitude, elevation) corresponding to each IModel Coordinate point in the input */
  public async getGeoCoordinatesFromIModelCoordinates(props: GeoCoordinatesRequestProps): Promise<GeoCoordinatesResponseProps> {
    const response = this[_nativeDb].getGeoCoordinatesFromIModelCoordinates(props);

    // fromCache is only meaningful on the front-end; provide it for compatibility with return type.
    response.fromCache = 0;
    // Native omits the array if the input was empty.
    response.geoCoords = response.geoCoords ?? [];
    return response;
  }

  /** Export meshes suitable for graphics APIs from arbitrary geometry in elements in this IModelDb.
   *  * Requests can be slow when processing many elements so it is expected that this function be used on a dedicated backend,
   *    or that shared backends export a limited number of elements at a time. Consider using exportGraphicsAsync instead.
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
    return this[_nativeDb].exportGraphics(exportProps);
  }

  /** Export meshes suitable for graphics APIs from arbitrary geometry in elements in this IModelDb.
   *  * This function queues an export task to the thread pool for each provided element ID, and returns
   *    a Promise that resolves when all elements have been exported. The onGraphics and onLineGraphics
   *    callbacks are invoked in the main thread as each element's export completes. This allows large
   *    exports to be performed without blocking the main thread.
   *  * Vertices are exported in the IModelDb's world coordinate system, which is right-handed with Z pointing up.
   *  * The results of changing [ExportGraphicsOptions]($core-backend) during the [ExportGraphicsOptions.onGraphics]($core-backend)
   *    callback are not defined.
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
   * await iModel.exportGraphicsAsync(({ onGraphics, elementIdArray: ["0x1"] }));
   * ```
   * @returns A Promise that resolves when the export is complete, or rejects in the case of an error.
   * @public
   */
  public async exportGraphicsAsync(exportProps: ExportGraphicsOptions): Promise<void> {
    return this[_nativeDb].exportGraphicsAsync(exportProps);
  }

  /**
   * Exports meshes suitable for graphics APIs from a specified [GeometryPart]($core-backend)
   * in this IModelDb.
   * The expected use case is to call [IModelDb.exportGraphics]($core-backend) and supply the
   * optional partInstanceArray argument, then call this function for each unique GeometryPart from
   * that list.  Consider using exportPartGraphicsAsync instead.
   *  * The results of changing [ExportPartGraphicsOptions]($core-backend) during the
   *    [ExportPartGraphicsOptions.onPartGraphics]($core-backend) callback are not defined.
   *  * See export-gltf under test-apps in the iTwin.js monorepo for a working reference.
   * @returns 0 is successful, status otherwise
   * @public
   */
  public exportPartGraphics(exportProps: ExportPartGraphicsOptions): DbResult {
    return this[_nativeDb].exportPartGraphics(exportProps);
  }

  /**
   * Exports meshes suitable for graphics APIs from a specified [GeometryPart]($core-backend)
   * in this IModelDb.
   * The expected use case is to call [IModelDb.exportGraphicsAsync]($core-backend) and supply the
   * optional partInstanceArray argument, then call this function for each unique GeometryPart from
   * that list. Each export queues a task to the thread pool, allowing multiple parts to be exported
   * in parallel and without blocking the main thread. The onPartGraphics and onPartLineGraphics
   * callbacks are invoked in the main thread.
   *  * The results of changing [ExportPartGraphicsOptions]($core-backend) during the
   *    [ExportPartGraphicsOptions.onPartGraphics]($core-backend) callback are not defined.
   *  * See export-gltf under test-apps in the iTwin.js monorepo for a working reference.
   * @returns A Promise that resolves when the export is complete, or rejects in the case of an error.
   * @public
   */
  public async exportPartGraphicsAsync(exportProps: ExportPartGraphicsOptions): Promise<void> {
    return this[_nativeDb].exportPartGraphicsAsync(exportProps);
  }

  /** Request geometry stream information from an element in binary format instead of json.
   * @returns IModelStatus.Success if successful
   * @beta
   */
  public elementGeometryRequest(requestProps: ElementGeometryRequest): IModelStatus {
    return this[_nativeDb].processGeometryStream(requestProps);
  }

  /** Request the creation of a backend geometry cache for the specified geometric element.
   * @returns ElementGeometryCacheResponseProps
   * @beta
   */
  public async updateElementGeometryCache(requestProps: ElementGeometryCacheRequestProps): Promise<ElementGeometryCacheResponseProps> {
    return this[_nativeDb].updateElementGeometryCache(requestProps);
  }

  /** Request operation using the backend geometry cache populated by first calling elementGeometryRequest.
 * @returns SUCCESS if requested operation could be applied.
 * @beta
 */
  public elementGeometryCacheOperation(requestProps: ElementGeometryCacheOperationRequestProps): BentleyStatus {
    return this[_nativeDb].elementGeometryCacheOperation(requestProps);
  }

  /** Create brep geometry for inclusion in an element's geometry stream.
   * @returns IModelStatus.Success if successful
   * @throws [[IModelError]] to report issues with input geometry or parameters
   * @alpha
   */
  public createBRepGeometry(createProps: BRepGeometryCreate): IModelStatus {
    return this[_nativeDb].createBRepGeometry(createProps);
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
  public saveSettingDictionary(name: string, dict: SettingsContainer) {
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
  private loadIModelSettings() {
    if (!this[_nativeDb].isOpen())
      return;

    this.withSqliteStatement("SELECT Name,StrData FROM be_Prop WHERE Namespace=?", (stmt) => {
      stmt.bindString(1, IModelDb._settingPropNamespace);
      while (stmt.nextRow()) {
        try {
          const settings = JSON.parse(stmt.getValueString(1));
          this.workspace.settings.addDictionary({ name: stmt.getValueString(0), priority: SettingsPriority.iModel }, settings);
        } catch (e) {
          Workspace.exceptionDiagnosticFn(e as WorkspaceDbLoadError);
        }
      }
    });
  }

  /** @internal */
  protected async loadWorkspaceSettings() {
    try {
      const problems: WorkspaceDbLoadError[] = [];
      const settingProps: WorkspaceDbSettingsProps[] = [];
      // Note: we can't use `getArray` here because we only look at dictionaries in the iModel's workspace, not appWorkspace.
      // Also, we must concatenate all entries in all of the dictionaries stored in the iModel into a single array *before*
      // calling `loadSettingsDictionary` since that function will add new dictionaries to the workspace.
      for (const dict of this.workspace.settings.dictionaries) {
        try {
          const props = dict.getSetting<WorkspaceDbSettingsProps[]>(WorkspaceSettingNames.settingsWorkspaces);
          if (props)
            settingProps.push(...IModelHost.settingsSchemas.validateSetting(props, WorkspaceSettingNames.settingsWorkspaces));
        } catch (e) {
          problems.push(e as WorkspaceDbLoadError); // something wrong with the setting stored in the iModel
        }
      }
      if (settingProps.length > 0)
        await this.workspace.loadSettingsDictionary(settingProps, problems);

      if (problems.length > 0)
        throwWorkspaceDbLoadErrors(`attempting to load workspace settings for iModel '${this.name}':`, problems);
    } catch (e) {
      // we don't want to throw exceptions when attempting to load Dictionaries. Call the diagnostics function instead.
      Workspace.exceptionDiagnosticFn(e as WorkspaceDbLoadErrors);
    }
  }

  /**
   * Controls how [Code]($common)s are copied from this iModel into another iModel, to work around problems with iModels
   * created by older connectors. The [imodel-transformer](https://github.com/iTwin/imodel-transformer) sets this appropriately
   * on your behalf - you should never need to set or interrogate this property yourself.
   * @public
   */
  public get codeValueBehavior(): "exact" | "trim-unicode-whitespace" {
    return this[_nativeDb].getCodeValueBehavior();
  }

  public set codeValueBehavior(newBehavior: "exact" | "trim-unicode-whitespace") {
    this[_nativeDb].setCodeValueBehavior(newBehavior);
  }

  /** @internal */
  public computeRangesForText(args: ComputeRangesForTextLayoutArgs): TextLayoutRanges {
    const props = this[_nativeDb].computeRangesForText(args.chars, args.fontId, args.bold, args.italic, args.widthFactor, args.textHeight);
    return {
      layout: Range2d.fromJSON(props.layout),
      justification: Range2d.fromJSON(props.justification),
    };
  }

  /** Writes the contents of a single ECSchema to a file on the local file system.
   * @beta
   */
  public exportSchema(args: ExportSchemaArgs): void {
    processSchemaWriteStatus(this[_nativeDb].exportSchema(args.schemaName, args.outputDirectory, args.outputFileName));
  }

  /** Writes the contents of all ECSchemas in this iModel to files in a directory on the local file system.
   * @beta
   */
  public exportSchemas(outputDirectory: LocalFileName): void {
    processSchemaWriteStatus(this[_nativeDb].exportSchemas(outputDirectory));
  }

  /** Attempt to simplify the geometry stream of a single [[GeometricElement]] or [[GeometryPart]] as specified by `args`.
   * @beta
   */
  public simplifyElementGeometry(args: SimplifyElementGeometryArgs): IModelStatus {
    return this[_nativeDb].simplifyElementGeometry(args);
  }

  /** Attempts to optimize all of the geometry in this iModel by identifying [[GeometryPart]]s that are referenced by exactly one
   * element's geometry stream. Each such reference is replaced by inserting the part's geometry directly into the element's geometry stream.
   * Then, the no-longer-used geometry part is deleted.
   * This can improve performance when a connector inadvertently creates large numbers of parts that are each only used once.
   * @beta
   */
  public inlineGeometryParts(): InlineGeometryPartsResult {
    return this[_nativeDb].inlineGeometryPartReferences();
  }

  /** Returns a string representation of the error that most recently arose during an operation on the underlying SQLite database.
   * If no errors have occurred, an empty string is returned.
   * Otherwise, a string of the format `message (code)` is returned, where `message` is a human-readable diagnostic string and `code` is an integer status code.
   * See [SQLite error codes and messages](https://www.sqlite.org/c3ref/errcode.html)
   * @note Do not rely upon this value or its specific contents in error handling logic. It is only intended for use in debugging.
   */
  public getLastError(): string {
    return this[_nativeDb].getLastError();
  }
}

function processSchemaWriteStatus(status: SchemaWriteStatus): void {
  switch (status) {
    case SchemaWriteStatus.Success: return;
    case SchemaWriteStatus.FailedToSaveXml: throw new Error("Failed to save schema XML");
    case SchemaWriteStatus.FailedToCreateXml: throw new Error("Failed to create schema XML");
    case SchemaWriteStatus.FailedToCreateJson: throw new Error("Failed to create schema JSON");
    case SchemaWriteStatus.FailedToWriteFile: throw new Error("Failed to write schema file");
    default: throw new Error("Unknown error while exporting schema");
  }
}

/** @public */
export namespace IModelDb {

  /** The collection of models in an [[IModelDb]].
   * @public @preview
   */
  export class Models {
    private readonly _modelCacheSize = 10;
    /** @internal */
    public readonly [_cache] = new LRUMap<Id64String, ModelProps>(this._modelCacheSize);
    /** @internal */
    public readonly [_instanceKeyCache] = new InstanceKeyLRUCache(this._modelCacheSize);

    /** @internal */
    public constructor(private _iModel: IModelDb) { }

    /** Get the ModelProps with the specified identifier.
     * @param modelId The Model identifier.
     * @throws [[IModelError]] if the model is not found or cannot be loaded.
     * @see tryGetModelProps
     */
    public getModelProps<T extends ModelProps>(id: Id64String): T {
      const model = this.tryGetModelProps<T>(id);
      if (undefined === model)
        throw new IModelError(IModelStatus.NotFound, `Model=${id}`);
      return model;
    }

    /** Get the ModelProps with the specified identifier.
     * @param modelId The Model identifier.
     * @returns The ModelProps or `undefined` if the model is not found.
     * @throws [[IModelError]] if the model cannot be loaded.
     * @note Useful for cases when a model may or may not exist and throwing an `Error` would be overkill.
     * @see getModelProps
     */
    public tryGetModelProps<T extends ModelProps>(id: Id64String): T | undefined {
      try {
        if (IModelHost.configuration?.disableThinnedNativeInstanceWorkflow) {
          return this._iModel[_nativeDb].getModel({ id }) as T;
        }

        const cachedMdl = this[_cache].get(id);
        if (cachedMdl) {
          return cachedMdl as T;
        }

        const options = { useJsNames: true }
        const instanceKey = this.resolveModelKey({ id });
        const rawInstance = this._iModel[_nativeDb].readInstance(instanceKey, options) as ECSqlRow;
        const classDef = this._iModel.getJsClass<typeof Model>(rawInstance.classFullName);
        const modelProps = classDef.deserialize({ row: rawInstance, iModel: this._iModel }) as T;
        this[_cache].set(id, modelProps);
        return modelProps;
      } catch {
        return undefined;
      }
    }

    /** Query for the last modified time for a [[Model]].
     * @param modelId The Id of the model.
     * @throws IModelError if `modelId` does not identify a model in the iModel.
     */
    public queryLastModifiedTime(modelId: Id64String): string {
      const sql = `SELECT LastMod FROM ${Model.classFullName} WHERE ECInstanceId=:modelId`;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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

    private resolveModelKey(modelIdArg: ModelLoadProps): IModelJsNative.ResolveInstanceKeyResult {
      const baseClassName = "BisCore:Model";
      let args: IModelJsNative.ResolveInstanceKeyArgs;
      if (modelIdArg.id) {
        args = { partialKey: { id: modelIdArg.id, baseClassName } };
      } else if (modelIdArg.code) {
        const modelId = this._iModel.elements.getElementProps<ElementProps>({ code: modelIdArg.code }).id;
        if (!modelId)
          throw new IModelError(IModelStatus.NotFound, `Model not found with code: [spec:${modelIdArg.code.spec}, scope:${modelIdArg.code.scope}, value:${modelIdArg.code.value}])`);
        args = { partialKey: { id: modelId, baseClassName } };
      } else {
        throw new IModelError(IModelStatus.InvalidId, `Invalid model identifier: ${JSON.stringify(modelIdArg)}`);
      }
      // Check the cache to avoid unnecessary native calls
      const cachedResult = this[_instanceKeyCache].get(args);
      if (cachedResult) {
        return cachedResult;
      } else {
        const instanceKey = this._iModel[_nativeDb].resolveInstanceKey(args);
        this[_instanceKeyCache].set(args, instanceKey);
        return instanceKey;
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
        return props.id = this._iModel[_nativeDb].insertModel(props);
      } catch (err: any) {
        const error = new IModelError(err.errorNumber, `Error inserting model [${err.message}], class=${props.classFullName}`);
        error.cause = err;
        throw error;
      }
    }

    /** Update an existing model.
     * @param props the properties of the model to change
     * @throws [[IModelError]] if unable to update the model.
     */
    public updateModel(props: UpdateModelOptions): void {
      try {
        if (props.id)
          this[_cache].delete(props.id);

        this._iModel[_nativeDb].updateModel(props);
      } catch (err: any) {
        const error = new IModelError(err.errorNumber, `Error updating model [${err.message}], id: ${props.id}`);
        error.cause = err;
        throw error;
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
      this._iModel.models[_cache].delete(modelId);
      const error = this._iModel[_nativeDb].updateModelGeometryGuid(modelId);
      if (error !== IModelStatus.Success)
        throw new IModelError(error, `Error updating geometry guid for model ${modelId}`);
    }

    /** Delete one or more existing models.
     * @param ids The Ids of the models to be deleted
     * @throws [[IModelError]]
     */
    public deleteModel(ids: Id64Arg): void {
      Id64.toIdSet(ids).forEach((id) => {
        try {
          this[_cache].delete(id);
          this[_instanceKeyCache].deleteById(id);
          this._iModel[_nativeDb].deleteModel(id);
        } catch (err: any) {
          const error = new IModelError(err.errorNumber, `Error deleting model [${err.message}], id: ${id}`);
          error.cause = err;
          throw error;
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

      return this._iModel[_nativeDb].queryModelExtentsAsync(ids);
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
   * @public @preview
   */
  export class Elements implements GuidMapper {
    private readonly _elementCacheSize = 50;
    /** @internal */
    public readonly [_cache] = new ElementLRUCache(this._elementCacheSize);
    /** @internal */
    public readonly [_instanceKeyCache] = new InstanceKeyLRUCache(this._elementCacheSize);

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

    /** Get properties of an Element by Id, FederationGuid, or Code
     * @throws [[IModelError]] if the element is not found or cannot be loaded.
     * @see tryGetElementProps
     */
    public getElementProps<T extends ElementProps>(props: Id64String | GuidString | Code | ElementLoadProps): T {
      const elProp = this.tryGetElementProps<T>(props);
      if (undefined === elProp)
        throw new IModelError(IModelStatus.NotFound, `element not found`);
      return elProp;
    }

    private resolveElementKey(props: Id64String | GuidString | Code | ElementLoadProps): IModelJsNative.ResolveInstanceKeyResult {
      const baseClassName = "BisCore:Element";
      let args: IModelJsNative.ResolveInstanceKeyArgs;
      if (typeof props === "string") {
        args = Id64.isId64(props) ? { partialKey: { id: props, baseClassName } } : { federationGuid: props };
      } else if (props instanceof Code) {
        args = { code: props };
      } else {
        if (props.id) {
          args = { partialKey: { id: props.id, baseClassName } };
        }
        else if (props.federationGuid) {
          args = { federationGuid: props.federationGuid };
        }
        else if (props.code) {
          args = { code: props.code };
        } else {
          throw new IModelError(IModelStatus.InvalidId, "Element Id or FederationGuid or Code is required");
        }
      }
      // Check the cache to avoid unnecessary native calls
      const cachedResult = this[_instanceKeyCache].get(args);
      if (cachedResult) {
        return cachedResult;
      } else {
        const instanceKey = this._iModel[_nativeDb].resolveInstanceKey(args);
        this[_instanceKeyCache].set(args, instanceKey);
        return instanceKey;
      }
    }

    /** Get properties of an Element by Id, FederationGuid, or Code
     * @returns The properties of the element or `undefined` if the element is not found.
     * @throws [[IModelError]] if the element exists, but cannot be loaded.
     * @note Useful for cases when an element may or may not exist and throwing an `Error` would be overkill.
     * @see getElementProps
     */
    public tryGetElementProps<T extends ElementProps>(props: Id64String | GuidString | Code | ElementLoadProps): T | undefined {
      if (typeof props === "string") {
        props = Id64.isId64(props) ? { id: props } : { federationGuid: props };
      } else if (props instanceof Code) {
        props = { code: props };
      }
      try {
        if (IModelHost.configuration?.disableThinnedNativeInstanceWorkflow) {
          return this._iModel[_nativeDb].getElement(props) as T;
        }

        const cachedElm = this[_cache].get(props);
        if (cachedElm) {
          return cachedElm.elProps as T;
        }

        const options = { ...props, useJsNames: true };
        const instanceKey = this.resolveElementKey(props);
        const rawInstance = this._iModel[_nativeDb].readInstance(instanceKey, options) as ECSqlRow;
        const classDef = this._iModel.getJsClass<typeof Element>(rawInstance.classFullName);
        const elementProps = classDef.deserialize({ row: rawInstance, iModel: this._iModel, options: { element: props } }) as T;
        this[_cache].set({ elProps: elementProps, loadOptions: props });
        return elementProps;
      } catch {
        return undefined;
      }
    }

    /** Get an element by Id, FederationGuid, or Code
     * @param elementId either the element's Id, Code, or FederationGuid, or an ElementLoadProps
     * @param elementClass Optional class to validate instance against. This parameter can accept abstract or concrete classes, but should be the same as the template (`T`) parameter.
     * @throws [[IModelError]] if the element is not found, cannot be loaded, or fails validation when `elementClass` is specified.
     * @see tryGetElement
     */
    public getElement<T extends Element>(elementId: Id64String | GuidString | Code | ElementLoadProps, elementClass?: EntityClassType<Element>): T {
      const element = this.tryGetElement<T>(elementId, elementClass);
      if (undefined === element) {
        if (typeof elementId === "string" || elementId instanceof Code)
          throw new IModelError(IModelStatus.NotFound, `Element=${elementId.toString()}`);
        else
          throw new IModelError(IModelStatus.NotFound, `Element={id: ${elementId.id} federationGuid: ${elementId.federationGuid}, code={spec: ${elementId.code?.spec}, scope: ${elementId.code?.scope}, value: ${elementId.code?.value}}}`);
      }
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

      const elementProps = this.tryGetElementProps<ElementProps>(elementId);
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

      const codeToQuery = new Code(code);
      try {
        const elementKey = this.resolveElementKey(codeToQuery);
        return Id64.fromString(elementKey.id);
      } catch (err: any) {
        if (err.errorNumber === IModelStatus.NotFound)
          return undefined;
        throw err;
      }
    }

    /** Query for an [[Element]]'s last modified time.
     * @param elementId The Id of the element.
     * @throws IModelError if `elementId` does not identify an element in the iModel.
     */
    public queryLastModifiedTime(elementId: Id64String): string {
      const sql = "SELECT LastMod FROM BisCore:Element WHERE ECInstanceId=:elementId";
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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
     * @throws [[ITwinError]] if unable to insert the element.
     * @note For convenience, the value of `elProps.id` is updated to reflect the resultant element's id.
     * However when `elProps.federationGuid` is not present or undefined, a new Guid will be generated and stored on the resultant element. But
     * the value of `elProps.federationGuid` is *not* updated. Generally, it is best to re-read the element after inserting (e.g. via [[getElementProps]])
     * if you intend to continue working with it. That will ensure its values reflect the persistent state.
     */
    public insertElement(elProps: ElementProps, options?: InsertElementOptions): Id64String {
      try {
        this[_cache].delete({
          id: elProps.id,
          federationGuid: elProps.federationGuid,
          code: elProps.code,
        });
        return elProps.id = this._iModel[_nativeDb].insertElement(elProps, options);
      } catch (err: any) {
        err.message = `Error inserting element [${err.message}]`;
        err.metadata = { elProps };
        throw err;
      }
    }

    /**
     * Update some properties of an existing element.
     * All parts of `elProps` are optional *other than* `id`. If id is missing, an exception is thrown.
     *
     * To support clearing a property value, every property name that is present in the `elProps` object will be updated even if the value is `undefined`.
     * To keep an individual element property unchanged, it should either be excluded from the `elProps` parameter or set to its current value.
     * @param elProps the properties of the element to update.
     * @note The values of `classFullName` and `model` *may not be changed* by this method. Further, it will permute the `elProps` object by adding or
     * overwriting their values to the correct values.
     * @throws [[ITwinError]] if unable to update the element.
     */
    public updateElement<T extends ElementProps>(elProps: Partial<T>): void {
      try {
        if (elProps.id) {
          this[_instanceKeyCache].deleteById(elProps.id);
        } else {
          this[_instanceKeyCache].delete({
            federationGuid: elProps.federationGuid,
            code: elProps.code,
          });
        }
        this[_cache].delete({
          id: elProps.id,
          federationGuid: elProps.federationGuid,
          code: elProps.code,
        });
        this._iModel[_nativeDb].updateElement(elProps);
      } catch (err: any) {
        err.message = `Error updating element [${err.message}], id: ${elProps.id}`;
        err.metadata = { elProps };
        throw err;
      }
    }

    /** Delete one or more elements from this iModel.
     * @param ids The set of Ids of the element(s) to be deleted
     * @throws [[ITwinError]]
     * @see deleteDefinitionElements
     */
    public deleteElement(ids: Id64Arg): void {
      const iModel = this._iModel;
      Id64.toIdSet(ids).forEach((id) => {
        try {
          this[_cache].delete({ id });
          this[_instanceKeyCache].deleteById(id);
          iModel[_nativeDb].deleteElement(id);
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
      const usageInfo = this._iModel[_nativeDb].queryDefinitionElementUsage(definitionElementIds);
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
        this._iModel[_nativeDb].beginPurgeOperation();
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
        this._iModel[_nativeDb].endPurgeOperation();
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
          const viewRelatedUsageInfo = this._iModel[_nativeDb].queryDefinitionElementUsage(viewRelatedIds);
          if (viewRelatedUsageInfo) {
            const usedViewRelatedIdSet: Id64Set = viewRelatedUsageInfo.usedIds ? Id64.toIdSet(viewRelatedUsageInfo.usedIds) : new Set<Id64String>();
            try {
              this._iModel[_nativeDb].beginPurgeOperation();
              deleteIfUnused(viewRelatedUsageInfo.displayStyleIds, usedViewRelatedIdSet);
              deleteIfUnused(viewRelatedUsageInfo.categorySelectorIds, usedViewRelatedIdSet);
              deleteIfUnused(viewRelatedUsageInfo.modelSelectorIds, usedViewRelatedIdSet);
            } finally {
              this._iModel[_nativeDb].endPurgeOperation();
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
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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
          Logger.logInfo(BackendLoggerCategory.ECDb, `No aspects found for class ${aspectClassFullName} and element ${elementId}`);
        return allAspects;
      }

      // Check if class is abstract
      const fullClassName = aspectClassFullName.replace(".", ":").split(":");
      const val = this._iModel[_nativeDb].getECClassMetaData(fullClassName[0], fullClassName[1]);
      if (val.result !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const metaData = new EntityMetaData(JSON.parse(val.result));
        if (metaData.modifier !== "Abstract") // Class is not abstract, use normal query to retrieve aspects
          return this._queryAspects(elementId, aspectClassFullName, excludedClassFullNames);
      }
      // If class specified is abstract, get the list of all classes derived from it
      let classIdList = IModelDb.Elements.classMap.get(aspectClassFullName);
      if (classIdList === undefined) {
        const classIds: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        this._iModel.withPreparedStatement(`select SourceECInstanceId from meta.ClassHasAllBaseClasses where TargetECInstanceId = (select ECInstanceId from meta.ECClassDef where Name='${fullClassName[1]}'
        and Schema.Id = (select ECInstanceId from meta.ECSchemaDef where Name='${fullClassName[0]}')) and SourceECInstanceId != TargetECInstanceId`,
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          (statement: ECSqlStatement) => {
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
        Logger.logInfo(BackendLoggerCategory.ECDb, `No aspects found for class ${aspectClassFullName} and element ${elementId}`);
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
        return this._iModel[_nativeDb].insertElementAspect(aspectProps);
      } catch (err: any) {
        const error = new IModelError(err.errorNumber, `Error inserting ElementAspect [${err.message}], class: ${aspectProps.classFullName}`, aspectProps);
        error.cause = err;
        throw error;
      }
    }

    /** Update an exist ElementAspect within the iModel.
     * @param aspectProps The properties to use to update the ElementAspect.
     * @throws [[IModelError]] if unable to update the ElementAspect.
     */
    public updateAspect(aspectProps: ElementAspectProps): void {
      try {
        this._iModel[_nativeDb].updateElementAspect(aspectProps);
      } catch (err: any) {
        const error = new IModelError(err.errorNumber, `Error updating ElementAspect [${err.message}], id: ${aspectProps.id}`, aspectProps);
        error.cause = err;
        throw error;
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
          iModel[_nativeDb].deleteElementAspect(aspectInstanceId);
        } catch (err: any) {
          const error = new IModelError(err.errorNumber, `Error deleting ElementAspect [${err.message}], id: ${aspectInstanceId}`);
          error.cause = err;
          throw error;
        }
      });
    }
  }

  /** The collection of views in an [[IModelDb]].
   * @public @preview
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
    public async accessViewStore(args: { props?: CloudSqlite.ContainerProps, accessLevel?: BlobContainer.RequestAccessLevel }): Promise<ViewStore.CloudAccess> {
      let props = args.props;
      if (undefined === props) {
        const propsString = this._iModel.queryFilePropertyString(Views.viewStoreProperty);
        if (!propsString)
          ViewStoreError.throwError("no-viewstore", { message: "iModel does not have a default ViewStore" });

        props = JSON.parse(propsString) as CloudSqlite.ContainerProps;
      }
      const accessToken = await CloudSqlite.requestToken({
        ...props,
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
        } catch { }
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
        } catch { }
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
        throw new IModelError(IModelStatus.BadArg, "illegal thumbnail id");

      return { namespace: "dgn_View", name: "Thumbnail", id: viewDefinitionId };
    }

    /** Get the thumbnail for a view.
     * @param viewDefinitionId The Id of the view for thumbnail
     * @returns the ThumbnailProps, or undefined if no thumbnail exists.
     */
    public getThumbnail(viewDefinitionId: Id64String): ThumbnailProps | undefined {
      const viewArg = this.getViewThumbnailArg(viewDefinitionId);
      const sizeProps = this._iModel[_nativeDb].queryFileProperty(viewArg, true) as string;
      if (undefined === sizeProps)
        return undefined;

      const out = JSON.parse(sizeProps) as ThumbnailProps;
      out.image = this._iModel[_nativeDb].queryFileProperty(viewArg, false) as Uint8Array;
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
      this._iModel[_nativeDb].saveFileProperty(viewArg, JSON.stringify(props), thumbnail.image);
      return 0;
    }

    /** Set the default view property the iModel.
     * @param viewId The Id of the ViewDefinition to use as the default
     * @deprecated in 4.2.0 - will not be removed until after 2026-06-13. Avoid setting this property - it is not practical for one single view to serve the needs of the many applications
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
        this._iModel[_nativeDb].getTileTree(id, (ret: IModelJsNative.ErrorStatusOrResult<IModelStatus, any>) => {
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
        ret = this._iModel[_nativeDb].pollTileContent(treeId, tileId);
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
        this._iModel[_nativeDb].getTileContent(treeId, tileId, resolve);
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

  private _skipSyncSchemasOnPullAndPush?: true;

  /** @internal */
  public get skipSyncSchemasOnPullAndPush() { return this._skipSyncSchemasOnPullAndPush ?? false; }

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
   * Permanently discards any local changes made to this briefcase, reverting the briefcase to its last synchronized state.
   * This operation cannot be undone. By default, all locks held by this briefcase will be released unless the `retainLocks` option is specified.
   * @Note This operation can be performed at any point including after failed rebase attempts.
   * @param args - Options for discarding changes.
   * @param args.retainLocks - If `true`, retains all currently held locks after discarding changes. If omitted or `false`, all locks will be released.
   * @returns A promise that resolves when the operation is complete.
   * @throws May throw if discarding changes fails.
   *
   * @public @preview
   */
  public async discardChanges(args?: { retainLocks?: true }): Promise<void> {
    Logger.logInfo(loggerCategory, "Discarding local changes");
    if (this.txns.isIndirectChanges) {
      throw new IModelError(IModelStatus.BadRequest, "Cannot discard changes when there are indirect changes");
    }

    if (this.txns.rebaser.inProgress() && !this.txns.rebaser.isAborting) {
      throw new IModelError(IModelStatus.BadRequest, "Cannot discard changes while a rebase is in progress");
    }

    this.clearCaches();
    this[_nativeDb].discardLocalChanges();
    this[_resetIModelDb]();
    BriefcaseManager.deleteRebaseFolders(this);
    if (args?.retainLocks) {
      return;
    }

    // attempt to release locks must happen after changes are undone successfully
    Logger.logInfo(loggerCategory, "Releasing locks after discarding changes");
    await this.locks.releaseAllLocks();
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
    return !this[_nativeDb].isReadonly() && (this.briefcaseId !== BriefcaseIdValue.Unassigned) && (undefined === this[_nativeDb].queryLocalValue(BriefcaseLocalValue.NoLocking));
  }

  // if the iModel uses a lock server, create a ServerBasedLocks LockControl for this BriefcaseDb.
  protected makeLockControl() {
    if (this.useLockServer)
      this._locks = createServerBasedLocks(this);
  }

  protected constructor(args: { nativeDb: IModelJsNative.DgnDb, key: string, openMode: OpenMode, briefcaseId: number }) {
    super({ ...args, changeset: args.nativeDb.getCurrentChangeset() });
    this._openMode = args.openMode;
    this.briefcaseId = args.briefcaseId;
    this.makeLockControl();
  }

  /** Upgrades the profile or domain schemas. File must be closed before this call and is always left closed. */
  private static async doUpgrade(briefcase: OpenBriefcaseArgs, upgradeOptions: UpgradeOptions, description: string): Promise<void> {
    let wasChanges = false;
    const executeUpgrade = () => {
      const nativeDb = this.openDgnDb({ path: briefcase.fileName }, OpenMode.ReadWrite, upgradeOptions); // performs the upgrade
      wasChanges = nativeDb.hasPendingTxns();
      nativeDb.closeFile();
    };

    const isSchemaSyncEnabled = await withBriefcaseDb(briefcase, async (db) => {
      await SchemaSync.pull(db);
      return db[_nativeDb].schemaSyncEnabled();
    }) as boolean;

    if (isSchemaSyncEnabled) {
      await SchemaSync.withLockedAccess(briefcase, { openMode: OpenMode.Readonly, operationName: "schema sync" }, async (syncAccess) => {
        const schemaSyncDbUri = syncAccess.getUri();
        executeUpgrade();
        await withBriefcaseDb(briefcase, async (db) => {
          db[_nativeDb].schemaSyncPush(schemaSyncDbUri);
          db.saveChanges();
        });
        syncAccess.synchronizeWithCloud();
      });
    } else {
      executeUpgrade();
    }

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
    try {
      await this.doUpgrade(briefcase, { profile: ProfileOptions.Upgrade }, "Upgraded profile");
    } catch (error: any) {
      if (error.errorNumber === DbResult.BE_SQLITE_ERROR_DataTransformRequired) {
        Logger.logInfo(loggerCategory, `Profile upgrade contains data transform. Retrying upgrade with a schema lock.`);
        try {
          await withBriefcaseDb(briefcase, async (db) => db.acquireSchemaLock()); // may not really acquire lock if iModel uses "noLocks" mode.
          await this.doUpgrade(briefcase, { profile: ProfileOptions.Upgrade, schemaLockHeld: true }, "Upgraded profile");
          await this.doUpgrade(briefcase, { domain: DomainOptions.Upgrade, schemaLockHeld: true }, "Upgraded domain schemas");
        } finally {
          await withBriefcaseDb(briefcase, async (db) => db.locks[_releaseAllLocks]());
        }
        return;
      }
      throw error;
    }
    try {
      await this.doUpgrade(briefcase, { domain: DomainOptions.Upgrade }, "Upgraded domain schemas");
    } catch (error: any) {
      if (error.errorNumber === DbResult.BE_SQLITE_ERROR_DataTransformRequired) {
        Logger.logInfo(loggerCategory, `Domain schema upgrade contains data transform. Retrying upgrade with a schema lock.`);
        try {
          await withBriefcaseDb(briefcase, async (db) => db.acquireSchemaLock()); // may not really acquire lock if iModel uses "noLocks" mode.
          await this.doUpgrade(briefcase, { domain: DomainOptions.Upgrade, schemaLockHeld: true }, "Upgraded domain schemas");
        } finally {
          await withBriefcaseDb(briefcase, async (db) => db.locks[_releaseAllLocks]());
        }
        return;
      }
      throw error;
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
    const briefcaseDb = new this({ nativeDb, key: file.key ?? Guid.createValue(), openMode, briefcaseId: nativeDb.getBriefcaseId() });

    // If they asked to watch for changes, set an fs.watch on the "-watch" file (only it is modified while we hold this connection.)
    // Whenever there are changes, restart our defaultTxn. That loads the changes from the other connection and sends
    // notifications as if they happened on this connection. Note: the watcher is called only when the backend event loop cycles.
    if (args.watchForChanges && undefined === args.container) {
      // Must touch the file synchronously - cannot watch a file until it exists.
      touch.sync(briefcaseDb.watchFilePathName);

      // Restart default txn to trigger events when watch file is changed by some other process.
      const watcher = fs.watch(briefcaseDb.watchFilePathName, { persistent: false }, () => {
        nativeDb.clearECDbCache();
        nativeDb.restartDefaultTxn();
        briefcaseDb.changeset = briefcaseDb[_nativeDb].getCurrentChangeset();
      });

      // Stop the watcher when we close this connection.
      briefcaseDb.onBeforeClose.addOnce(() => {
        watcher.close();
      });
    }

    // load all of the settings from workspaces
    await briefcaseDb.loadWorkspaceSettings();

    if (openMode === OpenMode.ReadWrite && CodeService.createForIModel) {
      try {
        briefcaseDb._codeService = await CodeService.createForIModel(briefcaseDb);
        this.onCodeServiceCreated.raiseEvent(briefcaseDb);
      } catch (e: any) {
        if ((e as CodeService.Error).errorId !== "NoCodeIndex") { // no code index means iModel isn't enforcing codes.
          Logger.logWarning(loggerCategory, `The CodeService is not available for this briefcase: errorId: ${(e as CodeService.Error).errorId}, errorMessage; ${e.message}. Proceeding with BriefcaseDb.open(), but all operations involving codes will fail.`);
          briefcaseDb._codeService = {
            verifyCode: (props: CodeService.ElementCodeProps) => {
              if (!Code.isEmpty(props.props.code)) {
                e.message = `The CodeService is not available for this briefcase: errorId: ${(e as CodeService.Error).errorId}, errorMessage; ${e.message}.`;
                throw e;
              }
            },
            appParams: {
              author: { name: "unknown" },
              origin: { name: "unknown" },
            },
            close: () => { },
            initialize: async () => { },
          };
        }
      }
    }

    this.onOpened.raiseEvent(briefcaseDb, args);
    return briefcaseDb;
  }

  /**
   * Iterate through the existing transactions to see if any of them are schema transactions.
   * @returns true if any schema transactions exist.
   * @beta
   */
  public checkIfSchemaTxnExists(): boolean {
    const txnProps = Array.from(this.txns.queryTxns());
    return txnProps.some((props) => props.type === "Schema" || props.type === "ECSchema");
  }

  /**  This is called by native code when applying a changeset */
  private onChangesetConflict(args: DbMergeChangesetConflictArgs): DbConflictResolution | undefined {
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
        if (args.tableName === "be_Prop") {
          if (args.getValueText(0, DbChangeStage.Old) === "ec_Db" && args.getValueText(1, DbChangeStage.Old) === "localDbInfo") {
            return DbConflictResolution.Replace;
          }
        }
        if (args.tableName.startsWith("ec_")) {
          return DbConflictResolution.Skip;
        }
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
        if (args.tableName.startsWith("ec_")) {
          return DbConflictResolution.Skip;
        }
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
      if (this[_nativeDb].queryLocalValue("DebugAllowFkViolations")) {
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
   * @internal Exported strictly for tests
   */
  public async executeWritable(func: () => Promise<void>): Promise<void> {
    const fileName = this.pathName;
    const isReadonly = this.isReadonly;
    let locks: LockControl | undefined;
    try {
      if (isReadonly) {
        this.closeAndReopen(OpenMode.ReadWrite, fileName);
        locks = this.locks;
        this.makeLockControl(); // create a ServerBasedLocks, if necessary
      }
      await func();
    } finally {
      if (isReadonly) {
        if (locks !== this._locks) { // did we have to create a ServerBasedLocks?
          this.locks[_close](); // yes, close it and reset back to previous
          this._locks = locks;
        }
        this.closeAndReopen(OpenMode.Readonly, fileName);
      }
    }
  }

  private closeAndReopen(openMode: OpenMode, fileName: string) {
    // Unclosed statements will produce BUSY error when attempting to close.
    this.clearCaches();

    // The following resets the native db's pointer to this JavaScript object.
    this[_nativeDb].closeFile();
    this[_nativeDb].openIModel(fileName, openMode);

    // Restore the native db's pointer to this JavaScript object.
    this[_nativeDb].setIModelDb(this);

    // refresh cached properties that could have been changed by another process writing to the same briefcase
    this.changeset = this[_nativeDb].getCurrentChangeset();

    // assert what should never change
    if (this.iModelId !== this[_nativeDb].getIModelId() || this.iTwinId !== this[_nativeDb].getITwinId())
      throw new Error("closeAndReopen detected change in iModelId and/or iTwinId");
  }

  /**
   * Pull and apply changesets from iModelHub
   * @note This method should not be called from {TxnManager.withIndirectTxnModeAsync} or {RebaseHandler.recompute}.
  */
  public async pullChanges(arg?: PullChangesArgs): Promise<void> {
    await this.executeWritable(async () => {
      await BriefcaseManager.pullAndApplyChangesets(this, arg ?? {});
      if (!this.skipSyncSchemasOnPullAndPush)
        await SchemaSync.pull(this);
      this.initializeIModelDb("pullMerge");
    });

    this.txns._onChangesPulled(this.changeset as ChangesetIndexAndId);
  }

  public async enableChangesetStatTracking(): Promise<void> {
    this[_nativeDb].enableChangesetStatsTracking();
  }

  public async disableChangesetStatTracking(): Promise<void> {
    this[_nativeDb].disableChangesetStatsTracking();
  }

  public async getAllChangesetHealthData(): Promise<ChangesetHealthStats[]> {
    return this[_nativeDb].getAllChangesetHealthData() as ChangesetHealthStats[];
  }

  /** Revert timeline changes and then push resulting changeset */
  public async revertAndPushChanges(arg: RevertChangesArgs): Promise<void> {
    const nativeDb = this[_nativeDb];
    if (arg.toIndex === undefined) {
      throw new IModelError(ChangeSetStatus.ApplyError, "Cannot revert without a toIndex");
    }
    if (nativeDb.hasUnsavedChanges()) {
      throw new IModelError(ChangeSetStatus.HasUncommittedChanges, "Cannot revert with unsaved changes");
    }
    if (nativeDb.hasPendingTxns()) {
      throw new IModelError(ChangeSetStatus.HasLocalChanges, "Cannot revert with pending txns");
    }

    const skipSchemaSyncPull = async <T>(func: () => Promise<T>) => {
      if (nativeDb.schemaSyncEnabled()) {
        this._skipSyncSchemasOnPullAndPush = true;
        try {
          return await func();
        } finally {
          this._skipSyncSchemasOnPullAndPush = undefined;
        }
      } else {
        return func();
      }
    };
    this.clearCaches();
    await skipSchemaSyncPull(async () => this.pullChanges({ ...arg, toIndex: undefined }));
    await this.acquireSchemaLock();

    if (nativeDb.schemaSyncEnabled()) {
      arg.skipSchemaChanges = true;
    }

    try {
      await BriefcaseManager.revertTimelineChanges(this, arg);
      this.saveChanges("Revert changes");
      if (!arg.description) {
        arg.description = `Reverted changes from ${this.changeset.index} to ${arg.toIndex}${arg.skipSchemaChanges ? " (schema changes skipped)" : ""}`;
      }
      const pushArgs = {
        description: arg.description,
        accessToken: arg.accessToken,
        mergeRetryCount: arg.mergeRetryCount,
        mergeRetryDelay: arg.mergeRetryDelay,
        pushRetryCount: arg.pushRetryCount,
        pushRetryDelay: arg.pushRetryDelay,
        retainLocks: arg.retainLocks,
      };
      await skipSchemaSyncPull(async () => this.pushChanges(pushArgs));
      this.clearCaches();
    } catch (err) {
      if (!arg.retainLocks) {
        await this.locks.releaseAllLocks();
        throw err;
      }
    } finally {
      this.abandonChanges();
    }
  }

  /**
   * Push changes to iModelHub.
   * @note This method should not be called from {TxnManager.withIndirectTxnModeAsync} or {RebaseHandler.recompute}.
   */
  public async pushChanges(arg: PushChangesArgs): Promise<void> {
    if (this.briefcaseId === BriefcaseIdValue.Unassigned)
      return;

    if (this[_nativeDb].hasUnsavedChanges()) {
      throw new IModelError(ChangeSetStatus.HasUncommittedChanges, "Cannot push with unsaved changes");
    } else if (!this[_nativeDb].hasPendingTxns()) {
      // Nothing to push.
      if (!arg.retainLocks) {
        await this.locks.releaseAllLocks();
      }

      return;
    }

    // pushing changes requires a writeable briefcase
    await this.executeWritable(async () => {
      await BriefcaseManager.pullMergePush(this, arg);
      this.initializeIModelDb("pullMerge");
    });

    this.txns._onChangesPushed(this.changeset as ChangesetIndexAndId);
    BriefcaseManager.deleteRebaseFolders(this);
  }

  public override close(options?: CloseIModelArgs) {
    if (this.isBriefcase && this.isOpen && !this.isReadonly && this.txns.rebaser.inProgress()) {
      this.abandonChanges();
    }
    super.close(options);
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
      const container = iModel.cloudContainer;
      if (!container)
        throw new Error("checkpoint is not from a cloud container");

      assert(undefined !== iModel.iTwinId);
      const props = await IModelHost[_hubAccess].queryV2Checkpoint({ accessToken, iTwinId: iModel.iTwinId, iModelId: iModel.iModelId, changeset: iModel.changeset });
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
   * @note: A *snapshot* cannot be modified after [[close]] is called.
   * @param filePath The file that will contain the new iModel *snapshot*
   * @param options The parameters that define the new iModel *snapshot*
   * @returns A writeable SnapshotDb
   * @see [Snapshot iModels]($docs/learning/backend/AccessingIModels.md#snapshot-imodels)
   */
  public static createEmpty(filePath: LocalFileName, options: CreateEmptySnapshotIModelProps): SnapshotDb {
    const nativeDb = new IModelNative.platform.DgnDb();
    nativeDb.createIModel(filePath, options);
    nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);

    const snapshotDb = new SnapshotDb(nativeDb, Guid.createValue());
    snapshotDb.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    if (options.createClassViews)
      snapshotDb._createClassViewsOnClose = true; // save flag that will be checked when close() is called
    if (options.geographicCoordinateSystem)
      snapshotDb.setGeographicCoordinateSystem(options.geographicCoordinateSystem);
    if (options.ecefLocation)
      snapshotDb.setEcefLocation(options.ecefLocation);
    return snapshotDb;
  }

  /** Create a local [Snapshot]($docs/learning/backend/AccessingIModels.md#snapshot-imodels) iModel file, using this iModel as a *seed* or starting point.
   * Snapshots are not synchronized with iModelHub, so do not have a change timeline.
   * @note: A *snapshot* cannot be modified after [[close]] is called.
   * @param iModelDb The snapshot will be initialized from the current contents of this iModelDb
   * @param snapshotFile The file that will contain the new iModel *snapshot*
   * @param options Optional properties that determine how the snapshot iModel is created.
   * @returns A writeable SnapshotDb
   * @see [Snapshot iModels]($docs/learning/backend/AccessingIModels.md#snapshot-imodels)
   */
  public static createFrom(iModelDb: IModelDb, snapshotFile: string, options?: CreateSnapshotIModelProps): SnapshotDb {
    iModelDb.performCheckpoint();
    IModelJsFs.copySync(iModelDb.pathName, snapshotFile);

    const nativeDb = new IModelNative.platform.DgnDb();
    nativeDb.openIModel(snapshotFile, OpenMode.ReadWrite, undefined);
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
    const wasKeyUndefined = opts?.key === undefined;
    const nativeDb = this.openDgnDb(file, OpenMode.Readonly, undefined, opts);
    if (wasKeyUndefined) {
      file.key = `${nativeDb.getIModelId()}:${nativeDb.getCurrentChangeset().id}`;
    }
    assert(undefined !== file.key);
    const db = new this(nativeDb, file.key);
    this.onOpened.raiseEvent(db);
    return db;
  }

  private static async attachAndOpenCheckpoint(checkpoint: CheckpointProps): Promise<SnapshotDb> {
    const { dbName, container } = await V2CheckpointManager.attach(checkpoint);
    const key = CheckpointManager.getKey(checkpoint);
    const db = SnapshotDb.openFile(dbName, { key, container });
    await db.loadWorkspaceSettings();
    return db;
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
    const cloudContainer = snapshot.cloudContainer;
    if (cloudContainer !== undefined) {
      snapshot._refreshSas = new RefreshV2CheckpointSas(cloudContainer.accessToken, checkpoint.reattachSafetySeconds);
    }
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
      if (BentleyStatus.SUCCESS !== this[_nativeDb].createClassViewsInDb()) {
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
    const nativeDb = new IModelNative.platform.DgnDb();
    nativeDb.createIModel(filePath, args);
    // Handle both the legacy allowEdit string and new enableTransactions boolean
    // If either is truthy, set the magic JSON string required by the native layer
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const shouldEnableTransactions = args.enableTransactions || args.allowEdit;
    if (shouldEnableTransactions)
      nativeDb.saveLocalValue(BriefcaseLocalValue.StandaloneEdit, `{ "txns": true }`);
    nativeDb.setITwinId(Guid.empty);
    nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
    nativeDb.saveChanges();
    const db = new this({ nativeDb, key: Guid.createValue(), briefcaseId: BriefcaseIdValue.Unassigned, openMode: OpenMode.ReadWrite });
    if (args.geographicCoordinateSystem)
      db.setGeographicCoordinateSystem(args.geographicCoordinateSystem);
    if (args.ecefLocation)
      db.setEcefLocation(args.ecefLocation);
    db.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    return db;
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
    const result = this[_nativeDb].createClassViewsInDb();
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
      const db = new this({ nativeDb, key: file.key, openMode, briefcaseId: BriefcaseIdValue.Unassigned });
      return db;
    } catch (error) {
      nativeDb.closeFile();
      throw error;
    }
  }

  /** Convert an iModel stored on the local file system into a StandaloneDb, chiefly for testing purposes.
   * The file must not be open in any application.
   * @param iModelFileName the path to the iModel on the local file system.
   * @beta
   */
  public static convertToStandalone(iModelFileName: LocalFileName): void {
    const nativeDb = new IModelNative.platform.DgnDb();
    nativeDb.openIModel(iModelFileName, OpenMode.ReadWrite);
    nativeDb.setITwinId(Guid.empty); // empty iTwinId means "standalone"
    nativeDb.saveChanges(); // save change to iTwinId
    nativeDb.deleteAllTxns(); // necessary before resetting briefcaseId
    nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned); // standalone iModels should always have BriefcaseId unassigned
    nativeDb.saveLocalValue("StandaloneEdit", JSON.stringify({ txns: true }));
    nativeDb.saveChanges(); // save change to briefcaseId
    nativeDb.closeFile();
  }
}
