/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, ChangeSet, UserInfo, IModelHubClient } from "@bentley/imodeljs-clients";
import { ErrorStatusOrResult } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { Id64, using, assert, PerfLogger, OpenMode, DbResult } from "@bentley/bentleyjs-core";
import { iModelHost } from "./IModelHost";
import { IModelDb } from "./IModelDb";
import { ECDb } from "./ECDb";
import { IModelVersion, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { BriefcaseManager } from "./BriefcaseManager";
import * as path from "path";
import { IModelJsFs } from "./IModelJsFs";
import { KnownLocations } from "./KnownLocations";

/** Equivalent of the ECEnumeration OpCode in the ECDbChange ECSchema */
export enum ChangeOpCode {
  Insert = 1,
  Update = 2,
  Delete = 4,
}

/** The enum represents the values for the ChangedValueState argument of the ECSQL function
 *  Changes.
 * The enum can be used when programmatically binding values to the ChangedValueState argument
 * in an ECSQL using the Changes ECSQL function.
 */
export enum ChangedValueState {
  AfterInsert = 1,
  BeforeUpdate = 2,
  AfterUpdate = 3,
  BeforeDelete = 4,
}

export interface ChangeSummary {
  id: Id64;
  changeSet: { wsgId: string, parentWsgId: string, pushDate: string, author: string };
}

export interface InstanceChange {
  id: Id64;
  summaryId: Id64;
  changedInstance: { id: Id64, className: string };
  opCode: ChangeOpCode;
  isIndirect: boolean;
  changedProperties: { before: any, after: any };
}

/** Class to extract change summaries for a briefcase. */
export class ChangeSummaryManager {
  /** Determines whether the Changes cache file is attached to the specified iModel or not
   * @param iModel iModel to check whether a Changes cache file is attached
   * @returns Returns true if the Changes cache file is attached to the iModel. false otherwise
   */
  public static isChangeCacheAttached(iModel: IModelDb): boolean {
    if (iModel == null || iModel.nativeDb == null)
      throw new IModelError(IModelStatus.BadRequest);

    return iModel.nativeDb.isChangeCacheAttached();
  }

  /** Attaches the Changes cache file to the specified iModel if it hasn't been attached yet.
   * A new Changes cache file will be created for the iModel if it hasn't existed before.
   * @param iModel iModel to attach the Changes cache file to
   * @throws [[IModelError]]
   */
  public static attachChangeCache(iModel: IModelDb): void {
    if (iModel == null || iModel.briefcase == null || iModel.briefcase.nativeDb == null)
      throw new IModelError(IModelStatus.BadRequest);

    if (iModel.briefcase.nativeDb!.isChangeCacheAttached())
      return;

    const changesCacheFilePath: string = BriefcaseManager.getChangeSummaryPathname(iModel.briefcase.iModelId);
    if (!IModelJsFs.existsSync(changesCacheFilePath)) {
      using(new ECDb(), (changesFile) => {
        ChangeSummaryManager.createChangesFile(iModel, changesFile, changesCacheFilePath);
      });
    }

    assert(IModelJsFs.existsSync(changesCacheFilePath));
    const res: DbResult = iModel.briefcase.nativeDb!.attachChangeCache(changesCacheFilePath);
    if (res !== DbResult.BE_SQLITE_OK)
      throw new IModelError(res, `Failed to attach Changes cache file to ${iModel.briefcase.pathname}.`);
  }

  /** Extracts change summaries from the specified range of changesets
   * @param accessToken Delegation token of the authorized user.
   * @param contextId Id of the Connect Project or Asset containing the iModel
   * @param iModelId Id of the iModel
   * @param startChangeSetId Changeset Id of the starting changeset to extract from (including this changeset).
   * If undefined, the first changeset of the iModel is used.
   * @param endChangeSetId Changeset Id of the end changeset to extract from (including this changeset).
   * If undefined, the latest changeset of the iModel is used.
   * @throws [[IModelError]]
   */
  public static async extractChangeSummaries(accessToken: AccessToken, contextId: string, iModelId: string,
    startChangeSetId?: string, endChangeSetId?: string): Promise<void> {

    const startChangesetIdStr: string = startChangeSetId !== undefined ? startChangeSetId : "first";
    const endChangesetIdStr: string = endChangeSetId !== undefined ? endChangeSetId : "latest";
    const totalPerf = new PerfLogger(`ChangeSummaryManager.extractChangeSummaries [Changesets: ${startChangesetIdStr} through ${endChangesetIdStr}, iModel: ${iModelId}, contextid: ${contextId}]`);

    let perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Open iModel");

    // TODO: open the imodel readonly and in exclusive ownership as we go back in history. Needs changes in BriefcaseManager.
    const iModel: IModelDb = await IModelDb.open(accessToken, contextId, iModelId, OpenMode.ReadWrite, IModelVersion.latest());
    if (iModel === undefined || iModel.nativeDb === undefined)
      throw new IModelError(IModelStatus.BadArg);

    perfLogger.dispose();

    perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Retrieve ChangeSetInfos from Hub");
    const hubClient = new IModelHubClient(iModelHost.configuration.iModelHubDeployConfig);

    const changeSetInfos: ChangeSet[] = await this.retrieveChangeSetInfos(hubClient, accessToken, iModelId, startChangeSetId, endChangeSetId);
    assert(startChangeSetId === undefined || startChangeSetId === changeSetInfos[0].wsgId);
    assert(endChangeSetId === undefined || endChangeSetId === changeSetInfos[changeSetInfos.length - 1].wsgId);
    perfLogger.dispose();

    perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Open or create local Changes file");
    const changesFile: ECDb = ChangeSummaryManager.openOrCreateChangesFile(iModel);
    perfLogger.dispose();
    if (changesFile === undefined || changesFile.nativeDb === undefined)
      throw new IModelError(IModelStatus.BadArg);

    try {
      const changeSetsFolder: string = BriefcaseManager.getChangeSetsPath(iModelId);
      const userInfoCache = new Map<string, string>();

      // extract summaries from end changeset through start changeset, so that we only have to go back in history
      for (const changeSetInfo of changeSetInfos.reverse()) {
        const currentChangeSetId: string = changeSetInfo.wsgId;

        perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Roll iModel to previous changeset");
        await iModel.reverseChanges(accessToken, IModelVersion.asOfChangeSet(currentChangeSetId));
        perfLogger.dispose();

        if (ChangeSummaryManager.isSummaryAlreadyExtracted(changesFile, currentChangeSetId))
          continue;

        const changeSetFilePath: string = path.join(changeSetsFolder, changeSetInfo.fileName!);
        perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Extract ChangeSummary");
        const stat: ErrorStatusOrResult<DbResult, string> = iModel.nativeDb.extractChangeSummary(changesFile.nativeDb, changeSetFilePath);
        perfLogger.dispose();
        if (stat.error != null && stat.error!.status !== DbResult.BE_SQLITE_OK)
          throw new IModelError(stat.error!.status);

        perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Add ChangeSet info to ChangeSummary");
        const changeSummaryId = new Id64(stat.result!);

        let userEmail: string | undefined; // undefined means that no user information is stored along with changeset
        if (changeSetInfo.userCreated !== undefined) {
          const userId: string = changeSetInfo.userCreated!;
          const foundUserEmail: string | undefined = userInfoCache.get(userId);
          if (foundUserEmail === undefined) {
            const userInfo: UserInfo = await hubClient.getUserInfo(accessToken, iModelId, userId);
            userEmail = userInfo.email;
            // in the cache, add empty e-mail to mark that this user has already been looked up
            userInfoCache.set(userId, userEmail !== undefined ? userEmail : "");
          } else
            userEmail = foundUserEmail.length !== 0 ? foundUserEmail : undefined;
        }

        ChangeSummaryManager.addExtendedInfos(changesFile, changeSummaryId, currentChangeSetId, changeSetInfo.parentId, changeSetInfo.pushDate, userEmail);
        perfLogger.dispose();
      }

      changesFile.saveChanges();
    } finally {
      changesFile.dispose();

      try {
        perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Move iModel to original changeset");
        await iModel.reinstateChanges(accessToken, IModelVersion.latest());
        perfLogger.dispose();
      } finally { await iModel.close(accessToken); }

      totalPerf.dispose();
    }
  }

  private static async retrieveChangeSetInfos(hubClient: IModelHubClient, accessToken: AccessToken, iModelId: string, startChangeSetId?: string, endChangeSetId?: string): Promise<ChangeSet[]> {
    const changeSetInfos: ChangeSet[] = await hubClient.getChangeSets(accessToken, iModelId, false, startChangeSetId);

    // getChangeSets does not retrieve the specified from-changeset itself, but only its direct child. So we must retrieve the from-changeset
    // ourselves first
    if (startChangeSetId !== undefined) {
      const startChangeSetInfo: ChangeSet = await hubClient.getChangeSet(accessToken, iModelId, startChangeSetId, false);
      changeSetInfos.unshift(startChangeSetInfo);
    }

    if (endChangeSetId === undefined || changeSetInfos.length === 0)
      return changeSetInfos;

    let endChangeSetIx: number = -1;
    for (let i = 0; i < changeSetInfos.length; i++) {
      if (changeSetInfos[i].wsgId === endChangeSetId) {
        endChangeSetIx = i;
        break;
      }
    }

    if (endChangeSetIx === changeSetInfos.length - 1)
      return changeSetInfos;

    if (endChangeSetIx < 0) {
      const errorMsg: string = startChangeSetId !== undefined ? `Invalid ChangeSet ${endChangeSetId} for iModel ${iModelId}. It does not exist.` :
        `Invalid ChangeSet ${endChangeSetId} for iModel ${iModelId}. It either does not exist or it is not a successor of the start changeset ${startChangeSetId}.`;
      throw new IModelError(IModelStatus.BadArg, errorMsg);
    }

    const deleteIx: number = endChangeSetIx + 1;
    changeSetInfos.splice(deleteIx, changeSetInfos.length - deleteIx);
    return changeSetInfos;
  }

  private static openOrCreateChangesFile(iModel: IModelDb): ECDb {
    if (iModel == null || iModel.briefcase == null || !iModel.briefcase.isOpen)
      throw new IModelError(IModelStatus.BadArg);

    const changesFile = new ECDb();
    const changesPath: string = BriefcaseManager.getChangeSummaryPathname(iModel.briefcase.iModelId);
    if (IModelJsFs.existsSync(changesPath)) {
      changesFile.openDb(changesPath, OpenMode.ReadWrite);
      return changesFile;
    }

    ChangeSummaryManager.createChangesFile(iModel, changesFile, changesPath);
    return changesFile;
  }

  private static createChangesFile(iModel: IModelDb, changesFile: ECDb, changesFilePath: string): void {
    if (iModel == null || iModel.briefcase == null || !iModel.briefcase.isOpen)
      throw new IModelError(IModelStatus.BadArg);

    assert(iModel.nativeDb != null);
    const stat: DbResult = iModel.nativeDb.createChangeCache(changesFile.nativeDb, changesFilePath);
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat);

    // Extended information like changeset ids, push dates are persisted in the IModelChange ECSchema
    changesFile.importSchema(ChangeSummaryManager.getExtendedSchemaPath());
  }

  private static getExtendedSchemaPath(): string {
    return path.join(KnownLocations.assetsDir, "IModelChange.01.00.ecschema.xml");
  }

  private static isSummaryAlreadyExtracted(changesFile: ECDb, changeSetId: string): boolean {
    return changesFile.withPreparedStatement("SELECT 1 FROM imodelchange.ChangeSet WHERE WsgId=?",
      (stmt) => {
        stmt.bindString(1, changeSetId);
        return DbResult.BE_SQLITE_ROW === stmt.step();
      });
  }

  private static addExtendedInfos(changesFile: ECDb, changeSummaryId: Id64, changesetWsgId: string, changesetParentWsgId?: string, changesetPushDate?: string, changeSetAuthor?: string): void {
    changesFile.withPreparedStatement("INSERT INTO imodelchange.ChangeSet(Summary.Id,WsgId,ParentWsgId,PushDate,Author) VALUES(?,?,?,?,?)",
      (stmt) => {
        stmt.bindId(1, changeSummaryId);
        stmt.bindString(2, changesetWsgId);
        if (changesetParentWsgId !== undefined)
          stmt.bindString(3, changesetParentWsgId);

        if (changesetPushDate !== undefined)
          stmt.bindDateTime(4, changesetPushDate);

        if (changeSetAuthor !== undefined)
          stmt.bindString(5, changeSetAuthor);

        const r: DbResult = stmt.step();
        if (r !== DbResult.BE_SQLITE_DONE)
          throw new IModelError(r, "Failed to add changeset information to extracted change summary " + changeSummaryId);
      });
  }

  /** Queries the ChangeSummary for the specified change summary id
   * @param iModel iModel
   * @param changeSummaryId ECInstanceId of the ChangeSummary (see ECDbChange.ChangeSummary ECClass)
   * @returns Returns the requested ChangeSummary object
   * @throws [[IModelError]] If change summary does not exist for the specified id, or if the
   * change cache file hasn't been attached, or in case of other errors.
   */
  public static queryChangeSummary(iModel: IModelDb, changeSummaryId: Id64): ChangeSummary {
    if (!ChangeSummaryManager.isChangeCacheAttached(iModel))
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Change cache must be attached to iModel.");

    return iModel.withPreparedStatement("SELECT WsgId,ParentWsgId,PushDate,Author FROM ecchange.imodelchange.ChangeSet WHERE Summary.Id=?", (stmt) => {
      stmt.bindId(1, changeSummaryId);
      if (stmt.step() !== DbResult.BE_SQLITE_ROW)
        throw new IModelError(DbResult.BE_SQLITE_ERROR, `No ChangeSet information found for ChangeSummary ${changeSummaryId.value}.`);

      const row = stmt.getRow();
      return { id: changeSummaryId, changeSet: { wsgId: row.wsgId, parentWsgId: row.parentWsgId, pushDate: row.pushDate, author: row.author } };
    });
  }

  /** Queries the InstanceChange for the specified instance change id
   * @param iModel iModel
   * @param instanceChangeId ECInstanceId of the InstanceChange (see ECDbChange.InstanceChange ECClass)
   * @returns Returns the requested InstanceChange object
   * @throws [[IModelError]] if instance change does not exist for the specified id, or if the
   * change cache file hasn't been attached, or in case of other errors.
   */
  public static queryInstanceChange(iModel: IModelDb, instanceChangeId: Id64): InstanceChange {
    if (!ChangeSummaryManager.isChangeCacheAttached(iModel))
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Change cache must be attached to iModel.");

    // query instance changes
    const instanceChange: InstanceChange = iModel.withPreparedStatement(`SELECT ic.Summary.Id summaryId, s.Name changedInstanceSchemaName, c.Name changedInstanceClassName, ic.ChangedInstance.Id changedInstanceId,
          ic.OpCode, ic.IsIndirect FROM ecchange.change.InstanceChange ic JOIN main.meta.ECClassDef c ON c.ECInstanceId=ic.ChangedInstance.ClassId
          JOIN main.meta.ECSchemaDef s ON c.Schema.Id=s.ECInstanceId WHERE ic.ECInstanceId=?`, (stmt) => {
        stmt.bindId(1, instanceChangeId);
        if (stmt.step() !== DbResult.BE_SQLITE_ROW)
          throw new IModelError(DbResult.BE_SQLITE_ERROR, `No InstanceChange found for id ${instanceChangeId.value}.`);

        const row = stmt.getRow();
        const changedInstanceId = new Id64(row.changedInstanceId);
        const changedInstanceClassName: string = row.changedInstanceSchemaName + "." + row.changedInstanceClassName;
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
    iModel.withPreparedStatement("SELECT AccessString FROM ecchange.change.PropertyValueChange WHERE InstanceChange.Id=?", (stmt) => {
      stmt.bindId(1, instanceChange.id);
      let isFirstRow: boolean = true;
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        if (!isFirstRow)
          propValECSql += ",";

        const propChangeRow = stmt.getRow();
        propValECSql += propChangeRow.accessString;
        isFirstRow = false;
      }
    });

    propValECSql += " FROM main." + instanceChange.changedInstance.className + ".Changes(?," + changedValueState + ") WHERE ECInstanceId=?";
    return iModel.withPreparedStatement(propValECSql, (stmt) => {
      stmt.bindId(1, instanceChange.summaryId);
      stmt.bindId(2, instanceChange.changedInstance.id);
      if (stmt.step() !== DbResult.BE_SQLITE_ROW)
        throw new IModelError(DbResult.BE_SQLITE_ERROR, `No property value changes found for InstanceChange ${instanceChange.id.value}.`);

      return stmt.getRow();
    });
  }
}
