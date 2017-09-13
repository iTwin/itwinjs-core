/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";

export const enum IModelStatus {
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
  WrongDgnDb = IMODEL_ERROR_BASE + 60,
  WrongDomain = IMODEL_ERROR_BASE + 61,
  WrongElement = IMODEL_ERROR_BASE + 62,
  WrongHandler = IMODEL_ERROR_BASE + 63,
  WrongModel = IMODEL_ERROR_BASE + 64,
}

export class IModelError extends Error {
  public constructor(public readonly errorNumber: number | IModelStatus | DbResult | BentleyStatus, message?: string) {
    super(message);
    assert(errorNumber as number !== IModelStatus.Success as number);
  }

  public toDebugString(): string {
    switch (this.errorNumber) {
      // IModelStatus cases
      case IModelStatus.AlreadyLoaded: return this._appendMessage("IModelStatus.AlreadyLoaded");
      case IModelStatus.AlreadyOpen: return this._appendMessage("IModelStatus.AlreadyOpen");
      case IModelStatus.BadArg: return this._appendMessage("IModelStatus.BadArg");
      case IModelStatus.BadElement: return this._appendMessage("IModelStatus.BadElement");
      case IModelStatus.BadModel: return this._appendMessage("IModelStatus.BadModel");
      case IModelStatus.BadRequest: return this._appendMessage("IModelStatus.BadRequest");
      case IModelStatus.BadSchema: return this._appendMessage("IModelStatus.BadSchema");
      case IModelStatus.CannotUndo: return this._appendMessage("IModelStatus.CannotUndo");
      case IModelStatus.CodeNotReserved: return this._appendMessage("IModelStatus.CodeNotReserved");
      case IModelStatus.DeletionProhibited: return this._appendMessage("IModelStatus.DeletionProhibited");
      case IModelStatus.DuplicateCode: return this._appendMessage("IModelStatus.DuplicateCode");
      case IModelStatus.DuplicateName: return this._appendMessage("IModelStatus.DuplicateName");
      case IModelStatus.ElementBlockedChange: return this._appendMessage("IModelStatus.ElementBlockedChange");
      case IModelStatus.FileAlreadyExists: return this._appendMessage("IModelStatus.FileAlreadyExists");
      case IModelStatus.FileNotFound: return this._appendMessage("IModelStatus.FileNotFound");
      case IModelStatus.FileNotLoaded: return this._appendMessage("IModelStatus.FileNotLoaded");
      case IModelStatus.ForeignKeyConstraint: return this._appendMessage("IModelStatus.ForeignKeyConstraint");
      case IModelStatus.IdExists: return this._appendMessage("IModelStatus.IdExists");
      case IModelStatus.InDynamicTransaction: return this._appendMessage("IModelStatus.InDynamicTransaction");
      case IModelStatus.InvalidCategory: return this._appendMessage("IModelStatus.InvalidCategory");
      case IModelStatus.InvalidCode: return this._appendMessage("IModelStatus.InvalidCode");
      case IModelStatus.InvalidCodeSpec: return this._appendMessage("IModelStatus.InvalidCodeSpec");
      case IModelStatus.InvalidId: return this._appendMessage("IModelStatus.InvalidId");
      case IModelStatus.InvalidName: return this._appendMessage("IModelStatus.InvalidName");
      case IModelStatus.InvalidParent: return this._appendMessage("IModelStatus.InvalidParent");
      case IModelStatus.InvalidProfileVersion: return this._appendMessage("IModelStatus.InvalidProfileVersion");
      case IModelStatus.IsCreatingRevision: return this._appendMessage("IModelStatus.IsCreatingRevision");
      case IModelStatus.LockNotHeld: return this._appendMessage("IModelStatus.LockNotHeld");
      case IModelStatus.Mismatch2d3d: return this._appendMessage("IModelStatus.Mismatch2d3d");
      case IModelStatus.MismatchGcs: return this._appendMessage("IModelStatus.MismatchGcs");
      case IModelStatus.MissingDomain: return this._appendMessage("IModelStatus.MissingDomain");
      case IModelStatus.MissingHandler: return this._appendMessage("IModelStatus.MissingHandler");
      case IModelStatus.MissingId: return this._appendMessage("IModelStatus.MissingId");
      case IModelStatus.NoGeometry: return this._appendMessage("IModelStatus.NoGeometry");
      case IModelStatus.NoMultiTxnOperation: return this._appendMessage("IModelStatus.NoMultiTxnOperation");
      case IModelStatus.NotDgnMarkupProject: return this._appendMessage("IModelStatus.NotDgnMarkupProject");
      case IModelStatus.NotEnabled: return this._appendMessage("IModelStatus.NotEnabled");
      case IModelStatus.NotFound: return this._appendMessage("IModelStatus.NotFound");
      case IModelStatus.NotOpen: return this._appendMessage("IModelStatus.NotOpen");
      case IModelStatus.NotOpenForWrite: return this._appendMessage("IModelStatus.NotOpenForWrite");
      case IModelStatus.NotSameUnitBase: return this._appendMessage("IModelStatus.NotSameUnitBase");
      case IModelStatus.NothingToRedo: return this._appendMessage("IModelStatus.NothingToRedo");
      case IModelStatus.NothingToUndo: return this._appendMessage("IModelStatus.NothingToUndo");
      case IModelStatus.ParentBlockedChange: return this._appendMessage("IModelStatus.ParentBlockedChange");
      case IModelStatus.ReadError: return this._appendMessage("IModelStatus.ReadError");
      case IModelStatus.ReadOnly: return this._appendMessage("IModelStatus.ReadOnly");
      case IModelStatus.ReadOnlyDomain: return this._appendMessage("IModelStatus.ReadOnlyDomain");
      case IModelStatus.RepositoryManagerError: return this._appendMessage("IModelStatus.RepositoryManagerError");
      case IModelStatus.SQLiteError: return this._appendMessage("IModelStatus.SQLiteError");
      case IModelStatus.TransactionActive: return this._appendMessage("IModelStatus.TransactionActive");
      case IModelStatus.UnitsMissing: return this._appendMessage("IModelStatus.UnitsMissing");
      case IModelStatus.UnknownFormat: return this._appendMessage("IModelStatus.UnknownFormat");
      case IModelStatus.UpgradeFailed: return this._appendMessage("IModelStatus.UpgradeFailed");
      case IModelStatus.ValidationFailed: return this._appendMessage("IModelStatus.ValidationFailed");
      case IModelStatus.VersionTooNew: return this._appendMessage("IModelStatus.VersionTooNew");
      case IModelStatus.VersionTooOld: return this._appendMessage("IModelStatus.VersionTooOld");
      case IModelStatus.ViewNotFound: return this._appendMessage("IModelStatus.ViewNotFound");
      case IModelStatus.WriteError: return this._appendMessage("IModelStatus.WriteError");
      case IModelStatus.WrongClass: return this._appendMessage("IModelStatus.WrongClass");
      case IModelStatus.WrongDgnDb: return this._appendMessage("IModelStatus.WrongDgnDb");
      case IModelStatus.WrongDomain: return this._appendMessage("IModelStatus.WrongDomain");
      case IModelStatus.WrongElement: return this._appendMessage("IModelStatus.WrongElement");
      case IModelStatus.WrongHandler: return this._appendMessage("IModelStatus.WrongHandler");
      case IModelStatus.WrongModel: return this._appendMessage("IModelStatus.WrongModel");

      // DbResult cases
      case DbResult.BE_SQLITE_ERROR: return this._appendMessage("DbResult.BE_SQLITE_ERROR");
      case DbResult.BE_SQLITE_INTERNAL: return this._appendMessage("DbResult.BE_SQLITE_INTERNAL");
      case DbResult.BE_SQLITE_PERM: return this._appendMessage("DbResult.BE_SQLITE_PERM");
      case DbResult.BE_SQLITE_ABORT: return this._appendMessage("DbResult.BE_SQLITE_ABORT");
      case DbResult.BE_SQLITE_BUSY: return this._appendMessage("DbResult.BE_SQLITE_BUSY");
      case DbResult.BE_SQLITE_LOCKED: return this._appendMessage("DbResult.BE_SQLITE_LOCKED");
      case DbResult.BE_SQLITE_NOMEM: return this._appendMessage("DbResult.BE_SQLITE_NOMEM");
      case DbResult.BE_SQLITE_READONLY: return this._appendMessage("DbResult.BE_SQLITE_READONLY");
      case DbResult.BE_SQLITE_INTERRUPT: return this._appendMessage("DbResult.BE_SQLITE_INTERRUPT");
      case DbResult.BE_SQLITE_IOERR: return this._appendMessage("DbResult.BE_SQLITE_IOERR");
      case DbResult.BE_SQLITE_CORRUPT: return this._appendMessage("DbResult.BE_SQLITE_CORRUPT");
      case DbResult.BE_SQLITE_NOTFOUND: return this._appendMessage("DbResult.BE_SQLITE_NOTFOUND");
      case DbResult.BE_SQLITE_FULL: return this._appendMessage("DbResult.BE_SQLITE_FULL");
      case DbResult.BE_SQLITE_CANTOPEN: return this._appendMessage("DbResult.BE_SQLITE_CANTOPEN");
      case DbResult.BE_SQLITE_PROTOCOL: return this._appendMessage("DbResult.BE_SQLITE_PROTOCOL");
      case DbResult.BE_SQLITE_EMPTY: return this._appendMessage("DbResult.BE_SQLITE_EMPTY");
      case DbResult.BE_SQLITE_SCHEMA: return this._appendMessage("DbResult.BE_SQLITE_SCHEMA");
      case DbResult.BE_SQLITE_TOOBIG: return this._appendMessage("DbResult.BE_SQLITE_TOOBIG");
      case DbResult.BE_SQLITE_CONSTRAINT_BASE: return this._appendMessage("DbResult.BE_SQLITE_CONSTRAINT_BASE");
      case DbResult.BE_SQLITE_MISMATCH: return this._appendMessage("DbResult.BE_SQLITE_MISMATCH");
      case DbResult.BE_SQLITE_MISUSE: return this._appendMessage("DbResult.BE_SQLITE_MISUSE");
      case DbResult.BE_SQLITE_NOLFS: return this._appendMessage("DbResult.BE_SQLITE_NOLFS");
      case DbResult.BE_SQLITE_AUTH: return this._appendMessage("DbResult.BE_SQLITE_AUTH");
      case DbResult.BE_SQLITE_FORMAT: return this._appendMessage("DbResult.BE_SQLITE_FORMAT");
      case DbResult.BE_SQLITE_RANGE: return this._appendMessage("DbResult.BE_SQLITE_RANGE");
      case DbResult.BE_SQLITE_NOTADB: return this._appendMessage("DbResult.BE_SQLITE_NOTADB");

      // BentleyStatus cases
      case BentleyStatus.ERROR: return this._appendMessage("BentleyStatus.ERROR");

      // Unexpected cases
      case IModelStatus.Success:
      case DbResult.BE_SQLITE_OK:
      case DbResult.BE_SQLITE_ROW:
      case DbResult.BE_SQLITE_DONE:
      case BentleyStatus.SUCCESS:
      default:
        assert(false); // Unknown error
        return this._appendMessage("Error " + this.errorNumber.toString());
    }
  }

  private _appendMessage(e: string): string {
    return this.message ? e + ": " + this.message : e;
  }
}
