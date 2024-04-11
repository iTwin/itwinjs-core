/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, DbChangeStage, DbConflictCause, DbConflictResolution, DbOpcode, DbResult, Logger } from "@itwin/core-bentley";
import { ChangesetFileProps, ChangesetIdWithIndex, FilePropertyProps } from "@itwin/core-common";
import { Range3d, Range3dProps } from "@itwin/core-geometry";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BriefcaseDb, ChangesetConflictArgs, ISingleTableConflictHandler } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { SqliteChangesetReader } from "./SqliteChangesetReader";

enum ProjectExtentSource {
  Auto = 0,
  User = 1,
}

/** @internal */
export interface FilePropValue {
  strValue?: string;
  blobVal?: Uint8Array;
}

/** @internal */
export interface FilePropConflict {
  key: FilePropertyProps;
  oldVal: FilePropValue | undefined | null;
  newVal: FilePropValue | undefined | null;
  localVal: FilePropValue | undefined | null;
  resolution: DbConflictResolution;
  opCode: DbOpcode;
  cause: DbConflictCause;
  changeset: ChangesetIdWithIndex;
}

/**
 * Handle be_Prop conflicts and record conflict for review by application
 * @internal
 */
export class FilePropertyConflictHandler implements ISingleTableConflictHandler {
  private static readonly namespaceColIdx = 0;
  private static readonly nameColIdx = 1;
  private static readonly idColIdx = 2;
  private static readonly subIdColIdx = 3;
  private static readonly strDataColIdx = 5;
  private static readonly rawSizeColIdx = 6;
  private static readonly dataColIdx = 7;
  private static readonly projectExtentSourceKey = { namespace: "dgn_Db", name: "Units" };
  private static readonly projectExtentKey = { namespace: "dgn_Db", name: "Extents" };
  private _mergeProjectExtent?: Range3d;
  private _changeset?: ChangesetFileProps;
  public conflicts: FilePropConflict[] = [];

  public constructor(private readonly _db: BriefcaseDb) { }

  public static register(db: BriefcaseDb) {
    const handler = new FilePropertyConflictHandler(db);
    db.tableConflictHandlers.set(handler.tableName, handler);
  }

  public get tableName(): string {
    return "be_Prop";
  }

  private parseProjectExtentSourceType(json: string | undefined | null): ProjectExtentSource {
    if (!json) {
      return ProjectExtentSource.Auto;
    }
    try {
      const extentsSource = JSON.parse(json).extentsSource;
      if (typeof extentsSource === "number")
        return extentsSource as ProjectExtentSource;
      return ProjectExtentSource.Auto;
    } catch {
      return ProjectExtentSource.Auto;
    }
  }

  private setProjectExtentSourceToUserDefined(): void {
    const unitsJson = this._db.queryFilePropertyString(FilePropertyConflictHandler.projectExtentSourceKey);
    const userDefinedProjectExtent = 1;
    let unitsObj: any;
    if (unitsJson) {
      unitsObj = JSON.parse(unitsJson);
      if (unitsObj.extentsSource !== userDefinedProjectExtent) {
        unitsObj.extentsSource = userDefinedProjectExtent;
      } else {
        unitsObj = undefined; // no need to update.
      }
    } else
      unitsObj = { extentsSource: userDefinedProjectExtent };

    if (unitsObj) {
      this._db.saveFileProperty(FilePropertyConflictHandler.projectExtentSourceKey, JSON.stringify(unitsObj));
    }
  }

  private static getPrimaryKeyFromConflictArgs(args: ChangesetConflictArgs): FilePropertyProps {
    const stage = args.opcode === DbOpcode.Insert ? DbChangeStage.New : DbChangeStage.Old;
    return {
      namespace: args.getValueText(this.namespaceColIdx, stage) as string,
      name: args.getValueText(this.nameColIdx, stage) as string,
      id: args.getValueInteger(this.idColIdx, stage) === 0 ? undefined : args.getValueId(this.idColIdx, stage) as string,
      subId: args.getValueInteger(this.subIdColIdx, stage) === 0 ? undefined : args.getValueId(this.subIdColIdx, stage) as string,
    };
  }

  private static getPrimaryKeyFromChangesetReader(reader: SqliteChangesetReader): FilePropertyProps {
    return {
      namespace: reader.getChangeValueText(0, "Old") as string,
      name: reader.getChangeValueText(1, "Old") as string,
      id: reader.isColumnValueNull(2, "Old") ? undefined : reader.getChangeValueId(2, "Old") as string,
      subId: reader.isColumnValueNull(3, "Old") ? undefined : reader.getChangeValueId(3, "Old") as string,
    };
  }

