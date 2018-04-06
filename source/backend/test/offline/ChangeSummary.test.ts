/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { expect, assert } from "chai";
import { OpenMode, DbResult, Id64 } from "@bentley/bentleyjs-core";
import { AccessToken, ConnectClient, IModelHubClient, Project, IModelQuery } from "@bentley/imodeljs-clients";
import { IModelVersion, IModelStatus } from "@bentley/imodeljs-common";
import { ChangeSummaryManager, ChangeSummary, InstanceChange } from "../../ChangeSummaryManager";
import { BriefcaseManager } from "../../BriefcaseManager";
import { IModelDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { ChangeSet } from "@bentley/imodeljs-clients";
import { KnownTestLocations } from "../KnownTestLocations";
import { IModelJsFs } from "../../IModelJsFs";
import { IModelHost } from "../../IModelHost";
import { TestIModelInfo, MockAssetUtil, MockAccessToken/*, Timer*/ } from "../MockAssetUtil";
import * as TypeMoq from "typemoq";

describe.skip("ChangeSummary", () => {
  let accessToken: AccessToken;
  let testProjectId: string;

  // const testIModels: TestIModelInfo[] = [
  //   new TestIModelInfo("ReadOnlyTest"),
  //   new TestIModelInfo("ReadWriteTest"),
  //   new TestIModelInfo("NoVersionsTest"),
  // ];
  const spoofAccessToken: MockAccessToken = new MockAccessToken();
  const iModelHubClientMock = TypeMoq.Mock.ofType(IModelHubClient);
  const iModelVersionMock = TypeMoq.Mock.ofType(IModelVersion);
  const connectClientMock = TypeMoq.Mock.ofType(ConnectClient);
  const testIModels: TestIModelInfo[] = [
    new TestIModelInfo("ReadOnlyTest"),
    new TestIModelInfo("ReadWriteTest"),
    new TestIModelInfo("NoVersionsTest"),
  ];
  const assetDir = "./test/assets/_mocks_";

  const cacheDir = IModelHost.configuration!.briefcaseCacheDir;

  before(async () => {
    const startTime = new Date().getTime();

    accessToken = await IModelTestUtils.getTestUserAccessToken();
    MockAssetUtil.setupConnectClientMock(connectClientMock, assetDir);
    MockAssetUtil.setupIModelHubClientMock(iModelHubClientMock, assetDir);
    MockAssetUtil.setupIModelVersionMock(iModelVersionMock);

    BriefcaseManager.hubClient = iModelHubClientMock.object;
    ChangeSummaryManager.hubClient = iModelHubClientMock.object;

    // Get test projectId from the mocked connection client
    const project: Project = await connectClientMock.object.getProject(spoofAccessToken as any, {
      $select: "*",
      $filter: "Name+eq+'NodeJstestproject'",
    });
    // connectClientMock.verify((f: ConnectClient) => f.getProject(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));
    assert(project && project.wsgId, "No projectId returned from connectionClient mock");
    testProjectId = project.wsgId;

    // Get test iModelIds from the mocked iModelHub client
    for (const iModelInfo of testIModels) {
      const iModels = await iModelHubClientMock.object.IModels().get(spoofAccessToken as any, testProjectId, new IModelQuery().byName(iModelInfo.name));
      assert(iModels.length > 0, `No IModels returned from iModelHubClient mock for ${iModelInfo.name} iModel`);
      assert(iModels[0].wsgId, `No IModelId returned for ${iModelInfo.name} iModel`);
      iModelInfo.id = iModels[0].wsgId;
      iModelInfo.localReadonlyPath = path.join(cacheDir, iModelInfo.id, "readOnly");
      iModelInfo.localReadWritePath = path.join(cacheDir, iModelInfo.id, "readWrite");

      // getChangeSets
      iModelInfo.changeSets = await iModelHubClientMock.object.ChangeSets().get(spoofAccessToken as any, iModelInfo.id);
      expect(iModelInfo.changeSets);

      // downloadChangeSets
      const csetDir = path.join(cacheDir, iModelInfo.id, "csets");
      await iModelHubClientMock.object.ChangeSets().download(iModelInfo.changeSets, csetDir);
    }
    MockAssetUtil.verifyIModelInfo(testIModels);

    console.log(`    ...getting information on Project+IModel+ChangeSets for test case from mock data: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console

    // Delete briefcases if the cache has been cleared, *and* we cannot acquire any more briefcases
    if (!IModelJsFs.existsSync(cacheDir)) {
      await IModelTestUtils.deleteBriefcasesIfAcquireLimitReached(accessToken, "iModelJsTest", "ReadOnlyTest");
      await IModelTestUtils.deleteBriefcasesIfAcquireLimitReached(accessToken, "iModelJsTest", "NoVersionsTest");
    }

    const changesPath: string = BriefcaseManager.getChangeSummaryPathname(testIModels[1].id);
    if (IModelJsFs.existsSync(changesPath))
      IModelJsFs.unlinkSync(changesPath);
  });

  it("Attach / Detach ChangeCache file to readwrite briefcase", async () => {
    const iModel: IModelDb = await IModelDb.open(spoofAccessToken, testProjectId, testIModels[1].id, OpenMode.ReadWrite, iModelVersionMock.object);
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

      const expectedCachePath: string = path.join(cacheDir, testIModels[1].id, testIModels[1].id.concat(".bim.ecchanges"));
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
      await iModel.close(spoofAccessToken);
    }
  });

  it("Attach / Detach ChangeCache file to readonly briefcase", async () => {
    const iModel: IModelDb = await IModelDb.open(spoofAccessToken, testProjectId, testIModels[1].id, OpenMode.Readonly, iModelVersionMock.object);
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

      const expectedCachePath: string = path.join(cacheDir, testIModels[1].id, testIModels[1].id.concat(".bim.ecchanges"));
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
      await iModel.close(spoofAccessToken);
    }
  });

  it("ECSqlStatementCache after detaching Change Cache", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[1].id, OpenMode.Readonly, iModelVersionMock.object);
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
    const iModel: IModelDb = await IModelDb.open(spoofAccessToken, testProjectId, testIModels[1].id, OpenMode.ReadWrite, iModelVersionMock.object);
    await iModel.close(accessToken);
    assert.exists(iModel);
    assert.throw(() => ChangeSummaryManager.isChangeCacheAttached(iModel));
    assert.throw(() => ChangeSummaryManager.attachChangeCache(iModel));
    assert.throw(() => ChangeSummaryManager.detachChangeCache(iModel));
  });

  it.skip("Extract ChangeSummaries", async () => {
    const iModel: IModelDb = await IModelDb.open(spoofAccessToken, testProjectId, testIModels[1].id, OpenMode.ReadWrite, iModelVersionMock.object);
    assert.exists(iModel);
    try {
      await ChangeSummaryManager.extractChangeSummaries(accessToken, iModel);
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

  it.skip("Extract ChangeSummary for single changeset", async () => {
    const changeSets: ChangeSet[] = await IModelTestUtils.hubClient.ChangeSets().get(spoofAccessToken, testIModels[1].id);
    assert.isAtLeast(changeSets.length, 3);
    // extract summary for second changeset
    const changesetId: string = changeSets[1].wsgId;

    const changesFilePath: string = BriefcaseManager.getChangeSummaryPathname(testIModels[1].id);
    if (IModelJsFs.existsSync(changesFilePath))
      IModelJsFs.removeSync(changesFilePath);

      // TODO ADDITIONAL MOCK SET UP FOR ASOFCHANGESET
    const iModel: IModelDb = await IModelDb.open(spoofAccessToken, testProjectId, testIModels[1].id, OpenMode.ReadWrite, IModelVersion.asOfChangeSet(changesetId));
    try {
      assert.exists(iModel);

      // now extract change summary for that one changeset
      await ChangeSummaryManager.extractChangeSummaries(accessToken, iModel, {currentChangeSetOnly: true});
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
      await iModel.close(spoofAccessToken);
    }
  });

  it.skip("Subsequent ChangeSummary extractions", async () => {
    const changesFilePath: string = BriefcaseManager.getChangeSummaryPathname(testIModels[1].id);
    if (IModelJsFs.existsSync(changesFilePath))
      IModelJsFs.removeSync(changesFilePath);

    const changeSets: ChangeSet[] = await IModelTestUtils.hubClient.ChangeSets().get(spoofAccessToken, testIModels[1].id);
    assert.isAtLeast(changeSets.length, 3);
    // first extraction: just first changeset
    const firstChangesetId: string = changeSets[0].id!;

    let iModel: IModelDb = await IModelDb.open(spoofAccessToken, testProjectId, testIModels[1].id, OpenMode.ReadWrite, IModelVersion.asOfChangeSet(firstChangesetId));
    try {
      assert.exists(iModel);

      // now extract change summary for that one changeset
      await ChangeSummaryManager.extractChangeSummaries(spoofAccessToken, iModel, {currentChangeSetOnly: true});
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
      iModel = await IModelDb.open(spoofAccessToken, testProjectId, testIModels[1].id, OpenMode.ReadWrite, IModelVersion.asOfChangeSet(lastChangesetId));
      // WIP not working yet until cache can be detached.
      // await iModel.pullAndMergeChanges(accessToken, IModelVersion.asOfChangeSet(lastChangesetId));

      await ChangeSummaryManager.extractChangeSummaries(spoofAccessToken, iModel, {currentChangeSetOnly: true});

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

  it.skip("Extract ChangeSummaries with invalid input", async () => {
    let iModel: IModelDb = await IModelDb.open(spoofAccessToken, testProjectId, testIModels[1].id, OpenMode.Readonly);
    try {
      assert.exists(iModel);
      await ChangeSummaryManager.extractChangeSummaries(spoofAccessToken, iModel);
    } catch (e) {
      assert.isDefined(e.errorNumber);
      assert.equal(e.errorNumber, IModelStatus.BadArg);
    } finally {
      await iModel.close(spoofAccessToken);
    }

    // open standalone iModel
    iModel = IModelTestUtils.openIModel("test.bim");
    assert.exists(iModel);
    assert.exists(iModel.briefcase);
    assert.isTrue(iModel.briefcase!.isStandalone);
    try {
      await ChangeSummaryManager.extractChangeSummaries(spoofAccessToken, iModel);
    } catch (e) {
      assert.isDefined(e.errorNumber);
      assert.equal(e.errorNumber, IModelStatus.BadArg);
    } finally {
      iModel.closeStandalone();
    }
  });

  it.skip("Query ChangeSummary content", async () => {
    const iModel: IModelDb = await IModelDb.open(spoofAccessToken, testProjectId, testIModels[1].id, OpenMode.ReadWrite, IModelVersion.latest());
    await ChangeSummaryManager.extractChangeSummaries(spoofAccessToken, iModel);
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
      const filePath = path.join(outDir, "imodelid_" + testIModels[1].id + "_changesummaryid_" + changeSummary.id.value + ".changesummary.json");
      if (IModelJsFs.existsSync(filePath))
        IModelJsFs.unlinkSync(filePath);

      const content = { id: changeSummary.id, changeSet: changeSummary.changeSet, instanceChanges: new Array<InstanceChange>() };
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
