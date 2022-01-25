/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { join } from "path";
import { DbResult, GuidString, Id64String, IModelHubStatus, IModelStatus, OpenMode } from "@itwin/core-bentley";
import {
  BriefcaseId, BriefcaseIdValue, ChangesetFileProps, ChangesetId, ChangesetIdWithIndex, ChangesetIndex, ChangesetIndexOrId, ChangesetProps,
  ChangesetRange, IModelError, LocalDirName, LocalFileName,
} from "@itwin/core-common";
import { LockConflict, LockMap, LockProps, LockState } from "../BackendHubAccess";
import { BriefcaseManager } from "../BriefcaseManager";
import { BriefcaseLocalValue, IModelDb, SnapshotDb } from "../IModelDb";
import { IModelHost } from "../IModelHost";
import { IModelJsFs } from "../IModelJsFs";
import { SQLiteDb } from "../SQLiteDb";

// cspell:ignore rowid

/** @internal */
interface MockBriefcaseIdProps {
  id: BriefcaseId;
  user: string; // Just an AccessToken that simulates a user
  alias: string;
  assigned: boolean;
}

/** @internal */
interface LocalHubProps {
  readonly iTwinId: GuidString;
  readonly iModelId: GuidString;
  readonly iModelName: string;
  readonly description?: string;
  readonly version0?: string;
  readonly noLocks?: true;
}

interface LocksEntry {
  id: Id64String;
  level: LockState;
  lastCsIndex?: ChangesetIndex;
  briefcaseId?: BriefcaseId;
}

interface LockStatusNone {
  state: LockState.None;
  lastCsIndex?: ChangesetIndex;
}
export interface LockStatusExclusive {
  state: LockState.Exclusive;
  briefcaseId: BriefcaseId;
  lastCsIndex?: ChangesetIndex;
}

export interface LockStatusShared {
  state: LockState.Shared;
  sharedBy: Set<BriefcaseId>;
  lastCsIndex?: ChangesetIndex;
}

interface BriefcaseIdAndChangeset {
  changeset: ChangesetIdWithIndex;
  briefcaseId: BriefcaseId;
}

type LockStatus = LockStatusNone | LockStatusExclusive | LockStatusShared;

/**
 * A "local" mock for IModelHub to provide access to a single iModel. Used by HubMock.
 * @internal
 */
export class LocalHub {
  public readonly iTwinId: GuidString;
  public readonly iModelId: GuidString;
  public readonly iModelName: string;
  public readonly description?: string;
  private _hubDb?: SQLiteDb;
  private _nextBriefcaseId = BriefcaseIdValue.FirstValid;
  private _latestChangesetIndex = 0;
  public get latestChangesetIndex() { return this._latestChangesetIndex; }

