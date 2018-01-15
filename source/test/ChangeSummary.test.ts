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
    try {
      assert.exists(iModel);
      assert(iModel.iModelToken.openMode === OpenMode.ReadWrite);

      assert.isFalse(ChangeSummaryManager.isChangeCacheAttached(iModel));

      assert.throw(() => iModel.getPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary"));

      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));
      iModel.withPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.equal(row.csumcount, 0);
      });

      // verify the extended schema was imported into the changes file
      iModel.withPreparedStatement("SELECT count(*) as csumcount FROM imodelchange.ChangeSet", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.equal(row.csumcount, 0);
      });

      const expectedCachePath: string = path.join(BriefcaseManager.cachePath, testIModelId, testIModelId.concat(".bim.ecchanges"));
      expect(fs.existsSync(expectedCachePath));
    } finally {
      await iModel.close(accessToken);
    }
  });

  it("Attach ChangeCache file to readonly briefcase", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.Readonly);
    try {
      assert.isFalse(ChangeSummaryManager.isChangeCacheAttached(iModel));
      assert.throw(() => iModel.getPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary"));

      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));
      iModel.withPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.equal(row.csumcount, 0);
      });

      // verify the extended schema was imported into the changes file
      iModel.withPreparedStatement("SELECT count(*) as csumcount FROM imodelchange.ChangeSet", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.equal(row.csumcount, 0);
      });

      const expectedCachePath: string = path.join(BriefcaseManager.cachePath, testIModelId, testIModelId.concat(".bim.ecchanges"));
      expect(fs.existsSync(expectedCachePath));
    } finally {
    await iModel.close(accessToken);
  }
  });

  it("Attach ChangeCache file to invalid imodel", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite, IModelVersion.latest());
    await iModel.close(accessToken);
    assert.exists(iModel);
    assert.throw(() => ChangeSummaryManager.isChangeCacheAttached(iModel));
    assert.throw(() => ChangeSummaryManager.attachChangeCache(iModel));
  });

  it("Extract ChangeSummaries", async () => {
    await ChangeSummaryManager.extractChangeSummaries(accessToken, testProjectId, testIModelId);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(iModel);
    try {
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      iModel.withPreparedStatement("SELECT ECInstanceId,ExtendedProperties FROM change.ChangeSummary", (myStmt) => {
        let rowCount: number = 0;
        while (myStmt.step() === DbResult.BE_SQLITE_ROW) {
          rowCount++;
          const row: any = myStmt.getRow();
          assert.isUndefined(row.extendedProperties, "ChangeSummary.ExtendedProperties is not expected to be populated when change summaries are extracted.");
        }
        assert.equal(rowCount, 3);
      });

      iModel.withPreparedStatement("SELECT * FROM imodelchange.ChangeSet", (myStmt) => {
        let rowCount: number = 0;
        while (myStmt.step() === DbResult.BE_SQLITE_ROW) {
          rowCount++;
          const row: any = myStmt.getRow();
          assert.equal("bistroDEV_pmadm1@mailinator.com", row.author);
        }

        assert.equal(rowCount, 3);

      });

    } finally {
      await iModel.close(accessToken);
    }
  });

  it("Extract ChangeSummaries for invalid imodel", async () => {
    await ChangeSummaryManager.extractChangeSummaries(accessToken, testProjectId, "123");
  });
});
