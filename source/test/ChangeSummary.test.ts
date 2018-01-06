/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// import * as fs from "fs";
import * as fs from "fs-extra";
import * as path from "path";
import { expect, assert } from "chai";
import { OpenMode, DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelVersion } from "../common/IModelVersion";
import { ChangeSummaryManager } from "../backend/ChangeSummaryManager";
import { BriefcaseManager } from "../backend/BriefcaseManager";
import { IModelDb } from "../backend/IModelDb";
import { IModelTestUtils } from "./IModelTestUtils";

describe("ChangeSummary", () => {
  let accessToken: AccessToken;
  let testProjectId: string;
  let testIModelId: string;
  let shouldDeleteAllBriefcases: boolean = false;

  before(async () => {
    accessToken = await IModelTestUtils.getTestUserAccessToken();
    testProjectId = await IModelTestUtils.getTestProjectId(accessToken, "NodeJsTestProject");
    testIModelId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, "MyTestModel");

    // Recreate briefcases if it's a TMR. todo: Figure a better way to prevent bleeding briefcase ids
    shouldDeleteAllBriefcases = !fs.existsSync(BriefcaseManager.cachePath);
    if (shouldDeleteAllBriefcases)
      await IModelTestUtils.deleteAllBriefcases(accessToken, testIModelId);

    const changesPath: string = BriefcaseManager.buildChangeSummaryFilePath(testIModelId);
    if (fs.existsSync(changesPath))
      fs.removeSync(changesPath);
  });

  it("Attach ChangeCache file to readwrite briefcase", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite, IModelVersion.latest());
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.ReadWrite);

    assert.isFalse(iModel.isChangeCacheAttached());

    assert.throw(() => iModel.getPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary"));

    iModel.attachChangeCache();
    assert.isTrue(iModel.isChangeCacheAttached());
    iModel.withPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary", (myStmt) => {
      assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
      const row: any = myStmt.getRow();
      assert.equal(row.csumcount, 0);
    });

    const expectedCachePath: string = path.join(BriefcaseManager.cachePath, testIModelId, testIModelId.concat(".bim.ecchanges"));
    expect(fs.existsSync(expectedCachePath));

    await iModel.close(accessToken);

  });

  it("Attach ChangeCache file to readonly briefcase", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.Readonly);

    assert.isFalse(iModel.isChangeCacheAttached());
    assert.throw(() => iModel.getPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary"));

    iModel.attachChangeCache();
    assert.isTrue(iModel.isChangeCacheAttached());
    iModel.withPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary", (myStmt) => {
      assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
      const row: any = myStmt.getRow();
      assert.equal(row.csumcount, 0);
    });
    const expectedCachePath: string = path.join(BriefcaseManager.cachePath, testIModelId, testIModelId.concat(".bim.ecchanges"));
    expect(fs.existsSync(expectedCachePath));
    await iModel.close(accessToken);
  });

  it("Extract ChangeSummaries from existing changesets", async () => {
    await ChangeSummaryManager.extractChangeSummaries(accessToken, testProjectId, testIModelId);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(iModel);
    iModel.attachChangeCache();
    assert.isTrue(iModel.isChangeCacheAttached());

    iModel.withPreparedStatement("SELECT ECInstanceId,ExtendedProperties FROM change.ChangeSummary", (myStmt) => {
      let rowCount: number = 0;
      while (myStmt.step() === DbResult.BE_SQLITE_ROW) {
        rowCount++;
      }
      assert.equal(rowCount, 3);
    });

    await iModel.close(accessToken);
  });
});
