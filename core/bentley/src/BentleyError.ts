/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Errors
 */

import { DbResult } from "./BeSQLite";
import { RepositoryStatus } from "./internal/RepositoryStatus";

/** Standard status code.
 * This status code should be rarely used.
 * Prefer to throw an exception to indicate an error, rather than returning a special status code.
 * If a status code is to be returned, prefer to return a more specific error status type such as IModelStatus or DbResult.
 * @public
 */
export enum BentleyStatus {
  SUCCESS = 0x0000,
  ERROR = 0x8000,
}

/** Status codes that are used in conjunction with [[BentleyError]].
 * Error status codes are divided into separate ranges for different kinds of errors. All known ranges at least should be defined here, to avoid collisions.
 * @public
 */
export enum IModelStatus {
  IMODEL_ERROR_BASE = 0x10000,
  Success = 0,
  AlreadyLoaded = IMODEL_ERROR_BASE + 1,
  AlreadyOpen = IMODEL_ERROR_BASE + 2,
  BadArg = IMODEL_ERROR_BASE + 3,
  BadElement = IMODEL_ERROR_BASE + 4,
  BadModel = IMODEL_ERROR_BASE + 5,
  BadRequest = IMODEL_ERROR_BASE + 6,
  BadSchema = IMODEL_ERROR_BASE + 7,
  CannotUndo = IMODEL_ERROR_BASE + 8,
  CodeNotReserved = IMODEL_ERROR_BASE + 9,
  DeletionProhibited = IMODEL_ERROR_BASE + 10,
  DuplicateCode = IMODEL_ERROR_BASE + 11,
  DuplicateName = IMODEL_ERROR_BASE + 12,
  ElementBlockedChange = IMODEL_ERROR_BASE + 13,
  FileAlreadyExists = IMODEL_ERROR_BASE + 14,
  FileNotFound = IMODEL_ERROR_BASE + 15,
  FileNotLoaded = IMODEL_ERROR_BASE + 16,
  ForeignKeyConstraint = IMODEL_ERROR_BASE + 17,
  IdExists = IMODEL_ERROR_BASE + 18,
  InDynamicTransaction = IMODEL_ERROR_BASE + 19,
  InvalidCategory = IMODEL_ERROR_BASE + 20,
  InvalidCode = IMODEL_ERROR_BASE + 21,
  InvalidCodeSpec = IMODEL_ERROR_BASE + 22,
  InvalidId = IMODEL_ERROR_BASE + 23,
  InvalidName = IMODEL_ERROR_BASE + 24,
  InvalidParent = IMODEL_ERROR_BASE + 25,
  InvalidProfileVersion = IMODEL_ERROR_BASE + 26,
  IsCreatingChangeSet = IMODEL_ERROR_BASE + 27,
  LockNotHeld = IMODEL_ERROR_BASE + 28,
  Mismatch2d3d = IMODEL_ERROR_BASE + 29,
  MismatchGcs = IMODEL_ERROR_BASE + 30,
  MissingDomain = IMODEL_ERROR_BASE + 31,
  MissingHandler = IMODEL_ERROR_BASE + 32,
  MissingId = IMODEL_ERROR_BASE + 33,
  NoGeometry = IMODEL_ERROR_BASE + 34,
  NoMultiTxnOperation = IMODEL_ERROR_BASE + 35,
  NotEnabled = IMODEL_ERROR_BASE + 37,
  NotFound = IMODEL_ERROR_BASE + 38,
  NotOpen = IMODEL_ERROR_BASE + 39,
  NotOpenForWrite = IMODEL_ERROR_BASE + 40,
  NotSameUnitBase = IMODEL_ERROR_BASE + 41,
  NothingToRedo = IMODEL_ERROR_BASE + 42,
  NothingToUndo = IMODEL_ERROR_BASE + 43,
  ParentBlockedChange = IMODEL_ERROR_BASE + 44,
  ReadError = IMODEL_ERROR_BASE + 45,
  ReadOnly = IMODEL_ERROR_BASE + 46,
  ReadOnlyDomain = IMODEL_ERROR_BASE + 47,
  RepositoryManagerError = IMODEL_ERROR_BASE + 48,
  SQLiteError = IMODEL_ERROR_BASE + 49,
  TransactionActive = IMODEL_ERROR_BASE + 50,
  UnitsMissing = IMODEL_ERROR_BASE + 51,
  UnknownFormat = IMODEL_ERROR_BASE + 52,
  UpgradeFailed = IMODEL_ERROR_BASE + 53,
  ValidationFailed = IMODEL_ERROR_BASE + 54,
  VersionTooNew = IMODEL_ERROR_BASE + 55,
  VersionTooOld = IMODEL_ERROR_BASE + 56,
  ViewNotFound = IMODEL_ERROR_BASE + 57,
  WriteError = IMODEL_ERROR_BASE + 58,
  WrongClass = IMODEL_ERROR_BASE + 59,
  WrongIModel = IMODEL_ERROR_BASE + 60,
  WrongDomain = IMODEL_ERROR_BASE + 61,
  WrongElement = IMODEL_ERROR_BASE + 62,
  WrongHandler = IMODEL_ERROR_BASE + 63,
  WrongModel = IMODEL_ERROR_BASE + 64,
  ConstraintNotUnique = IMODEL_ERROR_BASE + 65,
  NoGeoLocation = IMODEL_ERROR_BASE + 66,
  ServerTimeout = IMODEL_ERROR_BASE + 67,
  NoContent = IMODEL_ERROR_BASE + 68,
  NotRegistered = IMODEL_ERROR_BASE + 69,
  FunctionNotFound = IMODEL_ERROR_BASE + 70,
  NoActiveCommand = IMODEL_ERROR_BASE + 71,
  Aborted = IMODEL_ERROR_BASE + 72,
}