  private getProjectExtendSourceFromChangesetFile(changesetPath: string): ProjectExtentSource {
    const reader = SqliteChangesetReader.openFile({ fileName: changesetPath, db: this._db });
    let projectExtentSource: ProjectExtentSource | undefined;
    while (reader.step() && typeof projectExtentSource === "undefined") {
      if (reader.op === "Inserted" || reader.op === "Updated") {
        const fileProps = FilePropertyConflictHandler.getPrimaryKeyFromChangesetReader(reader);
        if (fileProps.namespace === "dgn_Db" && fileProps.name === "Units" && !reader.isColumnValueNull(5, "New")) {
          projectExtentSource = this.parseProjectExtentSourceType(reader.getChangeValueText(5, "New"));
        }
      }
    }
    reader.dispose();
    if (!projectExtentSource) {
      // read from local file
      const unitJson = this._db.queryFilePropertyString(FilePropertyConflictHandler.projectExtentSourceKey);
      projectExtentSource = this.parseProjectExtentSourceType(unitJson);
    }
    return projectExtentSource ?? ProjectExtentSource.Auto;
  }
  private getProjectExtentFromLocalTxns(): ProjectExtentSource {
    const reader = SqliteChangesetReader.openLocalChanges({ iModel: this._db.nativeDb });
    let projectExtentSource: ProjectExtentSource | undefined;
    while (reader.step() && typeof projectExtentSource === "undefined") {
      if (reader.op === "Inserted" || reader.op === "Updated") {
        const fileProps = FilePropertyConflictHandler.getPrimaryKeyFromChangesetReader(reader);
        if (fileProps.namespace === "dgn_Db" && fileProps.name === "Units" && !reader.isColumnValueNull(5, "New")) {
          projectExtentSource = this.parseProjectExtentSourceType(reader.getChangeValueText(5, "New"));
        }
      }
    }
    reader.dispose();
    if (!projectExtentSource) {
      // read from local file
      const unitJson = this._db.queryFilePropertyString(FilePropertyConflictHandler.projectExtentSourceKey);
      projectExtentSource = this.parseProjectExtentSourceType(unitJson);
    }
    return projectExtentSource ?? ProjectExtentSource.Auto;
  }
  private handleProjectExtentConflict(args: ChangesetConflictArgs): DbConflictResolution | undefined {
    const notHandled = undefined;
    const incomingProjectExtentSourceType = this.getProjectExtendSourceFromChangesetFile(args.changesetFile as string);
    const localProjectExtentSourceType = this.getProjectExtentFromLocalTxns();
    const projectExtentJson = args.getValueText(FilePropertyConflictHandler.strDataColIdx, DbChangeStage.New);
    if (typeof projectExtentJson !== "string") {
      return notHandled;
    }

    if (incomingProjectExtentSourceType === ProjectExtentSource.User && localProjectExtentSourceType === ProjectExtentSource.User) {
      const localProjectExtentVal = this._db.projectExtents;
      const incomingProjectExtentVal = Range3d.fromJSON(JSON.parse(projectExtentJson) as Range3dProps);

      // Skip if unchanged.
      if (incomingProjectExtentVal.isAlmostEqual(localProjectExtentVal))
        return DbConflictResolution.Skip;

      // Take union and skip incoming change
      this._mergeProjectExtent = localProjectExtentVal.union(incomingProjectExtentVal);
      Logger.logInfo(BackendLoggerCategory.IModelDb, `Incoming change for user defined project extents will me me merged with local user defined project extents.`);
      return DbConflictResolution.Skip;
    }

    // if local sourceType !== User && incoming sourceType === User then replace
    if (incomingProjectExtentSourceType === ProjectExtentSource.User && localProjectExtentSourceType !== ProjectExtentSource.User) {
      Logger.logInfo(BackendLoggerCategory.IModelDb, `Incoming change for user defined project extents will override local none-user defined project extents.`);
      return DbConflictResolution.Replace;
    }

    // if local sourceType === User && incoming sourceType !== User then skip
    if (incomingProjectExtentSourceType !== ProjectExtentSource.User && localProjectExtentSourceType === ProjectExtentSource.User) {
      Logger.logInfo(BackendLoggerCategory.IModelDb, `Incoming change for project extents will be skipped in favour of local user defined project extents.`);
      return DbConflictResolution.Skip;
    }
    return notHandled;
  }
  public onConflict(args: ChangesetConflictArgs): DbConflictResolution | undefined {
    const key = FilePropertyConflictHandler.getPrimaryKeyFromConflictArgs(args);
    if (key.namespace === FilePropertyConflictHandler.projectExtentKey.namespace && key.name === FilePropertyConflictHandler.projectExtentKey.name) {
      const resolution = this.handleProjectExtentConflict(args);
      if (!resolution)
        return resolution;
    }
    if (args.cause === DbConflictCause.Conflict) {
      // We have local insert for which their is incoming insert. We currently do not handle this.
      // We will let this fail/abort
      return undefined;
    }
    // default conflict
    return this.recordConflict(DbConflictResolution.Replace, args);
  }

