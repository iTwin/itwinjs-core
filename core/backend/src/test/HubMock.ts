/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { join } from "path";
import * as sinon from "sinon";
import { DbResult, GuidString, IModelStatus, OpenMode } from "@bentley/bentleyjs-core";
import { BriefcaseIdValue, BriefcaseProps, IModelError, IModelVersion } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BriefcaseManager } from "../BriefcaseManager";
import { IModelDb } from "../IModelDb";
import { IModelJsFs } from "../IModelJsFs";
import { SQLiteDb } from "../SQLiteDb";

export type LocalFileName = string;
export type LocalDirName = string;

export interface MockChangesetProps {
  id: string;
  parentId?: string;
  description: string;
  changesType: number;
  pushDate?: string;
  size?: number;
  index?: number;
}

export interface MockBriefcaseIdProps {
  id: number;
  user: string;
}

/** Mocks iModelHub for testing creating Briefcases, downloading checkpoints, and simulating multiple users pushing and pulling changeset. */
export class HubMock {
  private static mockRoot: LocalDirName;
  private static mocks = new Map<string, HubMock>();

  private _hubDb?: SQLiteDb;
  private _nextBriefcaseId = BriefcaseIdValue.FirstValid;
  private constructor(public readonly contextId: GuidString, public readonly iModelId: GuidString, public readonly iModelName: string) { }
  private get db() { return this._hubDb!; } // eslint-disable-line @typescript-eslint/naming-convention
  public get mockDir() { return join(HubMock.mockRoot, this.iModelId); }
  public get changesetDir() { return join(this.mockDir, "changesets"); }
  public get checkpointDir() { return join(this.mockDir, "checkpoints"); }
  public get mockDbName() { return join(this.mockDir, "mock.db"); }

  public static initialize(mockRoot: LocalDirName) {
    this.mockRoot = mockRoot;
    IModelJsFs.recursiveMkDirSync(mockRoot);
    IModelJsFs.purgeDirSync(mockRoot);

    sinon.stub(BriefcaseManager, "acquireNewBriefcaseId").callsFake(async (req: AuthorizedClientRequestContext, iModelId: GuidString) => {
      return this.findMock(iModelId).acquireNewBriefcaseId(req.accessToken.getUserInfo()!.id);
    });
    sinon.stub(BriefcaseManager, "releaseBriefcase").callsFake(async (_, briefcase: BriefcaseProps) => {
      return this.findMock(briefcase.iModelId).releaseBriefcaseId(briefcase.briefcaseId);
    });

    sinon.stub(IModelVersion, "getLatestChangeSetId").callsFake(async (_1, _2, iModelId: GuidString): Promise<GuidString> => {
      return this.findMock(iModelId).getLatestChangesetId();
    });

    sinon.stub(IModelVersion, "getChangeSetFromNamedVersion").callsFake(async (_1, _2, iModelId: GuidString, versionName: string): Promise<GuidString> => {
      return this.findMock(iModelId).findNamedVersion(versionName);
    });

  }

  public static findMock(iModelId: GuidString): HubMock {
    const mock = this.mocks.get(iModelId);
    if (!mock)
      throw new Error(`iModel ${iModelId} is not mocked`);
    return mock;
  }

