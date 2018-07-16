/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { expect, assert } from "chai";
import { OpenMode, DbResult, Id64, PerfLogger, ChangeSetStatus } from "@bentley/bentleyjs-core";
import { AccessToken, ConnectClient, IModelHubClient, ChangeSet } from "@bentley/imodeljs-clients";
import { IModelVersion, IModelStatus, ChangeOpCode, ChangedValueState } from "@bentley/imodeljs-common";
import { ChangeSummaryManager, ChangeSummary } from "../../ChangeSummaryManager";
import { BriefcaseManager } from "../../BriefcaseManager";
import { IModelDb, OpenParams, AccessMode } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { IModelJsFs } from "../../IModelJsFs";
import { TestIModelInfo, MockAssetUtil, MockAccessToken } from "../MockAssetUtil";
import * as TypeMoq from "typemoq";

function setupTest(iModelId: string): void {
  const cacheFilePath: string = BriefcaseManager.getChangeCachePathName(iModelId);
  if (IModelJsFs.existsSync(cacheFilePath))
    IModelJsFs.removeSync(cacheFilePath);
}

describe("ChangeSummary", () => {
  const index = process.argv.indexOf("--offline");
  const offline: boolean = process.argv[index + 1] === "mock";
  let accessToken: AccessToken = new MockAccessToken();
  let testProjectId: string;
  const iModelHubClientMock = TypeMoq.Mock.ofType(IModelHubClient);
  const connectClientMock = TypeMoq.Mock.ofType(ConnectClient);
  const testIModels: TestIModelInfo[] = [
    new TestIModelInfo("ReadOnlyTest"),
    new TestIModelInfo("ReadWriteTest"),
    new TestIModelInfo("NoVersionsTest"),
  ];
  const assetDir = "./src/test/assets/_mocks_";
  let cacheDir: string;

  before(async () => {
    if (offline) {
      await MockAssetUtil.setupMockAssets(assetDir);
      testProjectId = await MockAssetUtil.setupOfflineFixture(accessToken, iModelHubClientMock, connectClientMock, assetDir, cacheDir, testIModels);
    } else {
      [accessToken, testProjectId, cacheDir] = await IModelTestUtils.setupIntegratedFixture(testIModels);
    }
  });

  after(() => {
    if (offline)
      MockAssetUtil.tearDownOfflineFixture();
  });

  it("Attach / Detach ChangeCache file to pullonly briefcase", async () => {
    const testIModelId: string = testIModels[1].id;
    setupTest(testIModelId);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenParams.pullOnly(), IModelVersion.latest());
    try {
      assert.exists(iModel);
      assert(iModel.openParams.openMode === OpenMode.ReadWrite);

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

      expect(IModelJsFs.existsSync(BriefcaseManager.getChangeCachePathName(testIModelId)));

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
    const testIModelId: string = testIModels[0].id;
    setupTest(testIModelId);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.exists(iModel);
    assert(iModel.openParams.openMode === OpenMode.Readonly);
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

      expect(IModelJsFs.existsSync(BriefcaseManager.getChangeCachePathName(testIModelId)));

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

  it("ECSqlStatementCache after detaching Changes Cache", async () => {
    const testIModelId: string = testIModels[0].id;
    setupTest(testIModelId);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.exists(iModel);
    assert(iModel.openParams.openMode === OpenMode.Readonly);
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
    const testIModelId: string = testIModels[0].id;
    setupTest(testIModelId);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenParams.fixedVersion(), IModelVersion.latest());
    await iModel.close(accessToken);
    assert.exists(iModel);
    assert.throw(() => ChangeSummaryManager.isChangeCacheAttached(iModel));
    assert.throw(() => ChangeSummaryManager.attachChangeCache(iModel));
    assert.throw(() => ChangeSummaryManager.detachChangeCache(iModel));
  });

  it("Extract ChangeSummaries", async () => {
    const testIModelId: string = testIModels[0].id;
    setupTest(testIModelId);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenParams.pullOnly(AccessMode.Exclusive), IModelVersion.latest());
    assert.exists(iModel);
    try {
      const summaryIds: Id64[] = await ChangeSummaryManager.extractChangeSummaries(iModel);
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,ExtendedProperties FROM change.ChangeSummary ORDER BY ECInstanceId", (myStmt) => {
        let rowCount: number = 0;
        while (myStmt.step() === DbResult.BE_SQLITE_ROW) {
          rowCount++;
          const row: any = myStmt.getRow();
          assert.equal(row.className, "ECDbChange.ChangeSummary");
          assert.isUndefined(row.extendedProperties, "ChangeSummary.ExtendedProperties is not expected to be populated when change summaries are extracted.");
        }
        assert.isAtLeast(rowCount, 3);
      });

      iModel.withPreparedStatement("SELECT ECClassId,Summary,WsgId,ParentWsgId,Description,PushDate,Author FROM imodelchange.ChangeSet ORDER BY Summary.Id", (myStmt) => {
        let rowCount: number = 0;
        while (myStmt.step() === DbResult.BE_SQLITE_ROW) {
          rowCount++;
          const row: any = myStmt.getRow();
          assert.equal(row.className, "IModelChange.ChangeSet");
          assert.equal(row.summary.id, summaryIds[rowCount - 1].value);
          assert.equal(row.summary.relClassName, "IModelChange.ChangeSummaryIsExtractedFromChangeset");
          assert.isDefined(row.pushDate, "IModelChange.ChangeSet.PushDate is expected to be set for the changesets used in this test.");
          assert.isDefined(row.author, "IModelChange.ChangeSet.Author is expected to be set for the changesets used in this test.");
          // the other properties are not used, but using them in the ECSQL is important to verify preparation works
        }
        assert.isAtLeast(rowCount, 3);
      });

    } finally {
      await iModel.close(accessToken);
    }
  });

  it("Extract ChangeSummary for single changeset", async () => {
    const testIModelId: string = testIModels[0].id;
    setupTest(testIModelId);

    const changeSets: ChangeSet[] = await BriefcaseManager.hubClient.ChangeSets().get(accessToken, testIModelId);
    assert.isAtLeast(changeSets.length, 3);
    // extract summary for second changeset
    const changesetId: string = changeSets[1].wsgId;

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenParams.pullOnly(AccessMode.Exclusive), IModelVersion.latest());
    try {
      assert.exists(iModel);
      await iModel.reverseChanges(accessToken, IModelVersion.asOfChangeSet(changesetId));

      // now extract change summary for that one changeset
      const summaryIds: Id64[] = await ChangeSummaryManager.extractChangeSummaries(iModel, { currentVersionOnly: true });
      assert.equal(summaryIds.length, 1);
      assert.isTrue(summaryIds[0].isValid());
      assert.isTrue(IModelJsFs.existsSync(BriefcaseManager.getChangeCachePathName(testIModelId)));
      assert.exists(iModel);
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      iModel.withPreparedStatement("SELECT WsgId, Summary, ParentWsgId, Description, PushDate, Author FROM imodelchange.ChangeSet", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.isDefined(row.wsgId);
        assert.equal(row.wsgId, changesetId);
        assert.isDefined(row.summary);
        assert.equal(row.summary.id, summaryIds[0].value);
        assert.isDefined(row.pushDate, "IModelChange.ChangeSet.PushDate is expected to be set for the changesets used in this test.");
        assert.isDefined(row.author, "IModelChange.ChangeSet.Author is expected to be set for the changesets used in this test.");
        // the other properties are not used, but using them in the ECSQL is important to verify preparation works
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_DONE);
      });
    } finally {
      await iModel.close(accessToken);
    }
  });

  it("Extracting ChangeSummaries for a range of changesets", async () => {
    const testIModelId: string = testIModels[0].id;
    setupTest(testIModelId);

    const changeSets: ChangeSet[] = await BriefcaseManager.hubClient.ChangeSets().get(accessToken, testIModelId);
    assert.isAtLeast(changeSets.length, 3);
    const startChangeSetId: string = changeSets[0].id!;
    const endChangeSetId: string = changeSets[1].id!;
    const startVersion: IModelVersion = IModelVersion.asOfChangeSet(startChangeSetId);
    const endVersion: IModelVersion = IModelVersion.asOfChangeSet(endChangeSetId);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenParams.pullOnly(AccessMode.Exclusive), endVersion);
    try {
      assert.exists(iModel);
      const summaryIds: Id64[] = await ChangeSummaryManager.extractChangeSummaries(iModel, { startVersion });
      assert.equal(summaryIds.length, 2);
      assert.isTrue(IModelJsFs.existsSync(BriefcaseManager.getChangeCachePathName(testIModelId)));

      assert.exists(iModel);
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      iModel.withPreparedStatement("SELECT WsgId, Summary, ParentWsgId, Description, PushDate, Author FROM imodelchange.ChangeSet ORDER BY Summary.Id", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        let row: any = myStmt.getRow();
        assert.isDefined(row.wsgId);
        // Change summaries are extracted from end to start, so order is inverse of changesets
        assert.equal(row.wsgId, endChangeSetId);
        assert.isDefined(row.summary);
        assert.equal(row.summary.id, summaryIds[0].value);
        assert.isDefined(row.pushDate, "IModelChange.ChangeSet.PushDate is expected to be set for the changesets used in this test.");
        assert.isDefined(row.author, "IModelChange.ChangeSet.Author is expected to be set for the changesets used in this test.");
        // the other properties are not used, but using them in the ECSQL is important to verify preparation works
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        row = myStmt.getRow();
        assert.isDefined(row.wsgId);
        assert.equal(row.wsgId, startChangeSetId);
        assert.isDefined(row.summary);
        assert.equal(row.summary.id, summaryIds[1].value);
        assert.isDefined(row.pushDate, "IModelChange.ChangeSet.PushDate is expected to be set for the changesets used in this test.");
        assert.isDefined(row.author, "IModelChange.ChangeSet.Author is expected to be set for the changesets used in this test.");
      });
    } finally {
      await iModel.close(accessToken);
    }
  });

  it("Subsequent ChangeSummary extractions", async () => {
    const testIModelId: string = testIModels[0].id;
    setupTest(testIModelId);

    const changeSets: ChangeSet[] = await BriefcaseManager.hubClient.ChangeSets().get(accessToken, testIModelId);
    assert.isAtLeast(changeSets.length, 3);
    // first extraction: just first changeset
    const firstChangesetId: string = changeSets[0].id!;

    let iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenParams.pullOnly(AccessMode.Exclusive), IModelVersion.latest());
    try {
      assert.exists(iModel);
      await iModel.reverseChanges(accessToken, IModelVersion.asOfChangeSet(firstChangesetId));

      // now extract change summary for that one changeset
      const summaryIds: Id64[] = await ChangeSummaryManager.extractChangeSummaries(iModel, { currentVersionOnly: true });
      assert.equal(summaryIds.length, 1);
      assert.isTrue(IModelJsFs.existsSync(BriefcaseManager.getChangeCachePathName(testIModelId)));

      assert.exists(iModel);
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      iModel.withPreparedStatement("SELECT WsgId, Summary, ParentWsgId, Description, PushDate, Author FROM imodelchange.ChangeSet", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.isDefined(row.wsgId);
        assert.equal(row.wsgId, firstChangesetId);
        assert.isDefined(row.summary);
        assert.equal(row.summary.id, summaryIds[0].value);
        assert.isDefined(row.pushDate, "IModelChange.ChangeSet.PushDate is expected to be set for the changesets used in this test.");
        assert.isDefined(row.author, "IModelChange.ChangeSet.Author is expected to be set for the changesets used in this test.");
        // the other properties are not used, but using them in the ECSQL is important to verify preparation works
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_DONE);
      });

      // now do second extraction for last changeset
      const lastChangesetId: string = changeSets[changeSets.length - 1].id!;
      await iModel.close(accessToken);
      iModel = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(), IModelVersion.asOfChangeSet(lastChangesetId));
      // WIP not working yet until cache can be detached.
      // await iModel.pullAndMergeChanges(accessToken, IModelVersion.asOfChangeSet(lastChangesetId));

      await ChangeSummaryManager.extractChangeSummaries(iModel, { currentVersionOnly: true });

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
    const testIModelId: string = testIModels[0].id;
    setupTest(testIModelId);

    // extract on fixedVersion(exclusive access) iModel should fail
    let iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenParams.fixedVersion(AccessMode.Exclusive));
    try {
      assert.exists(iModel);
      await ChangeSummaryManager.extractChangeSummaries(iModel);
    } catch (e) {
      assert.isDefined(e.errorNumber);
      assert.equal(e.errorNumber, ChangeSetStatus.CannotMergeIntoReadonly);
    } finally {
      await iModel.close(accessToken);
    }

    // extract on fixedVersion(shared access) iModel should fail
    iModel = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenParams.fixedVersion(AccessMode.Shared));
    try {
      assert.exists(iModel);
      await ChangeSummaryManager.extractChangeSummaries(iModel);
    } catch (e) {
      assert.isDefined(e.errorNumber);
      assert.equal(e.errorNumber, ChangeSetStatus.ApplyError);
    } finally {
      await iModel.close(accessToken);
    }

    // extract on closed iModel should fail
    iModel = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenParams.fixedVersion());
    try {
      assert.exists(iModel);
      await iModel.close(accessToken);
      await ChangeSummaryManager.extractChangeSummaries(iModel);
    } catch (e) {
      assert.isDefined(e.errorNumber);
      assert.equal(e.errorNumber, IModelStatus.BadArg);
    }

    // extract on standalone iModel should fail
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
    // testProjectId = "d46de192-6cad-4086-b968-71b517edc215";
    // const testIModelId: string = "a237be2f-7a59-4f40-a0bd-14bf9c0634f1";
    const testIModelId: string = testIModels[0].id;
    setupTest(testIModelId);

    let perfLogger = new PerfLogger("IModelDb.open");
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenParams.pullOnly(AccessMode.Exclusive), IModelVersion.latest());
    perfLogger.dispose();
    try {
      await ChangeSummaryManager.extractChangeSummaries(iModel);
      assert.exists(iModel);
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      const outDir = KnownTestLocations.outputDir;
      if (!IModelJsFs.existsSync(outDir))
        IModelJsFs.mkdirSync(outDir);

      const changeSummaries = new Array<ChangeSummary>();
      iModel.withPreparedStatement("SELECT ECInstanceId FROM ecchange.change.ChangeSummary ORDER BY ECInstanceId", (stmt) => {
        perfLogger = new PerfLogger("ChangeSummaryManager.queryChangeSummary");
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          const row = stmt.getRow();
          const csum: ChangeSummary = ChangeSummaryManager.queryChangeSummary(iModel, new Id64(row.id));
          changeSummaries.push(csum);
        }
        perfLogger.dispose();
      });

      for (const changeSummary of changeSummaries) {
        const filePath = path.join(outDir, "imodelid_" + testIModels[1].id + "_changesummaryid_" + changeSummary.id.value + ".changesummary.json");
        if (IModelJsFs.existsSync(filePath))
          IModelJsFs.unlinkSync(filePath);

        const content = { id: changeSummary.id, changeSet: changeSummary.changeSet, instanceChanges: new Array<any>() };
        iModel.withPreparedStatement("SELECT ECInstanceId FROM ecchange.change.InstanceChange WHERE Summary.Id=? ORDER BY ECInstanceId", (stmt) => {
          stmt.bindId(1, changeSummary.id);
          perfLogger = new PerfLogger("ChangeSummaryManager.queryInstanceChange for all instances in ChangeSummary " + changeSummary.id);
          while (stmt.step() === DbResult.BE_SQLITE_ROW) {
            const row = stmt.getRow();

            const instanceChange: any = ChangeSummaryManager.queryInstanceChange(iModel, new Id64(row.id));
            switch (instanceChange.opCode) {
              case ChangeOpCode.Insert: {
                const rows: any[] = iModel.executeQuery(ChangeSummaryManager.buildPropertyValueChangesECSql(iModel, instanceChange, ChangedValueState.AfterInsert));
                assert.equal(rows.length, 1);
                instanceChange.after = rows[0];
                break;
              }
              case ChangeOpCode.Update: {
                let rows: any[] = iModel.executeQuery(ChangeSummaryManager.buildPropertyValueChangesECSql(iModel, instanceChange, ChangedValueState.BeforeUpdate));
                assert.equal(rows.length, 1);
                instanceChange.before = rows[0];
                rows = iModel.executeQuery(ChangeSummaryManager.buildPropertyValueChangesECSql(iModel, instanceChange, ChangedValueState.BeforeUpdate));
                assert.equal(rows.length, 1);
                instanceChange.after = rows[0];
                break;
              }
              case ChangeOpCode.Delete: {
                const rows: any[] = iModel.executeQuery(ChangeSummaryManager.buildPropertyValueChangesECSql(iModel, instanceChange, ChangedValueState.BeforeDelete));
                assert.equal(rows.length, 1);
                instanceChange.before = rows[0];
                break;
              }
              default:
                throw new Error("Unexpected ChangedOpCode " + instanceChange.opCode);
            }

            content.instanceChanges.push(instanceChange);
          }
          perfLogger.dispose();
        });

        IModelJsFs.writeFileSync(filePath, JSON.stringify(content));
      }
    } finally {
      await iModel.close(accessToken);
    }
  });
});