  public constructor(public readonly rootDir: LocalDirName, arg: LocalHubProps) {
    this.iTwinId = arg.iTwinId;
    this.iModelId = arg.iModelId;
    this.iModelName = arg.iModelName;
    this.description = arg.description;

    this.cleanup();

    IModelJsFs.recursiveMkDirSync(this.rootDir);
    IModelJsFs.mkdirSync(this.changesetDir);
    IModelJsFs.mkdirSync(this.checkpointDir);

    const db = this._hubDb = new SQLiteDb();
    db.createDb(this.mockDbName);
    db.executeSQL("CREATE TABLE briefcases(id INTEGER PRIMARY KEY NOT NULL,user TEXT NOT NULL,alias TEXT NOT NULL,assigned INTEGER DEFAULT 1)");
    db.executeSQL("CREATE TABLE timeline(csIndex INTEGER PRIMARY KEY NOT NULL,csId TEXT NOT NULL UNIQUE,description TEXT,user TEXT,size BIGINT,type INTEGER,pushDate TEXT,briefcaseId INTEGER,\
                   FOREIGN KEY(briefcaseId) REFERENCES briefcases(id))");
    db.executeSQL("CREATE TABLE checkpoints(csIndex INTEGER PRIMARY KEY NOT NULL)");
    db.executeSQL("CREATE TABLE versions(name TEXT PRIMARY KEY NOT NULL,csIndex TEXT,FOREIGN KEY(csIndex) REFERENCES timeline(csIndex))");
    db.executeSQL("CREATE TABLE locks(id INTEGER PRIMARY KEY NOT NULL,level INTEGER NOT NULL,lastCSetIndex INTEGER,briefcaseId INTEGER)");
    db.executeSQL("CREATE TABLE sharedLocks(lockId INTEGER NOT NULL,briefcaseId INTEGER NOT NULL,PRIMARY KEY(lockId,briefcaseId))");
    db.executeSQL("CREATE INDEX LockIdx ON locks(briefcaseId)");
    db.executeSQL("CREATE INDEX SharedLockIdx ON sharedLocks(briefcaseId)");
    db.saveChanges();

    const version0 = arg.version0 ?? join(IModelHost.cacheDir, "version0.bim");

    if (!arg.version0) { // if they didn't supply a version0 file, create a blank one.
      IModelJsFs.removeSync(version0);
      const blank = SnapshotDb.createEmpty(version0, { rootSubject: { name: arg.description ?? arg.iModelName } });
      blank.saveChanges();
      blank.close();
    }

    const path = this.uploadCheckpoint({ changesetIndex: 0, localFile: version0 });
    if (!arg.version0)
      IModelJsFs.removeSync(version0);

    const nativeDb = IModelDb.openDgnDb({ path }, OpenMode.ReadWrite);
    try {
      nativeDb.setITwinId(this.iTwinId);
      nativeDb.setIModelId(this.iModelId);
      nativeDb.saveChanges();
      nativeDb.deleteAllTxns(); // necessary before resetting briefcaseId
      nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
      nativeDb.saveLocalValue(BriefcaseLocalValue.NoLocking, arg.noLocks ? "true" : undefined);
      nativeDb.saveChanges();
    } finally {
      nativeDb.closeIModel();
    }
  }

  private get db() { return this._hubDb!; } // eslint-disable-line @typescript-eslint/naming-convention
  public get changesetDir() { return join(this.rootDir, "changesets"); }
  public get checkpointDir() { return join(this.rootDir, "checkpoints"); }
  public get mockDbName() { return join(this.rootDir, "localHub.db"); }

  /** Acquire the next available briefcaseId and assign it to the supplied user */
  public acquireNewBriefcaseId(user: string, alias?: string): BriefcaseId {
    const db = this.db;
    const newId = this._nextBriefcaseId++;
    alias = alias ?? `${user} (${newId})`;
    db.withSqliteStatement("INSERT INTO briefcases(id,user,alias) VALUES (?,?,?)", (stmt) => {
      stmt.bindInteger(1, newId);
      stmt.bindString(2, user);
      stmt.bindString(3, alias!);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't insert briefcaseId in mock database");
    });
    db.saveChanges();
    return newId;
  }

