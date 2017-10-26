/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { LogFunction } from "./Logger";

/** Status codes that are used in conjunction with [[IModelError]]. */
export const enum IModelStatus { // NOTE: values must be kept in sync with DgnDbStatus and DbResult on the DgnPlatform C++ side
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
  IsCreatingRevision = IMODEL_ERROR_BASE + 27,
  LockNotHeld = IMODEL_ERROR_BASE + 28,
  Mismatch2d3d = IMODEL_ERROR_BASE + 29,
  MismatchGcs = IMODEL_ERROR_BASE + 30,  // The Geographic Coordinate Systems of the source and target are not based on equivalent projections
  MissingDomain = IMODEL_ERROR_BASE + 31,
  MissingHandler = IMODEL_ERROR_BASE + 32,
  MissingId = IMODEL_ERROR_BASE + 33,
  NoGeometry = IMODEL_ERROR_BASE + 34,
  NoMultiTxnOperation = IMODEL_ERROR_BASE + 35,
  NotDgnMarkupProject = IMODEL_ERROR_BASE + 36,
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
}

/** Error status from various briefcase operations */
export const enum BriefcaseStatus { // WIP: Need to setup the error numbers in a consistent way
  CannotAcquire = 0x20000,
  CannotDownload,
  CannotCopy,
  CannotDelete,
  VersionNotFound,
}

/** Defines the *signature* for a function that returns meta-data related to an error.
 * Declared as a function so that the expense of creating the meta-data is only paid when it is needed.
 */
export type GetMetaDataFunction = () => any;

/** The error type thrown by this module. `IModelError` subclasses `Error` to add an `errorNumber` member. See [[IModelStatus]] for `errorNumber` values. */
export class IModelError extends Error {
  private readonly _getMetaData: GetMetaDataFunction |  undefined;
  public errorNumber: number;

  public constructor(errorNumber: number | IModelStatus | DbResult | BentleyStatus | BriefcaseStatus, message?: string, log?: LogFunction, getMetaData?: GetMetaDataFunction) {
    super(message);
    this.errorNumber = errorNumber;
    assert(errorNumber as number !== IModelStatus.Success as number);
    this._getMetaData = getMetaData;
    this.name = this._initName();
    if (log)
      log(this.toString(), this._getMetaData);
  }

  public hasMetaData(): boolean { return this._getMetaData !== undefined; }

  public getMetaData(): any {
    return this.hasMetaData() ? this._getMetaData!() : undefined;
  }

