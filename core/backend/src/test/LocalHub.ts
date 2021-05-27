/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { join } from "path";
import { DbResult, GuidString, IModelStatus, OpenMode } from "@bentley/bentleyjs-core";
import { BriefcaseIdValue, IModelError } from "@bentley/imodeljs-common";
import { BriefcaseManager } from "../BriefcaseManager";
import { ChangesetFileProps, ChangesetProps, ChangesetRange, LocalDirName, LocalFileName } from "../HubAccess";
import { IModelDb } from "../IModelDb";
import { IModelJsFs } from "../IModelJsFs";
import { SQLiteDb } from "../SQLiteDb";

// cspell:ignore rowid

export interface MockBriefcaseIdProps {
  id: number;
  user: string;
}

export interface LocalHubProps {
  readonly contextId: GuidString;
  readonly iModelId: GuidString;
  readonly iModelName: string;
  readonly description?: string;
  readonly revision0: string;
}

export class LocalHub {
  public readonly contextId: GuidString;
  public readonly iModelId: GuidString;
  public readonly iModelName: string;
  public readonly description?: string;
  private _hubDb?: SQLiteDb;
  private _nextBriefcaseId = BriefcaseIdValue.FirstValid;

  public constructor(public readonly rootDir: string, arg: LocalHubProps) {
    this.contextId = arg.contextId;
    this.iModelId = arg.iModelId;
    this.iModelName = arg.iModelName;
    this.description = arg.description;

    this.cleanup();

    IModelJsFs.recursiveMkDirSync(this.rootDir);
    IModelJsFs.mkdirSync(this.changesetDir);
    IModelJsFs.mkdirSync(this.checkpointDir);

    const db = this._hubDb = new SQLiteDb();
    db.createDb(this.mockDbName);
    db.executeSQL("CREATE TABLE briefcases(id INTEGER PRIMARY KEY,user TEXT)");
    db.executeSQL("CREATE TABLE timeline(id TEXT PRIMARY KEY,parentId TEXT,description TEXT,user TEXT,size BIGINT,type INTEGER,pushDate TEXT,FOREIGN KEY(parentId) REFERENCES timeline(id))");
    db.executeSQL("CREATE TABLE checkpoints(csIndex INTEGER PRIMARY KEY)");
    db.executeSQL("CREATE TABLE versions(name TEXT PRIMARY KEY,id TEXT,FOREIGN KEY(id) REFERENCES timeline(id))");
    db.saveChanges();

    const path = this.addCheckpoint({ id: "", localFile: arg.revision0 });
    const nativeDb = IModelDb.openDgnDb({ path }, OpenMode.ReadWrite);
    try {
      nativeDb.saveProjectGuid(this.contextId);
      nativeDb.setDbGuid(this.iModelId);
      nativeDb.saveChanges();
      nativeDb.deleteAllTxns(); // necessary before resetting briefcaseId
      nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
    } finally {
      nativeDb.closeIModel();
    }
  }

  private get db() { return this._hubDb!; } // eslint-disable-line @typescript-eslint/naming-convention
  public get changesetDir() { return join(this.rootDir, "changesets"); }
  public get checkpointDir() { return join(this.rootDir, "checkpoints"); }
  public get mockDbName() { return join(this.rootDir, "localHub.db"); }

  public acquireNewBriefcaseId(user: string): number {
    const db = this.db;
    const newId = this._nextBriefcaseId++;
    db.withSqliteStatement("INSERT INTO briefcases(id,user) VALUES (?,?)", (stmt) => {
      stmt.bindValue(1, newId);
      stmt.bindValue(2, user);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't update briefcaseId in mock database");
    });
    db.saveChanges();
    return newId;
  }