/** Error statuses produced by various briefcase operations, typically encountered as the `errorNumber` of an [IModelError]($common).
 * @public
 */
export enum BriefcaseStatus {
  BRIEFCASE_STATUS_BASE = 0x20000,
  CannotAcquire = BRIEFCASE_STATUS_BASE,
  CannotDownload = BRIEFCASE_STATUS_BASE + 1,
  CannotUpload = BRIEFCASE_STATUS_BASE + 2,
  CannotCopy = BRIEFCASE_STATUS_BASE + 3,
  CannotDelete = BRIEFCASE_STATUS_BASE + 4,
  VersionNotFound = BRIEFCASE_STATUS_BASE + 5,
  CannotApplyChanges = BRIEFCASE_STATUS_BASE + 6,
  DownloadCancelled = BRIEFCASE_STATUS_BASE + 7,
  ContainsDeletedChangeSets = BRIEFCASE_STATUS_BASE + 8,
}

/** RpcInterface status codes
 * @beta
 */
export enum RpcInterfaceStatus {
  Success = 0,
  RPC_INTERFACE_ERROR_BASE = 0x21000,
  /** The RpcInterface implemented by the server is incompatible with the interface requested by the client. */
  IncompatibleVersion = RPC_INTERFACE_ERROR_BASE,
}

/** Error statuses produced by various Changeset operations, typically encountered as the `errorNumber` of an [IModelError]($common).
 * @public
 */
export enum ChangeSetStatus { // Note: Values must be kept in sync with ChangeSetStatus in DgnPlatform
  Success = 0,
  CHANGESET_ERROR_BASE = 0x16000,
  /** Error applying a change set when reversing or reinstating it */
  ApplyError = CHANGESET_ERROR_BASE + 1,
  /** Change tracking has not been enabled. The ChangeSet API mandates this. */
  ChangeTrackingNotEnabled = CHANGESET_ERROR_BASE + 2,
  /** Contents of the change stream are corrupted and does not match the ChangeSet */
  CorruptedChangeStream = CHANGESET_ERROR_BASE + 3,
  /** File containing the changes to the change set is not found */
  FileNotFound = CHANGESET_ERROR_BASE + 4,
  /** Error writing the contents of the change set to the backing change stream file */
  FileWriteError = CHANGESET_ERROR_BASE + 5,
  /**  Cannot perform the operation since the Db has local changes */
  HasLocalChanges = CHANGESET_ERROR_BASE + 6,
  /**  Cannot perform the operation since current transaction has uncommitted changes */
  HasUncommittedChanges = CHANGESET_ERROR_BASE + 7,
  /**  Invalid ChangeSet Id */
  InvalidId = CHANGESET_ERROR_BASE + 8,
  /**  Invalid version of the change set */
  InvalidVersion = CHANGESET_ERROR_BASE + 9,
  /** Cannot perform the operation since system is in the middle of a dynamic transaction */
  InDynamicTransaction = CHANGESET_ERROR_BASE + 10,
  /** Cannot perform operation since system is in the middle of a creating a change set */
  IsCreatingChangeSet = CHANGESET_ERROR_BASE + 11,
  /** Cannot perform operation since the system is not creating a change set */
  IsNotCreatingChangeSet = CHANGESET_ERROR_BASE + 12,
  /** Error propagating the changes after the merge */
  MergePropagationError = CHANGESET_ERROR_BASE + 13,
  /** No change sets to merge */
  NothingToMerge = CHANGESET_ERROR_BASE + 14,
  /** No transactions are available to create a change set */
  NoTransactions = CHANGESET_ERROR_BASE + 15,
  /** Parent change set of the Db does not match the parent id of the change set */
  ParentMismatch = CHANGESET_ERROR_BASE + 16,
  /** Error performing a SQLite operation on the Db */
  SQLiteError = CHANGESET_ERROR_BASE + 17,
  /** ChangeSet originated in a different Db */
  WrongDgnDb = CHANGESET_ERROR_BASE + 18,
  /** Could not open the DgnDb to merge change set */
  CouldNotOpenDgnDb = CHANGESET_ERROR_BASE + 19,
  /** Cannot merge changes in in an open DgnDb. Close the DgnDb, and process the operation when it is opened. */
  MergeSchemaChangesOnOpen = CHANGESET_ERROR_BASE + 20,
  /** Cannot reverse or reinstate schema changes. */
  ReverseOrReinstateSchemaChanges = CHANGESET_ERROR_BASE + 21,
  /** Cannot process changes schema changes in an open DgnDb. Close the DgnDb, and process the operation when it is opened. */
  ProcessSchemaChangesOnOpen = CHANGESET_ERROR_BASE + 22,
  /** Cannot merge changes into a Readonly DgnDb. */
  CannotMergeIntoReadonly = CHANGESET_ERROR_BASE + 23,
  /**  Cannot merge changes into a Master DgnDb. */
  CannotMergeIntoMaster = CHANGESET_ERROR_BASE + 24,
  /** Cannot merge changes into a DgnDb that has reversed change sets. */
  CannotMergeIntoReversed = CHANGESET_ERROR_BASE + 25,
  /** ChangeSet(s) download was cancelled. */
  DownloadCancelled = CHANGESET_ERROR_BASE + 26,
}

/** Status from returned HTTP status code
 * @beta
 */
export enum HttpStatus {
  /** 2xx Success */
  Success = 0,
  /** 1xx Informational responses */
  Info = 0x17001,
  /** 3xx Redirection */
  Redirection = 0x17002,
  /** 4xx Client errors */
  ClientError = 0x17003,
  /** 5xx Server errors */
  ServerError = 0x17004,
}

/** Statuses produced by APIs that interact with iModelHub, typically encountered as the `errorNumber` of an [IModelError]($common).
 * @public
 */