  /** Release a briefcaseId */
  public releaseBriefcaseId(id: BriefcaseId) {
    const db = this.db;
    this.releaseAllLocks({ briefcaseId: id, changesetIndex: 0 });
    db.withSqliteStatement("UPDATE briefcases SET assigned=0 WHERE id=?", (stmt) => {
      stmt.bindInteger(1, id);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, `briefcaseId ${id} was not reserved`);
    });
    db.saveChanges();
  }

  /** Get an array of all of the currently assigned Briefcases */
  public getBriefcases(onlyAssigned = true): MockBriefcaseIdProps[] {
    const briefcases: MockBriefcaseIdProps[] = [];
    let sql = "SELECT id,user,alias,assigned FROM briefcases";
    if (onlyAssigned)
      sql += " WHERE assigned=1";

    this.db.withSqliteStatement(sql, (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        briefcases.push({
          id: stmt.getValueInteger(0),
          user: stmt.getValueString(1),
          alias: stmt.getValueString(2),
          assigned: stmt.getValueInteger(3) !== 0,
        });
      }
    });
    return briefcases;
  }

  /** Get an array of all of the currently assigned BriefcaseIds for a user */
  public getBriefcaseIds(user: string): BriefcaseId[] {
    const briefcases: BriefcaseId[] = [];
    this.db.withSqliteStatement("SELECT id FROM briefcases WHERE user=? AND assigned=1", (stmt) => {
      stmt.bindString(1, user);
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        briefcases.push(stmt.getValueInteger(0));
    });
    return briefcases;
  }

  public getBriefcase(id: BriefcaseId): MockBriefcaseIdProps {
    return this.db.withSqliteStatement("SELECT user,alias,assigned FROM briefcases WHERE id=?", (stmt) => {
      stmt.bindInteger(1, id);
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw new IModelError(IModelStatus.NotFound, "no briefcase with that id");
      return { id, user: stmt.getValueString(0), alias: stmt.getValueString(1), assigned: stmt.getValueInteger(2) !== 0 };
    });
  }

  private getChangesetFileName(index: ChangesetIndex) {
    return join(this.changesetDir, `changeset-${index}`);
  }

  /** Add a changeset to the timeline
   * @return the changesetIndex of the added changeset
   */
  public addChangeset(changeset: ChangesetFileProps): ChangesetIndex {
    const stats = IModelJsFs.lstatSync(changeset.pathname);
    if (!stats)
      throw new Error(`cannot read changeset file ${changeset.pathname}`);

    const parentIndex = this.getChangesetById(changeset.parentId).index;
    if (parentIndex !== this.latestChangesetIndex)
      throw new IModelError(IModelStatus.InvalidParent, "changeset parent is not latest changeset");

    this.getBriefcase(changeset.briefcaseId); // throws if invalid id
    const db = this.db;
    changeset.index = this._latestChangesetIndex + 1;
    db.withSqliteStatement("INSERT INTO timeline(csIndex,csId,description,size,type,pushDate,user,briefcaseId) VALUES (?,?,?,?,?,?,?,?)", (stmt) => {
      stmt.bindInteger(1, changeset.index);
      stmt.bindString(2, changeset.id);
      stmt.bindString(3, changeset.description);
      stmt.bindInteger(4, stats.size);
      stmt.bindInteger(5, changeset.changesType ?? 0);
      stmt.bindString(6, changeset.pushDate ?? new Date().toString());
      stmt.bindString(7, changeset.userCreated ?? "");
      stmt.bindInteger(8, changeset.briefcaseId);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't insert changeset into mock db");
    });
    this._latestChangesetIndex = changeset.index; // only change this after insert succeeds
    db.saveChanges();
    IModelJsFs.copySync(changeset.pathname, this.getChangesetFileName(changeset.index));
    return changeset.index;
  }

  public getIndexFromChangeset(changeset: ChangesetIndexOrId): ChangesetIndex {
    return changeset.index ?? this.getChangesetIndex(changeset.id);
  }

  /** Get the index of a changeset by its Id */
  public getChangesetIndex(id: ChangesetId): ChangesetIndex {
    if (id === "")
      return 0;

    return this.db.withPreparedSqliteStatement("SELECT csIndex FROM timeline WHERE csId=?", (stmt) => {
      stmt.bindString(1, id);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== rc)
        throw new IModelError(rc, `changeset ${id} not found`);

      return stmt.getValueInteger(0);
    });
  }

  /** Get the properties of a changeset by its Id */
  public getChangesetById(id: ChangesetId): ChangesetProps {
    return this.getChangesetByIndex(this.getChangesetIndex(id));
  }

  public getPreviousIndex(index: ChangesetIndex) {
    return this.db.withPreparedSqliteStatement("SELECT max(csIndex) FROM timeline WHERE csIndex<?", (stmt) => {
      stmt.bindInteger(1, index);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== rc)
        throw new IModelError(rc, `cannot get previous index`);

      return stmt.getValueInteger(0);
    });
  }

  public getParentId(index: ChangesetIndex): ChangesetId {
    if (index === 0)
      return "";

    return this.db.withPreparedSqliteStatement("SELECT csId FROM timeline WHERE csIndex=?", (stmt) => {
      stmt.bindInteger(1, this.getPreviousIndex(index));
      stmt.step();
      return stmt.getValueString(0);
    });
  }

  /** Get the properties of a changeset by its index */
  public getChangesetByIndex(index: ChangesetIndex): ChangesetProps {
    if (index <= 0)
      return { id: "", changesType: 0, description: "version0", parentId: "", briefcaseId: 0, pushDate: "", userCreated: "", index: 0 };

    return this.db.withPreparedSqliteStatement("SELECT description,size,type,pushDate,user,csId,briefcaseId FROM timeline WHERE csIndex=?", (stmt) => {
      stmt.bindInteger(1, index);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== rc)
        throw new IModelError(rc, `changeset at index ${index} not found`);

      return {
        description: stmt.getValueString(0),
        size: stmt.getValueDouble(1),
        changesType: stmt.getValueInteger(2),
        pushDate: stmt.getValueString(3),
        userCreated: stmt.getValueString(4),
        id: stmt.getValueString(5),
        briefcaseId: stmt.getValueInteger(6),
        index,
        parentId: this.getParentId(index),
      };
    });
  }

  public getLatestChangeset(): ChangesetProps {
    return this.getChangesetByIndex(this.latestChangesetIndex);
  }

  public getChangesetId(index: ChangesetIndex): ChangesetId {
    return this.getChangesetByIndex(index).id;
  }

  /** Get an array of changesets starting with first to last, by index */
  public queryChangesets(range?: ChangesetRange): ChangesetProps[] {
    const changesets: ChangesetProps[] = [];
    const first = range?.first ?? 0;
    const last = range?.end ?? this.latestChangesetIndex;

    this.db.withPreparedSqliteStatement("SELECT csIndex FROM timeline WHERE csIndex>=? AND csIndex<=? ORDER BY csIndex", (stmt) => {
      stmt.bindInteger(1, first);
      stmt.bindInteger(2, last);
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        changesets.push(this.getChangesetByIndex(stmt.getValueInteger(0)));
    });
    return changesets;
  }

  /** Name a version */
  public addNamedVersion(arg: { versionName: string, csIndex: ChangesetIndex }) {
    const db = this.db;
    db.withSqliteStatement("INSERT INTO versions(name,csIndex) VALUES (?,?)", (stmt) => {
      stmt.bindString(1, arg.versionName);
      stmt.bindInteger(2, arg.csIndex);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't insert named version");
    });
    db.saveChanges();
  }

  /** Delete a named version */
  public deleteNamedVersion(versionName: string) {
    const db = this.db;
    db.withSqliteStatement("DELETE FROM versions WHERE name=?", (stmt) => {
      stmt.bindString(1, versionName);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't delete named version");
    });
    db.saveChanges();
  }

  /** find the changeset for a named version */
  public findNamedVersion(versionName: string): ChangesetProps {
    const index = this.db.withSqliteStatement("SELECT csIndex FROM versions WHERE name=?", (stmt) => {
      stmt.bindString(1, versionName);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== rc)
        throw new IModelError(IModelStatus.NotFound, `Named version ${versionName} not found`);
      return stmt.getValueInteger(0);
    });
    return this.getChangesetByIndex(index);
  }

  public checkpointNameFromIndex(csIndex: ChangesetIndex) {
    return `checkpoint-${csIndex}`;
  }

  /** "upload" a checkpoint */
  public uploadCheckpoint(arg: { changesetIndex: ChangesetIndex, localFile: LocalFileName }) {
    const db = this.db;
    db.withSqliteStatement("INSERT INTO checkpoints(csIndex) VALUES (?)", (stmt) => {
      stmt.bindInteger(1, arg.changesetIndex);
      const res = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== res)
        throw new IModelError(res, "can't insert checkpoint into mock db");
    });
    db.saveChanges();
    const outName = join(this.checkpointDir, this.checkpointNameFromIndex(arg.changesetIndex));
    IModelJsFs.copySync(arg.localFile, outName);
    return outName;
  }

  /** Get an array of the indexes for a range of checkpoints */
  public getCheckpoints(range?: ChangesetRange): ChangesetIndex[] {
    const first = range?.first ?? 0;
    const last = range?.end ?? this.latestChangesetIndex;

    const checkpoints: ChangesetIndex[] = [];
    this.db.withSqliteStatement("SELECT csIndex FROM checkpoints WHERE csIndex>=? AND csIndex<=? ORDER BY csIndex", (stmt) => {
      stmt.bindInteger(1, first);
      stmt.bindInteger(2, last);
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        checkpoints.push(stmt.getValueInteger(0));

    });
    return checkpoints;
  }

  /** Find the checkpoint that is no newer than a changesetIndex */
  public queryPreviousCheckpoint(changesetIndex: ChangesetIndex): ChangesetIndex {
    if (changesetIndex <= 0)
      return 0;

    return this.db.withSqliteStatement("SELECT max(csIndex) FROM checkpoints WHERE csIndex <= ? ", (stmt) => {
      stmt.bindInteger(1, changesetIndex);
      const res = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== res)
        throw new IModelError(res, "can't get previous checkpoint");
      return stmt.getValueInteger(0);
    });
  }

  /** "download" a checkpoint */
  public downloadCheckpoint(arg: { changeset: ChangesetIndexOrId, targetFile: LocalFileName }) {
    const index = this.getIndexFromChangeset(arg.changeset);
    const prev = this.queryPreviousCheckpoint(index);
    IModelJsFs.copySync(join(this.checkpointDir, this.checkpointNameFromIndex(prev)), arg.targetFile);
    const changeset = this.getChangesetByIndex(index);
    return { index, id: changeset.id };
  }

  private copyChangeset(arg: ChangesetFileProps): ChangesetFileProps {
    IModelJsFs.copySync(this.getChangesetFileName(arg.index), arg.pathname);
    return arg;
  }

  /** "download" a changeset */
  public downloadChangeset(arg: { index: ChangesetIndex, targetDir: LocalDirName }) {
    const cs = this.getChangesetByIndex(arg.index);
    const csProps = { ...cs, pathname: join(arg.targetDir, cs.id), index: arg.index };
    return this.copyChangeset(csProps);
  }

  /** "download" all the changesets in a given range */
  public downloadChangesets(arg: { range?: ChangesetRange, targetDir: LocalDirName }): ChangesetFileProps[] {
    const cSets = this.queryChangesets(arg.range) as ChangesetFileProps[];
    for (const cs of cSets) {
      cs.pathname = join(arg.targetDir, cs.id);
      this.copyChangeset(cs);
    }
    return cSets;
  }

  private querySharedLockHolders(elementId: Id64String) {
    return this.db.withPreparedSqliteStatement("SELECT briefcaseId FROM sharedLocks WHERE lockId=?", (stmt) => {
      stmt.bindId(1, elementId);
      const briefcases = new Set<BriefcaseId>();
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        briefcases.add(stmt.getValueInteger(0));
      return briefcases;
    });
  }

  public queryAllLocks(briefcaseId: BriefcaseId) {
    this.getBriefcase(briefcaseId); // throws if briefcaseId invalid.
    const locks: LockProps[] = [];
    this.db.withPreparedSqliteStatement("SELECT id FROM locks WHERE briefcaseId=?", (stmt) => {
      stmt.bindInteger(1, briefcaseId);
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        locks.push({ id: stmt.getValueId(0), state: LockState.Exclusive });
    });
    this.db.withPreparedSqliteStatement("SELECT lockId FROM sharedLocks WHERE briefcaseId=?", (stmt) => {
      stmt.bindInteger(1, briefcaseId);
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        locks.push({ id: stmt.getValueId(0), state: LockState.Shared });
    });
    return locks;
  }

  public queryLockStatus(elementId: Id64String): LockStatus {
    return this.db.withPreparedSqliteStatement("SELECT lastCSetIndex,level,briefcaseId FROM locks WHERE id=?", (stmt) => {
      stmt.bindId(1, elementId);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== rc)
        return { state: LockState.None };
      const lastCsVal = stmt.getValue(0);
      const lock = {
        lastCsIndex: lastCsVal.isNull ? undefined : lastCsVal.getInteger(),
        state: stmt.getValueInteger(1),
      };
      switch (lock.state) {
        case LockState.None:
          return lock;
        case LockState.Exclusive:
          return { ...lock, briefcaseId: stmt.getValueInteger(2) };
        case LockState.Shared:
          return { ...lock, sharedBy: this.querySharedLockHolders(elementId) };
        default:
          throw new Error("illegal lock state");
      }
    });
  }

  private reserveLock(currStatus: LockStatus, props: LockProps, briefcase: BriefcaseIdAndChangeset) {
    if (props.state === LockState.Exclusive && currStatus.lastCsIndex && (currStatus.lastCsIndex > this.getIndexFromChangeset(briefcase.changeset)))
      throw new IModelError(IModelHubStatus.PullIsRequired, "pull is required to obtain lock");

    const wantShared = props.state === LockState.Shared;
    if (wantShared && (currStatus.state === LockState.Exclusive))
      throw new Error("cannot acquire shared lock because an exclusive lock is already held");

    this.db.withPreparedSqliteStatement("INSERT INTO locks(id,level,briefcaseId) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET briefcaseId=excluded.briefcaseId,level=excluded.level", (stmt) => {
      stmt.bindId(1, props.id);
      stmt.bindInteger(2, props.state);
      stmt.bindValue(3, wantShared ? undefined : briefcase.briefcaseId);
      const rc = stmt.step();
      if (rc !== DbResult.BE_SQLITE_DONE)
        throw new IModelError(rc, "cannot insert lock");
    });

    if (wantShared) {
      this.db.withPreparedSqliteStatement("INSERT INTO sharedLocks(lockId,briefcaseId) VALUES(?,?)", (stmt) => {
        stmt.bindId(1, props.id);
        stmt.bindInteger(2, briefcase.briefcaseId);
        const rc = stmt.step();
        if (rc !== DbResult.BE_SQLITE_DONE)
          throw new IModelError(rc, "cannot insert shared lock");
      });
    }
  }

  private clearLock(id: Id64String) {
    this.db.withPreparedSqliteStatement("UPDATE locks SET level=0,briefcaseId=NULL WHERE id=?", (stmt) => {
      stmt.bindId(1, id);
      const rc = stmt.step();
      if (rc !== DbResult.BE_SQLITE_DONE)
        throw new IModelError(rc, "can't release lock");
    });
  }

  private updateLockChangeset(id: Id64String, index: ChangesetIndex) {
    if (index <= 0)
      return;

    this.db.withPreparedSqliteStatement("UPDATE locks SET lastCSetIndex=? WHERE id=?", (stmt) => {
      stmt.bindInteger(1, index);
      stmt.bindId(2, id);
      const rc = stmt.step();
      if (rc !== DbResult.BE_SQLITE_DONE)
        throw new IModelError(rc, "can't update lock changeSetId");
    });
  }

  private requestLock(props: LockProps, briefcase: BriefcaseIdAndChangeset) {
    if (props.state === LockState.None)
      throw new Error("cannot request lock for LockState.None");

    this.getBriefcase(briefcase.briefcaseId); // throws if briefcaseId invalid.

    const lockStatus = this.queryLockStatus(props.id);
    switch (lockStatus.state) {
      case LockState.None:
        return this.reserveLock(lockStatus, props, briefcase);

      case LockState.Shared:
        if (props.state === LockState.Shared) {
          if (!lockStatus.sharedBy.has(briefcase.briefcaseId))
            this.reserveLock(lockStatus, props, briefcase);
        } else {
          // if requester is the only one holding a shared lock, "upgrade" the lock from shared to exclusive
          if (lockStatus.sharedBy.size > 1 || !lockStatus.sharedBy.has(briefcase.briefcaseId)) {
            const id = lockStatus.sharedBy.values().next().value;
            throw new LockConflict(id, this.getBriefcase(id).alias, "shared lock is held");
          }
          this.removeSharedLock(props.id, briefcase.briefcaseId);
          this.reserveLock(this.queryLockStatus(props.id), props, briefcase);
        }
        return;

      case LockState.Exclusive:
        if (lockStatus.briefcaseId !== briefcase.briefcaseId)
          throw new LockConflict(lockStatus.briefcaseId, this.getBriefcase(lockStatus.briefcaseId).alias, "exclusive lock is already held");
    }
  }

  private removeSharedLock(lockId: Id64String, briefcaseId: BriefcaseId) {
    this.db.withPreparedSqliteStatement("DELETE FROM sharedLocks WHERE lockId=? AND briefcaseId=?", (stmt) => {
      stmt.bindId(1, lockId);
      stmt.bindInteger(2, briefcaseId);
      const rc = stmt.step();
      if (rc !== DbResult.BE_SQLITE_DONE)
        throw new IModelError(rc, "can't remove shared lock");
    });
  }

  private releaseLock(props: LockProps, arg: { briefcaseId: BriefcaseId, changesetIndex: ChangesetIndex }) {
    const lockId = props.id;
    const lockStatus = this.queryLockStatus(lockId);
    switch (lockStatus.state) {
      case LockState.None:
        throw new IModelError(IModelHubStatus.LockDoesNotExist, "lock not held");

      case LockState.Exclusive:
        if (lockStatus.briefcaseId !== arg.briefcaseId)
          throw new IModelError(IModelHubStatus.LockOwnedByAnotherBriefcase, "lock not held by this briefcase");
        this.updateLockChangeset(lockId, arg.changesetIndex);
        this.clearLock(lockId);
        break;

      case LockState.Shared:
        if (!lockStatus.sharedBy.has(arg.briefcaseId))
          throw new IModelError(IModelHubStatus.LockDoesNotExist, "shared lock not held by this briefcase");
        this.removeSharedLock(lockId, arg.briefcaseId);
        if (lockStatus.sharedBy.size === 1)
          this.clearLock(lockId);
    }
  }

  /** Acquire a set of locks. If any lock cannot be acquired, no locks are acquired  */
  public acquireLocks(locks: LockMap, briefcase: BriefcaseIdAndChangeset) {
    try {
      for (const lock of locks)
        this.requestLock({ id: lock[0], state: lock[1] }, briefcase);
      this.db.saveChanges(); // only after all locks have been acquired
    } catch (err) {
      this.db.abandonChanges(); // abandon all locks that may have been acquired
      throw err;
    }
  }

  public acquireLock(props: LockProps, briefcase: BriefcaseIdAndChangeset) {
    const locks = new Map<Id64String, LockState>();
    locks.set(props.id, props.state);
    this.acquireLocks(locks, briefcase);
  }

  public releaseLocks(locks: LockProps[], arg: { briefcaseId: BriefcaseId, changesetIndex: ChangesetIndex }) {
    for (const props of locks)
      this.releaseLock(props, arg);
    this.db.saveChanges();
  }

  public releaseAllLocks(arg: { briefcaseId: BriefcaseId, changesetIndex: ChangesetIndex }) {
    const locks = this.queryAllLocks(arg.briefcaseId);
    this.releaseLocks(locks, arg);
  }

  private countTable(tableName: string): number {
    return this.db.withSqliteStatement(`SELECT count(*) from ${tableName}`, (stmt) => {
      stmt.step();
      return stmt.getValueInteger(0);
    });
  }

  // for debugging
  public countSharedLocks(): number { return this.countTable("sharedLocks"); }
  // for debugging
  public countLocks(): number { return this.countTable("locks"); }

  // for debugging
  public queryAllSharedLocks(): { id: Id64String, briefcaseId: BriefcaseId }[] {
    const locks: { id: Id64String, briefcaseId: BriefcaseId }[] = [];
    this.db.withPreparedSqliteStatement("SELECT lockId,briefcaseId FROM sharedLocks", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        locks.push({ id: stmt.getValueId(0), briefcaseId: stmt.getValueInteger(1) });
    });
    return locks;
  }

  // for debugging
  public queryLocks(): LocksEntry[] {
    const locks: LocksEntry[] = [];
    this.db.withPreparedSqliteStatement("SELECT id,level,lastCSetIndex,briefcaseId FROM locks", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        locks.push({
          id: stmt.getValueId(0),
          level: stmt.getValueInteger(1),
          lastCsIndex: stmt.getValue(2).isNull ? undefined : stmt.getValueInteger(2),
          briefcaseId: stmt.getValue(3).isNull ? undefined : stmt.getValueInteger(3),
        });
    });
    return locks;
  }

  public removeDir(dirName: string) {
    if (IModelJsFs.existsSync(dirName)) {
      IModelJsFs.purgeDirSync(dirName);
      IModelJsFs.rmdirSync(dirName);
    }

  }
  public cleanup() {
    if (this._hubDb) {
      this._hubDb.closeDb();
      this._hubDb = undefined;
    }
    try {
      this.removeDir(BriefcaseManager.getIModelPath(this.iModelId));
      this.removeDir(this.rootDir);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`ERROR: test left an iModel open for [${this.iModelName}]. LocalMock cannot clean up - make sure you call imodel.close() in your test`);
    }
  }
}
