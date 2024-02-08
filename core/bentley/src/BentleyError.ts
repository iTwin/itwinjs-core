/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Errors
 */

import { DbResult } from "./BeSQLite";

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

/** Return codes for methods which perform repository management operations
 * @internal
 */
export enum RepositoryStatus {
  Success = 0,
  /** The repository server did not respond to a request */
  ServerUnavailable = 0x15001,
  /** A requested lock was already held by another briefcase */
  LockAlreadyHeld = 0x15002,
  /** Failed to sync briefcase manager with server */
  SyncError = 0x15003,
  /** Response from server not understood */
  InvalidResponse = 0x15004,
  /** An operation requires local changes to be committed or abandoned */
  PendingTransactions = 0x15005,
  /** A lock cannot be relinquished because the associated object has been modified */
  LockUsed = 0x15006,
  /** An operation required creation of a ChangeSet, which failed */
  CannotCreateChangeSet = 0x15007,
  /** Request to server not understood */
  InvalidRequest = 0x15008,
  /** A change set committed to the server must be integrated into the briefcase before the operation can be completed */
  ChangeSetRequired = 0x15009,
  /** A requested DgnCode is reserved by another briefcase or in use */
  CodeUnavailable = 0x1500A,
  /** A DgnCode cannot be released because it has not been reserved by the requesting briefcase */
  CodeNotReserved = 0x1500B,
  /** A DgnCode cannot be relinquished because it has been used locally */
  CodeUsed = 0x1500C,
  /** A required lock is not held by this briefcase */
  LockNotHeld = 0x1500D,
  /** Repository is currently locked, no changes allowed */
  RepositoryIsLocked = 0x1500E,
  /** Channel write constraint violation, such as an attempt to write outside the designated channel. */
  ChannelConstraintViolation = 0x1500F,
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

/** When you want to associate an explanatory message with an error status value.
 * @internal
 */
export interface StatusCodeWithMessage<ErrorCodeType> {
  status: ErrorCodeType;
  message: string;
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
      case IModelStatus.AlreadyLoaded.valueOf(): return "Already Loaded";
      case IModelStatus.AlreadyOpen.valueOf(): return "Already Open";
      case IModelStatus.BadArg.valueOf(): return "Bad Arg";
      case IModelStatus.BadElement.valueOf(): return "Bad Element";
      case IModelStatus.BadModel.valueOf(): return "Bad Model";
      case IModelStatus.BadRequest.valueOf(): return "Bad Request";
      case IModelStatus.BadSchema.valueOf(): return "Bad Schema";
      case IModelStatus.CannotUndo.valueOf(): return "Can not Undo";
      case IModelStatus.CodeNotReserved.valueOf(): return "Code Not Reserved";
      case IModelStatus.DeletionProhibited.valueOf(): return "Deletion Prohibited";
      case IModelStatus.DuplicateCode.valueOf(): return "Duplicate Code";
      case IModelStatus.DuplicateName.valueOf(): return "Duplicate Name";
      case IModelStatus.ElementBlockedChange.valueOf(): return "Element Blocked Change";
      case IModelStatus.FileAlreadyExists.valueOf(): return "File Already Exists";
      case IModelStatus.FileNotFound.valueOf(): return "File Not Found";
      case IModelStatus.FileNotLoaded.valueOf(): return "File Not Loaded";
      case IModelStatus.ForeignKeyConstraint.valueOf(): return "ForeignKey Constraint";
      case IModelStatus.IdExists.valueOf(): return "Id Exists";
      case IModelStatus.InDynamicTransaction.valueOf(): return "InDynamicTransaction";
      case IModelStatus.InvalidCategory.valueOf(): return "Invalid Category";
      case IModelStatus.InvalidCode.valueOf(): return "Invalid Code";
      case IModelStatus.InvalidCodeSpec.valueOf(): return "Invalid CodeSpec";
      case IModelStatus.InvalidId.valueOf(): return "Invalid Id";
      case IModelStatus.InvalidName.valueOf(): return "Invalid Name";
      case IModelStatus.InvalidParent.valueOf(): return "Invalid Parent";
      case IModelStatus.InvalidProfileVersion.valueOf(): return "Invalid Profile Version";
      case IModelStatus.IsCreatingChangeSet.valueOf(): return "IsCreatingChangeSet";
      case IModelStatus.LockNotHeld.valueOf(): return "Lock Not Held";
      case IModelStatus.Mismatch2d3d.valueOf(): return "Mismatch 2d3d";
      case IModelStatus.MismatchGcs.valueOf(): return "Mismatch Gcs";
      case IModelStatus.MissingDomain.valueOf(): return "Missing Domain";
      case IModelStatus.MissingHandler.valueOf(): return "Missing Handler";
      case IModelStatus.MissingId.valueOf(): return "Missing Id";
      case IModelStatus.NoGeometry.valueOf(): return "No Geometry";
      case IModelStatus.NoMultiTxnOperation.valueOf(): return "NoMultiTxnOperation";
      case IModelStatus.NotEnabled.valueOf(): return "Not Enabled";
      case IModelStatus.NotFound.valueOf(): return "Not Found";
      case IModelStatus.NotOpen.valueOf(): return "Not Open";
      case IModelStatus.NotOpenForWrite.valueOf(): return "Not Open For Write";
      case IModelStatus.NotSameUnitBase.valueOf(): return "Not Same Unit Base";
      case IModelStatus.NothingToRedo.valueOf(): return "Nothing To Redo";
      case IModelStatus.NothingToUndo.valueOf(): return "Nothing To Undo";
      case IModelStatus.ParentBlockedChange.valueOf(): return "Parent Blocked Change";
      case IModelStatus.ReadError.valueOf(): return "Read Error";
      case IModelStatus.ReadOnly.valueOf(): return "ReadOnly";
      case IModelStatus.ReadOnlyDomain.valueOf(): return "ReadOnlyDomain";
      case IModelStatus.RepositoryManagerError.valueOf(): return "RepositoryManagerError";
      case IModelStatus.SQLiteError.valueOf(): return "SQLiteError";
      case IModelStatus.TransactionActive.valueOf(): return "Transaction Active";
      case IModelStatus.UnitsMissing.valueOf(): return "Units Missing";
      case IModelStatus.UnknownFormat.valueOf(): return "Unknown Format";
      case IModelStatus.UpgradeFailed.valueOf(): return "Upgrade Failed";
      case IModelStatus.ValidationFailed.valueOf(): return "Validation Failed";
      case IModelStatus.VersionTooNew.valueOf(): return "Version Too New";
      case IModelStatus.VersionTooOld.valueOf(): return "Version Too Old";
      case IModelStatus.ViewNotFound.valueOf(): return "View Not Found";
      case IModelStatus.WriteError.valueOf(): return "Write Error";
      case IModelStatus.WrongClass.valueOf(): return "Wrong Class";
      case IModelStatus.WrongIModel.valueOf(): return "Wrong IModel";
      case IModelStatus.WrongDomain.valueOf(): return "Wrong Domain";
      case IModelStatus.WrongElement.valueOf(): return "Wrong Element";
      case IModelStatus.WrongHandler.valueOf(): return "Wrong Handler";
      case IModelStatus.WrongModel.valueOf(): return "Wrong Model";
      case DbResult.BE_SQLITE_ERROR.valueOf(): return "BE_SQLITE_ERROR";
      case DbResult.BE_SQLITE_INTERNAL.valueOf(): return "BE_SQLITE_INTERNAL";
      case DbResult.BE_SQLITE_PERM.valueOf(): return "BE_SQLITE_PERM";
      case DbResult.BE_SQLITE_ABORT.valueOf(): return "BE_SQLITE_ABORT";
      case DbResult.BE_SQLITE_BUSY.valueOf(): return "Db is busy";
      case DbResult.BE_SQLITE_LOCKED.valueOf(): return "Db is Locked";
      case DbResult.BE_SQLITE_NOMEM.valueOf(): return "BE_SQLITE_NOMEM";
      case DbResult.BE_SQLITE_READONLY.valueOf(): return "Readonly";
      case DbResult.BE_SQLITE_INTERRUPT.valueOf(): return "BE_SQLITE_INTERRUPT";
      case DbResult.BE_SQLITE_IOERR.valueOf(): return "BE_SQLITE_IOERR";
      case DbResult.BE_SQLITE_CORRUPT.valueOf(): return "BE_SQLITE_CORRUPT";
      case DbResult.BE_SQLITE_NOTFOUND.valueOf(): return "Not Found";
      case DbResult.BE_SQLITE_FULL.valueOf(): return "BE_SQLITE_FULL";
      case DbResult.BE_SQLITE_CANTOPEN.valueOf(): return "Can't open";
      case DbResult.BE_SQLITE_PROTOCOL.valueOf(): return "BE_SQLITE_PROTOCOL";
      case DbResult.BE_SQLITE_EMPTY.valueOf(): return "BE_SQLITE_EMPTY";
      case DbResult.BE_SQLITE_SCHEMA.valueOf(): return "BE_SQLITE_SCHEMA";
      case DbResult.BE_SQLITE_TOOBIG.valueOf(): return "BE_SQLITE_TOOBIG";
      case DbResult.BE_SQLITE_MISMATCH.valueOf(): return "BE_SQLITE_MISMATCH";
      case DbResult.BE_SQLITE_MISUSE.valueOf(): return "BE_SQLITE_MISUSE";
      case DbResult.BE_SQLITE_NOLFS.valueOf(): return "BE_SQLITE_NOLFS";
      case DbResult.BE_SQLITE_AUTH.valueOf(): return "BE_SQLITE_AUTH";
      case DbResult.BE_SQLITE_FORMAT.valueOf(): return "BE_SQLITE_FORMAT";
      case DbResult.BE_SQLITE_RANGE.valueOf(): return "BE_SQLITE_RANGE";
      case DbResult.BE_SQLITE_NOTADB.valueOf(): return "Not a Database";
      case DbResult.BE_SQLITE_IOERR_READ.valueOf(): return "BE_SQLITE_IOERR_READ";
      case DbResult.BE_SQLITE_IOERR_SHORT_READ.valueOf(): return "BE_SQLITE_IOERR_SHORT_READ";
      case DbResult.BE_SQLITE_IOERR_WRITE.valueOf(): return "BE_SQLITE_IOERR_WRITE";
      case DbResult.BE_SQLITE_IOERR_FSYNC.valueOf(): return "BE_SQLITE_IOERR_FSYNC";
      case DbResult.BE_SQLITE_IOERR_DIR_FSYNC.valueOf(): return "BE_SQLITE_IOERR_DIR_FSYNC";
      case DbResult.BE_SQLITE_IOERR_TRUNCATE.valueOf(): return "BE_SQLITE_IOERR_TRUNCATE";
      case DbResult.BE_SQLITE_IOERR_FSTAT.valueOf(): return "BE_SQLITE_IOERR_FSTAT";
      case DbResult.BE_SQLITE_IOERR_UNLOCK.valueOf(): return "BE_SQLITE_IOERR_UNLOCK";
      case DbResult.BE_SQLITE_IOERR_RDLOCK.valueOf(): return "BE_SQLITE_IOERR_RDLOCK";
      case DbResult.BE_SQLITE_IOERR_DELETE.valueOf(): return "BE_SQLITE_IOERR_DELETE";
      case DbResult.BE_SQLITE_IOERR_BLOCKED.valueOf(): return "BE_SQLITE_IOERR_BLOCKED";
      case DbResult.BE_SQLITE_IOERR_NOMEM.valueOf(): return "BE_SQLITE_IOERR_NOMEM";
      case DbResult.BE_SQLITE_IOERR_ACCESS.valueOf(): return "BE_SQLITE_IOERR_ACCESS";
      case DbResult.BE_SQLITE_IOERR_CHECKRESERVEDLOCK.valueOf(): return "BE_SQLITE_IOERR_CHECKRESERVEDLOCK";
      case DbResult.BE_SQLITE_IOERR_LOCK.valueOf(): return "BE_SQLITE_IOERR_LOCK";
      case DbResult.BE_SQLITE_IOERR_CLOSE.valueOf(): return "BE_SQLITE_IOERR_CLOSE";
      case DbResult.BE_SQLITE_IOERR_DIR_CLOSE.valueOf(): return "BE_SQLITE_IOERR_DIR_CLOSE";
      case DbResult.BE_SQLITE_IOERR_SHMOPEN.valueOf(): return "BE_SQLITE_IOERR_SHMOPEN";
      case DbResult.BE_SQLITE_IOERR_SHMSIZE.valueOf(): return "BE_SQLITE_IOERR_SHMSIZE";
      case DbResult.BE_SQLITE_IOERR_SHMLOCK.valueOf(): return "BE_SQLITE_IOERR_SHMLOCK";
      case DbResult.BE_SQLITE_IOERR_SHMMAP.valueOf(): return "BE_SQLITE_IOERR_SHMMAP";
      case DbResult.BE_SQLITE_IOERR_SEEK.valueOf(): return "BE_SQLITE_IOERR_SEEK";
      case DbResult.BE_SQLITE_IOERR_DELETE_NOENT.valueOf(): return "BE_SQLITE_IOERR_DELETE_NOENT";

