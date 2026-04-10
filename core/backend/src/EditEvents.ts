/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { OpenMode } from "@itwin/core-bentley";
import type { IModelDb } from "./IModelDb";
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
}
