/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { expect, assert } from "chai";
import { OpenMode, DbResult, Id64, PerfLogger } from "@bentley/bentleyjs-core";
import { AccessToken, ChangeSet } from "@bentley/imodeljs-clients";
import { IModelVersion, IModelStatus } from "@bentley/imodeljs-common";
import { ChangeSummaryManager, ChangeSummary, InstanceChange } from "../ChangeSummaryManager";
import { IModelJsFs, IModelHost, IModelDb, BriefcaseManager } from "../backend";
import { IModelTestUtils } from "./IModelTestUtils";
import { HubTestUtils } from "./HubTestUtils";
import { KnownTestLocations } from "./KnownTestLocations";
import { TestConfig } from "./TestConfig";

describe("ChangeSummary", () => {
  let accessToken: AccessToken;
  let testProjectId: string;
  let testIModelId: string;

  before(async () => {
    accessToken = await IModelTestUtils.getTestUserAccessToken();
    testProjectId = await HubTestUtils.queryProjectIdByName(accessToken, TestConfig.projectName);
    testIModelId = await HubTestUtils.queryIModelIdByName(accessToken, testProjectId, TestConfig.iModelName);

    // Delete briefcases if the cache has been cleared, *and* we cannot acquire any more briefcases
    await HubTestUtils.purgeAcquiredBriefcases(accessToken, TestConfig.projectName, TestConfig.iModelName);
    await HubTestUtils.purgeAcquiredBriefcases(accessToken, TestConfig.projectName, "NoVersionsTest");

    const changesPath: string = BriefcaseManager.getChangeSummaryPathname(testIModelId);
    if (IModelJsFs.existsSync(changesPath))
      IModelJsFs.unlinkSync(changesPath);
  });

  it("Attach / Detach ChangeCache file to readwrite briefcase", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite, IModelVersion.latest());
    try {
      assert.exists(iModel);
      assert(iModel.iModelToken.openMode === OpenMode.ReadWrite);

      assert.isFalse(ChangeSummaryManager.isChangeCacheAttached(iModel));

      assert.throw(() => iModel.withPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary", () => { }));

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

      const cacheDir = IModelHost.configuration!.briefcaseCacheDir;
      const expectedCachePath: string = path.join(cacheDir, testIModelId, testIModelId.concat(".bim.ecchanges"));
      expect(IModelJsFs.existsSync(expectedCachePath));

      ChangeSummaryManager.detachChangeCache(iModel);
      assert.isFalse(ChangeSummaryManager.isChangeCacheAttached(iModel));
      assert.throw(() => iModel.withPreparedStatement("SELECT count(*) as sumcount FROM change.ChangeSummary", () => { }));

      // calling detach if nothing was attached should fail
      assert.throw(() => ChangeSummaryManager.detachChangeCache(iModel));

      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));
      iModel.withPreparedStatement("SELECT count(*) as sumcount FROM change.ChangeSummary", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.equal(row.sumcount, 0);
      });

    } finally {
      await iModel.close(accessToken);
    }
  });

  it("Attach / Detach ChangeCache file to readonly briefcase", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.Readonly);
    try {
      assert.isFalse(ChangeSummaryManager.isChangeCacheAttached(iModel));
      assert.throw(() => iModel.withPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary", () => { }));

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

      const cacheDir = IModelHost.configuration!.briefcaseCacheDir;
      const expectedCachePath: string = path.join(cacheDir, testIModelId, testIModelId.concat(".bim.ecchanges"));
      expect(IModelJsFs.existsSync(expectedCachePath));

      ChangeSummaryManager.detachChangeCache(iModel);
      assert.isFalse(ChangeSummaryManager.isChangeCacheAttached(iModel));
      assert.throw(() => iModel.withPreparedStatement("SELECT count(*) as sumcount FROM change.ChangeSummary", () => { }));

      // calling detach if nothing was attached should fail
      assert.throw(() => ChangeSummaryManager.detachChangeCache(iModel));

      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));
      iModel.withPreparedStatement("SELECT count(*) as sumcount FROM change.ChangeSummary", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.equal(row.sumcount, 0);
      });

    } finally {
      await iModel.close(accessToken);
    }
  });

  it("ECSqlStatementCache after detaching Change Cache", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.Readonly);
    try {
      assert.isFalse(ChangeSummaryManager.isChangeCacheAttached(iModel));
      assert.throw(() => iModel.withPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary", () => { }));

      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));
      iModel.withPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.equal(row.csumcount, 0);
      });

      ChangeSummaryManager.detachChangeCache(iModel);
      assert.isFalse(ChangeSummaryManager.isChangeCacheAttached(iModel));
      assert.throw(() => iModel.withPreparedStatement("SELECT count(*) as csumcount FROM change.ChangeSummary", () => { }));

    } finally {
      await iModel.close(accessToken);
    }
  });

  it("Attach / Detach ChangeCache file to closed imodel", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite, IModelVersion.latest());
    await iModel.close(accessToken);
    assert.exists(iModel);
    assert.throw(() => ChangeSummaryManager.isChangeCacheAttached(iModel));
    assert.throw(() => ChangeSummaryManager.attachChangeCache(iModel));
    assert.throw(() => ChangeSummaryManager.detachChangeCache(iModel));
  });

  it("Extract ChangeSummaries", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite, IModelVersion.latest());
    assert.exists(iModel);
    try {
      await ChangeSummaryManager.extractChangeSummaries(iModel);
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
        assert.isAtLeast(rowCount, 3);
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
        assert.isAtLeast(rowCount, 3);
      });

    } finally {
      await iModel.close(accessToken);
    }
  });

  it("Extract ChangeSummary for single changeset", async () => {
    const changeSets: ChangeSet[] = await HubTestUtils.hubClient!.ChangeSets().get(accessToken, testIModelId);
    assert.isAtLeast(changeSets.length, 3);
    // extract summary for second changeset
    const changesetId: string = changeSets[1].wsgId;

    const changesFilePath: string = BriefcaseManager.getChangeSummaryPathname(testIModelId);
    if (IModelJsFs.existsSync(changesFilePath))
      IModelJsFs.removeSync(changesFilePath);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite, IModelVersion.latest());
    try {
      assert.exists(iModel);
      await iModel.reverseChanges(accessToken, IModelVersion.asOfChangeSet(changesetId));

      // now extract change summary for that one changeset
      await ChangeSummaryManager.extractChangeSummaries(iModel, { currentChangeSetOnly: true });
      assert.isTrue(IModelJsFs.existsSync(changesFilePath));

      assert.exists(iModel);
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      const changeSummaryId: Id64 = iModel.withPreparedStatement("SELECT ECInstanceId FROM change.ChangeSummary", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.isDefined(row.id);
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_DONE);
        return new Id64(row.id);
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
    const changesFilePath: string = BriefcaseManager.getChangeSummaryPathname(testIModelId);
    if (IModelJsFs.existsSync(changesFilePath))
      IModelJsFs.removeSync(changesFilePath);

    const changeSets: ChangeSet[] = await HubTestUtils.hubClient!.ChangeSets().get(accessToken, testIModelId);
    assert.isAtLeast(changeSets.length, 3);
    // first extraction: just first changeset
    const firstChangesetId: string = changeSets[0].id!;

    let iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite, IModelVersion.latest());
    try {
      assert.exists(iModel);
      await iModel.reverseChanges(accessToken, IModelVersion.asOfChangeSet(firstChangesetId));

      // now extract change summary for that one changeset
      await ChangeSummaryManager.extractChangeSummaries(iModel, { currentChangeSetOnly: true });
      assert.isTrue(IModelJsFs.existsSync(changesFilePath));

      assert.exists(iModel);
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      const changeSummaryId: Id64 = iModel.withPreparedStatement("SELECT ECInstanceId FROM change.ChangeSummary", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.isDefined(row.id);
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_DONE);
        return new Id64(row.id);
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

      // now do second extraction for last changeset
      const lastChangesetId: string = changeSets[changeSets.length - 1].id!;
      await iModel.close(accessToken);
      iModel = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite, IModelVersion.asOfChangeSet(lastChangesetId));
      // WIP not working yet until cache can be detached.
      // await iModel.pullAndMergeChanges(accessToken, IModelVersion.asOfChangeSet(lastChangesetId));

      await ChangeSummaryManager.extractChangeSummaries(iModel, { currentChangeSetOnly: true });

      // WIP
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

  it("Extract ChangeSummaries with invalid input", async () => {
    let iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly);
    try {
      assert.exists(iModel);
      await ChangeSummaryManager.extractChangeSummaries(iModel);
    } catch (e) {
      assert.isDefined(e.errorNumber);
      assert.equal(e.errorNumber, IModelStatus.BadArg);
    } finally {
      await iModel.close(accessToken);
    }

    // open standalone iModel
    iModel = IModelTestUtils.openIModel("test.bim");
    assert.exists(iModel);
    assert.exists(iModel.briefcase);
    assert.isTrue(iModel.briefcase!.isStandalone);
    try {
      await ChangeSummaryManager.extractChangeSummaries(iModel);
    } catch (e) {
      assert.isDefined(e.errorNumber);
      assert.equal(e.errorNumber, IModelStatus.BadArg);
    } finally {
      iModel.closeStandalone();
    }
  });

  it("Query ChangeSummary content", async () => {
    // accessToken = await IModelTestUtils.getTestUserAccessToken(TestUsers.user1);
    // const iModel: IModelDb = await IModelDb.open(accessToken, "d46de192-6cad-4086-b968-71b517edc215", "a237be2f-7a59-4f40-a0bd-14bf9c0634f1", OpenMode.ReadWrite, IModelVersion.latest());
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite, IModelVersion.latest());
    await ChangeSummaryManager.extractChangeSummaries(iModel);
    assert.exists(iModel);
    ChangeSummaryManager.attachChangeCache(iModel);
    assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

    const outDir = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);

    const changeSummaries = new Array<ChangeSummary>();
    iModel.withPreparedStatement("SELECT ECInstanceId FROM ecchange.change.ChangeSummary ORDER BY ECInstanceId", (stmt) => {
      const perfLogger = new PerfLogger("ChangeSummaryManager.queryChangeSummary");
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const row = stmt.getRow();
        const csum: ChangeSummary = ChangeSummaryManager.queryChangeSummary(iModel, new Id64(row.id));
        changeSummaries.push(csum);
      }
      perfLogger.dispose();
    });

    for (const changeSummary of changeSummaries) {
      const filePath = path.join(outDir, "imodelid_" + testIModelId + "_changesummaryid_" + changeSummary.id.value + ".changesummary.json");
      if (IModelJsFs.existsSync(filePath))
        IModelJsFs.unlinkSync(filePath);

      const content = { id: changeSummary.id, changeSet: changeSummary.changeSet, instanceChanges: new Array<InstanceChange>() };
      iModel.withPreparedStatement("SELECT ECInstanceId FROM ecchange.change.InstanceChange WHERE Summary.Id=? ORDER BY ECInstanceId", (stmt) => {
        stmt.bindId(1, changeSummary.id);
        const perfLogger = new PerfLogger("ChangeSummaryManager.queryInstanceChange for all instances in ChangeSummary " + changeSummary.id);
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          const row = stmt.getRow();

          const instanceChange: InstanceChange = ChangeSummaryManager.queryInstanceChange(iModel, new Id64(row.id));
          content.instanceChanges.push(instanceChange);
        }
        perfLogger.dispose();
      });

      IModelJsFs.writeFileSync(filePath, JSON.stringify(content));
    }
  });
});
