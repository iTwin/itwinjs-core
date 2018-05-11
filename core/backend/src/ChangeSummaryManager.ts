/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModels */

import { AccessToken, ChangeSet, UserInfo, UserInfoQuery, ChangeSetQuery } from "@bentley/imodeljs-clients";
import { ErrorStatusOrResult } from "@bentley/imodeljs-native-platform-api";
import { Id64, using, assert, PerfLogger, OpenMode, DbResult } from "@bentley/bentleyjs-core";
import { IModelDb } from "./IModelDb";
import { ECDb } from "./ECDb";
import { ECSqlStatement } from "./ECSqlStatement";
import { ChangeOpCode, ChangedValueState, IModelVersion, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { BriefcaseManager } from "./BriefcaseManager";
import * as path from "path";
import { IModelJsFs } from "./IModelJsFs";
import { KnownLocations } from "./Platform";

/** Represents an instance of the `ChangeSummary` ECClass from the `ECDbChange` ECSchema
 *
 *  See also
 *  - [ChangeSummaryManager.queryChangeSummary]($backend)
 *  - [ChangeSummary Overview]($docs/learning/ChangeSummaries)
 */
export interface ChangeSummary {
  id: Id64;
  changeSet: { wsgId: string, parentWsgId: string, pushDate: string, author: string };
}

/** Represents an instance of the `InstanceChange` ECClass from the `ECDbChange` ECSchema
 *
 *  See also
 *  - [ChangeSummaryManager.queryInstanceChange]($backend)
 *  - [ChangeSummary Overview]($docs/learning/ChangeSummaries)
 */
export interface InstanceChange {
  id: Id64;
  summaryId: Id64;
  changedInstance: { id: Id64, className: string };
  opCode: ChangeOpCode;
  isIndirect: boolean;
  changedProperties: { before: any, after: any };
}

/** Options for [ChangeSummaryManager.extractChangeSummaries]($backend). */
export interface ChangeSummaryExtractOptions {
  /** If specified, change summaries are extracted from the start changeset to the current changeset as of which the iModel
   *  was opened. If undefined, the extraction starts at the first changeset of the iModel.
   */
  startChangeSetId?: string;
  /** If specified, the change summary will be extracted only for current changeset as of which the iModel
   *  was opened.
   */
  currentChangeSetOnly?: boolean;
}

class ChangeSummaryExtractContext {
  public readonly iModel: IModelDb;
  public readonly accessToken: AccessToken;

  public constructor(iModel: IModelDb) {
    this.iModel = iModel;
    this.accessToken = IModelDb.getAccessToken(this.iModelId);
  }

  public get iModelId(): string { assert(!!this.iModel.briefcase); return this.iModel.briefcase!.iModelId; }
}

/** Class to extract Change Summaries for a briefcase.
 *
 *  See also:
 *  - [ChangeSummary Overview]($docs/learning/ChangeSummaries)
 */
export class ChangeSummaryManager {
  /** Determines whether the *Changes Cache File* is attached to the specified iModel or not
   * @param iModel iModel to check whether a *Changes Cache File* is attached
   * @returns Returns true if the *Changes Cache File* is attached to the iModel. false otherwise
   */
  public static isChangeCacheAttached(iModel: IModelDb): boolean {
    if (!iModel || !iModel.nativeDb)
      throw new IModelError(IModelStatus.BadRequest, "Invalid iModel object. iModel must be open.");

    return iModel.nativeDb.isChangeCacheAttached();
  }

  /** Attaches the *Changes Cache File* to the specified iModel if it hasn't been attached yet.
   * A new *Changes Cache File* will be created for the iModel if it hasn't existed before.
   * @param iModel iModel to attach the *Changes Cache File* file to
   * @throws [IModelError]($common)
   */
  public static attachChangeCache(iModel: IModelDb): void {
    if (!iModel || !iModel.briefcase || !iModel.nativeDb)
      throw new IModelError(IModelStatus.BadRequest, "Invalid iModel object. iModel must be open.");

    if (ChangeSummaryManager.isChangeCacheAttached(iModel))
      return;

    const changesCacheFilePath: string = BriefcaseManager.getChangeSummaryPathname(iModel.briefcase.iModelId);
    if (!IModelJsFs.existsSync(changesCacheFilePath)) {
      using(new ECDb(), (changesFile: ECDb) => {
        ChangeSummaryManager.createChangesFile(iModel, changesFile, changesCacheFilePath);
      });
    }

    assert(IModelJsFs.existsSync(changesCacheFilePath));
    const res: DbResult = iModel.nativeDb.attachChangeCache(changesCacheFilePath);
    if (res !== DbResult.BE_SQLITE_OK)
      throw new IModelError(res, `Failed to attach Changes Cache file to ${iModel.briefcase.pathname}.`);
  }

  /** Detaches the *Changes Cache File* from the specified iModel.
   * @param iModel iModel to detach the *Changes Cache File* to
   * @throws [IModelError]($common) in case of errors, e.g. if no *Changes Cache File* was attached before.
   */
  public static detachChangeCache(iModel: IModelDb): void {
    if (!iModel || !iModel.briefcase || !iModel.nativeDb)
      throw new IModelError(IModelStatus.BadRequest, "Invalid iModel object. iModel must be open.");

    iModel.clearStatementCache();
    const res: DbResult = iModel.nativeDb.detachChangeCache();
    if (res !== DbResult.BE_SQLITE_OK)
      throw new IModelError(res, `Failed to detach Changes Cache file from ${iModel.briefcase.pathname}.`);
  }

  /** Extracts change summaries from the specified iModel.
   * Change summaries are extracted from the specified startChangeSetId up through the change set the iModel was opened with.
   * If startChangeSetId is undefined, the first changeset will be used.
   * @param iModel iModel to extract change summaries for. The iModel must not be a standalone iModel.
   * Note: The method moves the history of the iModel back to the specified start changeset. After the extraction has completed,
   * the iModel is moved back to the original changeset.
   * @param options Extraction options
   * @throws [IModelError]($common) if the iModel is standalone,r was not opened in readwrite mode.
   */
  public static async extractChangeSummaries(iModel: IModelDb, options?: ChangeSummaryExtractOptions): Promise<void> {
    // TODO: iModel must be opened in exclusive mode (needs change in BriefcaseManager)
    if (!iModel || !iModel.briefcase || !iModel.briefcase.isOpen || iModel.briefcase.isStandalone)
      throw new IModelError(IModelStatus.BadArg, "iModel to extract change summaries for must be open and must not be a standalone iModel.");

    const ctx = new ChangeSummaryExtractContext(iModel);

    const endChangeSetId: string = iModel.briefcase.reversedChangeSetId || iModel.briefcase.changeSetId;
    assert(endChangeSetId.length !== 0);

    let startChangeSetId: string = "";
    if (options) {
      if (options.startChangeSetId)
        startChangeSetId = options.startChangeSetId;
      else if (options.currentChangeSetOnly) {
        startChangeSetId = endChangeSetId;
      }
    }

    const totalPerf = new PerfLogger(`ChangeSummaryManager.extractChangeSummaries [Changesets: ${startChangeSetId} through ${endChangeSetId}, iModel: ${ctx.iModelId}]`);

    // download necessary changesets if they were not downloaded before and retrieve infos about those changesets
    let perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Retrieve ChangeSetInfos and download ChangeSets from Hub");
    const changeSetInfos: ChangeSet[] = await ChangeSummaryManager.downloadChangeSets(ctx, startChangeSetId, endChangeSetId);
    perfLogger.dispose();

    perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Open or create local Changes file");
    const changesFile: ECDb = ChangeSummaryManager.openOrCreateChangesFile(iModel);
    perfLogger.dispose();

    if (!changesFile || !changesFile.nativeDb) {
      assert(false, "Should not happen as an exception should have been thrown in that case");
      throw new IModelError(IModelStatus.BadArg, "Failed to create Change Cache file.");
    }

    try {
      const changeSetsFolder: string = BriefcaseManager.getChangeSetsPath(ctx.iModelId);
      const userInfoCache = new Map<string, string>();

      // extract summaries from end changeset through start changeset, so that we only have to go back in history
      const changeSetCount: number = changeSetInfos.length;
      const endChangeSetIx: number = changeSetCount - 1;
      for (let i = endChangeSetIx; i >= 0; i--) {
        const currentChangeSetInfo: ChangeSet = changeSetInfos[i];
        const currentChangeSetId: string = currentChangeSetInfo.wsgId;

        if (ChangeSummaryManager.isSummaryAlreadyExtracted(changesFile, currentChangeSetId))
          continue;

        // iModel is at end changeset, so no need to reverse for it.
        if (i !== endChangeSetIx) {
          perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Roll iModel to previous changeset");
          await iModel.reverseChanges(ctx.accessToken, IModelVersion.asOfChangeSet(currentChangeSetId));
          perfLogger.dispose();
        }

        const changeSetFilePath: string = path.join(changeSetsFolder, currentChangeSetInfo.fileName!);
        if (!IModelJsFs.existsSync(changeSetFilePath))
          throw new IModelError(IModelStatus.FileNotFound, "Failed to extract change summary: Changeset file '" + changeSetFilePath + "' does not exist.");

        perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Extract ChangeSummary");
        const stat: ErrorStatusOrResult<DbResult, string> = iModel.nativeDb.extractChangeSummary(changesFile.nativeDb, changeSetFilePath);
        perfLogger.dispose();
        if (stat.error && stat.error.status !== DbResult.BE_SQLITE_OK)
          throw new IModelError(stat.error.status, stat.error.message);

        perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Add ChangeSet info to ChangeSummary");
        const changeSummaryId = new Id64(stat.result!);

        let userEmail: string | undefined; // undefined means that no user information is stored along with changeset
        if (currentChangeSetInfo.userCreated) {
          const userId: string = currentChangeSetInfo.userCreated;
          const foundUserEmail: string | undefined = userInfoCache.get(userId);
          if (!foundUserEmail) {
            const userInfo: UserInfo = (await BriefcaseManager.hubClient.Users().get(ctx.accessToken, ctx.iModelId, new UserInfoQuery().byId(userId)))[0];
            userEmail = userInfo.email;
            // in the cache, add empty e-mail to mark that this user has already been looked up
            userInfoCache.set(userId, userEmail !== undefined ? userEmail : "");
          } else
            userEmail = foundUserEmail.length !== 0 ? foundUserEmail : undefined;
        }

        ChangeSummaryManager.addExtendedInfos(changesFile, changeSummaryId, currentChangeSetId, currentChangeSetInfo.parentId, currentChangeSetInfo.pushDate, userEmail);
        perfLogger.dispose();
      }

      changesFile.saveChanges();
    } finally {
      changesFile.dispose();

      perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Move iModel to original changeset");
      await iModel.reinstateChanges(ctx.accessToken, IModelVersion.asOfChangeSet(endChangeSetId));
      perfLogger.dispose();

      totalPerf.dispose();
    }
  }

  private static async downloadChangeSets(ctx: ChangeSummaryExtractContext, startChangeSetId: string, endChangeSetId: string): Promise<ChangeSet[]> {
    // Get the change set before the startChangeSet so that startChangeSet is included in the download and processing
    let beforeStartChangeSetId: string;
    if (startChangeSetId.length === 0)
      beforeStartChangeSetId = "";
    else {
      const query = new ChangeSetQuery();
      query.byId(startChangeSetId);

      const changeSets: ChangeSet[] = await BriefcaseManager.hubClient.ChangeSets().get(ctx.accessToken, ctx.iModelId, query);
      if (changeSets.length === 0)
        return Promise.reject(`Unable to find change set ${startChangeSetId} for iModel ${ctx.iModelId}`);

      const changeSetInfo: ChangeSet = changeSets[0];

      beforeStartChangeSetId = !changeSetInfo.parentId ? "" : changeSetInfo.parentId;
    }

    const changeSetInfos: ChangeSet[] = await BriefcaseManager.downloadChangeSets(ctx.accessToken, ctx.iModelId, beforeStartChangeSetId, endChangeSetId);
    assert(startChangeSetId.length === 0 || startChangeSetId === changeSetInfos[0].wsgId);
    assert(endChangeSetId === changeSetInfos[changeSetInfos.length - 1].wsgId);
    return changeSetInfos;
  }

  private static openOrCreateChangesFile(iModel: IModelDb): ECDb {
    if (!iModel || !iModel.briefcase || !iModel.briefcase.isOpen)
      throw new IModelError(IModelStatus.BadArg, "Invalid iModel handle. iModel but be open.");

    const changesFile = new ECDb();
    const changesPath: string = BriefcaseManager.getChangeSummaryPathname(iModel.briefcase.iModelId);
    if (IModelJsFs.existsSync(changesPath)) {
      changesFile.openDb(changesPath, OpenMode.ReadWrite);
      return changesFile;
    }

    try {
      ChangeSummaryManager.createChangesFile(iModel, changesFile, changesPath);
      return changesFile;
    } catch (e) {
      // delete cache file again in case it was created but schema import failed
      if (IModelJsFs.existsSync(changesPath))
        IModelJsFs.removeSync(changesPath);

      throw e;
    }
  }

  private static createChangesFile(iModel: IModelDb, changesFile: ECDb, changesFilePath: string): void {
    if (!iModel || !iModel.briefcase || !iModel.briefcase.isOpen)
      throw new IModelError(IModelStatus.BadArg, "Invalid iModel object. iModel but be open.");

    assert(iModel.nativeDb);
    const stat: DbResult = iModel.nativeDb.createChangeCache(changesFile.nativeDb, changesFilePath);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Failed to create Change Cache file at '" + changesFilePath + "'.");

    // Extended information like changeset ids, push dates are persisted in the IModelChange ECSchema
    changesFile.importSchema(ChangeSummaryManager.getExtendedSchemaPath());
  }

  private static getExtendedSchemaPath(): string {
    return path.join(KnownLocations.platformAssetsDir, "IModelChange.01.00.ecschema.xml");
  }

  private static isSummaryAlreadyExtracted(changesFile: ECDb, changeSetId: string): boolean {
    return changesFile.withPreparedStatement("SELECT 1 FROM imodelchange.ChangeSet WHERE WsgId=?",
      (stmt: ECSqlStatement) => {
        stmt.bindString(1, changeSetId);
        return DbResult.BE_SQLITE_ROW === stmt.step();
      });
  }

  private static addExtendedInfos(changesFile: ECDb, changeSummaryId: Id64, changesetWsgId: string, changesetParentWsgId?: string, changesetPushDate?: string, changeSetAuthor?: string): void {
    changesFile.withPreparedStatement("INSERT INTO imodelchange.ChangeSet(Summary.Id,WsgId,ParentWsgId,PushDate,Author) VALUES(?,?,?,?,?)",
      (stmt: ECSqlStatement) => {
        stmt.bindId(1, changeSummaryId);
        stmt.bindString(2, changesetWsgId);
        if (changesetParentWsgId)
          stmt.bindString(3, changesetParentWsgId);

        if (changesetPushDate)
          stmt.bindDateTime(4, changesetPushDate);

        if (changeSetAuthor)
          stmt.bindString(5, changeSetAuthor);

        const r: DbResult = stmt.step();
        if (r !== DbResult.BE_SQLITE_DONE)
          throw new IModelError(r, "Failed to add changeset information to extracted change summary " + changeSummaryId);
      });
  }

  /** Queries the ChangeSummary for the specified change summary id
   *
   * See also [Change Summary Overview]($docs/learning/ChangeSummaries)
   * @param iModel iModel
   * @param changeSummaryId ECInstanceId of the ChangeSummary
   * @returns Returns the requested ChangeSummary object
   * @throws [IModelError]($common) If change summary does not exist for the specified id, or if the
   * change cache file hasn't been attached, or in case of other errors.
   */
  public static queryChangeSummary(iModel: IModelDb, changeSummaryId: Id64): ChangeSummary {
    if (!ChangeSummaryManager.isChangeCacheAttached(iModel))
      throw new IModelError(IModelStatus.BadArg, "Change Cache file must be attached to iModel.");

    return iModel.withPreparedStatement("SELECT WsgId,ParentWsgId,PushDate,Author FROM ecchange.imodelchange.ChangeSet WHERE Summary.Id=?",
      (stmt: ECSqlStatement) => {
        stmt.bindId(1, changeSummaryId);
        if (stmt.step() !== DbResult.BE_SQLITE_ROW)
          throw new IModelError(IModelStatus.BadArg, `No ChangeSet information found for ChangeSummary ${changeSummaryId.value}.`);

        const row = stmt.getRow();
        return { id: changeSummaryId, changeSet: { wsgId: row.wsgId, parentWsgId: row.parentWsgId, pushDate: row.pushDate, author: row.author } };
      });
  }

  /** Queries the InstanceChange for the specified instance change id.
   *
   * See also [Change Summary Overview]($docs/learning/ChangeSummaries)
   *
   * @param iModel iModel
   * @param instanceChangeId ECInstanceId of the InstanceChange (see `ECDbChange.InstanceChange` ECClass in the *ECDbChange* ECSchema)
   * @returns Returns the requested InstanceChange object
   * @throws [IModelError]($common) if instance change does not exist for the specified id, or if the
   * change cache file hasn't been attached, or in case of other errors.
   */
  public static queryInstanceChange(iModel: IModelDb, instanceChangeId: Id64): InstanceChange {
    if (!ChangeSummaryManager.isChangeCacheAttached(iModel))
      throw new IModelError(IModelStatus.BadArg, "Change Cache file must be attached to iModel.");

    // query instance changes
    const instanceChange: InstanceChange = iModel.withPreparedStatement(`SELECT ic.Summary.Id summaryId, s.Name changedInstanceSchemaName, c.Name changedInstanceClassName, ic.ChangedInstance.Id changedInstanceId,
          ic.OpCode, ic.IsIndirect FROM ecchange.change.InstanceChange ic JOIN main.meta.ECClassDef c ON c.ECInstanceId=ic.ChangedInstance.ClassId
          JOIN main.meta.ECSchemaDef s ON c.Schema.Id=s.ECInstanceId WHERE ic.ECInstanceId=?`, (stmt: ECSqlStatement) => {
        stmt.bindId(1, instanceChangeId);
        if (stmt.step() !== DbResult.BE_SQLITE_ROW)
          throw new IModelError(IModelStatus.BadArg, `No InstanceChange found for id ${instanceChangeId.value}.`);

        const row = stmt.getRow();
        const changedInstanceId = new Id64(row.changedInstanceId);
        const changedInstanceClassName: string = "[" + row.changedInstanceSchemaName + "].[" + row.changedInstanceClassName + "]";
        const op: ChangeOpCode = row.opCode as ChangeOpCode;

        return {
          id: instanceChangeId, summaryId: new Id64(row.summaryId), changedInstance: { id: changedInstanceId, className: changedInstanceClassName },
          opCode: op, isIndirect: row.isIndirect, changedProperties: { before: undefined, after: undefined },
        };
      });

    switch (instanceChange.opCode) {
      case ChangeOpCode.Insert:
        instanceChange.changedProperties.after = ChangeSummaryManager.queryPropertyValueChanges(iModel, instanceChange, ChangedValueState.AfterInsert);
        break;

      case ChangeOpCode.Update:
        instanceChange.changedProperties.before = ChangeSummaryManager.queryPropertyValueChanges(iModel, instanceChange, ChangedValueState.BeforeUpdate);
        instanceChange.changedProperties.after = ChangeSummaryManager.queryPropertyValueChanges(iModel, instanceChange, ChangedValueState.AfterUpdate);
        break;

      case ChangeOpCode.Delete:
        instanceChange.changedProperties.before = ChangeSummaryManager.queryPropertyValueChanges(iModel, instanceChange, ChangedValueState.BeforeDelete);
        break;
    }

    return instanceChange;
  }

  private static queryPropertyValueChanges(iModel: IModelDb, instanceChange: InstanceChange, changedValueState: ChangedValueState): object {
    // query property value changes just to build a SELECT statement against the class of the changed instance
    let propValECSql: string = "SELECT ";
    iModel.withPreparedStatement("SELECT AccessString FROM ecchange.change.PropertyValueChange WHERE InstanceChange.Id=?",
      (stmt: ECSqlStatement) => {
        stmt.bindId(1, instanceChange.id);
        let isFirstRow: boolean = true;
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          if (!isFirstRow)
            propValECSql += ",";

          // access string tokens need to be escaped as they might collide with reserved words in ECSQL or SQLite
          const accessString: string = stmt.getValue(0).getString();
          const accessStringTokens: string[] = accessString.split(".");
          assert(accessStringTokens.length > 0);
          let isFirstToken: boolean = true;
          for (const token of accessStringTokens) {
            if (!isFirstToken)
              propValECSql += ".";

            propValECSql += "[" + token + "]";
            isFirstToken = false;
          }

          isFirstRow = false;
        }
      });

    propValECSql += " FROM main." + instanceChange.changedInstance.className + ".Changes(?," + changedValueState + ") WHERE ECInstanceId=?";
    return iModel.withPreparedStatement(propValECSql, (stmt: ECSqlStatement) => {
      stmt.bindId(1, instanceChange.summaryId);
      stmt.bindId(2, instanceChange.changedInstance.id);
      if (stmt.step() !== DbResult.BE_SQLITE_ROW)
        throw new IModelError(IModelStatus.BadArg, `No property value changes found for InstanceChange ${instanceChange.id.value}.`);

      return stmt.getRow();
    });
  }
}