export enum IModelHubStatus {
  Success = 0,
  IMODELHUBERROR_BASE = 0x19000,
  IMODELHUBERROR_REQUESTERRORBASE = 0x19100,
  Unknown = IMODELHUBERROR_BASE + 1,
  MissingRequiredProperties = IMODELHUBERROR_BASE + 2,
  InvalidPropertiesValues = IMODELHUBERROR_BASE + 3,
  UserDoesNotHavePermission = IMODELHUBERROR_BASE + 4,
  UserDoesNotHaveAccess = IMODELHUBERROR_BASE + 5,
  InvalidBriefcase = IMODELHUBERROR_BASE + 6,
  BriefcaseDoesNotExist = IMODELHUBERROR_BASE + 7,
  BriefcaseDoesNotBelongToUser = IMODELHUBERROR_BASE + 8,
  AnotherUserPushing = IMODELHUBERROR_BASE + 9,
  ChangeSetAlreadyExists = IMODELHUBERROR_BASE + 10,
  ChangeSetDoesNotExist = IMODELHUBERROR_BASE + 11,
  FileIsNotUploaded = IMODELHUBERROR_BASE + 12,
  iModelIsNotInitialized = IMODELHUBERROR_BASE + 13,
  ChangeSetPointsToBadSeed = IMODELHUBERROR_BASE + 14,
  OperationFailed = IMODELHUBERROR_BASE + 15,
  PullIsRequired = IMODELHUBERROR_BASE + 16,
  MaximumNumberOfBriefcasesPerUser = IMODELHUBERROR_BASE + 17,
  MaximumNumberOfBriefcasesPerUserPerMinute = IMODELHUBERROR_BASE + 18,
  DatabaseTemporarilyLocked = IMODELHUBERROR_BASE + 19,
  iModelIsLocked = IMODELHUBERROR_BASE + 20,
  CodesExist = IMODELHUBERROR_BASE + 21,
  LocksExist = IMODELHUBERROR_BASE + 22,
  iModelAlreadyExists = IMODELHUBERROR_BASE + 23,
  iModelDoesNotExist = IMODELHUBERROR_BASE + 24,
  FileDoesNotExist = IMODELHUBERROR_BASE + 25,
  FileAlreadyExists = IMODELHUBERROR_BASE + 26,
  LockDoesNotExist = IMODELHUBERROR_BASE + 27,
  LockOwnedByAnotherBriefcase = IMODELHUBERROR_BASE + 28,
  CodeStateInvalid = IMODELHUBERROR_BASE + 29,
  CodeReservedByAnotherBriefcase = IMODELHUBERROR_BASE + 30,
  CodeDoesNotExist = IMODELHUBERROR_BASE + 31,
  EventTypeDoesNotExist = IMODELHUBERROR_BASE + 32,
  EventSubscriptionDoesNotExist = IMODELHUBERROR_BASE + 33,
  EventSubscriptionAlreadyExists = IMODELHUBERROR_BASE + 34,
  ITwinIdIsNotSpecified = IMODELHUBERROR_BASE + 35,
  FailedToGetITwinPermissions = IMODELHUBERROR_BASE + 36,
  FailedToGetITwinMembers = IMODELHUBERROR_BASE + 37,
  ChangeSetAlreadyHasVersion = IMODELHUBERROR_BASE + 38,
  VersionAlreadyExists = IMODELHUBERROR_BASE + 39,
  JobSchedulingFailed = IMODELHUBERROR_BASE + 40,
  ConflictsAggregate = IMODELHUBERROR_BASE + 41,
  FailedToGetITwinById = IMODELHUBERROR_BASE + 42,

  DatabaseOperationFailed = IMODELHUBERROR_BASE + 43,
  SeedFileInitializationFailed = IMODELHUBERROR_BASE + 44,

  FailedToGetAssetPermissions = IMODELHUBERROR_BASE + 45,
  FailedToGetAssetMembers = IMODELHUBERROR_BASE + 46,
  ITwinDoesNotExist = IMODELHUBERROR_BASE + 47,

  LockChunkDoesNotExist = IMODELHUBERROR_BASE + 49,

  CheckpointAlreadyExists = IMODELHUBERROR_BASE + 50,
  CheckpointDoesNotExist = IMODELHUBERROR_BASE + 51,

  // Errors that are returned for incorrect iModelHub request.
  UndefinedArgumentError = IMODELHUBERROR_REQUESTERRORBASE + 1,
  InvalidArgumentError = IMODELHUBERROR_REQUESTERRORBASE + 2,
  MissingDownloadUrlError = IMODELHUBERROR_REQUESTERRORBASE + 3,
  NotSupportedInBrowser = IMODELHUBERROR_REQUESTERRORBASE + 4,
  FileHandlerNotSet = IMODELHUBERROR_REQUESTERRORBASE + 5,
  FileNotFound = IMODELHUBERROR_REQUESTERRORBASE + 6,
  InitializationTimeout = IMODELHUBERROR_REQUESTERRORBASE + 7,
}

/** GeoServiceStatus errors
 * @public
 */
export enum GeoServiceStatus {
  Success = 0,
  GEOSERVICESTATUS_BASE = 0x24000,
  // Error mapped from 'IModelStatus'
  NoGeoLocation = IModelStatus.NoGeoLocation,
  // Following errors are mapped from 'GeoCoordStatus'
  OutOfUsefulRange = GEOSERVICESTATUS_BASE + 1,
  OutOfMathematicalDomain = GEOSERVICESTATUS_BASE + 2,
  NoDatumConverter = GEOSERVICESTATUS_BASE + 3,
  VerticalDatumConvertError = GEOSERVICESTATUS_BASE + 4,
  CSMapError = GEOSERVICESTATUS_BASE + 5,
  Pending = GEOSERVICESTATUS_BASE + 6,
}

/** Error status from various reality data operations
 * @alpha
 */
