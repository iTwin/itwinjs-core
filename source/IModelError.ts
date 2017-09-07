/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { DgnDbStatus } from "./IModel";

export class IModelError extends Error {
  public constructor(public readonly errorNumber: number | DgnDbStatus | DbResult | BentleyStatus, message?: string) {
    super(message);
    assert(errorNumber as number !== DgnDbStatus.Success as number);
  }

  public toDebugString(): string {
    switch (this.errorNumber) {
      // DgnDbStatus cases
      case DgnDbStatus.AlreadyLoaded: return this._appendMessage("DgnDbStatus.AlreadyLoaded");
      case DgnDbStatus.AlreadyOpen: return this._appendMessage("DgnDbStatus.AlreadyOpen");
      case DgnDbStatus.BadArg: return this._appendMessage("DgnDbStatus.BadArg");
      case DgnDbStatus.BadElement: return this._appendMessage("DgnDbStatus.BadElement");
      case DgnDbStatus.BadModel: return this._appendMessage("DgnDbStatus.BadModel");
      case DgnDbStatus.BadRequest: return this._appendMessage("DgnDbStatus.BadRequest");
      case DgnDbStatus.BadSchema: return this._appendMessage("DgnDbStatus.BadSchema");
      case DgnDbStatus.CannotUndo: return this._appendMessage("DgnDbStatus.CannotUndo");
      case DgnDbStatus.CodeNotReserved: return this._appendMessage("DgnDbStatus.CodeNotReserved");
      case DgnDbStatus.DeletionProhibited: return this._appendMessage("DgnDbStatus.DeletionProhibited");
      case DgnDbStatus.DuplicateCode: return this._appendMessage("DgnDbStatus.DuplicateCode");
      case DgnDbStatus.DuplicateName: return this._appendMessage("DgnDbStatus.DuplicateName");
      case DgnDbStatus.ElementBlockedChange: return this._appendMessage("DgnDbStatus.ElementBlockedChange");
      case DgnDbStatus.FileAlreadyExists: return this._appendMessage("DgnDbStatus.FileAlreadyExists");
      case DgnDbStatus.FileNotFound: return this._appendMessage("DgnDbStatus.FileNotFound");
      case DgnDbStatus.FileNotLoaded: return this._appendMessage("DgnDbStatus.FileNotLoaded");
      case DgnDbStatus.ForeignKeyConstraint: return this._appendMessage("DgnDbStatus.ForeignKeyConstraint");
      case DgnDbStatus.IdExists: return this._appendMessage("DgnDbStatus.IdExists");
      case DgnDbStatus.InDynamicTransaction: return this._appendMessage("DgnDbStatus.InDynamicTransaction");
      case DgnDbStatus.InvalidCategory: return this._appendMessage("DgnDbStatus.InvalidCategory");
      case DgnDbStatus.InvalidCode: return this._appendMessage("DgnDbStatus.InvalidCode");
      case DgnDbStatus.InvalidCodeSpec: return this._appendMessage("DgnDbStatus.InvalidCodeSpec");
      case DgnDbStatus.InvalidId: return this._appendMessage("DgnDbStatus.InvalidId");
      case DgnDbStatus.InvalidName: return this._appendMessage("DgnDbStatus.InvalidName");
      case DgnDbStatus.InvalidParent: return this._appendMessage("DgnDbStatus.InvalidParent");
      case DgnDbStatus.InvalidProfileVersion: return this._appendMessage("DgnDbStatus.InvalidProfileVersion");
      case DgnDbStatus.IsCreatingRevision: return this._appendMessage("DgnDbStatus.IsCreatingRevision");
      case DgnDbStatus.LockNotHeld: return this._appendMessage("DgnDbStatus.LockNotHeld");
      case DgnDbStatus.Mismatch2d3d: return this._appendMessage("DgnDbStatus.Mismatch2d3d");
      case DgnDbStatus.MismatchGcs: return this._appendMessage("DgnDbStatus.MismatchGcs");
      case DgnDbStatus.MissingDomain: return this._appendMessage("DgnDbStatus.MissingDomain");
      case DgnDbStatus.MissingHandler: return this._appendMessage("DgnDbStatus.MissingHandler");
      case DgnDbStatus.MissingId: return this._appendMessage("DgnDbStatus.MissingId");
      case DgnDbStatus.NoGeometry: return this._appendMessage("DgnDbStatus.NoGeometry");
      case DgnDbStatus.NoMultiTxnOperation: return this._appendMessage("DgnDbStatus.NoMultiTxnOperation");
      case DgnDbStatus.NotDgnMarkupProject: return this._appendMessage("DgnDbStatus.NotDgnMarkupProject");
      case DgnDbStatus.NotEnabled: return this._appendMessage("DgnDbStatus.NotEnabled");
      case DgnDbStatus.NotFound: return this._appendMessage("DgnDbStatus.NotFound");
      case DgnDbStatus.NotOpen: return this._appendMessage("DgnDbStatus.NotOpen");
      case DgnDbStatus.NotOpenForWrite: return this._appendMessage("DgnDbStatus.NotOpenForWrite");
      case DgnDbStatus.NotSameUnitBase: return this._appendMessage("DgnDbStatus.NotSameUnitBase");
      case DgnDbStatus.NothingToRedo: return this._appendMessage("DgnDbStatus.NothingToRedo");
      case DgnDbStatus.NothingToUndo: return this._appendMessage("DgnDbStatus.NothingToUndo");
      case DgnDbStatus.ParentBlockedChange: return this._appendMessage("DgnDbStatus.ParentBlockedChange");
      case DgnDbStatus.ReadError: return this._appendMessage("DgnDbStatus.ReadError");
      case DgnDbStatus.ReadOnly: return this._appendMessage("DgnDbStatus.ReadOnly");
      case DgnDbStatus.ReadOnlyDomain: return this._appendMessage("DgnDbStatus.ReadOnlyDomain");
      case DgnDbStatus.RepositoryManagerError: return this._appendMessage("DgnDbStatus.RepositoryManagerError");
      case DgnDbStatus.SQLiteError: return this._appendMessage("DgnDbStatus.SQLiteError");
      case DgnDbStatus.TransactionActive: return this._appendMessage("DgnDbStatus.TransactionActive");
      case DgnDbStatus.UnitsMissing: return this._appendMessage("DgnDbStatus.UnitsMissing");
      case DgnDbStatus.UnknownFormat: return this._appendMessage("DgnDbStatus.UnknownFormat");
      case DgnDbStatus.UpgradeFailed: return this._appendMessage("DgnDbStatus.UpgradeFailed");
      case DgnDbStatus.ValidationFailed: return this._appendMessage("DgnDbStatus.ValidationFailed");
      case DgnDbStatus.VersionTooNew: return this._appendMessage("DgnDbStatus.VersionTooNew");
      case DgnDbStatus.VersionTooOld: return this._appendMessage("DgnDbStatus.VersionTooOld");
      case DgnDbStatus.ViewNotFound: return this._appendMessage("DgnDbStatus.ViewNotFound");
      case DgnDbStatus.WriteError: return this._appendMessage("DgnDbStatus.WriteError");
      case DgnDbStatus.WrongClass: return this._appendMessage("DgnDbStatus.WrongClass");
      case DgnDbStatus.WrongDgnDb: return this._appendMessage("DgnDbStatus.WrongDgnDb");
      case DgnDbStatus.WrongDomain: return this._appendMessage("DgnDbStatus.WrongDomain");
      case DgnDbStatus.WrongElement: return this._appendMessage("DgnDbStatus.WrongElement");
      case DgnDbStatus.WrongHandler: return this._appendMessage("DgnDbStatus.WrongHandler");
      case DgnDbStatus.WrongModel: return this._appendMessage("DgnDbStatus.WrongModel");

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
      case DgnDbStatus.Success:
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
