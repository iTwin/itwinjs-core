/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModels */

import { AccessToken, ChangeSet, UserInfo, IModelHubClient, ChangeSetQuery, UserInfoQuery, AzureFileHandler } from "@bentley/imodeljs-clients";
import { ErrorStatusOrResult } from "@bentley/imodeljs-native-platform-api";
import { Id64, using, assert, PerfLogger, OpenMode, DbResult } from "@bentley/bentleyjs-core";
import { IModelHost } from "./IModelHost";
import { IModelDb } from "./IModelDb";
import { ECDb } from "./ECDb";
import { ECSqlStatement } from "./ECSqlStatement";
import { IModelVersion, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { BriefcaseManager } from "./BriefcaseManager";
import * as path from "path";
import { IModelJsFs } from "./IModelJsFs";
import { KnownLocations } from "./Platform";

/** Equivalent of the ECEnumeration OpCode in the `ECDbChange` ECSchema */
export enum ChangeOpCode {
  Insert = 1,
  Update = 2,
  Delete = 4,
}

/** The enum represents the values for the ChangedValueState argument of the ECSQL function
 *  **Changes**.
 * The enum can be used when programmatically binding values to the ChangedValueState argument
 * in an ECSQL using the **Changes** ECSQL function.
 */
export enum ChangedValueState {
  AfterInsert = 1,
  BeforeUpdate = 2,
  AfterUpdate = 3,
  BeforeDelete = 4,
}

/** Represents an instance of the `ChangeSummary` ECClass from the `ECDbChange` ECSchema
 *
 *  See also [ChangeSummaryManager.queryChangeSummary]($imodeljs-backend.ChangeSummaryManager.queryChangeSummary)
 */
export interface ChangeSummary {
  id: Id64;
  changeSet: { wsgId: string, parentWsgId: string, pushDate: string, author: string };
}

/** Represents an instance of the `InstanceChange` ECClass from the `ECDbChange` ECSchema
 *
 *  See also [ChangeSummaryManager.queryInstanceChange]($imodeljs-backend.ChangeSummaryManager.queryInstanceChange)
 */
export interface InstanceChange {
  id: Id64;
  summaryId: Id64;
  changedInstance: { id: Id64, className: string };
  opCode: ChangeOpCode;
  isIndirect: boolean;
  changedProperties: { before: any, after: any };
}

/** Options for [ChangeSummaryManager.extractChangeSummaries]($imodeljs-backend.ChangeSummaryManager.extractChangeSummaries). */
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

/** Class to extract change summaries for a briefcase. */
export class ChangeSummaryManager {
  /** Determines whether the Changes cache file is attached to the specified iModel or not
   * @param iModel iModel to check whether a Changes cache file is attached
   * @returns Returns true if the Changes cache file is attached to the iModel. false otherwise
   */
  public static isChangeCacheAttached(iModel: IModelDb): boolean {
    if (!iModel || !iModel.nativeDb)
      throw new IModelError(IModelStatus.BadRequest);

    return iModel.nativeDb.isChangeCacheAttached();
  }

  /** Attaches the Changes cache file to the specified iModel if it hasn't been attached yet.
   * A new Changes cache file will be created for the iModel if it hasn't existed before.
   * @param iModel iModel to attach the Changes cache file to
   * @throws [IModelError]($imodeljs-common.IModelError)
   */
  public static attachChangeCache(iModel: IModelDb): void {
    if (!iModel || !iModel.briefcase || !iModel.nativeDb)
      throw new IModelError(IModelStatus.BadRequest);

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
      throw new IModelError(res, `Failed to attach Changes cache file to ${iModel.briefcase.pathname}.`);
  }

  /** Detaches the ECChanges cache file from the specified iModel.
   * @param iModel iModel to detach the ECChanges cache file to
   * @throws [IModelError]($imodeljs-common.IModelError) in case of errors, e.g. if no ECChanges cache was attached before.
   */
  public static detachChangeCache(iModel: IModelDb): void {
    if (!iModel || !iModel.briefcase || !iModel.nativeDb)
      throw new IModelError(IModelStatus.BadRequest);

    iModel.clearStatementCache();
    const res: DbResult = iModel.nativeDb.detachChangeCache();
    if (res !== DbResult.BE_SQLITE_OK)
      throw new IModelError(res, `Failed to detach ECChanges cache file from ${iModel.briefcase.pathname}.`);
  }

  /** Extracts change summaries from the specified iModel.
   * Change summaries are extracted from the specified startChangeSetId up through the change set the iModel was opened with.
   * If startChangeSetId is undefined, the first changeset will be used.
   * @param iModel iModel to extract change summaries for. The iModel must not be a standalone iModel, and it must be opened
   * with [OpenMode.ReadWrite]($bentleyjs-core.OpenMode.ReadWrite).
   * Note: The method moves the history of the iModel back to the specified start changeset. After the extraction has completed,
   * the iModel is moved back to the original changeset.
   * @param options Extraction options
   * @throws [IModelError]($imodeljs-common.IModelError) if the iModel is standalone,r was not opened in readwrite mode.
   */
  public static async extractChangeSummaries(iModel: IModelDb, options?: ChangeSummaryExtractOptions): Promise<void> {
    // TODO: iModel must be opened in exclusive mode (needs change in BriefcaseManager)
    if (!iModel || !iModel.briefcase || !iModel.briefcase.isOpen || iModel.isReadonly() || iModel.briefcase.isStandalone)
      throw new IModelError(IModelStatus.BadArg, "iModel to extract change summaries for must be open in readwrite mode and must not be a standalone iModel.");

    const iModelId: string = iModel.briefcase.iModelId;
    const endChangeSetId: string = iModel.briefcase.reversedChangeSetId || iModel.briefcase.changeSetId;
    assert(endChangeSetId.length !== 0);

    let startChangeSetId: string | undefined;
    if (options) {
      if (options.startChangeSetId)
        startChangeSetId = options.startChangeSetId;
      else if (options.currentChangeSetOnly) {
        startChangeSetId = endChangeSetId;
      }
    }

    const totalPerf = new PerfLogger(`ChangeSummaryManager.extractChangeSummaries [Changesets: ${startChangeSetId} through ${endChangeSetId}, iModel: ${iModelId}]`);

    let perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Retrieve ChangeSetInfos from Hub");
    const hubClient = new IModelHubClient(IModelHost.configuration!.iModelHubDeployConfig, new AzureFileHandler());

    const accessToken: AccessToken = IModelDb.getAccessToken(iModelId);
    const changeSetInfos: ChangeSet[] = await this.retrieveChangeSetInfos(hubClient, accessToken, iModelId, endChangeSetId, startChangeSetId);
    assert(!startChangeSetId || startChangeSetId === changeSetInfos[0].wsgId);
    assert(endChangeSetId === changeSetInfos[changeSetInfos.length - 1].wsgId);
    perfLogger.dispose();

    perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Open or create local Changes file");
    const changesFile: ECDb = ChangeSummaryManager.openOrCreateChangesFile(iModel);
    perfLogger.dispose();
    if (!changesFile || !changesFile.nativeDb)
      throw new IModelError(IModelStatus.BadArg);

    try {
      const changeSetsFolder: string = BriefcaseManager.getChangeSetsPath(iModelId);
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
          await iModel.reverseChanges(accessToken, IModelVersion.asOfChangeSet(currentChangeSetId));
          perfLogger.dispose();
        }

        const changeSetFilePath: string = path.join(changeSetsFolder, currentChangeSetInfo.fileName!);
        perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Extract ChangeSummary");
        const stat: ErrorStatusOrResult<DbResult, string> = iModel.nativeDb.extractChangeSummary(changesFile.nativeDb, changeSetFilePath);
        perfLogger.dispose();
        if (stat.error && stat.error.status !== DbResult.BE_SQLITE_OK)
          throw new IModelError(stat.error.status);

        perfLogger = new PerfLogger("ChangeSummaryManager.extractChangeSummaries>Add ChangeSet info to ChangeSummary");
        const changeSummaryId = new Id64(stat.result!);

        let userEmail: string | undefined; // undefined means that no user information is stored along with changeset
        if (currentChangeSetInfo.userCreated) {
          const userId: string = currentChangeSetInfo.userCreated;
          const foundUserEmail: string | undefined = userInfoCache.get(userId);
          if (!foundUserEmail) {
            const userInfo: UserInfo = (await hubClient.Users().get(accessToken, iModelId, new UserInfoQuery().byId(userId)))[0];
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
      await iModel.reinstateChanges(accessToken, IModelVersion.asOfChangeSet(endChangeSetId));
      perfLogger.dispose();

      totalPerf.dispose();
    }
  }

  private static async retrieveChangeSetInfos(hubClient: IModelHubClient, accessToken: AccessToken, iModelId: string, endChangeSetId: string, startChangeSetId?: string): Promise<ChangeSet[]> {
    if (startChangeSetId === endChangeSetId)
      return await hubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().byId(startChangeSetId));

    const query = new ChangeSetQuery();
    if (startChangeSetId)
      query.fromId(startChangeSetId);
    const changeSetInfos: ChangeSet[] = await hubClient.ChangeSets().get(accessToken, iModelId, query);

    // getChangeSets does not retrieve the specified from-changeset itself, but only its direct child. So we must retrieve the from-changeset
    // ourselves first
    if (startChangeSetId) {
      const startChangeSetInfo: ChangeSet = (await hubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().byId(startChangeSetId)))[0];
      changeSetInfos.unshift(startChangeSetInfo);
    }

    if (changeSetInfos.length === 0)
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
      const errorMsg: string = startChangeSetId !== undefined && startChangeSetId !== null ? `Invalid ChangeSet ${endChangeSetId} for iModel ${iModelId}. It does not exist.` :
        `Invalid ChangeSet ${endChangeSetId} for iModel ${iModelId}. It either does not exist or it is not a successor of the start changeset ${startChangeSetId}.`;
      throw new IModelError(IModelStatus.BadArg, errorMsg);
    }

    const deleteIx: number = endChangeSetIx + 1;
    changeSetInfos.splice(deleteIx, changeSetInfos.length - deleteIx);
    return changeSetInfos;
  }

  private static openOrCreateChangesFile(iModel: IModelDb): ECDb {
    if (!iModel || !iModel.briefcase || !iModel.briefcase.isOpen)
      throw new IModelError(IModelStatus.BadArg);

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
      throw new IModelError(IModelStatus.BadArg);

    assert(iModel.nativeDb);
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
   * @param iModel iModel
   * @param changeSummaryId ECInstanceId of the ChangeSummary (see `ECDbChange.ChangeSummary` ECClass)
   * @returns Returns the requested ChangeSummary object
   * @throws [IModelError]($imodeljs-common.IModelError) If change summary does not exist for the specified id, or if the
   * change cache file hasn't been attached, or in case of other errors.
   */
  public static queryChangeSummary(iModel: IModelDb, changeSummaryId: Id64): ChangeSummary {
    if (!ChangeSummaryManager.isChangeCacheAttached(iModel))
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Change cache must be attached to iModel.");

    return iModel.withPreparedStatement("SELECT WsgId,ParentWsgId,PushDate,Author FROM ecchange.imodelchange.ChangeSet WHERE Summary.Id=?",
    (stmt: ECSqlStatement) => {
      stmt.bindId(1, changeSummaryId);
      if (stmt.step() !== DbResult.BE_SQLITE_ROW)
        throw new IModelError(DbResult.BE_SQLITE_ERROR, `No ChangeSet information found for ChangeSummary ${changeSummaryId.value}.`);

      const row = stmt.getRow();
      return { id: changeSummaryId, changeSet: { wsgId: row.wsgId, parentWsgId: row.parentWsgId, pushDate: row.pushDate, author: row.author } };
    });
  }

  /** Queries the InstanceChange for the specified instance change id
   * @param iModel iModel
   * @param instanceChangeId ECInstanceId of the InstanceChange (see `ECDbChange.InstanceChange` ECClass)
   * @returns Returns the requested InstanceChange object
   * @throws [IModelError]($imodeljs-common.IModelError) if instance change does not exist for the specified id, or if the
   * change cache file hasn't been attached, or in case of other errors.
   */
  public static queryInstanceChange(iModel: IModelDb, instanceChangeId: Id64): InstanceChange {
    if (!ChangeSummaryManager.isChangeCacheAttached(iModel))
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Change cache must be attached to iModel.");

    // query instance changes
    const instanceChange: InstanceChange = iModel.withPreparedStatement(`SELECT ic.Summary.Id summaryId, s.Name changedInstanceSchemaName, c.Name changedInstanceClassName, ic.ChangedInstance.Id changedInstanceId,
          ic.OpCode, ic.IsIndirect FROM ecchange.change.InstanceChange ic JOIN main.meta.ECClassDef c ON c.ECInstanceId=ic.ChangedInstance.ClassId
          JOIN main.meta.ECSchemaDef s ON c.Schema.Id=s.ECInstanceId WHERE ic.ECInstanceId=?`, (stmt: ECSqlStatement) => {
        stmt.bindId(1, instanceChangeId);
        if (stmt.step() !== DbResult.BE_SQLITE_ROW)
          throw new IModelError(DbResult.BE_SQLITE_ERROR, `No InstanceChange found for id ${instanceChangeId.value}.`);

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
        throw new IModelError(DbResult.BE_SQLITE_ERROR, `No property value changes found for InstanceChange ${instanceChange.id.value}.`);

      return stmt.getRow();
    });
  }
}
