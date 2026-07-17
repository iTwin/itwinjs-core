/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { SchemaImportReservationError } from "@itwin/core-common";
import { IModelDb } from "../IModelDb";
import { SharedSchemaReservations } from "../SharedSchemaReservations";
import { SchemaSync } from "../SchemaSync";
import { _close, _nativeDb } from "./Symbols";

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

  public async reserveSchemaImport(schemaFileNames: string[], sourceType?: "file" | "xml"): Promise<void> {
    if (!Array.isArray(schemaFileNames) || schemaFileNames.length === 0 || schemaFileNames.some((f) => typeof f !== "string"))
      SchemaImportReservationError.throwError("invalid-argument", { message: "schemaFileNames must be a non-empty array of strings" });

    // Acquire the container write-lock so that reservation writes are serialized — two briefcases
    // can never update the reservation store concurrently (plan §7.5).
    await this._schemaSync.withLockedDb({ operationName: "reserveSchemaImport" }, async () => {
      const syncDbUri = this._schemaSync.getUri();
      // Native parses the schemas, derives per-row content keys, allocates ids for any new keys
      // (reusing stored ids for keys already present), and writes the updated key→id blobs and
      // column maps directly into the sync-db reservation rows (plan §7.1 / §7.2).
      // TS never receives a key→id map; the blobs are owned by native entirely.
      (this._iModel[_nativeDb] as any).reserveSchemaImport(schemaFileNames, syncDbUri, sourceType); // eslint-disable-line @typescript-eslint/no-explicit-any
    });
  }
}

/** @internal */
export async function createSchemaSyncSchemaReservations(iModel: IModelDb): Promise<SharedSchemaReservations> {
  return SchemaSyncSchemaReservations.create(iModel);
}
