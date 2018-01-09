/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, ChangeSet, UserInfo } from "@bentley/imodeljs-clients";
import { OpenMode, DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelDb } from "./IModelDb";
import { ECDb } from "./ECDb";
import { IModelVersion } from "../common/IModelVersion";
import { IModelError, IModelStatus } from "../common/IModelError";
import { ErrorStatusOrResult } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { BriefcaseManager } from "./BriefcaseManager";
import * as path from "path";
import * as fs from "fs";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

class ChangeSummaryExtendedInfo {
  constructor(public changeSetId: string, public pushDate: string, public user: string, public parentChangeSetId: string) { }
}

/** Class to extract change summaries for a briefcase. */
export class ChangeSummaryManager {

  /** Extracts change summaries from the specified range of changesets
   * @param startChangeSetId  Changeset Id of the starting changeset to extract from. If undefined, the first changeset of the iModel
   * is used.
   * @param endChangeSetId  Changeset Id of the end changeset to extract from. If undefined, the latest changeset of the iModel
   * is used.
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

    const changesFile: ECDb = await ChangeSummaryManager.openOrCreateChangesFile(accessToken, projectId, iModelId);
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
        if (!userEmail) {
          const userInfo: UserInfo = await BriefcaseManager.hubClient!.getUserInfo(accessToken, iModelId, changeSet.userCreated);
          userEmail = userInfo.email;
          userInfoCache.set(changeSet.userCreated, userEmail);
        }

        ChangeSummaryManager.addExtendedInfos(changesFile, changeSummaryId, new ChangeSummaryExtendedInfo(changeSet.wsgId, changeSet.pushDate, userEmail, changeSet.parentId));
      } finally {
        await iModel.close(accessToken);
      }
    }

    changesFile.saveChanges();
    changesFile.closeDb();
  }

  private static async openOrCreateChangesFile(accessToken: AccessToken, projectId: string, iModelId: string): Promise<ECDb> {
    const changesFile = new ECDb();
    const changesPath: string = BriefcaseManager.buildChangeSummaryFilePath(iModelId);
    if (fs.existsSync(changesPath)) {
      changesFile.openDb(changesPath, OpenMode.ReadWrite);
      return changesFile;
    }

    const iModel: IModelDb = await IModelDb.open(accessToken, projectId, iModelId, OpenMode.Readonly);
    if (iModel == null)
      throw new IModelError(IModelStatus.BadArg);

    try {
      iModel.createChangeCache(changesFile, changesPath);
      return changesFile;

      } finally {
      await iModel.close(accessToken);
    }
  }

  private static isSummaryAlreadyExtracted(changesFile: ECDb, changeSetId: string): boolean {
    return changesFile.withPreparedStatement("SELECT 1 FROM change.ChangeSummary WHERE json_extract(ExtendedProperties,'$.wsgid')=?",
      (stmt) => {
        stmt.bindValues([changeSetId]);
        return DbResult.BE_SQLITE_ROW === stmt.step();
      });
  }

  private static addExtendedInfos(changesFile: ECDb, changeSummaryId: string, extendedInfo: ChangeSummaryExtendedInfo): void {
    changesFile.withPreparedStatement("UPDATE change.ChangeSummary SET ExtendedProperties=? WHERE ECInstanceId=?",
      (stmt) => {
        const infoStr: string = JSON.stringify(extendedInfo);
        stmt.bindValues([infoStr, changeSummaryId]);
        const r: DbResult = stmt.step();
        if (r !== DbResult.BE_SQLITE_DONE)
          throw new IModelError(r);
          });
  }

}