  private static decompress(binData: Uint8Array, rawSize: number): Uint8Array | undefined {
    try {
      return IModelHost.platform.DgnDb.zlibDecompress(binData, rawSize);
    } catch (e) {
      return undefined;
    }
  }

  private getValueFromConflictArgs(args: ChangesetConflictArgs, stage: DbChangeStage): FilePropValue {
    let blobVal = args.getValueBinary(FilePropertyConflictHandler.dataColIdx, stage);
    let strValue = args.getValueText(FilePropertyConflictHandler.strDataColIdx, stage);
    if (blobVal !== undefined && blobVal !== null) {
      let rawSize = args.getValueInteger(FilePropertyConflictHandler.rawSizeColIdx, stage);
      if (!rawSize) {
        const key = FilePropertyConflictHandler.getPrimaryKeyFromConflictArgs(args);
        rawSize = this._db.withSqliteStatement(`SELECT [RawSize] FROM [be_Prop] WHERE [Namespace] = ? AND [Name] = ?`, (stmt) => {
          stmt.bindString(1, key.namespace);
          stmt.bindString(2, key.name);
          if (stmt.step() === DbResult.BE_SQLITE_ROW) {
            if (!stmt.isValueNull(0))
              return stmt.getValueInteger(0);
          }
          return undefined;
        });
      }
      if (rawSize !== undefined && rawSize !== null)
        blobVal = FilePropertyConflictHandler.decompress(blobVal, rawSize);
    }

    if (strValue === null)
      strValue = undefined;

    if (blobVal === null)
      blobVal = undefined;

    return { strValue, blobVal };
  }
  private getValueFromLocalBriefcase(key: FilePropertyProps): FilePropValue {
    const strValue = this._db.withSqliteStatement(`SELECT [StrData] FROM [be_Prop] WHERE [Namespace] = ? AND [Name] = ? AND [Id] = ? AND [SubId] = ?`, (stmt) => {
      stmt.bindString(1, key.namespace);
      stmt.bindString(2, key.name);

      const idParamIdx = 3;
      const id = key.id;
      if (typeof id === "string") {
        if (id !== "0x0" && id !== "0")
          stmt.bindId(idParamIdx, id);
        else
          stmt.bindInteger(idParamIdx, 0);
      } else {
        stmt.bindInteger(idParamIdx, id ?? 0);
      }

      const subIdParamIdx = 4;
      const subId = key.subId;
      if (typeof subId === "string") {
        if (subId !== "0x0" && subId !== "0")
          stmt.bindId(subIdParamIdx, subId);
        else
          stmt.bindInteger(subIdParamIdx, 0);
      } else {
        stmt.bindInteger(subIdParamIdx, subId ?? 0);
      }

      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        if (!stmt.isValueNull(0))
          return stmt.getValueString(0);
      }
      return undefined;
    });
    return { strValue, blobVal: this._db.queryFilePropertyBlob(key) };
  }
  private recordConflict(resolution: DbConflictResolution, args: ChangesetConflictArgs): DbConflictResolution {
    this.conflicts.push({
      key: FilePropertyConflictHandler.getPrimaryKeyFromConflictArgs(args),
      oldVal: this.getValueFromConflictArgs(args, DbChangeStage.Old),
      newVal: this.getValueFromConflictArgs(args, DbChangeStage.New),
      localVal: this.getValueFromLocalBriefcase(FilePropertyConflictHandler.getPrimaryKeyFromConflictArgs(args)),
      resolution,
      opCode: args.opcode,
      cause: args.cause,
      changeset: { id: this._changeset?.id as string, index: this._changeset?.index },
    });
    return resolution;
  }

  public onAfterSingleChangesetApply(changeset: ChangesetFileProps): void {
    assert(!this._changeset || this._changeset.id === changeset.id);
    this._changeset = undefined;
    if (this._mergeProjectExtent) {
      this.setProjectExtentSourceToUserDefined();
      this._db.updateProjectExtents(this._mergeProjectExtent);
      this._mergeProjectExtent = undefined;
      const commitMessage = `Merged local project extents with ${changeset.id}`;
      this._db.saveChanges(commitMessage);
      Logger.logInfo(BackendLoggerCategory.IModelDb, commitMessage);
    }

  }
  public onBeforeSingleChangesetApply(changeset: ChangesetFileProps): void {
    this._changeset = changeset;
  }
  public onBeforeApplyChangesets(_changesets: ChangesetFileProps[]): void {
    this.conflicts = [];
  }
  public onAfterApplyChangesets(_changesets: ChangesetFileProps[]): void {
  }
}