export enum RealityDataStatus {
  Success = 0,
  REALITYDATA_ERROR_BASE = 0x25000,
  InvalidData = REALITYDATA_ERROR_BASE + 1,
}

/** A function that returns a metadata object for a [[BentleyError]].
 * This is generally used for logging. However not every exception is logged, so use this if the metadata for an exception is expensive to create.
 * @public
 */
export type GetMetaDataFunction = () => object | undefined;

/** Optional metadata attached to a [[BentleyError]]. May either be an object or a function that returns an object.
 * If this exception is logged and metadata is present, the metaData object is attached to the log entry via `JSON.stringify`
 * @public
 */
export type LoggingMetaData = GetMetaDataFunction | object | undefined;

function isObject(obj: unknown): obj is { [key: string]: unknown } {
  return typeof obj === "object" && obj !== null;
}

interface ErrorProps {
  message: string;
  stack?: string;
  metadata?: object;
}

/** Base exception class for iTwin.js exceptions.
 * @public
 */
export class BentleyError extends Error {
  private readonly _metaData: LoggingMetaData;

  /**
   * @param errorNumber The a number that identifies of the problem.
   * @param message  message that describes the problem (should not be localized).
   * @param metaData metaData about the exception.
   */
  public constructor(public errorNumber: number, message?: string, metaData?: LoggingMetaData) {
    super(message);
    this.errorNumber = errorNumber;
    this._metaData = metaData;
    this.name = this._initName();
  }

  /** Returns true if this BentleyError includes (optional) metadata. */
  public get hasMetaData(): boolean { return undefined !== this._metaData; }

  /** get the meta data associated with this BentleyError, if any. */
  public getMetaData(): object | undefined {
    return BentleyError.getMetaData(this._metaData);
  }

  /** get the metadata object associated with an ExceptionMetaData, if any. */
  public static getMetaData(metaData: LoggingMetaData): object | undefined {
    return (typeof metaData === "function") ? metaData() : metaData;
  }

