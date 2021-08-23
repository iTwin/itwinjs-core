/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { DbResult, Id64, Id64String, OpenMode } from "@bentley/bentleyjs-core";
import { IModelError } from "@bentley/imodeljs-common";
import { LockProps, LockState } from "./BackendHubAccess";
import { BriefcaseDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { SQLiteDb } from "./SQLiteDb";

export class Locks {
  private _db?: SQLiteDb;
  private _iModel?: BriefcaseDb;

  private get iModel() { return this._iModel!; } // eslint-disable-line @typescript-eslint/naming-convention
  private get lockDb() { return this._db!; } // eslint-disable-line @typescript-eslint/naming-convention

  public open(iModel: BriefcaseDb) {
    this._iModel = iModel;
    this._db = new SQLiteDb();

    const dbName = `${this.iModel.getTempFileBase()}-locks`;
    try {
      this._db.openDb(dbName, OpenMode.ReadWrite);
    } catch (_e) {
      this._db.createDb(dbName);
      this._db.executeSQL("CREATE TABLE locks(id INTEGER PRIMARY KEY NOT NULL,level INTEGER NOT NULL,lastCSetIndex INTEGER)");

    }
  }
  private getParentAndModel(id: Id64String): { modelId: Id64String, parentId: Id64String } {
    return this.iModel.withPreparedSqliteStatement("SELECT ModelId,ParentId FROM bis_Element WHERE id=?", (stmt) => {
      stmt.bindId(1, id);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== rc)
        throw new IModelError(rc, `element ${id} not found`);

      return { modelId: stmt.getValueId(0), parentId: stmt.getValueId(1) };
    });
  }

  private getLockState(id: Id64String): LockState | undefined {
    return !Id64.isValid(id) ? LockState.None : this.lockDb.withPreparedSqliteStatement("SELECT level FROM locks WHERE id=?", (stmt) => {
      stmt.bindId(1, id);
      return (DbResult.BE_SQLITE_ROW === stmt.step()) ? stmt.getValueInteger(0) : undefined;
    });
  }

  public hasExclusiveLock(id: Id64String): boolean {
    if (this.getLockState(id) === LockState.Exclusive)
      return true;
    const el = this.getParentAndModel(id);
    return this.hasExclusiveLock(el.modelId) || this.hasExclusiveLock(el.parentId);
  }

  public hasSharedLock(id: Id64String): boolean {
    const state = this.getLockState(id);
    if (state === LockState.Shared || state === LockState.Exclusive)
      return true;

    // see if parent or model has exclusive lock. if so we have shared lock, but parent or model holding shared lock doesn't help.
    const el = this.getParentAndModel(id);
    return this.hasExclusiveLock(el.modelId) || this.hasExclusiveLock(el.parentId);
  }

  private addSharedLock(id: Id64String, locks: Set<Id64String>) {
    if (locks.has(id) || this.hasSharedLock(id))
      return;
    const el = this.getParentAndModel(id);

    if (!this.hasSharedLock(el.parentId)) {
      locks.push({ id, state: LockState.Shared });
      this.addSharedLocks(id, locks);
    }

  }

  public async acquireExclusiveLock(id: Id64String): Promise<void> {
    if (this.hasExclusiveLock(id))
      return;

    const locks = new Map<Id64String, LockState>();
    locks.set(id, LockState.Exclusive);

    this.addSharedLock(id, locks);
    await IModelHost.hubAccess.acquireLocks(this.iModel, locks);
    for (const lock of locks)
      this.saveLockState(lock.id, lock.state);
  }

}
