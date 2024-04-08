/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbChangeStage, DbConflictResolution, DbOpcode, Logger } from "@itwin/core-bentley";
import { ChangesetFileProps, FilePropertyProps } from "@itwin/core-common";
import { Range3d, Range3dProps } from "@itwin/core-geometry";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BriefcaseDb, ChangesetConflictArgs, ISingleTableDataConflictHandler } from "./IModelDb";
import { SqliteChangesetReader } from "./SqliteChangesetReader";

enum ProjectExtentSource {
  Auto = 0,
  User = 1,
}

/**
 * Handle be_Prop conflicts
 */
export class FilePropertyConflictHandler implements ISingleTableDataConflictHandler {
  private static readonly namespaceColIdx = 0;
  private static readonly nameColIdx = 1;
  private static readonly idColIdx = 2;
  private static readonly subIdColIdx = 3;
  private static readonly strDataColIdx = 5;
  private static readonly projectExtentSourceKey = { namespace: "dgn_Db", name: "Units" };
  private static readonly projectExtentKey = { namespace: "dgn_Db", name: "Extents" };
  private _mergeProjectExtent?: Range3d;
  private constructor(private readonly _db: BriefcaseDb) { }
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
  private setProjectExtentSourceToUserDefined() {
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
    return {
      namespace: args.getValueText(this.namespaceColIdx, DbChangeStage.Old) as string,
      name: args.getValueText(this.nameColIdx, DbChangeStage.Old) as string,
      id: args.getValueId(this.idColIdx, DbChangeStage.Old) as string,
      subId: args.getValueId(this.subIdColIdx, DbChangeStage.Old) as string,
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

  private getProjectExtendSourceFromChangesetFile(changesetPath: string) {
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
  public onConflict(args: ChangesetConflictArgs): DbConflictResolution | undefined {
    const notHandled = undefined;
    if (args.opcode !== DbOpcode.Update) {
      return notHandled;
    }

    const key = FilePropertyConflictHandler.getPrimaryKeyFromConflictArgs(args);
    if (key.namespace === FilePropertyConflictHandler.projectExtentKey.namespace && key.name === FilePropertyConflictHandler.projectExtentKey.name) {
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
      if (incomingProjectExtentSourceType === ProjectExtentSource.User
        && localProjectExtentSourceType !== ProjectExtentSource.User) {
        Logger.logInfo(BackendLoggerCategory.IModelDb, `Incoming change for user defined project extents will override local none-user defined project extents.`);
        return DbConflictResolution.Replace;
      }

      // if local sourceType === User && incoming sourceType !== User then skip
      if (incomingProjectExtentSourceType !== ProjectExtentSource.User
        && localProjectExtentSourceType === ProjectExtentSource.User) {
        Logger.logInfo(BackendLoggerCategory.IModelDb, `Incoming change for project extents will be skipped in favour of local user defined project extents.`);
        return DbConflictResolution.Skip;
      }
    }
    return DbConflictResolution.Replace;
  }
  public onAfterSingleChangesetApply(changeset: ChangesetFileProps) {
    if (this._mergeProjectExtent) {
      this.setProjectExtentSourceToUserDefined();
      this._db.updateProjectExtents(this._mergeProjectExtent);
      this._mergeProjectExtent = undefined;
      const commitMessage = `Merged local project extents with ${changeset.id}`;
      this._db.saveChanges(commitMessage);
      Logger.logInfo(BackendLoggerCategory.IModelDb, commitMessage);
    }
  }
  public onBeforeSingleChangesetApply(_changeset: ChangesetFileProps) {
  }
}
