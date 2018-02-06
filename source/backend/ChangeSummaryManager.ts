/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, ChangeSet, UserInfo } from "@bentley/imodeljs-clients";
import { OpenMode, DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelDb } from "./IModelDb";
import { ECDb } from "./ECDb";
import { DateTime } from "../common/ECSqlTypes";
import { IModelVersion } from "../common/IModelVersion";
import { IModelError, IModelStatus } from "../common/IModelError";
import { ErrorStatusOrResult } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { BriefcaseManager } from "./BriefcaseManager";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { using } from "@bentley/bentleyjs-core/lib/Disposable";
import * as path from "path";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { IModelJsFs } from "./IModelJsFs";
import { KnownLocations } from "./KnownLocations";

/** Equivalent of the ECEnumeration OpCode in the ECDbChange ECSchema */
export enum ChangeOpCode {
  Insert = 1,
  Update = 2,
  Delete = 4 }

/** The enum represents the values for the ChangedValueState argument of the ECSQL function
 *  Changes.
 * The enum can be used when programmatically binding values to the ChangedValueState argument
 * in an ECSQL using the Changes ECSQL function.
 */
export enum ChangedValueState {
    AfterInsert = 1,
    BeforeUpdate = 2,
    AfterUpdate = 3,
    BeforeDelete = 4 }

export interface ChangeSummary {
  id: Id64;
  changeSet: {wsgId: string, parentWsgId: string, pushDate: DateTime, author: string};
}

export interface InstanceChange {
  id: Id64;
  summaryId: Id64;
  changedInstance: {id: Id64, className: string};
  opCode: ChangeOpCode;
  isIndirect: boolean;
  changedProperties: {before: any, after: any};
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
    if (iModel == null || iModel.briefcaseEntry == null || iModel.briefcaseEntry.nativeDb == null)
      throw new IModelError(IModelStatus.BadRequest);

    if (iModel.briefcaseEntry.nativeDb!.isChangeCacheAttached())
      return;

    const changesCacheFilePath: string = BriefcaseManager.buildChangeSummaryFilePath(iModel.briefcaseEntry.iModelId);
    if (!IModelJsFs.existsSync(changesCacheFilePath)) {
      using (new ECDb(), (changesFile) => {
        ChangeSummaryManager.createChangesFile(iModel, changesFile, changesCacheFilePath);
      });
    }

