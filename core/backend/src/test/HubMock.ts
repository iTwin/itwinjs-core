/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { join } from "path";
import { DbResult } from "@bentley/bentleyjs-core";
import { IModelJsNative } from "../imodeljs-backend";
import { IModelJsFs } from "../IModelJsFs";
import { SQLiteDb } from "../SQLiteDb";
import { BriefcaseIdValue } from "@bentley/imodeljs-common";

export type LocalFileName = string;
export type LocalDirName = string;

export interface MockChangesetProps extends IModelJsNative.ChangeSetProps {
  description: string;
  size?: number;
  index?: number;
}

export interface MockBriefcaseIdProps {
  id: number;
  user: string;
}

export class HubMock {
  public contextId: string;
  public iModelName: string;
  private _mockDir: LocalDirName;
  private _hubDb?: SQLiteDb;

  private get db() { return this._hubDb!; } // eslint-disable-line @typescript-eslint/naming-convention
  public get changesetDir() { return join(this._mockDir, "changesets"); }
  public get checkpointDir() { return join(this._mockDir, "checkpoints"); }
  public get mockDbName() { return join(this._mockDir, "mock.db"); }

  public constructor(arg: { contextId: string, mockDir: LocalDirName, iModelName: string, localFile: LocalFileName }) {
    this.contextId = arg.contextId;
    this._mockDir = arg.mockDir;
    this.iModelName = arg.iModelName;

    this.cleanup();

    IModelJsFs.recursiveMkDirSync(this._mockDir);
    IModelJsFs.mkdirSync(this.changesetDir);
    IModelJsFs.mkdirSync(this.checkpointDir);

    const db = this._hubDb = new SQLiteDb();
    db.createDb(this.mockDbName);
    db.executeSQL("CREATE TABLE briefcases(id INTEGER PRIMARY KEY,user TEXT)");
    db.executeSQL("CREATE TABLE timeline(id TEXT PRIMARY KEY,parentId, TEXT,description TEXT,size BIGINT,type INTEGER,pushDate TEXT)");
    db.executeSQL("CREATE TABLE checkpoints(id TEXT PRIMARY KEY,isNamed INTEGER)");
    db.saveChanges();

    this.addCheckpoint({ id: "0", localFile: arg.localFile, isNamed: false });
  }

  public acquireNewBriefcaseId(user: string): number {
    const db = this.db;
    let next = BriefcaseIdValue.FirstValid;
    db.withSqliteStatement("SELECT max(id) from briefcases", (stmt) => {
      if (DbResult.BE_SQLITE_ROW === stmt.step())
        next = stmt.getValue(0).getInteger() + 1;
    });
    db.withSqliteStatement("INSERT INTO briefcases(id,user) VALUES (?,?)", (stmt) => {
      stmt.bindValue(1, next);
      stmt.bindValue(2, user);
      if (DbResult.BE_SQLITE_OK !== stmt.step())
        throw new Error("can't update briefcaseId in mock database");
    });
    db.saveChanges();
    return next;
  }

  public releaseBriefcaseId(id: number) {
    const db = this.db;
    db.withSqliteStatement("DELETE FROM from briefcases WHERE id=?", (stmt) => {
      stmt.bindValue(0, id);
      if (DbResult.BE_SQLITE_DONE !== stmt.step())
        throw new Error(`briefcaseId ${id} was not reserved`);
    });
    db.saveChanges();
  }

  public getBriefcaseIds(): MockBriefcaseIdProps[] {
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

  public addChangeset(arg: { changeset: MockChangesetProps, localFile: LocalFileName }) {
    const changeset = arg.changeset;
    const stats = IModelJsFs.lstatSync(arg.localFile);
    if (!stats)
      throw new Error(`cannot read changeset file ${arg.localFile}`);

    const db = this.db;
    db.withSqliteStatement("INSERT INTO timeline(id,parentId,description,size,type,pushDate) VALUES (?,?,?,?,?,?)", (stmt) => {
      stmt.bindValue(1, changeset.id);
      stmt.bindValue(2, changeset.parentId);
      stmt.bindValue(3, changeset.description);
      stmt.bindValue(4, stats.size);
      stmt.bindValue(5, changeset.changesType ?? 0);
      stmt.bindValue(6, changeset.pushDate ?? new Date().toString());
      if (DbResult.BE_SQLITE_OK !== stmt.step())
        throw new Error("can't insert changeset into mock db");
    });
    db.saveChanges();
    IModelJsFs.copySync(arg.localFile, join(this.changesetDir, changeset.id));
  }

  public getChangesets() {
    const changesets: MockChangesetProps[] = [];
    this.db.withSqliteStatement("SELECT id,parentId,description,size,type,pushDate,rowid FROM timeline", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const id = stmt.getValue(0).getString();
        changesets.push({
          id,
          parentId: stmt.getValue(1).getString(),
          description: stmt.getValue(2).getString(),
          size: stmt.getValue(3).getDouble(),
          changesType: stmt.getValue(4).getInteger(),
          pushDate: stmt.getValue(5).getString(),
          pathname: id,
          index: stmt.getValue(6).getInteger() + 1,
        });
      }
    });
    return changesets;
  }

  public getChangeset(arg: { id: string, targetFile: LocalFileName }) {
    const sourceFile = join(this.changesetDir, arg.id);
    if (!IModelJsFs.existsSync(sourceFile))
      throw new Error("changeset does not exist");
    IModelJsFs.copySync(arg.targetFile, sourceFile);
  }

  public addCheckpoint(arg: { id: string, localFile: LocalFileName, isNamed: boolean }) {
    const db = this.db;
    db.withSqliteStatement("INSERT INTO checkpoints(id,isNamed) VALUES (?,?)", (stmt) => {
      stmt.bindValue(1, arg.id);
      stmt.bindValue(2, arg.isNamed);
      if (DbResult.BE_SQLITE_OK !== stmt.step())
        throw new Error("can't insert checkpoint into mock db");
    });
    db.saveChanges();
    IModelJsFs.copySync(arg.localFile, join(this.checkpointDir, arg.id));
  }

  public getCheckpoints() {
    const checkpoints: string[] = [];
    this.db.withSqliteStatement("SELECT id FROM checkpoints", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        checkpoints.push(stmt.getValue(0).getString());

    });
    return checkpoints;
  }

  public getCheckpoint(arg: { id: string, targetFile: LocalFileName }) {
    const sourceFile = join(this.checkpointDir, arg.id);
    if (!IModelJsFs.existsSync(sourceFile))
      throw new Error("checkpoint does not exist");
    IModelJsFs.copySync(arg.targetFile, sourceFile);
  }

  public cleanup() {
    if (this._hubDb) {
      this._hubDb.closeDb();
      this._hubDb = undefined;
    }
    IModelJsFs.purgeDirSync(this._mockDir);

  }
}
