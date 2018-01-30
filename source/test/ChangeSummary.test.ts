/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// import * as fs from "fs";
import * as path from "path";
import { expect, assert } from "chai";
import { OpenMode, DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelVersion } from "../common/IModelVersion";
import { ChangeSummaryManager, ChangeSummary, InstanceChange } from "../backend/ChangeSummaryManager";
import { BriefcaseManager } from "../backend/BriefcaseManager";
import { IModelDb } from "../backend/IModelDb";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { IModelTestUtils } from "./IModelTestUtils";
import { ChangeSet } from "@bentley/imodeljs-clients";
import { using } from "@bentley/bentleyjs-core/lib/Disposable";
import { KnownTestLocations } from "./KnownTestLocations";
import { IModelJsFs } from "../backend/IModelJsFs";

describe.skip("ChangeSummary", () => {
  let accessToken: AccessToken;
  let testProjectId: string;
  let testIModelId: string;
  let shouldDeleteAllBriefcases: boolean = false;

  before(async () => {
    accessToken = await IModelTestUtils.getTestUserAccessToken();
    testProjectId = await IModelTestUtils.getTestProjectId(accessToken, "NodeJsTestProject");
    testIModelId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, "TestModel");

    // Recreate briefcases if it's a TMR. todo: Figure a better way to prevent bleeding briefcase ids
    shouldDeleteAllBriefcases = !IModelJsFs.existsSync(BriefcaseManager.cacheDir);
    if (shouldDeleteAllBriefcases)
      await IModelTestUtils.deleteAllBriefcases(accessToken, testIModelId);

    const changesPath: string = BriefcaseManager.buildChangeSummaryFilePath(testIModelId);
    if (IModelJsFs.existsSync(changesPath))
      IModelJsFs.unlinkSync(changesPath);
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

      const expectedCachePath: string = path.join(BriefcaseManager.cacheDir, testIModelId, testIModelId.concat(".bim.ecchanges"));
      expect(IModelJsFs.existsSync(expectedCachePath));
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
      assert.throw(() => using (iModel.getPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary"), () => {}));

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

      const expectedCachePath: string = path.join(BriefcaseManager.cacheDir, testIModelId, testIModelId.concat(".bim.ecchanges"));
      expect(IModelJsFs.existsSync(expectedCachePath));
    } finally {
    await iModel.close(accessToken);
  }
  });

  it("Attach ChangeCache file to closed imodel", async () => {
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

      const changeSummaryIds = new Array<Id64>();
      iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,ExtendedProperties FROM change.ChangeSummary ORDER BY ECInstanceId", (myStmt) => {
        let rowCount: number = 0;
        while (myStmt.step() === DbResult.BE_SQLITE_ROW) {
          rowCount++;
          const row: any = myStmt.getRow();
          changeSummaryIds.push(new Id64(row.id));
          assert.equal(row.className, "ECDbChange.ChangeSummary");
          assert.isUndefined(row.extendedProperties, "ChangeSummary.ExtendedProperties is not expected to be populated when change summaries are extracted.");
        }
        assert.equal(rowCount, 3);
      });

      iModel.withPreparedStatement("SELECT ECClassId,Summary FROM imodelchange.ChangeSet ORDER BY Summary.Id", (myStmt) => {
        let rowCount: number = 0;
        while (myStmt.step() === DbResult.BE_SQLITE_ROW) {
          rowCount++;
          const row: any = myStmt.getRow();
          assert.equal(row.className, "IModelChange.ChangeSet");
          assert.equal(row.summary.id, changeSummaryIds[rowCount - 1].value);
          assert.equal(row.summary.relClassName, "IModelChange.ChangeSummaryIsExtractedFromChangeset");
        }

        assert.equal(rowCount, 3);

      });

    } finally {
      await iModel.close(accessToken);
    }
  });

  it("Extract ChangeSummary for single changeset", async () => {
    const latestVersion: IModelVersion = IModelVersion.latest();
    const changesetId: string = await latestVersion.evaluateChangeSet(accessToken, testIModelId);
    const changesFilePath: string = BriefcaseManager.buildChangeSummaryFilePath(testIModelId);
    if (IModelJsFs.existsSync(changesFilePath))
      IModelJsFs.removeSync(changesFilePath);

    // now extract change summary for that one changeset
    await ChangeSummaryManager.extractChangeSummaries(accessToken, testProjectId, testIModelId, changesetId, changesetId);
    assert.isTrue(IModelJsFs.existsSync(changesFilePath));

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, latestVersion);
    try {
      assert.exists(iModel);
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      const changeSummaryId: Id64 = iModel.withPreparedStatement("SELECT ECInstanceId FROM change.ChangeSummary", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.isDefined(row.id);
        const id = new Id64(row.id);
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_DONE);
        return id;
        });

      iModel.withPreparedStatement("SELECT WsgId, Summary FROM imodelchange.ChangeSet", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.isDefined(row.wsgId);
        assert.equal(row.wsgId, changesetId);
        assert.isDefined(row.summary);
        assert.equal(row.summary.id, changeSummaryId.value);
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_DONE);
        });
    } finally {
      await iModel.close(accessToken);
    }
  });

  it("Subsequent ChangeSummary extractions", async () => {
    const changesFilePath: string = BriefcaseManager.buildChangeSummaryFilePath(testIModelId);
    if (IModelJsFs.existsSync(changesFilePath))
      IModelJsFs.removeSync(changesFilePath);

    const changeSets: ChangeSet[] = await IModelTestUtils.hubClient.getChangeSets(accessToken, testIModelId, false);
    assert.equal(changeSets.length, 3);
    // first extraction: just first changeset
    const firstChangesetId: string = changeSets[0].id;

    // now extract change summary for that one changeset
    await ChangeSummaryManager.extractChangeSummaries(accessToken, testProjectId, testIModelId, firstChangesetId, firstChangesetId);
    assert.isTrue(IModelJsFs.existsSync(changesFilePath));

    let iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly);
    try {
      assert.exists(iModel);
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      const changeSummaryId: Id64 = iModel.withPreparedStatement("SELECT ECInstanceId FROM change.ChangeSummary", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.isDefined(row.id);
        const id = new Id64(row.id);
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_DONE);
        return id;
        });

      iModel.withPreparedStatement("SELECT WsgId, Summary FROM imodelchange.ChangeSet", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.isDefined(row.wsgId);
        assert.equal(row.wsgId, firstChangesetId);
        assert.isDefined(row.summary);
        assert.equal(row.summary.id, changeSummaryId.value);
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_DONE);
        });
    } finally {
      await iModel.close(accessToken);
    }

    // now do second extraction for last changeset
    const lastChangesetId: string = changeSets[changeSets.length - 1].id;

    await ChangeSummaryManager.extractChangeSummaries(accessToken, testProjectId, testIModelId, lastChangesetId, lastChangesetId);
    assert.isTrue(IModelJsFs.existsSync(changesFilePath));

    iModel = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly);
    try {
      assert.exists(iModel);
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      iModel.withPreparedStatement("SELECT cset.WsgId changesetId FROM change.ChangeSummary csum JOIN imodelchange.ChangeSet cset ON csum.ECInstanceId=cset.Summary.Id ORDER BY csum.ECInstanceId", (myStmt) => {
        let rowCount: number = 0;
        while (myStmt.step() === DbResult.BE_SQLITE_ROW) {
          rowCount++;
          const row: any = myStmt.getRow();
          assert.isDefined(row.changesetId);
          if (rowCount === 1)
            assert.equal(row.changesetId, firstChangesetId);
          else if (rowCount === 2)
            assert.equal(row.changesetId, lastChangesetId);
        }
        assert.equal(rowCount, 2);
        });
    } finally {
      await iModel.close(accessToken);
    }
  });

  it("Extract ChangeSummaries for already downloaded changesets", async () => {
    await ChangeSummaryManager.extractChangeSummaries(accessToken, testProjectId, testIModelId);
    const changesFilePath: string = BriefcaseManager.buildChangeSummaryFilePath(testIModelId);
    const csetPath: string = BriefcaseManager.getChangeSetsPath(testIModelId);
    // delete changes file before extracting again with already downloaded changesets
    if (IModelJsFs.existsSync(changesFilePath))
      IModelJsFs.removeSync(changesFilePath);

    const lastChangesetId: string = await IModelVersion.latest().evaluateChangeSet(accessToken, testIModelId);
    assert.isTrue(IModelJsFs.existsSync(path.join(csetPath, lastChangesetId + ".cs")));

    // now extract again where changesets were already downloaded
    await ChangeSummaryManager.extractChangeSummaries(accessToken, testProjectId, testIModelId);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly);
    assert.exists(iModel);
    try {
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      const rows: any[] = iModel.executeQuery("SELECT count(*) csumcount FROM change.ChangeSummary csum JOIN imodelchange.ChangeSet cset ON csum.ECInstanceId=cset.Summary.Id");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].csumcount, "0x3");

    } finally {
      await iModel.close(accessToken);
    }
  });

  it.skip("Extract ChangeSummaries with invalid input", async () => {
    try {
      await ChangeSummaryManager.extractChangeSummaries(accessToken, "123", testIModelId);
     } catch (e) {
       assert.equal(e.message, "Not Found");
     }

    try {
     await ChangeSummaryManager.extractChangeSummaries(accessToken, testProjectId, "123");
    } catch (e) {
      assert.equal(e.message, "Not Found");
    }
  });

  it("Query ChangeSummary content", async () => {
    await ChangeSummaryManager.extractChangeSummaries(accessToken, testProjectId, testIModelId);
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(iModel);
    ChangeSummaryManager.attachChangeCache(iModel);
    assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

    const outDir = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);

    const changeSummaries = new Array<ChangeSummary>();
    iModel.withPreparedStatement("SELECT ECInstanceId FROM ecchange.change.ChangeSummary ORDER BY ECInstanceId", (stmt) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const row = stmt.getRow();
        const csum: ChangeSummary = ChangeSummaryManager.queryChangeSummary(iModel, new Id64(row.id));
        changeSummaries.push(csum);
      }
    });

    for (const changeSummary of changeSummaries) {
      const filePath = path.join(outDir, "imodelid_" + testIModelId + "_changesummaryid_" + changeSummary.id + ".changesummary.json");
      if (IModelJsFs.existsSync(filePath))
        IModelJsFs.unlinkSync(filePath);

      const content = {id: changeSummary.id, changeSet: changeSummary.changeSet, instanceChanges: new Array<InstanceChange>()};
      iModel.withPreparedStatement("SELECT ECInstanceId FROM ecchange.change.InstanceChange WHERE Summary.Id=? ORDER BY ECInstanceId", (stmt) => {
        stmt.bindId(1, changeSummary.id);
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          const row = stmt.getRow();

          const instanceChange: InstanceChange = ChangeSummaryManager.queryInstanceChange(iModel, new Id64(row.id));
          content.instanceChanges.push(instanceChange);
        }
      });

      IModelJsFs.writeFileSync(filePath, JSON.stringify(content));
    }
  });
});