    assert(IModelJsFs.existsSync(changesCacheFilePath));
    const res: DbResult = iModel.briefcaseEntry.nativeDb!.attachChangeCache(changesCacheFilePath);
    if (res !== DbResult.BE_SQLITE_OK)
      throw new IModelError(res, `Failed to attach Changes cache file to ${iModel.briefcaseEntry.pathname}.`);
  }

  /** Extracts change summaries from the specified range of changesets
   * @param startChangeSetId  Changeset Id of the starting changeset to extract from (including this changeset).
   * If undefined, the first changeset of the iModel is used.
   * @param endChangeSetId  Changeset Id of the end changeset to extract from (including this changeset).
   * If undefined, the latest changeset of the iModel is used.
   * @throws [[IModelError]]
   */
  public static async extractChangeSummaries(accessToken: AccessToken, projectId: string, iModelId: string,
    startChangeSetId?: string, endChangeSetId?: string): Promise<void> {

    await BriefcaseManager.initialize(accessToken);

    let endVersion: IModelVersion = IModelVersion.latest();
    if (endChangeSetId !== undefined)
      endVersion = IModelVersion.asOfChangeSet(endChangeSetId);

    endChangeSetId = await endVersion.evaluateChangeSet(accessToken, iModelId);

    // If we want to download changesets that includes startChangeSetId, we need to pass its parent.
    // So determine the parent changeset id first (WIP: Isn't there an easier way to achieve that?)
    let startParentChangeSetId: string | undefined;
    if (startChangeSetId !== undefined) {
      const startChangeSet: ChangeSet = await BriefcaseManager.hubClient!.getChangeSet(accessToken, iModelId, false, startChangeSetId);
      if (startChangeSet === null || startChangeSet === undefined)
        throw new IModelError(IModelStatus.BadArg, `Start ChangeSet ${startChangeSetId} not found on the hub for iModel ${iModelId}.`);

      startParentChangeSetId = startChangeSet.parentId;
    }

    // Downloads the required changesets (if they haven't been downloaded before)
    const changeSets: ChangeSet[] = await BriefcaseManager.downloadChangeSets(accessToken, iModelId, endChangeSetId, startParentChangeSetId);

    // to create the cache file we need the corresponding iModel as the changes cache file stores information
    // about the imodel it belongs to.
    const latestIModel: IModelDb = await IModelDb.open(accessToken, projectId, iModelId, OpenMode.Readonly);
    if (latestIModel == null || latestIModel.nativeDb == null)
      throw new IModelError(IModelStatus.BadArg);

    let changesFile: ECDb;

    try {
      changesFile = ChangeSummaryManager.openOrCreateChangesFile(latestIModel);
    } finally {
      await latestIModel.close(accessToken);
    }

    assert(changesFile.isOpen());
    const userInfoCache = new Map<string, string>();
    const changeSetsFolder: string = BriefcaseManager.getChangeSetsPath(iModelId);
    for (const changeSet of changeSets) {
      const version: IModelVersion = IModelVersion.asOfChangeSet(changeSet.wsgId);
      const iModel: IModelDb = await IModelDb.open(accessToken, projectId, iModelId, OpenMode.Readonly, version);
      try {

        if (ChangeSummaryManager.isSummaryAlreadyExtracted(changesFile, changeSet.wsgId)) {
          continue;
        }

        const nativeIModelDb = iModel.nativeDb;
        const changeSetFilePath: string = path.join(changeSetsFolder, changeSet.fileName!);
        const stat: ErrorStatusOrResult<DbResult, string> = nativeIModelDb.extractChangeSummary(changesFile.nativeDb, changeSetFilePath);
        if (stat.error != null && stat.error!.status !== DbResult.BE_SQLITE_OK)
          throw new IModelError(stat.error!.status);

        assert(stat.result != null);
        const changeSummaryId: string = stat.result!;

        let userEmail: string | undefined = userInfoCache.get(changeSet.userCreated!);
        if (userEmail == null) {
          const userInfo: UserInfo = await BriefcaseManager.hubClient!.getUserInfo(accessToken, iModelId, changeSet.userCreated!);
          userEmail = userInfo.email!;
          userInfoCache.set(changeSet.userCreated!, userEmail);
        }

        ChangeSummaryManager.addExtendedInfos(changesFile, changeSummaryId, changeSet.wsgId, changeSet.parentId!, changeSet.pushDate!, userEmail);
      } finally {
        await iModel.close(accessToken);
      }
    }

    changesFile.saveChanges();
    changesFile.closeDb();
  }

  private static openOrCreateChangesFile(iModel: IModelDb): ECDb {
    if (iModel == null || iModel.briefcaseEntry == null || !iModel.briefcaseEntry.isOpen)
      throw new IModelError(IModelStatus.BadArg);

    const changesFile = new ECDb();
    const changesPath: string = BriefcaseManager.buildChangeSummaryFilePath(iModel.briefcaseEntry.iModelId);
    if (IModelJsFs.existsSync(changesPath)) {
      changesFile.openDb(changesPath, OpenMode.ReadWrite);
      return changesFile;
    }

    ChangeSummaryManager.createChangesFile(iModel, changesFile, changesPath);
    return changesFile;
  }

  private static createChangesFile(iModel: IModelDb, changesFile: ECDb, changesFilePath: string): void {
    if (iModel == null || iModel.briefcaseEntry == null || !iModel.briefcaseEntry.isOpen)
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

  private static addExtendedInfos(changesFile: ECDb, changeSummaryId: string, changesetWsgId: string, changesetParentWsgId: string, changesetPushDate: string, changeSetAuthor: string): void {
    changesFile.withPreparedStatement("INSERT INTO imodelchange.ChangeSet(Summary.Id,WsgId,ParentWsgId,PushDate,Author) VALUES(?,?,?,?,?)",
      (stmt) => {
        stmt.bindId(1, new Id64(changeSummaryId));
        stmt.bindString(2, changesetWsgId);
        stmt.bindString(3, changesetParentWsgId);
        stmt.bindDateTime(4, new DateTime(changesetPushDate));
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
      return {id: changeSummaryId, changeSet: {wsgId: row.wsgId, parentWsgId: row.parentWsgId, pushDate: row.pushDate, author: row.author}};
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

        return { id: instanceChangeId, summaryId: new Id64(row.summaryId), changedInstance: {id: changedInstanceId, className: changedInstanceClassName},
                opCode: op, isIndirect: row.isIndirect, changedProperties: {before: undefined, after: undefined}};
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
