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
   * Replays all recorded events into the given [[EditTxn]].
   *
   * Events are applied in the order they were recorded. For each insert, if the target iModel
   * assigns a different ID than the original, the mapping is tracked and all subsequent events
   * referencing the original ID are automatically redirected to the new one.
   *
   * Remapped ID fields include: `id`, `model.id`, `parent.id`, `code.scope` (elements),
   * `on.id` (aspects), `modeledElement.id` (models), and `sourceId`/`targetId` (relationships).
   *
   * @param txn The active [[EditTxn]] into which events are replayed.
   * @beta
   */
  public replay(txn: EditTxn): void {
    const idMap = new Map<Id64String, Id64String>();
    const remap = (id: Id64String): Id64String => idMap.get(id) ?? id;
    const remapRelated = <T extends { id: Id64String }>(r: T): T => {
      const newId = remap(r.id);
      return newId === r.id ? r : { ...r, id: newId };
    };

    this._db.withPreparedSqliteStatement("SELECT type, props FROM events ORDER BY id", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const type = stmt.getValueString(0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p: any = JSON.parse(stmt.getValueString(1));

        switch (type) {
          case "insertElement": {
            const originalId: Id64String = p.id;
            const newId = txn.insertElement({
              ...p,
              id: undefined,
              model: remapRelated(p.model),
              ...(p.parent && { parent: remapRelated(p.parent) }),
              ...(p.code && { code: { ...p.code, scope: remap(p.code.scope) } }),
            });
            idMap.set(originalId, newId);
            break;
          }
          case "updateElement":
            txn.updateElement({
              ...p,
              id: remap(p.id),
              ...(p.model && { model: remapRelated(p.model) }),
              ...(p.parent && { parent: remapRelated(p.parent) }),
              ...(p.code && { code: { ...p.code, scope: remap(p.code.scope) } }),
            });
            break;
          case "deleteElement":
            txn.deleteElement(remap(p.id));
            break;
          case "insertAspect": {
            const originalId: Id64String = p.id;
            const newId = txn.insertAspect({ ...p, id: undefined, on: remapRelated(p.on) });
            idMap.set(originalId, newId);
            break;
          }
          case "updateAspect":
            txn.updateAspect({ ...p, id: remap(p.id), on: remapRelated(p.on) });
            break;
          case "deleteAspect":
            txn.deleteAspect(remap(p.id));
            break;
          case "insertModel": {
            const originalId: Id64String = p.id;
            const newId = txn.insertModel({ ...p, id: undefined, modeledElement: remapRelated(p.modeledElement) });
            idMap.set(originalId, newId);
            break;
          }
          case "updateModel":
            txn.updateModel({ ...p, id: remap(p.id), ...(p.modeledElement && { modeledElement: remapRelated(p.modeledElement) }) });
            break;
          case "updateGeometryGuid":
            txn.updateGeometryGuid(remap(p.modelId));
            break;
          case "deleteModel":
            txn.deleteModel(remap(p.id));
            break;
          case "insertRelationship": {
            const originalId: Id64String = p.id;
            const newId = txn.insertRelationship({ ...p, id: undefined, sourceId: remap(p.sourceId), targetId: remap(p.targetId) });
            idMap.set(originalId, newId);
            break;
          }
          case "updateRelationship":
            txn.updateRelationship({ ...p, id: remap(p.id), sourceId: remap(p.sourceId), targetId: remap(p.targetId) });
            break;
          case "deleteRelationship":
            txn.deleteRelationship({ ...p, id: remap(p.id), sourceId: remap(p.sourceId), targetId: remap(p.targetId) });
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