      case DbResult.BE_SQLITE_ERROR_DataTransformRequired.valueOf(): return "Schema update require to transform data";
      case DbResult.BE_SQLITE_ERROR_FileExists.valueOf(): return "File Exists";
      case DbResult.BE_SQLITE_ERROR_AlreadyOpen.valueOf(): return "Already Open";
      case DbResult.BE_SQLITE_ERROR_NoPropertyTable.valueOf(): return "No Property Table";
      case DbResult.BE_SQLITE_ERROR_FileNotFound.valueOf(): return "File Not Found";
      case DbResult.BE_SQLITE_ERROR_NoTxnActive.valueOf(): return "No Txn Active";
      case DbResult.BE_SQLITE_ERROR_BadDbProfile.valueOf(): return "Bad Db Profile";
      case DbResult.BE_SQLITE_ERROR_InvalidProfileVersion.valueOf(): return "Invalid Profile Version";
      case DbResult.BE_SQLITE_ERROR_ProfileUpgradeFailed.valueOf(): return "Profile Upgrade Failed";
      case DbResult.BE_SQLITE_ERROR_ProfileTooOldForReadWrite.valueOf(): return "Profile Too Old For ReadWrite";
      case DbResult.BE_SQLITE_ERROR_ProfileTooOld.valueOf(): return "Profile Too Old";
      case DbResult.BE_SQLITE_ERROR_ProfileTooNewForReadWrite.valueOf(): return "Profile Too New For ReadWrite";
      case DbResult.BE_SQLITE_ERROR_ProfileTooNew.valueOf(): return "Profile Too New";
      case DbResult.BE_SQLITE_ERROR_ChangeTrackError.valueOf(): return "ChangeTrack Error";
      case DbResult.BE_SQLITE_ERROR_InvalidChangeSetVersion.valueOf(): return "Invalid ChangeSet Version";
      case DbResult.BE_SQLITE_ERROR_SchemaUpgradeRequired.valueOf(): return "Schema Upgrade Required";
      case DbResult.BE_SQLITE_ERROR_SchemaTooNew.valueOf(): return "Schema Too New";
      case DbResult.BE_SQLITE_ERROR_SchemaTooOld.valueOf(): return "Schema Too Old";
      case DbResult.BE_SQLITE_ERROR_SchemaLockFailed.valueOf(): return "Schema Lock Failed";
      case DbResult.BE_SQLITE_ERROR_SchemaUpgradeFailed.valueOf(): return "Schema Upgrade Failed";
      case DbResult.BE_SQLITE_ERROR_SchemaImportFailed.valueOf(): return "Schema Import Failed";
      case DbResult.BE_SQLITE_ERROR_CouldNotAcquireLocksOrCodes.valueOf(): return "Could Not Acquire Locks Or Codes";
      case DbResult.BE_SQLITE_ERROR_SchemaUpgradeRecommended.valueOf(): return "Recommended that the schemas found in the database be upgraded";
      case DbResult.BE_SQLITE_LOCKED_SHAREDCACHE.valueOf(): return "BE_SQLITE_LOCKED_SHAREDCACHE";
      case DbResult.BE_SQLITE_BUSY_RECOVERY.valueOf(): return "BE_SQLITE_BUSY_RECOVERY";
      case DbResult.BE_SQLITE_CANTOPEN_NOTEMPDIR.valueOf(): return "SQLite No Temp Dir";
      case DbResult.BE_SQLITE_CANTOPEN_ISDIR.valueOf(): return "BE_SQLITE_CANTOPEN_ISDIR";
      case DbResult.BE_SQLITE_CANTOPEN_FULLPATH.valueOf(): return "BE_SQLITE_CANTOPEN_FULLPATH";
      case DbResult.BE_SQLITE_CORRUPT_VTAB.valueOf(): return "BE_SQLITE_CORRUPT_VTAB";
      case DbResult.BE_SQLITE_READONLY_RECOVERY.valueOf(): return "BE_SQLITE_READONLY_RECOVERY";
      case DbResult.BE_SQLITE_READONLY_CANTLOCK.valueOf(): return "BE_SQLITE_READONLY_CANTLOCK";
      case DbResult.BE_SQLITE_READONLY_ROLLBACK.valueOf(): return "BE_SQLITE_READONLY_ROLLBACK";
      case DbResult.BE_SQLITE_ABORT_ROLLBACK.valueOf(): return "BE_SQLITE_ABORT_ROLLBACK";
      case DbResult.BE_SQLITE_CONSTRAINT_CHECK.valueOf(): return "BE_SQLITE_CONSTRAINT_CHECK";
      case DbResult.BE_SQLITE_CONSTRAINT_COMMITHOOK.valueOf(): return "CommitHook Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_FOREIGNKEY.valueOf(): return "Foreign Key Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_FUNCTION.valueOf(): return "Function Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_NOTNULL.valueOf(): return "NotNull Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_PRIMARYKEY.valueOf(): return "Primary Key Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_TRIGGER.valueOf(): return "Trigger Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_UNIQUE.valueOf(): return "Unique Constraint Error";
      case DbResult.BE_SQLITE_CONSTRAINT_VTAB.valueOf(): return "VTable Constraint Error";
      case BentleyStatus.ERROR.valueOf(): return "Error";
      case BriefcaseStatus.CannotAcquire.valueOf(): return "CannotAcquire";
      case BriefcaseStatus.CannotDownload.valueOf(): return "CannotDownload";
      case BriefcaseStatus.CannotCopy.valueOf(): return "CannotCopy";
      case BriefcaseStatus.CannotDelete.valueOf(): return "CannotDelete";
      case BriefcaseStatus.VersionNotFound.valueOf(): return "VersionNotFound";
      case BriefcaseStatus.DownloadCancelled.valueOf(): return "DownloadCancelled";
      case BriefcaseStatus.ContainsDeletedChangeSets.valueOf(): return "ContainsDeletedChangeSets";
      case RpcInterfaceStatus.IncompatibleVersion.valueOf(): return "RpcInterfaceStatus.IncompatibleVersion";
      case ChangeSetStatus.ApplyError.valueOf(): return "Error applying a change set";
      case ChangeSetStatus.ChangeTrackingNotEnabled.valueOf(): return "Change tracking has not been enabled. The ChangeSet API mandates this";
      case ChangeSetStatus.CorruptedChangeStream.valueOf(): return "Contents of the change stream are corrupted and does not match the ChangeSet";
      case ChangeSetStatus.FileNotFound.valueOf(): return "File containing the changes was not found";
      case ChangeSetStatus.FileWriteError.valueOf(): return "Error writing the contents of the change set to the backing change stream file";
      case ChangeSetStatus.HasLocalChanges.valueOf(): return "Cannot perform the operation since the Db has local changes";
      case ChangeSetStatus.HasUncommittedChanges.valueOf(): return "Cannot perform the operation since current transaction has uncommitted changes";
      case ChangeSetStatus.InvalidId.valueOf(): return "Invalid ChangeSet Id";
      case ChangeSetStatus.InvalidVersion.valueOf(): return "Invalid version of the change set";
      case ChangeSetStatus.InDynamicTransaction.valueOf(): return "Cannot perform the operation since system is in the middle of a dynamic transaction";
      case ChangeSetStatus.IsCreatingChangeSet.valueOf(): return "Cannot perform operation since system is in the middle of a creating a change set";
      case ChangeSetStatus.IsNotCreatingChangeSet.valueOf(): return "Cannot perform operation since the system is not creating a change set";
      case ChangeSetStatus.MergePropagationError.valueOf(): return "Error propagating the changes after the merge";
      case ChangeSetStatus.NothingToMerge.valueOf(): return "No change sets to merge";
      case ChangeSetStatus.NoTransactions.valueOf(): return "No transactions are available to create a change set";
      case ChangeSetStatus.ParentMismatch.valueOf(): return "Parent change set of the Db does not match the parent id of the change set";
      case ChangeSetStatus.SQLiteError.valueOf(): return "Error performing a SQLite operation on the Db";
      case ChangeSetStatus.WrongDgnDb.valueOf(): return "ChangeSet originated in a different Db";
      case ChangeSetStatus.CouldNotOpenDgnDb.valueOf(): return "Could not open the DgnDb to merge change set";
      case ChangeSetStatus.MergeSchemaChangesOnOpen.valueOf(): return "Cannot merge changes in in an open DgnDb. Close the DgnDb, and process the operation when it is opened";
      case ChangeSetStatus.ReverseOrReinstateSchemaChanges.valueOf(): return "Cannot reverse or reinstate schema changes.";
      case ChangeSetStatus.ProcessSchemaChangesOnOpen.valueOf(): return "Cannot process changes schema changes in an open DgnDb. Close the DgnDb, and process the operation when it is opened";
      case ChangeSetStatus.CannotMergeIntoReadonly.valueOf(): return "Cannot merge changes into a Readonly DgnDb";
      case ChangeSetStatus.CannotMergeIntoMaster.valueOf(): return "Cannot merge changes into a Master DgnDb";
      case ChangeSetStatus.CannotMergeIntoReversed.valueOf(): return "Cannot merge changes into a DgnDb that has reversed change sets";
      case ChangeSetStatus.DownloadCancelled.valueOf(): return "ChangeSet(s) download was cancelled.";
      case RepositoryStatus.ServerUnavailable.valueOf(): return "ServerUnavailable";
      case RepositoryStatus.LockAlreadyHeld.valueOf(): return "LockAlreadyHeld";
      case RepositoryStatus.SyncError.valueOf(): return "SyncError";
      case RepositoryStatus.InvalidResponse.valueOf(): return "InvalidResponse";
      case RepositoryStatus.PendingTransactions.valueOf(): return "PendingTransactions";
      case RepositoryStatus.LockUsed.valueOf(): return "LockUsed";
      case RepositoryStatus.CannotCreateChangeSet.valueOf(): return "CannotCreateChangeSet";
      case RepositoryStatus.InvalidRequest.valueOf(): return "InvalidRequest";
      case RepositoryStatus.ChangeSetRequired.valueOf(): return "ChangeSetRequired";
      case RepositoryStatus.CodeUnavailable.valueOf(): return "CodeUnavailable";
      case RepositoryStatus.CodeNotReserved.valueOf(): return "CodeNotReserved";
      case RepositoryStatus.CodeUsed.valueOf(): return "CodeUsed";
      case RepositoryStatus.LockNotHeld.valueOf(): return "LockNotHeld";
      case RepositoryStatus.RepositoryIsLocked.valueOf(): return "RepositoryIsLocked";
      case RepositoryStatus.ChannelConstraintViolation.valueOf(): return "ChannelConstraintViolation";
      case HttpStatus.Info.valueOf(): return "HTTP Info";
      case HttpStatus.Redirection.valueOf(): return "HTTP Redirection";
      case HttpStatus.ClientError.valueOf(): return "HTTP Client error";
      case HttpStatus.ServerError.valueOf(): return "HTTP Server error";
      case IModelHubStatus.Unknown.valueOf(): return "Unknown error";
      case IModelHubStatus.MissingRequiredProperties.valueOf(): return "Missing required properties";
      case IModelHubStatus.InvalidPropertiesValues.valueOf(): return "Invalid properties values";
      case IModelHubStatus.UserDoesNotHavePermission.valueOf(): return "User does not have permission";
      case IModelHubStatus.UserDoesNotHaveAccess.valueOf(): return "User does not have access";
      case IModelHubStatus.InvalidBriefcase.valueOf(): return "Invalid briefcase";
      case IModelHubStatus.BriefcaseDoesNotExist.valueOf(): return "Briefcase does not exist";
      case IModelHubStatus.BriefcaseDoesNotBelongToUser.valueOf(): return "Briefcase does not belong to user";
      case IModelHubStatus.AnotherUserPushing.valueOf(): return "Another user pushing";
      case IModelHubStatus.ChangeSetAlreadyExists.valueOf(): return "ChangeSet already exists";
      case IModelHubStatus.ChangeSetDoesNotExist.valueOf(): return "ChangeSet does not exist";
      case IModelHubStatus.FileIsNotUploaded.valueOf(): return "File is not uploaded";
      case IModelHubStatus.iModelIsNotInitialized.valueOf(): return "iModel is not initialized";
      case IModelHubStatus.ChangeSetPointsToBadSeed.valueOf(): return "ChangeSet points to a bad seed file";
      case IModelHubStatus.OperationFailed.valueOf(): return "iModelHub operation has failed";
      case IModelHubStatus.PullIsRequired.valueOf(): return "Pull is required";
      case IModelHubStatus.MaximumNumberOfBriefcasesPerUser.valueOf(): return "Limit of briefcases per user was reached";
      case IModelHubStatus.MaximumNumberOfBriefcasesPerUserPerMinute.valueOf(): return "Limit of briefcases per user per minute was reached";
      case IModelHubStatus.DatabaseTemporarilyLocked.valueOf(): return "Database is temporarily locked";
      case IModelHubStatus.iModelIsLocked.valueOf(): return "iModel is locked";
      case IModelHubStatus.CodesExist.valueOf(): return "Code already exists";
      case IModelHubStatus.LocksExist.valueOf(): return "Lock already exists";
      case IModelHubStatus.iModelAlreadyExists.valueOf(): return "iModel already exists";
      case IModelHubStatus.iModelDoesNotExist.valueOf(): return "iModel does not exist";
      case IModelHubStatus.LockDoesNotExist.valueOf(): return "Lock does not exist";
      case IModelHubStatus.LockChunkDoesNotExist.valueOf(): return "Lock chunk does not exist";
      case IModelHubStatus.LockOwnedByAnotherBriefcase.valueOf(): return "Lock is owned by another briefcase";
      case IModelHubStatus.CodeStateInvalid.valueOf(): return "Code state is invalid";
      case IModelHubStatus.CodeReservedByAnotherBriefcase.valueOf(): return "Code is reserved by another briefcase";
      case IModelHubStatus.CodeDoesNotExist.valueOf(): return "Code does not exist";
      case IModelHubStatus.FileDoesNotExist.valueOf(): return "File does not exist";
      case IModelHubStatus.FileAlreadyExists.valueOf(): return "File already exists";
      case IModelHubStatus.EventTypeDoesNotExist.valueOf(): return "Event type does not exist";
      case IModelHubStatus.EventSubscriptionDoesNotExist.valueOf(): return "Event subscription does not exist";
      case IModelHubStatus.EventSubscriptionAlreadyExists.valueOf(): return "Event subscription already exists";
      case IModelHubStatus.ITwinIdIsNotSpecified.valueOf(): return "ITwin Id is not specified";
      case IModelHubStatus.FailedToGetITwinPermissions.valueOf(): return "Failed to get iTwin permissions";
      case IModelHubStatus.FailedToGetITwinMembers.valueOf(): return "Failed to get iTwin members";
      case IModelHubStatus.FailedToGetAssetPermissions.valueOf(): return "Failed to get asset permissions";
      case IModelHubStatus.FailedToGetAssetMembers.valueOf(): return "Failed to get asset members";
      case IModelHubStatus.ChangeSetAlreadyHasVersion.valueOf(): return "ChangeSet already has version";
      case IModelHubStatus.VersionAlreadyExists.valueOf(): return "Version already exists";
      case IModelHubStatus.JobSchedulingFailed.valueOf(): return "Failed to schedule a background job";
      case IModelHubStatus.ConflictsAggregate.valueOf(): return "Codes or locks are owned by another briefcase";
      case IModelHubStatus.FailedToGetITwinById.valueOf(): return "Failed to query iTwin by its id";
      case IModelHubStatus.DatabaseOperationFailed.valueOf(): return "Database operation has failed";
      case IModelHubStatus.ITwinDoesNotExist.valueOf(): return "ITwin does not exist";
      case IModelHubStatus.UndefinedArgumentError.valueOf(): return "Undefined argument";
      case IModelHubStatus.InvalidArgumentError.valueOf(): return "Invalid argument";
      case IModelHubStatus.MissingDownloadUrlError.valueOf(): return "Missing download url";
      case IModelHubStatus.NotSupportedInBrowser.valueOf(): return "Not supported in browser";
      case IModelHubStatus.FileHandlerNotSet.valueOf(): return "File handler is not set";
      case IModelHubStatus.FileNotFound.valueOf(): return "File not found";
      case GeoServiceStatus.NoGeoLocation.valueOf(): return "No GeoLocation";
      case GeoServiceStatus.OutOfUsefulRange.valueOf(): return "Out of useful range";
      case GeoServiceStatus.OutOfMathematicalDomain.valueOf(): return "Out of mathematical domain";
      case GeoServiceStatus.NoDatumConverter.valueOf(): return "No datum converter";
      case GeoServiceStatus.VerticalDatumConvertError.valueOf(): return "Vertical datum convert error";
      case GeoServiceStatus.CSMapError.valueOf(): return "CSMap error";
      case GeoServiceStatus.Pending.valueOf(): return "Pending";
      case RealityDataStatus.InvalidData.valueOf(): return "Invalid or unknown data";
      case IModelStatus.Success.valueOf():
      case DbResult.BE_SQLITE_OK.valueOf():
      case DbResult.BE_SQLITE_ROW.valueOf():
      case DbResult.BE_SQLITE_DONE.valueOf():
      case BentleyStatus.SUCCESS.valueOf():
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

      if (error.toString() !== "[object Object]")
        return error.toString();
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

