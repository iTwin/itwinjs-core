/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, ChangeSet, UserInfo } from "@bentley/imodeljs-clients";
import { OpenMode, DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelDb } from "./IModelDb";
import { ECDb } from "./ECDb";
import { DateTime } from "./ECSqlStatement";
import { IModelVersion } from "../common/IModelVersion";
import { IModelError, IModelStatus } from "../common/IModelError";
import { ErrorStatusOrResult } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { BriefcaseManager } from "./BriefcaseManager";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { using } from "@bentley/bentleyjs-core/lib/Disposable";
import * as path from "path";
import * as fs from "fs";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

class ChangeSummaryExtendedInfo {
  constructor(public changeSetId: string, public parentChangeSetId: string, public pushDate: string, public author: string) { }
}

/** Class to extract change summaries for a briefcase. */
export class ChangeSummaryManager {

  /** Determines whether the Changes cache file is attached to the specified iModel or not
   * @param iModel iModel to check whether a Changes cache file is attached
   * @return true if the Changes cache file is attached to the iModel. false otherwise
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
    if (!fs.existsSync(changesCacheFilePath)) {
      using (new ECDb(), (changesFile) => {
        ChangeSummaryManager.createChangesFile(iModel, changesFile, changesCacheFilePath);
      });
    }

    assert(fs.existsSync(changesCacheFilePath));
    const res: DbResult = iModel.briefcaseEntry.nativeDb!.attachChangeCache(changesCacheFilePath);
    if (res !== DbResult.BE_SQLITE_OK)
      throw new IModelError(res, `Failed to attach Changes cache file to ${iModel.briefcaseEntry.pathname}.`);
  }

  /** Extracts change summaries from the specified range of changesets
   * @param startChangeSetId  Changeset Id of the starting changeset to extract from. If undefined, the first changeset of the iModel
   * is used.
   * @param endChangeSetId  Changeset Id of the end changeset to extract from. If undefined, the latest changeset of the iModel
   * is used.
   * @throws [[IModelError]]
   */
  public static async extractChangeSummaries(accessToken: AccessToken, projectId: string, iModelId: string,
    startChangeSetId?: string, endChangeSetId?: string): Promise<void> {

    let startVersion: IModelVersion = IModelVersion.first();
    let endVersion: IModelVersion = IModelVersion.latest();

    if (startChangeSetId)
      startVersion = IModelVersion.asOfChangeSet(startChangeSetId);

    startChangeSetId = await startVersion.evaluateChangeSet(accessToken, iModelId);

    if (endChangeSetId)
      endVersion = IModelVersion.asOfChangeSet(endChangeSetId);

    endChangeSetId = await endVersion.evaluateChangeSet(accessToken, iModelId);

    await BriefcaseManager.initialize(accessToken);
    const changeSets: ChangeSet[] = await BriefcaseManager.downloadChangeSets(accessToken, iModelId, endChangeSetId, startChangeSetId);
    const changeSetsFolder: string = BriefcaseManager.getChangeSetsPath(iModelId);

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

    for (const changeSet of changeSets) {
      const version: IModelVersion = IModelVersion.asOfChangeSet(changeSet.wsgId);
      const iModel: IModelDb = await IModelDb.open(accessToken, projectId, iModelId, OpenMode.Readonly, version);
      const nativeIModelDb = iModel.nativeDb;
      if (nativeIModelDb == null)
        throw new IModelError(IModelStatus.WrongIModel);

      try {

        if (ChangeSummaryManager.isSummaryAlreadyExtracted(changesFile, changeSet.wsgId)) {
          continue;
        }

        const changeSetFilePath: string = path.join(changeSetsFolder, changeSet.fileName);
        const stat: ErrorStatusOrResult<DbResult, string> = nativeIModelDb.extractChangeSummary(changesFile.nativeDb, changeSetFilePath);
        if (stat.error != null && stat.error!.status !== DbResult.BE_SQLITE_OK)
          throw new IModelError(stat.error!.status);

        assert(stat.result != null);
        const changeSummaryId: string = stat.result!;

        let userEmail: string | undefined = userInfoCache.get(changeSet.userCreated);
        if (userEmail == null) {
          const userInfo: UserInfo = await BriefcaseManager.hubClient!.getUserInfo(accessToken, iModelId, changeSet.userCreated);
          userEmail = userInfo.email;
          userInfoCache.set(changeSet.userCreated, userEmail);
        }

        ChangeSummaryManager.addExtendedInfos(changesFile, changeSummaryId, new ChangeSummaryExtendedInfo(changeSet.wsgId, changeSet.parentId, changeSet.pushDate, userEmail));
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
    if (fs.existsSync(changesPath)) {
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
    return __dirname + "/assets/IModelChange.01.00.ecschema.xml";
  }

  private static isSummaryAlreadyExtracted(changesFile: ECDb, changeSetId: string): boolean {
    return changesFile.withPreparedStatement("SELECT 1 FROM imodelchange.ChangeSet WHERE WsgId=?",
      (stmt) => {
        stmt.bindString(1, changeSetId);
        return DbResult.BE_SQLITE_ROW === stmt.step();
      });
  }

  private static addExtendedInfos(changesFile: ECDb, changeSummaryId: string, extendedInfo: ChangeSummaryExtendedInfo): void {
    changesFile.withPreparedStatement("INSERT INTO imodelchange.ChangeSet(Summary.Id,WsgId,ParentWsgId,PushDate,Author) VALUES(?,?,?,?,?)",
      (stmt) => {
        stmt.bindId(1, new Id64(changeSummaryId));
        stmt.bindString(2, extendedInfo.changeSetId);
        stmt.bindString(3, extendedInfo.parentChangeSetId);
        stmt.bindDateTime(4, new DateTime(extendedInfo.pushDate));
        stmt.bindString(5, extendedInfo.author);
        const r: DbResult = stmt.step();
        if (r !== DbResult.BE_SQLITE_DONE)
          throw new IModelError(r, "Failed to add changeset information to extracted change summary " + changeSummaryId);
      });
  }

}
