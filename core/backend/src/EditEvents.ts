/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { DbResult, Id64String, OpenMode } from "@itwin/core-bentley";
import type { IModelDb } from "./IModelDb";
import type { EditTxn } from "./EditTxn";
import { SQLiteDb } from "./SQLiteDb";
import { _nativeDb } from "./internal/Symbols";

/**
 * Manages a sidecar SQLite database that records every discrete, direct modification made through
 * an [[EditTxn]].  Each row in the database represents a single editing operation (an "event"),
 * stored as a JSON serialisation of the props that were passed to the originating [[EditTxn]] method.
 *
 * The database file is placed next to the iModel's temporary files and is named after the iModel
 * with an `-events` suffix, mirroring the naming convention used by [[ServerBasedLocks]].
 *
 * An `EditEvents` instance is created and owned by the [[IModelDb]].  Callers should not construct
 * this class directly.
 *
 * @beta
 */
export class EditEvents {
  private readonly _db = new SQLiteDb();

  /** @internal */
  public constructor(iModel: IModelDb) {
    const dbName = `${iModel[_nativeDb].getTempFileBaseName()}-events`;
    try {
      this._db.openDb(dbName, OpenMode.ReadWrite);
    } catch {
      this._db.createDb(dbName);
    }

    this._db.executeSQL(`
      CREATE TABLE IF NOT EXISTS events(
        -- Sequential rowid assigned by SQLite; has no semantic meaning beyond ordering.
        id    INTEGER PRIMARY KEY NOT NULL,
        type  TEXT    NOT NULL,
        props TEXT    NOT NULL
      )`);
    this._db.saveChanges();
  }

  /** Whether the underlying database is currently open. */
  public get isOpen(): boolean {
    return this._db.isOpen;
  }

  /**
   * Record a single editing event.
   * @param type  A string identifying the operation (e.g. `"insertElement"`, `"deleteModel"`).
   * @param props The props object that was passed to the [[EditTxn]] method, serialised as JSON.
   * @internal
   */
  public recordEvent(type: string, props: object): void {
    this._db.withPreparedSqliteStatement(
      "INSERT INTO events(type, props) VALUES(?, ?)",
      (stmt) => {
        stmt.bindString(1, type);
        stmt.bindString(2, JSON.stringify(props));
        stmt.stepForWrite();
      },
    );
  }

  /**
   * Close the sidecar database, flushing any pending event writes.
   * Called automatically when the owning [[IModelDb]] is closed.
   */
  public close(): void {
    if (this._db.isOpen)
      this._db.closeDb(true);
  }

  /**
   * Replays all recorded events into the given [[EditTxn]] using the high-level editing methods.
   *
   * Events are applied in the order they were recorded:
   * - **Elements** use `insertElement` with `forceUseId` to preserve original IDs, plus
   *   `updateElement` and `deleteElement` for the full handler pipeline.
   * - **Models** use `insertModel` / `updateModel` / `deleteModel`. Model IDs are always
   *   equal to the modeled element's ID, so no remapping is needed.
   * - **Aspects** and **relationships** use `insertAspect` / `insertRelationship` etc.
   *   Because their IDs cannot be forced on insert, a remap table tracks
   *   original → new IDs and is applied to subsequent update/delete events.
   *
   * @param txn The active [[EditTxn]] into which events are replayed.
   * @beta
   */
  public replay(txn: EditTxn): void {
    const aspectIdMap = new Map<Id64String, Id64String>();
    const relationshipIdMap = new Map<Id64String, Id64String>();

    this._db.withPreparedSqliteStatement("SELECT type, props FROM events ORDER BY id", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const type = stmt.getValueString(0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p: any = JSON.parse(stmt.getValueString(1));

        switch (type) {
          case "insertElement":
            txn.insertElement(p, { forceUseId: true });
            break;
          case "updateElement":
            txn.updateElement(p);
            break;
          case "deleteElement":
            txn.deleteElement(p.id);
            break;

          case "insertModel":
            txn.insertModel(p);
            break;
          case "updateModel":
            txn.updateModel(p);
            break;
          case "updateGeometryGuid":
            txn.updateGeometryGuid(p.modelId);
            break;
          case "deleteModel":
            txn.deleteModel(p.id);
            break;

          case "insertAspect": {
            const originalId: Id64String = p.id;
            delete p.id; // let the target assign a new ID
            const newId = txn.insertAspect(p);
            if (newId !== originalId)
              aspectIdMap.set(originalId, newId);
            break;
          }
          case "updateAspect":
            p.id = aspectIdMap.get(p.id) ?? p.id;
            txn.updateAspect(p);
            break;
          case "deleteAspect":
            txn.deleteAspect(aspectIdMap.get(p.id) ?? p.id);
            break;

          case "insertRelationship": {
            const originalId: Id64String = p.id;
            delete p.id; // let the target assign a new ID
            const newId = txn.insertRelationship(p);
            if (newId !== originalId)
              relationshipIdMap.set(originalId, newId);
            break;
          }
          case "updateRelationship":
            p.id = relationshipIdMap.get(p.id) ?? p.id;
            txn.updateRelationship(p);
            break;
          case "deleteRelationship":
            p.id = relationshipIdMap.get(p.id) ?? p.id;
            txn.deleteRelationship(p);
            break;

          case "saveFileProperty":
            txn.saveFileProperty(p.prop, p.strValue);
            break;
          case "updateIModelProps":
            if (p.projectExtents)
              txn.updateProjectExtents(p.projectExtents);
            if (p.ecefLocation)
              txn.updateEcefLocation(p.ecefLocation);
            break;
          case "saveSettingDictionary":
            txn.saveSettingDictionary(p.name, p.dict);
            break;
          case "deleteSettingDictionary":
            txn.deleteSettingDictionary(p.name);
            break;
        }
      }
    });
  }
}