  /** create a HubMock for an iModel.
   *  - contextId - the Guid of the context to mock
   *  - iModelId - the Guid of the iModel to mock
   *  - iModelName - the name of the iModel to mock
   *  - revision0 - the local filename of the revision 0 (aka "seed") .bim file
   */
  public static create(arg: { contextId: GuidString, iModelId: GuidString, iModelName: string, revision0: LocalFileName }) {
    if (!this.mockRoot)
      throw new Error("call initialize first");

    const mock = new HubMock(arg.contextId, arg.iModelId, arg.iModelName);
    this.mocks.set(arg.iModelId, mock);
    mock.cleanup();

    IModelJsFs.recursiveMkDirSync(mock.mockDir);
    IModelJsFs.mkdirSync(mock.changesetDir);
    IModelJsFs.mkdirSync(mock.checkpointDir);

    const db = mock._hubDb = new SQLiteDb();
    db.createDb(mock.mockDbName);
    db.executeSQL("CREATE TABLE briefcases(id INTEGER PRIMARY KEY,user TEXT)");
    db.executeSQL("CREATE TABLE timeline(id TEXT PRIMARY KEY,parentId TEXT,description TEXT,size BIGINT,type INTEGER,pushDate TEXT,FOREIGN KEY(parentId) REFERENCES timeline(id))");
    db.executeSQL("CREATE TABLE checkpoints(id TEXT PRIMARY KEY)");
    db.executeSQL("CREATE TABLE versions(name TEXT PRIMARY KEY,id TEXT,FOREIGN KEY(id) REFERENCES timeline(id))");
    db.saveChanges();

    const path = mock.addCheckpoint({ id: "0", localFile: arg.revision0 });
    const nativeDb = IModelDb.openDgnDb({ path }, OpenMode.ReadWrite);
    try {
      nativeDb.saveProjectGuid(arg.contextId);
      nativeDb.setDbGuid(arg.iModelId);
      nativeDb.saveChanges();
      nativeDb.deleteAllTxns(); // necessary before resetting briefcaseId
      nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
    } finally {
      nativeDb.closeIModel();
    }
  }

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
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't insert changeset into mock db");
    });
    db.saveChanges();
    IModelJsFs.copySync(arg.localFile, join(this.changesetDir, changeset.id));
  }

  public getChangeset(id: string) {
    this.db.withSqliteStatement("SELECT parentId,description,size,type,pushDate,rowid FROM timeline WHERE Id=?", (stmt) => {
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw new IModelError(IModelStatus.NotFound, `changeset ${id} not found`);

      return {
        id,
        parentId: stmt.getValue(0).isNull ? undefined : stmt.getValue(1).getString(),
        description: stmt.getValue(1).getString(),
        size: stmt.getValue(2).getDouble(),
        changesType: stmt.getValue(3).getInteger(),
        pushDate: stmt.getValue(4).getString(),
        index: stmt.getValue(5).getInteger(),
      };
    });
  }

  public getChangesets(): MockChangesetProps[] {
    const changesets: MockChangesetProps[] = [];
    this.db.withSqliteStatement("SELECT id,parentId,description,size,type,pushDate,rowid FROM timeline", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        changesets.push({
          id: stmt.getValue(0).getString(),
          parentId: stmt.getValue(1).isNull ? undefined : stmt.getValue(1).getString(),
          description: stmt.getValue(2).getString(),
          size: stmt.getValue(3).getDouble(),
          changesType: stmt.getValue(4).getInteger(),
          pushDate: stmt.getValue(5).getString(),
          index: stmt.getValue(6).getInteger(),
        });
      }
    });
    return changesets;
  }

  public getLatestChangesetId(): string {
    return this.db.withSqliteStatement("SELECT max(rowid),id FROM timeline", (stmt) => {
      const rc = stmt.step();
      return (DbResult.BE_SQLITE_ROW !== rc) ? "" : stmt.getValue(1).getString();
    });
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

  public addCheckpoint(arg: { id: string, localFile: LocalFileName }) {
    if (arg.id !== "0")
      this.getChangeset(arg.id); // throws if not found
    const db = this.db;
    db.withSqliteStatement("INSERT INTO checkpoints(id) VALUES (?)", (stmt) => {
      stmt.bindValue(1, arg.id);
      const res = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== res)
        throw new IModelError(res, "can't insert checkpoint into mock db");
    });
    db.saveChanges();
    const outName = join(this.checkpointDir, arg.id);
    IModelJsFs.copySync(arg.localFile, outName);
    return outName;
  }

  public getCheckpoints() {
    const checkpoints: string[] = [];
    this.db.withSqliteStatement("SELECT id FROM checkpoints", (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step())
        checkpoints.push(stmt.getValue(0).getString());

    });
    return checkpoints;
  }

  public downloadCheckpoint(arg: { id: string, targetFile: LocalFileName }) {
    IModelJsFs.copySync(join(this.checkpointDir, arg.id), arg.targetFile);
  }

  public downloadChangeset(arg: { id: string, targetFile: LocalFileName }) {
    IModelJsFs.copySync(join(this.changesetDir, arg.id), arg.targetFile);
  }

  public cleanup() {
    if (this._hubDb) {
      this._hubDb.closeDb();
      this._hubDb = undefined;
    }
    IModelJsFs.purgeDirSync(this.mockDir);
  }
}