  public releaseBriefcaseId(id: number) {
    const db = this.db;
    db.withSqliteStatement("DELETE FROM briefcases WHERE id=?", (stmt) => {
      stmt.bindValue(1, id);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, `briefcaseId ${id} was not reserved`);
    });
    db.saveChanges();
  }

  public getBriefcases(): MockBriefcaseIdProps[] {
    const briefcases: MockBriefcaseIdProps[] = [];
    this.db.withSqliteStatement("SELECT id,user FROM briefcases", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        briefcases.push({
          id: stmt.getValue(0).getInteger(),
          user: stmt.getValue(1).getString(),
        });
      }
    });
    return briefcases;
  }

  public getBriefcaseIds(user: string): number[] {
    const briefcases: number[] = [];
    this.db.withSqliteStatement("SELECT id FROM briefcases WHERE user=?", (stmt) => {
      stmt.bindValue(1, user);
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        briefcases.push(stmt.getValue(0).getInteger());
    });
    return briefcases;
  }

  public addChangeset(changeset: ChangesetFileProps) {
    const stats = IModelJsFs.lstatSync(changeset.pathname);
    if (!stats)
      throw new Error(`cannot read changeset file ${changeset.pathname}`);

    const db = this.db;
    db.withSqliteStatement("INSERT INTO timeline(id,parentId,description,size,type,pushDate,user) VALUES (?,?,?,?,?,?,?)", (stmt) => {
      stmt.bindValue(1, changeset.id);
      stmt.bindValue(2, changeset.parentId === "" ? undefined : changeset.parentId);
      stmt.bindValue(3, changeset.description);
      stmt.bindValue(4, stats.size);
      stmt.bindValue(5, changeset.changesType ?? 0);
      stmt.bindValue(6, changeset.pushDate ?? new Date().toString());
      stmt.bindValue(7, changeset.userCreated ?? "");
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't insert changeset into mock db");
    });
    db.saveChanges();
    IModelJsFs.copySync(changeset.pathname, join(this.changesetDir, changeset.id));
  }

  public getChangesetIndex(id: string): number {
    if (id === "")
      return 0;

    return this.db.withPreparedSqliteStatement("SELECT rowid FROM timeline WHERE Id=?", (stmt) => {
      stmt.bindValue(1, id);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== rc)
        throw new IModelError(rc, `changeset ${id} not found`);

      return stmt.getValue(0).getInteger();
    });
  }

  public getChangesetById(id: string): ChangesetProps {
    return this.getChangesetByIndex(this.getChangesetIndex(id));
  }

  public getChangesetByIndex(index: number): ChangesetProps {
    if (index === 0)
      return { id: "", changesType: 0, description: "revision0", parentId: "" };

    return this.db.withPreparedSqliteStatement("SELECT parentId,description,size,type,pushDate,user,id FROM timeline WHERE rowid=?", (stmt) => {
      stmt.bindValue(1, index);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== rc)
        throw new IModelError(rc, `changeset at index ${index} not found`);

      return {
        parentId: stmt.getValue(0).isNull ? "" : stmt.getValue(0).getString(),
        description: stmt.getValue(1).getString(),
        size: stmt.getValue(2).getDouble(),
        changesType: stmt.getValue(3).getInteger(),
        pushDate: stmt.getValue(4).getString(),
        userCreated: stmt.getValue(5).getString(),
        id: stmt.getValue(6).getString(),
        index,
      };
    });
  }

  public getChangesets(first?: number, last?: number): ChangesetProps[] {
    const changesets: ChangesetProps[] = [];
    if (undefined === first)
      first = 1;
    if (undefined === last)
      last = this.getLatestChangesetIndex();
    if (0 === first) {
      changesets.push(this.getChangesetByIndex(0));
      ++first;
    }

    this.db.withPreparedSqliteStatement("SELECT rowid FROM timeline WHERE rowid>=? AND rowid<=? ORDER BY rowid", (stmt) => {
      stmt.bindValue(1, first);
      stmt.bindValue(2, last);
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        changesets.push(this.getChangesetByIndex(stmt.getValue(0).getInteger()));
    });
    return changesets;
  }

  public getLatestChangesetIndex(): number {
    return this.db.withSqliteStatement("SELECT max(rowid) FROM timeline", (stmt) => {
      stmt.step();
      return stmt.getValue(0).getInteger();
    });
  }

  public getLatestChangesetId(): string {
    return this.getChangesetByIndex(this.getLatestChangesetIndex()).id;
  }

  public addNamedVersion(arg: { versionName: string, id: string }) {
    const db = this.db;
    db.withSqliteStatement("INSERT INTO versions(name,id) VALUES (?,?)", (stmt) => {
      stmt.bindValue(1, arg.versionName);
      stmt.bindValue(2, arg.id);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't insert named version");
    });
    db.saveChanges();
  }

  public deleteNamedVersion(versionName: string) {
    const db = this.db;
    db.withSqliteStatement("DELETE FROM versions WHERE name=?", (stmt) => {
      stmt.bindValue(1, versionName);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't delete named version");
    });
    db.saveChanges();
  }

  public findNamedVersion(versionName: string): string {
    return this.db.withSqliteStatement("SELECT id FROM versions WHERE name=?", (stmt) => {
      stmt.bindValue(1, versionName);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== rc)
        throw new IModelError(IModelStatus.NotFound, `Named version ${versionName} not found`);
      return stmt.getValue(0).getString();
    });
  }

  public checkpointNameFromId(id: string) {
    return id === "" ? "0" : id;
  }

  public addCheckpoint(arg: { id: string, localFile: LocalFileName }) {
    const index = (arg.id !== "") ? this.getChangesetIndex(arg.id) : 0;
    const db = this.db;
    db.withSqliteStatement("INSERT INTO checkpoints(csIndex) VALUES (?)", (stmt) => {
      stmt.bindValue(1, index);
      const res = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== res)
        throw new IModelError(res, "can't insert checkpoint into mock db");
    });
    db.saveChanges();
    const outName = join(this.checkpointDir, this.checkpointNameFromId(arg.id));
    IModelJsFs.copySync(arg.localFile, outName);
    return outName;
  }

  public getCheckpoints(): number[] {
    const checkpoints: number[] = [];
    this.db.withSqliteStatement("SELECT csIndex FROM checkpoints", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        checkpoints.push(stmt.getValue(0).getInteger());

    });
    return checkpoints;
  }

  public getPreviousCheckpoint(id: string): number {
    if (id === "")
      return 0;
    const index = this.getChangesetIndex(id);
    return this.db.withSqliteStatement("SELECT max(csIndex) FROM checkpoints WHERE csIndex <= ? ", (stmt) => {
      stmt.bindValue(1, index);
      const res = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== res)
        throw new IModelError(res, "can't get previous checkpoint");
      return stmt.getValue(0).getInteger();
    });
  }

  public downloadCheckpoint(arg: { id: string, targetFile: LocalFileName }) {
    IModelJsFs.copySync(join(this.checkpointDir, this.checkpointNameFromId(arg.id)), arg.targetFile);
  }

  private copyChangeset(arg: ChangesetFileProps): ChangesetFileProps {
    IModelJsFs.copySync(join(this.changesetDir, arg.id), arg.pathname);
    return arg;
  }

  public downloadChangeset(arg: { id: string, targetDir: LocalDirName }) {
    const cs = this.getChangesetById(arg.id);
    const csProps = { ...cs, pathname: join(arg.targetDir, cs.id) };
    return this.copyChangeset(csProps);
  }

  public queryChangesets(range?: ChangesetRange): ChangesetProps[] {
    range = range ?? { first: "" };
    const startId = (undefined !== range.after) ? range.after : range.first;
    let startIndex = this.getChangesetIndex(startId);
    if (undefined !== range.after)
      startIndex++;
    if (startIndex === 0) // there's no changeset for index 0 - that's revision0
      startIndex = 1;
    const endIndex = range.end ? this.getChangesetIndex(range.end) : this.getLatestChangesetIndex();
    if (endIndex < startIndex)
      throw new Error("illegal changeset range");

    const changesets: ChangesetProps[] = [];
    while (startIndex <= endIndex)
      changesets.push(this.getChangesetByIndex(startIndex++));
    return changesets;
  }

  public downloadChangesets(arg: { range?: ChangesetRange, targetDir: LocalDirName }): ChangesetFileProps[] {
    const cSets = this.queryChangesets(arg.range) as ChangesetFileProps[];
    for (const cs of cSets) {
      cs.pathname = join(arg.targetDir, cs.id);
      this.copyChangeset(cs);
    }
    return cSets;
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
    this.removeDir(BriefcaseManager.getIModelPath(this.iModelId));
    this.removeDir(this.rootDir);
  }
}