  private _initName(): string {
    switch (this.errorNumber) {
      // IModelStatus cases
      case IModelStatus.AlreadyLoaded: return "IModelStatus.AlreadyLoaded";
      case IModelStatus.AlreadyOpen: return "IModelStatus.AlreadyOpen";
      case IModelStatus.BadArg: return "IModelStatus.BadArg";
      case IModelStatus.BadElement: return "IModelStatus.BadElement";
      case IModelStatus.BadModel: return "IModelStatus.BadModel";
      case IModelStatus.BadRequest: return "IModelStatus.BadRequest";
      case IModelStatus.BadSchema: return "IModelStatus.BadSchema";
      case IModelStatus.CannotUndo: return "IModelStatus.CannotUndo";
      case IModelStatus.CodeNotReserved: return "IModelStatus.CodeNotReserved";
      case IModelStatus.DeletionProhibited: return "IModelStatus.DeletionProhibited";
      case IModelStatus.DuplicateCode: return "IModelStatus.DuplicateCode";
      case IModelStatus.DuplicateName: return "IModelStatus.DuplicateName";
      case IModelStatus.ElementBlockedChange: return "IModelStatus.ElementBlockedChange";
      case IModelStatus.FileAlreadyExists: return "IModelStatus.FileAlreadyExists";
      case IModelStatus.FileNotFound: return "IModelStatus.FileNotFound";
      case IModelStatus.FileNotLoaded: return "IModelStatus.FileNotLoaded";
      case IModelStatus.ForeignKeyConstraint: return "IModelStatus.ForeignKeyConstraint";
      case IModelStatus.IdExists: return "IModelStatus.IdExists";
      case IModelStatus.InDynamicTransaction: return "IModelStatus.InDynamicTransaction";
      case IModelStatus.InvalidCategory: return "IModelStatus.InvalidCategory";
      case IModelStatus.InvalidCode: return "IModelStatus.InvalidCode";
      case IModelStatus.InvalidCodeSpec: return "IModelStatus.InvalidCodeSpec";
      case IModelStatus.InvalidId: return "IModelStatus.InvalidId";
      case IModelStatus.InvalidName: return "IModelStatus.InvalidName";
      case IModelStatus.InvalidParent: return "IModelStatus.InvalidParent";
      case IModelStatus.InvalidProfileVersion: return "IModelStatus.InvalidProfileVersion";
      case IModelStatus.IsCreatingRevision: return "IModelStatus.IsCreatingRevision";
      case IModelStatus.LockNotHeld: return "IModelStatus.LockNotHeld";
      case IModelStatus.Mismatch2d3d: return "IModelStatus.Mismatch2d3d";
      case IModelStatus.MismatchGcs: return "IModelStatus.MismatchGcs";
      case IModelStatus.MissingDomain: return "IModelStatus.MissingDomain";
      case IModelStatus.MissingHandler: return "IModelStatus.MissingHandler";
      case IModelStatus.MissingId: return "IModelStatus.MissingId";
      case IModelStatus.NoGeometry: return "IModelStatus.NoGeometry";
      case IModelStatus.NoMultiTxnOperation: return "IModelStatus.NoMultiTxnOperation";
      case IModelStatus.NotDgnMarkupProject: return "IModelStatus.NotDgnMarkupProject";
      case IModelStatus.NotEnabled: return "IModelStatus.NotEnabled";
      case IModelStatus.NotFound: return "IModelStatus.NotFound";
      case IModelStatus.NotOpen: return "IModelStatus.NotOpen";
      case IModelStatus.NotOpenForWrite: return "IModelStatus.NotOpenForWrite";
      case IModelStatus.NotSameUnitBase: return "IModelStatus.NotSameUnitBase";
      case IModelStatus.NothingToRedo: return "IModelStatus.NothingToRedo";
      case IModelStatus.NothingToUndo: return "IModelStatus.NothingToUndo";
      case IModelStatus.ParentBlockedChange: return "IModelStatus.ParentBlockedChange";
      case IModelStatus.ReadError: return "IModelStatus.ReadError";
      case IModelStatus.ReadOnly: return "IModelStatus.ReadOnly";
      case IModelStatus.ReadOnlyDomain: return "IModelStatus.ReadOnlyDomain";
      case IModelStatus.RepositoryManagerError: return "IModelStatus.RepositoryManagerError";
      case IModelStatus.SQLiteError: return "IModelStatus.SQLiteError";
      case IModelStatus.TransactionActive: return "IModelStatus.TransactionActive";
      case IModelStatus.UnitsMissing: return "IModelStatus.UnitsMissing";
      case IModelStatus.UnknownFormat: return "IModelStatus.UnknownFormat";
      case IModelStatus.UpgradeFailed: return "IModelStatus.UpgradeFailed";
      case IModelStatus.ValidationFailed: return "IModelStatus.ValidationFailed";
      case IModelStatus.VersionTooNew: return "IModelStatus.VersionTooNew";
      case IModelStatus.VersionTooOld: return "IModelStatus.VersionTooOld";
      case IModelStatus.ViewNotFound: return "IModelStatus.ViewNotFound";
      case IModelStatus.WriteError: return "IModelStatus.WriteError";
      case IModelStatus.WrongClass: return "IModelStatus.WrongClass";
      case IModelStatus.WrongIModel: return "IModelStatus.WrongIModel";
      case IModelStatus.WrongDomain: return "IModelStatus.WrongDomain";
      case IModelStatus.WrongElement: return "IModelStatus.WrongElement";
      case IModelStatus.WrongHandler: return "IModelStatus.WrongHandler";
      case IModelStatus.WrongModel: return "IModelStatus.WrongModel";

      // DbResult cases
      case DbResult.BE_SQLITE_ERROR: return "DbResult.BE_SQLITE_ERROR";
      case DbResult.BE_SQLITE_INTERNAL: return "DbResult.BE_SQLITE_INTERNAL";
      case DbResult.BE_SQLITE_PERM: return "DbResult.BE_SQLITE_PERM";
      case DbResult.BE_SQLITE_ABORT: return "DbResult.BE_SQLITE_ABORT";
      case DbResult.BE_SQLITE_BUSY: return "DbResult.BE_SQLITE_BUSY";
      case DbResult.BE_SQLITE_LOCKED: return "DbResult.BE_SQLITE_LOCKED";
      case DbResult.BE_SQLITE_NOMEM: return "DbResult.BE_SQLITE_NOMEM";
      case DbResult.BE_SQLITE_READONLY: return "DbResult.BE_SQLITE_READONLY";
      case DbResult.BE_SQLITE_INTERRUPT: return "DbResult.BE_SQLITE_INTERRUPT";
      case DbResult.BE_SQLITE_IOERR: return "DbResult.BE_SQLITE_IOERR";
      case DbResult.BE_SQLITE_CORRUPT: return "DbResult.BE_SQLITE_CORRUPT";
      case DbResult.BE_SQLITE_NOTFOUND: return "DbResult.BE_SQLITE_NOTFOUND";
      case DbResult.BE_SQLITE_FULL: return "DbResult.BE_SQLITE_FULL";
      case DbResult.BE_SQLITE_CANTOPEN: return "DbResult.BE_SQLITE_CANTOPEN";
      case DbResult.BE_SQLITE_PROTOCOL: return "DbResult.BE_SQLITE_PROTOCOL";
      case DbResult.BE_SQLITE_EMPTY: return "DbResult.BE_SQLITE_EMPTY";
      case DbResult.BE_SQLITE_SCHEMA: return "DbResult.BE_SQLITE_SCHEMA";
      case DbResult.BE_SQLITE_TOOBIG: return "DbResult.BE_SQLITE_TOOBIG";
      case DbResult.BE_SQLITE_CONSTRAINT_BASE: return "DbResult.BE_SQLITE_CONSTRAINT_BASE";
      case DbResult.BE_SQLITE_MISMATCH: return "DbResult.BE_SQLITE_MISMATCH";
      case DbResult.BE_SQLITE_MISUSE: return "DbResult.BE_SQLITE_MISUSE";
      case DbResult.BE_SQLITE_NOLFS: return "DbResult.BE_SQLITE_NOLFS";
      case DbResult.BE_SQLITE_AUTH: return "DbResult.BE_SQLITE_AUTH";
      case DbResult.BE_SQLITE_FORMAT: return "DbResult.BE_SQLITE_FORMAT";
      case DbResult.BE_SQLITE_RANGE: return "DbResult.BE_SQLITE_RANGE";
      case DbResult.BE_SQLITE_NOTADB: return "DbResult.BE_SQLITE_NOTADB";

      // BentleyStatus cases
      case BentleyStatus.ERROR: return "BentleyStatus.ERROR";

      // BriefcaseStatus
      case BriefcaseStatus.CannotAcquire: return "BriefcaseError.CannotAcquire";
      case BriefcaseStatus.CannotDownload: return "BriefcaseError.CannotDownload";
      case BriefcaseStatus.CannotCopy: return "BriefcaseError.CannotCopy";
      case BriefcaseStatus.CannotDelete: return "BriefcaseError.CannotDelete";
      case BriefcaseStatus.VersionNotFound: return "BriefcaseError.VersionNotFound";

      // Unexpected cases
      case IModelStatus.Success:
      case DbResult.BE_SQLITE_OK:
      case DbResult.BE_SQLITE_ROW:
      case DbResult.BE_SQLITE_DONE:
      case BentleyStatus.SUCCESS:
      default:
        assert(false); // Unknown error
        return "IModelError";
    }
  }
}
