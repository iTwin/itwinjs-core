/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { SchemaImportReservationError } from "@itwin/core-common";
import { IModelDb } from "../IModelDb";
import { OnSchemaImportArg, SchemaImportIdentity, SharedSchemaReservations } from "../SharedSchemaReservations";
import { SchemaSync } from "../SchemaSync";
import { _close, _nativeDb, _onSchemaImport } from "./Symbols";

class SchemaSyncSchemaReservations implements SharedSchemaReservations {
  public get isServerBased() { return true; }
  private readonly _iModel: IModelDb;
  private readonly _schemaSync: SchemaSync.CloudAccess;

  private constructor(iModel: IModelDb, schemaSync: SchemaSync.CloudAccess) {
    this._iModel = iModel;
    this._schemaSync = schemaSync;
  }

  public static async create(iModel: IModelDb): Promise<SchemaSyncSchemaReservations> {
    const schemaSync = await SchemaSync.getCloudAccess(iModel);
    schemaSync.synchronizeWithCloud();
    return new SchemaSyncSchemaReservations(iModel, schemaSync);
  }

  public [_close](): void {
    try {
      this._schemaSync.close();
    } catch {
      // best-effort cleanup; never throw out of close hooks
    }
  }

  private validateIdentity(identity: SchemaImportIdentity): void {
    if (!identity.schemaName || typeof identity.schemaName !== "string")
      SchemaImportReservationError.throwError("invalid-identity", { message: "schemaName must be a non-empty string" });
    if (!Number.isInteger(identity.versionMajor) || identity.versionMajor < 0)
      SchemaImportReservationError.throwError("invalid-identity", { message: "versionMajor must be a non-negative integer" });
    if (!Number.isInteger(identity.versionMinor) || identity.versionMinor < 0)
      SchemaImportReservationError.throwError("invalid-identity", { message: "versionMinor must be a non-negative integer" });
    if (!Number.isInteger(identity.versionPatch) || identity.versionPatch < 0)
      SchemaImportReservationError.throwError("invalid-identity", { message: "versionPatch must be a non-negative integer" });
  }

  public needsSchemaReservation(identity: SchemaImportIdentity): boolean {
    if (!SchemaSync.isEnabled(this._iModel))
      return false;
    this.validateIdentity(identity);
    return !this._schemaSync.reader.findSchemaReservation(identity);
  }

  public async reserveSchemaImport(identity: SchemaImportIdentity): Promise<void> {
    this.validateIdentity(identity);

    // Compute per-table counts via native dry-run (returns undefined until native side is implemented)
    const nativeDb = this._iModel[_nativeDb] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const perTableCounts: Record<string, number> = nativeDb.computeSchemaImportReservation?.(identity) ?? {};
    const baseFingerprint: string = nativeDb.getSchemaImportBaseFingerprint?.() ?? "";

    await this._schemaSync.writeLocker.reserveSchemaImport(identity, perTableCounts, baseFingerprint);
  }

  public [_onSchemaImport](arg: OnSchemaImportArg): void {
    if (!SchemaSync.isEnabled(this._iModel) || this._iModel.holdsSchemaLock)
      return;

    if (this._schemaSync.container.hasLocalChanges)
      SchemaImportReservationError.throwError("container-has-local-changes", {
        message: "Schema import is not allowed when there are local changes in the SchemaSync container",
      });

    const reservation = this._schemaSync.reader.findSchemaReservation(arg.identity);
    if (!reservation)
      SchemaImportReservationError.throwError("reservation-not-found", {
        message: `No SchemaSync reservation found for schema '${arg.identity.schemaName}' v${arg.identity.versionMajor}.${arg.identity.versionMinor}.${arg.identity.versionPatch} — call reserveSchemaImport before importing`,
      });

    // Base-state check: compare the stored fingerprint with the current db state
    const nativeDb = this._iModel[_nativeDb] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const currentFingerprint: string = nativeDb.getSchemaImportBaseFingerprint?.() ?? "";
    if (reservation.baseFingerprint && currentFingerprint && reservation.baseFingerprint !== currentFingerprint)
      SchemaImportReservationError.throwError("base-state-mismatch", {
        message: `Schema import reservation for '${arg.identity.schemaName}' was created against a different base state; re-reserve after pulling the latest changes`,
      });

    // Populate native options with reserved id ranges
    const reservedRanges: Record<string, { startId: number; count: number }> = {};
    for (const [tableName, range] of reservation.ranges)
      reservedRanges[tableName] = { startId: range.startId, count: range.count };

    arg.nativeOptions.schemaImportReservation = { reservedRanges };
    arg.nativeOptions.forceReservedIds = true;
  }
}

/** @internal */
export async function createSchemaSyncSchemaReservations(iModel: IModelDb): Promise<SharedSchemaReservations> {
  return SchemaSyncSchemaReservations.create(iModel);
}
