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
      this._db.executeSQL("CREATE TABLE locks(id INTEGER PRIMARY KEY NOT NULL,state INTEGER NOT NULL)");

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
    return !Id64.isValid(id) ? LockState.None : this.lockDb.withPreparedSqliteStatement("SELECT state FROM locks WHERE id=?", (stmt) => {
      stmt.bindId(1, id);
      return (DbResult.BE_SQLITE_ROW === stmt.step()) ? stmt.getValueInteger(0) : undefined;
    });
  }

  private saveLockState(props: LockProps) {
    this.lockDb.withPreparedSqliteStatement("INSERT INTO locks(id,state) VALUES (?,?)", (stmt) => {
      stmt.bindId(1, props.id);
      stmt.bindInteger(1, props.state);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't insert lock into database");
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
    if (!Id64.isValid(id) || locks.has(id) || this.hasSharedLock(id))
      return;

    locks.add(id);
    this.addParentSharedLocks(id, locks);
  }

  private addParentSharedLocks(id: Id64String, locks: Set<Id64String>) {
    const el = this.getParentAndModel(id);
    this.addSharedLock(el.parentId, locks);
    this.addSharedLock(el.modelId, locks);

  }

  public async acquireExclusiveLock(id: Id64String): Promise<void> {
    if (this.hasExclusiveLock(id))
      return;

    const sharedLocks = new Set<Id64String>();
    this.addParentSharedLocks(id, sharedLocks);

    const locks: LockProps[] = [{ id, state: LockState.Exclusive }];
    for (const shared of sharedLocks)
      locks.push({ id: shared, state: LockState.Shared });

    await IModelHost.hubAccess.acquireLocks(this.iModel, locks);
    for (const lock of locks)
      this.saveLockState(lock);
  }

}