  /** This function returns the name of each error status. Override this method to handle more error status codes. */
  protected _initName(): string {
    switch (this.errorNumber) {
      case IModelStatus.AlreadyLoaded: return "Already Loaded";
      case IModelStatus.AlreadyOpen: return "Already Open";
      case IModelStatus.BadArg: return "Bad Arg";
      case IModelStatus.BadElement: return "Bad Element";
      case IModelStatus.BadModel: return "Bad Model";
      case IModelStatus.BadRequest: return "Bad Request";
      case IModelStatus.BadSchema: return "Bad Schema";
      case IModelStatus.CannotUndo: return "Can not Undo";
      case IModelStatus.CodeNotReserved: return "Code Not Reserved";
      case IModelStatus.DeletionProhibited: return "Deletion Prohibited";
      case IModelStatus.DuplicateCode: return "Duplicate Code";
      case IModelStatus.DuplicateName: return "Duplicate Name";
      case IModelStatus.ElementBlockedChange: return "Element Blocked Change";
      case IModelStatus.FileAlreadyExists: return "File Already Exists";
      case IModelStatus.FileNotFound: return "File Not Found";
      case IModelStatus.FileNotLoaded: return "File Not Loaded";
      case IModelStatus.ForeignKeyConstraint: return "ForeignKey Constraint";
      case IModelStatus.IdExists: return "Id Exists";
      case IModelStatus.InDynamicTransaction: return "InDynamicTransaction";
      case IModelStatus.InvalidCategory: return "Invalid Category";
      case IModelStatus.InvalidCode: return "Invalid Code";
      case IModelStatus.InvalidCodeSpec: return "Invalid CodeSpec";
      case IModelStatus.InvalidId: return "Invalid Id";
      case IModelStatus.InvalidName: return "Invalid Name";
      case IModelStatus.InvalidParent: return "Invalid Parent";
      case IModelStatus.InvalidProfileVersion: return "Invalid Profile Version";
      case IModelStatus.IsCreatingChangeSet: return "IsCreatingChangeSet";
      case IModelStatus.LockNotHeld: return "Lock Not Held";
      case IModelStatus.Mismatch2d3d: return "Mismatch 2d3d";
      case IModelStatus.MismatchGcs: return "Mismatch Gcs";
      case IModelStatus.MissingDomain: return "Missing Domain";
      case IModelStatus.MissingHandler: return "Missing Handler";
      case IModelStatus.MissingId: return "Missing Id";
      case IModelStatus.NoGeometry: return "No Geometry";
      case IModelStatus.NoMultiTxnOperation: return "NoMultiTxnOperation";
      case IModelStatus.NotEnabled: return "Not Enabled";
      case IModelStatus.NotFound: return "Not Found";
      case IModelStatus.NotOpen: return "Not Open";
      case IModelStatus.NotOpenForWrite: return "Not Open For Write";
      case IModelStatus.NotSameUnitBase: return "Not Same Unit Base";
      case IModelStatus.NothingToRedo: return "Nothing To Redo";
      case IModelStatus.NothingToUndo: return "Nothing To Undo";
      case IModelStatus.ParentBlockedChange: return "Parent Blocked Change";
      case IModelStatus.ReadError: return "Read Error";
      case IModelStatus.ReadOnly: return "ReadOnly";
      case IModelStatus.ReadOnlyDomain: return "ReadOnlyDomain";
      case IModelStatus.RepositoryManagerError: return "RepositoryManagerError";
      case IModelStatus.SQLiteError: return "SQLiteError";
      case IModelStatus.TransactionActive: return "Transaction Active";
      case IModelStatus.UnitsMissing: return "Units Missing";
      case IModelStatus.UnknownFormat: return "Unknown Format";
      case IModelStatus.UpgradeFailed: return "Upgrade Failed";
      case IModelStatus.ValidationFailed: return "Validation Failed";
      case IModelStatus.VersionTooNew: return "Version Too New";
      case IModelStatus.VersionTooOld: return "Version Too Old";
      case IModelStatus.ViewNotFound: return "View Not Found";
      case IModelStatus.WriteError: return "Write Error";
      case IModelStatus.WrongClass: return "Wrong Class";
      case IModelStatus.WrongIModel: return "Wrong IModel";
      case IModelStatus.WrongDomain: return "Wrong Domain";
      case IModelStatus.WrongElement: return "Wrong Element";
      case IModelStatus.WrongHandler: return "Wrong Handler";
      case IModelStatus.WrongModel: return "Wrong Model";
      case DbResult.BE_SQLITE_ERROR: return "BE_SQLITE_ERROR";
      case DbResult.BE_SQLITE_INTERNAL: return "BE_SQLITE_INTERNAL";
      case DbResult.BE_SQLITE_PERM: return "BE_SQLITE_PERM";
      case DbResult.BE_SQLITE_ABORT: return "BE_SQLITE_ABORT";
      case DbResult.BE_SQLITE_BUSY: return "Db is busy";
      case DbResult.BE_SQLITE_LOCKED: return "Db is Locked";
      case DbResult.BE_SQLITE_NOMEM: return "BE_SQLITE_NOMEM";
      case DbResult.BE_SQLITE_READONLY: return "Readonly";
      case DbResult.BE_SQLITE_INTERRUPT: return "BE_SQLITE_INTERRUPT";
      case DbResult.BE_SQLITE_IOERR: return "BE_SQLITE_IOERR";
      case DbResult.BE_SQLITE_CORRUPT: return "BE_SQLITE_CORRUPT";
      case DbResult.BE_SQLITE_NOTFOUND: return "Not Found";
      case DbResult.BE_SQLITE_FULL: return "BE_SQLITE_FULL";
      case DbResult.BE_SQLITE_CANTOPEN: return "Can't open";
      case DbResult.BE_SQLITE_PROTOCOL: return "BE_SQLITE_PROTOCOL";
      case DbResult.BE_SQLITE_EMPTY: return "BE_SQLITE_EMPTY";
      case DbResult.BE_SQLITE_SCHEMA: return "BE_SQLITE_SCHEMA";
      case DbResult.BE_SQLITE_TOOBIG: return "BE_SQLITE_TOOBIG";
      case DbResult.BE_SQLITE_MISMATCH: return "BE_SQLITE_MISMATCH";
      case DbResult.BE_SQLITE_MISUSE: return "BE_SQLITE_MISUSE";
      case DbResult.BE_SQLITE_NOLFS: return "BE_SQLITE_NOLFS";
      case DbResult.BE_SQLITE_AUTH: return "BE_SQLITE_AUTH";
      case DbResult.BE_SQLITE_FORMAT: return "BE_SQLITE_FORMAT";
      case DbResult.BE_SQLITE_RANGE: return "BE_SQLITE_RANGE";
      case DbResult.BE_SQLITE_NOTADB: return "Not a Database";
      case DbResult.BE_SQLITE_IOERR_READ: return "BE_SQLITE_IOERR_READ";
      case DbResult.BE_SQLITE_IOERR_SHORT_READ: return "BE_SQLITE_IOERR_SHORT_READ";
      case DbResult.BE_SQLITE_IOERR_WRITE: return "BE_SQLITE_IOERR_WRITE";
      case DbResult.BE_SQLITE_IOERR_FSYNC: return "BE_SQLITE_IOERR_FSYNC";
      case DbResult.BE_SQLITE_IOERR_DIR_FSYNC: return "BE_SQLITE_IOERR_DIR_FSYNC";
      case DbResult.BE_SQLITE_IOERR_TRUNCATE: return "BE_SQLITE_IOERR_TRUNCATE";
      case DbResult.BE_SQLITE_IOERR_FSTAT: return "BE_SQLITE_IOERR_FSTAT";
      case DbResult.BE_SQLITE_IOERR_UNLOCK: return "BE_SQLITE_IOERR_UNLOCK";
      case DbResult.BE_SQLITE_IOERR_RDLOCK: return "BE_SQLITE_IOERR_RDLOCK";
      case DbResult.BE_SQLITE_IOERR_DELETE: return "BE_SQLITE_IOERR_DELETE";
      case DbResult.BE_SQLITE_IOERR_BLOCKED: return "BE_SQLITE_IOERR_BLOCKED";
      case DbResult.BE_SQLITE_IOERR_NOMEM: return "BE_SQLITE_IOERR_NOMEM";
      case DbResult.BE_SQLITE_IOERR_ACCESS: return "BE_SQLITE_IOERR_ACCESS";
      case DbResult.BE_SQLITE_IOERR_CHECKRESERVEDLOCK: return "BE_SQLITE_IOERR_CHECKRESERVEDLOCK";
      case DbResult.BE_SQLITE_IOERR_LOCK: return "BE_SQLITE_IOERR_LOCK";
      case DbResult.BE_SQLITE_IOERR_CLOSE: return "BE_SQLITE_IOERR_CLOSE";
      case DbResult.BE_SQLITE_IOERR_DIR_CLOSE: return "BE_SQLITE_IOERR_DIR_CLOSE";
      case DbResult.BE_SQLITE_IOERR_SHMOPEN: return "BE_SQLITE_IOERR_SHMOPEN";
      case DbResult.BE_SQLITE_IOERR_SHMSIZE: return "BE_SQLITE_IOERR_SHMSIZE";
      case DbResult.BE_SQLITE_IOERR_SHMLOCK: return "BE_SQLITE_IOERR_SHMLOCK";
      case DbResult.BE_SQLITE_IOERR_SHMMAP: return "BE_SQLITE_IOERR_SHMMAP";
      case DbResult.BE_SQLITE_IOERR_SEEK: return "BE_SQLITE_IOERR_SEEK";
      case DbResult.BE_SQLITE_IOERR_DELETE_NOENT: return "BE_SQLITE_IOERR_DELETE_NOENT";

      case DbResult.BE_SQLITE_ERROR_DataTransformRequired: return "Schema update require to transform data";
      case DbResult.BE_SQLITE_ERROR_FileExists: return "File Exists";
      case DbResult.BE_SQLITE_ERROR_AlreadyOpen: return "Already Open";
      case DbResult.BE_SQLITE_ERROR_NoPropertyTable: return "No Property Table";
      case DbResult.BE_SQLITE_ERROR_FileNotFound: return "File Not Found";
      case DbResult.BE_SQLITE_ERROR_NoTxnActive: return "No Txn Active";
      case DbResult.BE_SQLITE_ERROR_BadDbProfile: return "Bad Db Profile";
      case DbResult.BE_SQLITE_ERROR_InvalidProfileVersion: return "Invalid Profile Version";
      case DbResult.BE_SQLITE_ERROR_ProfileUpgradeFailed: return "Profile Upgrade Failed";
      case DbResult.BE_SQLITE_ERROR_ProfileTooOldForReadWrite: return "Profile Too Old For ReadWrite";
      case DbResult.BE_SQLITE_ERROR_ProfileTooOld: return "Profile Too Old";
      case DbResult.BE_SQLITE_ERROR_ProfileTooNewForReadWrite: return "Profile Too New For ReadWrite";
      case DbResult.BE_SQLITE_ERROR_ProfileTooNew: return "Profile Too New";
      case DbResult.BE_SQLITE_ERROR_ChangeTrackError: return "ChangeTrack Error";
      case DbResult.BE_SQLITE_ERROR_InvalidChangeSetVersion: return "Invalid ChangeSet Version";
      case DbResult.BE_SQLITE_ERROR_SchemaUpgradeRequired: return "Schema Upgrade Required";
      case DbResult.BE_SQLITE_ERROR_SchemaTooNew: return "Schema Too New";
      case DbResult.BE_SQLITE_ERROR_SchemaTooOld: return "Schema Too Old";
      case DbResult.BE_SQLITE_ERROR_SchemaLockFailed: return "Schema Lock Failed";
      case DbResult.BE_SQLITE_ERROR_SchemaUpgradeFailed: return "Schema Upgrade Failed";
      case DbResult.BE_SQLITE_ERROR_SchemaImportFailed: return "Schema Import Failed";
      case DbResult.BE_SQLITE_ERROR_CouldNotAcquireLocksOrCodes: return "Could Not Acquire Locks Or Codes";
      case DbResult.BE_SQLITE_ERROR_SchemaUpgradeRecommended: return "Recommended that the schemas found in the database be upgraded";
      case DbResult.BE_SQLITE_LOCKED_SHAREDCACHE: return "BE_SQLITE_LOCKED_SHAREDCACHE";
      case DbResult.BE_SQLITE_BUSY_RECOVERY: return "BE_SQLITE_BUSY_RECOVERY";
      case DbResult.BE_SQLITE_CANTOPEN_NOTEMPDIR: return "SQLite No Temp Dir";
      case DbResult.BE_SQLITE_CANTOPEN_ISDIR: return "BE_SQLITE_CANTOPEN_ISDIR";
      case DbResult.BE_SQLITE_CANTOPEN_FULLPATH: return "BE_SQLITE_CANTOPEN_FULLPATH";
      case DbResult.BE_SQLITE_CORRUPT_VTAB: return "BE_SQLITE_CORRUPT_VTAB";
      case DbResult.BE_SQLITE_READONLY_RECOVERY: return "BE_SQLITE_READONLY_RECOVERY";
      case DbResult.BE_SQLITE_READONLY_CANTLOCK: return "BE_SQLITE_READONLY_CANTLOCK";
      case DbResult.BE_SQLITE_READONLY_ROLLBACK: return "BE_SQLITE_READONLY_ROLLBACK";
      case DbResult.BE_SQLITE_ABORT_ROLLBACK: return "BE_SQLITE_ABORT_ROLLBACK";
      case DbResult.BE_SQLITE_CONSTRAINT_CHECK: return "BE_SQLITE_CONSTRAINT_CHECK";
      case DbResult.BE_SQLITE_CONSTRAINT_COMMITHOOK: return "CommitHook Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_FOREIGNKEY: return "Foreign Key Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_FUNCTION: return "Function Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_NOTNULL: return "NotNull Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_PRIMARYKEY: return "Primary Key Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_TRIGGER: return "Trigger Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_UNIQUE: return "Unique Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_VTAB: return "VTable Constraint Error";
      case BentleyStatus.ERROR: return "Error";
      case BriefcaseStatus.CannotAcquire: return "CannotAcquire";
      case BriefcaseStatus.CannotDownload: return "CannotDownload";
      case BriefcaseStatus.CannotCopy: return "CannotCopy";
      case BriefcaseStatus.CannotDelete: return "CannotDelete";
      case BriefcaseStatus.VersionNotFound: return "VersionNotFound";
      case BriefcaseStatus.DownloadCancelled: return "DownloadCancelled";
      case BriefcaseStatus.ContainsDeletedChangeSets: return "ContainsDeletedChangeSets";
      case RpcInterfaceStatus.IncompatibleVersion: return "RpcInterfaceStatus.IncompatibleVersion";
      case ChangeSetStatus.ApplyError: return "Error applying a change set";
      case ChangeSetStatus.ChangeTrackingNotEnabled: return "Change tracking has not been enabled. The ChangeSet API mandates this";
      case ChangeSetStatus.CorruptedChangeStream: return "Contents of the change stream are corrupted and does not match the ChangeSet";
      case ChangeSetStatus.FileNotFound: return "File containing the changes was not found";
      case ChangeSetStatus.FileWriteError: return "Error writing the contents of the change set to the backing change stream file";
      case ChangeSetStatus.HasLocalChanges: return "Cannot perform the operation since the Db has local changes";
      case ChangeSetStatus.HasUncommittedChanges: return "Cannot perform the operation since current transaction has uncommitted changes";
      case ChangeSetStatus.InvalidId: return "Invalid ChangeSet Id";
      case ChangeSetStatus.InvalidVersion: return "Invalid version of the change set";
      case ChangeSetStatus.InDynamicTransaction: return "Cannot perform the operation since system is in the middle of a dynamic transaction";
      case ChangeSetStatus.IsCreatingChangeSet: return "Cannot perform operation since system is in the middle of a creating a change set";
      case ChangeSetStatus.IsNotCreatingChangeSet: return "Cannot perform operation since the system is not creating a change set";
      case ChangeSetStatus.MergePropagationError: return "Error propagating the changes after the merge";
      case ChangeSetStatus.NothingToMerge: return "No change sets to merge";
      case ChangeSetStatus.NoTransactions: return "No transactions are available to create a change set";
      case ChangeSetStatus.ParentMismatch: return "Parent change set of the Db does not match the parent id of the change set";
      case ChangeSetStatus.SQLiteError: return "Error performing a SQLite operation on the Db";
      case ChangeSetStatus.WrongDgnDb: return "ChangeSet originated in a different Db";
      case ChangeSetStatus.CouldNotOpenDgnDb: return "Could not open the DgnDb to merge change set";
      case ChangeSetStatus.MergeSchemaChangesOnOpen: return "Cannot merge changes in in an open DgnDb. Close the DgnDb, and process the operation when it is opened";
      case ChangeSetStatus.ReverseOrReinstateSchemaChanges: return "Cannot reverse or reinstate schema changes.";
      case ChangeSetStatus.ProcessSchemaChangesOnOpen: return "Cannot process changes schema changes in an open DgnDb. Close the DgnDb, and process the operation when it is opened";
      case ChangeSetStatus.CannotMergeIntoReadonly: return "Cannot merge changes into a Readonly DgnDb";
      case ChangeSetStatus.CannotMergeIntoMaster: return "Cannot merge changes into a Master DgnDb";
      case ChangeSetStatus.CannotMergeIntoReversed: return "Cannot merge changes into a DgnDb that has reversed change sets";
      case ChangeSetStatus.DownloadCancelled: return "ChangeSet(s) download was cancelled.";
      case RepositoryStatus.ServerUnavailable: return "ServerUnavailable";
      case RepositoryStatus.LockAlreadyHeld: return "LockAlreadyHeld";
      case RepositoryStatus.SyncError: return "SyncError";
      case RepositoryStatus.InvalidResponse: return "InvalidResponse";
      case RepositoryStatus.PendingTransactions: return "PendingTransactions";
      case RepositoryStatus.LockUsed: return "LockUsed";
      case RepositoryStatus.CannotCreateChangeSet: return "CannotCreateChangeSet";
      case RepositoryStatus.InvalidRequest: return "InvalidRequest";
      case RepositoryStatus.ChangeSetRequired: return "ChangeSetRequired";
      case RepositoryStatus.CodeUnavailable: return "CodeUnavailable";
      case RepositoryStatus.CodeNotReserved: return "CodeNotReserved";
      case RepositoryStatus.CodeUsed: return "CodeUsed";
      case RepositoryStatus.LockNotHeld: return "LockNotHeld";
      case RepositoryStatus.RepositoryIsLocked: return "RepositoryIsLocked";
      case RepositoryStatus.ChannelConstraintViolation: return "ChannelConstraintViolation";
      case HttpStatus.Info: return "HTTP Info";
      case HttpStatus.Redirection: return "HTTP Redirection";
      case HttpStatus.ClientError: return "HTTP Client error";
      case HttpStatus.ServerError: return "HTTP Server error";
      case IModelHubStatus.Unknown: return "Unknown error";
      case IModelHubStatus.MissingRequiredProperties: return "Missing required properties";
      case IModelHubStatus.InvalidPropertiesValues: return "Invalid properties values";
      case IModelHubStatus.UserDoesNotHavePermission: return "User does not have permission";
      case IModelHubStatus.UserDoesNotHaveAccess: return "User does not have access";
      case IModelHubStatus.InvalidBriefcase: return "Invalid briefcase";
      case IModelHubStatus.BriefcaseDoesNotExist: return "Briefcase does not exist";
      case IModelHubStatus.BriefcaseDoesNotBelongToUser: return "Briefcase does not belong to user";
      case IModelHubStatus.AnotherUserPushing: return "Another user pushing";
      case IModelHubStatus.ChangeSetAlreadyExists: return "ChangeSet already exists";
      case IModelHubStatus.ChangeSetDoesNotExist: return "ChangeSet does not exist";
      case IModelHubStatus.FileIsNotUploaded: return "File is not uploaded";
      case IModelHubStatus.iModelIsNotInitialized: return "iModel is not initialized";
      case IModelHubStatus.ChangeSetPointsToBadSeed: return "ChangeSet points to a bad seed file";
      case IModelHubStatus.OperationFailed: return "iModelHub operation has failed";
      case IModelHubStatus.PullIsRequired: return "Pull is required";
      case IModelHubStatus.MaximumNumberOfBriefcasesPerUser: return "Limit of briefcases per user was reached";
      case IModelHubStatus.MaximumNumberOfBriefcasesPerUserPerMinute: return "Limit of briefcases per user per minute was reached";
      case IModelHubStatus.DatabaseTemporarilyLocked: return "Database is temporarily locked";
      case IModelHubStatus.iModelIsLocked: return "iModel is locked";
      case IModelHubStatus.CodesExist: return "Code already exists";
      case IModelHubStatus.LocksExist: return "Lock already exists";
      case IModelHubStatus.iModelAlreadyExists: return "iModel already exists";
      case IModelHubStatus.iModelDoesNotExist: return "iModel does not exist";
      case IModelHubStatus.LockDoesNotExist: return "Lock does not exist";
      case IModelHubStatus.LockChunkDoesNotExist: return "Lock chunk does not exist";
      case IModelHubStatus.LockOwnedByAnotherBriefcase: return "Lock is owned by another briefcase";
      case IModelHubStatus.CodeStateInvalid: return "Code state is invalid";
      case IModelHubStatus.CodeReservedByAnotherBriefcase: return "Code is reserved by another briefcase";
      case IModelHubStatus.CodeDoesNotExist: return "Code does not exist";
      case IModelHubStatus.FileDoesNotExist: return "File does not exist";
      case IModelHubStatus.FileAlreadyExists: return "File already exists";
      case IModelHubStatus.EventTypeDoesNotExist: return "Event type does not exist";
      case IModelHubStatus.EventSubscriptionDoesNotExist: return "Event subscription does not exist";
      case IModelHubStatus.EventSubscriptionAlreadyExists: return "Event subscription already exists";
      case IModelHubStatus.ITwinIdIsNotSpecified: return "ITwin Id is not specified";
      case IModelHubStatus.FailedToGetITwinPermissions: return "Failed to get iTwin permissions";
      case IModelHubStatus.FailedToGetITwinMembers: return "Failed to get iTwin members";
      case IModelHubStatus.FailedToGetAssetPermissions: return "Failed to get asset permissions";
      case IModelHubStatus.FailedToGetAssetMembers: return "Failed to get asset members";
      case IModelHubStatus.ChangeSetAlreadyHasVersion: return "ChangeSet already has version";
      case IModelHubStatus.VersionAlreadyExists: return "Version already exists";
      case IModelHubStatus.JobSchedulingFailed: return "Failed to schedule a background job";
      case IModelHubStatus.ConflictsAggregate: return "Codes or locks are owned by another briefcase";
      case IModelHubStatus.FailedToGetITwinById: return "Failed to query iTwin by its id";
      case IModelHubStatus.DatabaseOperationFailed: return "Database operation has failed";
      case IModelHubStatus.ITwinDoesNotExist: return "ITwin does not exist";
      case IModelHubStatus.UndefinedArgumentError: return "Undefined argument";
      case IModelHubStatus.InvalidArgumentError: return "Invalid argument";
      case IModelHubStatus.MissingDownloadUrlError: return "Missing download url";
      case IModelHubStatus.NotSupportedInBrowser: return "Not supported in browser";
      case IModelHubStatus.FileHandlerNotSet: return "File handler is not set";
      case IModelHubStatus.FileNotFound: return "File not found";
      case GeoServiceStatus.NoGeoLocation: return "No GeoLocation";
      case GeoServiceStatus.OutOfUsefulRange: return "Out of useful range";
      case GeoServiceStatus.OutOfMathematicalDomain: return "Out of mathematical domain";
      case GeoServiceStatus.NoDatumConverter: return "No datum converter";
      case GeoServiceStatus.VerticalDatumConvertError: return "Vertical datum convert error";
      case GeoServiceStatus.CSMapError: return "CSMap error";
      case GeoServiceStatus.Pending: return "Pending";
      case RealityDataStatus.InvalidData: return "Invalid or unknown data";
      case DbResult.BE_SQLITE_OK:
      case DbResult.BE_SQLITE_ROW:
      case DbResult.BE_SQLITE_DONE:
      case BentleyStatus.SUCCESS:
        return "Success";

      default:
        return `Error (${this.errorNumber})`;
    }
  }

