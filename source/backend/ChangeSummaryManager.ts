/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, ChangeSet, UserInfo } from "@bentley/imodeljs-clients";
import { OpenMode, DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelDb } from "./IModelDb";
import { ECDb } from "./ECDb";
import { ECSqlStatement } from "./ECSqlStatement";
import { IModelVersion } from "../common/IModelVersion";
import { IModelError } from "../common/IModelError";
import { ErrorStatusOrResult} from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { BriefcaseManager } from "./BriefcaseManager";
import * as path from "path";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
// import * as fs from "fs";

class ChangeSummaryExtendedInfo {
  constructor(public changeSetId: string, public pushDate: string, public user: string, public parentChangeSetId: string) {}
}

export class ChangeSummaryManager {

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

    let iModel: IModelDb = await IModelDb.open(accessToken, projectId, iModelId, OpenMode.Readonly, startVersion);

    const changesPath: string = BriefcaseManager.buildChangeSummaryFilePath(iModelId);
    const changesFile = new ECDb();
    iModel.createChangeCache(changesFile, changesPath);
    const alreadyExtractedStmt: ECSqlStatement = changesFile.prepareStatement("SELECT 1 FROM change.ChangeSummary WHERE json_extract(ExtendedProperties,'$.wsgid')=?");
    const addExtendedInfoStmt: ECSqlStatement = changesFile.prepareStatement("UPDATE change.ChangeSummary SET ExtendedProperties=? WHERE ECInstanceId=?");

    const userInfoCache = new Map<string, string>();

    for (const changeSet of changeSets) {
      const version: IModelVersion = IModelVersion.asOfChangeSet(changeSet.wsgId);
      iModel = await IModelDb.open(accessToken, projectId, iModelId, OpenMode.Readonly, version);
      if (ChangeSummaryManager.isSummaryAlreadyExtracted(alreadyExtractedStmt, changeSet.wsgId))
        continue;

      const changeSetFilePath: string = path.join(changeSetsFolder, changeSet.fileName);
      const stat: ErrorStatusOrResult<DbResult, string> = iModel.briefcaseInfo!.nativeDb.extractChangeSummary(changesFile.nativeDb, changeSetFilePath);
      if (stat.error != null && stat.error!.status !== DbResult.BE_SQLITE_OK)
        return Promise.reject(new IModelError(stat.error!.status));

      assert(stat.result != null);
      const changeSummaryId: string = stat.result!;
      await iModel.close(accessToken);

      let userEmail: string | undefined = userInfoCache.get(changeSet.userCreated);
      if (!userEmail) {
        const userInfo: UserInfo = await BriefcaseManager.hubClient!.getUserInfo(accessToken, iModelId, changeSet.userCreated);
        userEmail = userInfo.email;
        userInfoCache.set(changeSet.userCreated, userEmail);
      }

      ChangeSummaryManager.addExtendedInfos(addExtendedInfoStmt, changeSummaryId, new ChangeSummaryExtendedInfo(changeSet.wsgId, changeSet.pushDate, userEmail, changeSet.parentId));
    }

    changesFile.saveChanges();
    Promise.resolve();
  }

  private static isSummaryAlreadyExtracted(stmt: ECSqlStatement, changeSetId: string): boolean {
    stmt.bindValues([changeSetId]);
    const stat: DbResult = stmt.step();
    stmt.reset();
    stmt.clearBindings();
    return DbResult.BE_SQLITE_ROW === stat;
  }

  private static addExtendedInfos(stmt: ECSqlStatement, changeSummaryId: string, extendedInfo: ChangeSummaryExtendedInfo): void {
    const infoStr: string = JSON.stringify(extendedInfo);
    stmt.bindValues([infoStr, changeSummaryId]);
    const r: DbResult = stmt.step();
    if (r !== DbResult.BE_SQLITE_DONE)
      throw new IModelError(r);

    stmt.clearBindings();
    stmt.reset();
  }

}