  /** Use run-time type checking to safely get a useful string summary of an unknown error value, or `""` if none exists.
   * @note It's recommended to use this function in `catch` clauses, where a caught value cannot be assumed to be `instanceof Error`
   * @public
   */
  public static getErrorMessage(error: unknown): string {
    if (typeof error === "string")
      return error;

    if (error instanceof Error)
      return error.toString();

    if (isObject(error)) {
      if (typeof error.message === "string")
        return error.message;

      if (typeof error.msg === "string")
        return error.msg;

      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      if (error.toString() !== "[object Object]")
        return error.toString();  // eslint-disable-line @typescript-eslint/no-base-to-string
    }

    return "";
  }

  /** Use run-time type checking to safely get the call stack of an unknown error value, if possible.
   * @note It's recommended to use this function in `catch` clauses, where a caught value cannot be assumed to be `instanceof Error`
   * @public
   */
  public static getErrorStack(error: unknown): string | undefined {
    if (isObject(error) && typeof error.stack === "string")
      return error.stack;

    return undefined;
  }

  /** Use run-time type checking to safely get the metadata with an unknown error value, if possible.
   * @note It's recommended to use this function in `catch` clauses, where a caught value cannot be assumed to be `instanceof BentleyError`
   * @see [[BentleyError.getMetaData]]
   * @public
   */
  public static getErrorMetadata(error: unknown): object | undefined {
    if (isObject(error) && typeof error.getMetaData === "function") {
      const metadata = error.getMetaData();
      if (typeof metadata === "object" && metadata !== null)
        return metadata;
    }

    return undefined;
  }

  /** Returns a new `ErrorProps` object representing an unknown error value.  Useful for logging or wrapping/re-throwing caught errors.
   * @note Unlike `Error` objects (which lose messages and call stacks when serialized to JSON), objects
   *       returned by this are plain old JavaScript objects, and can be easily logged/serialized to JSON.
   * @public
   */
  public static getErrorProps(error: unknown): ErrorProps {
    const serialized: ErrorProps = {
      message: BentleyError.getErrorMessage(error),
    };

    const stack = BentleyError.getErrorStack(error);
    if (stack)
      serialized.stack = stack;

    const metadata = BentleyError.getErrorMetadata(error);
    if (metadata)
      serialized.metadata = metadata;

    return serialized;
  }
}

