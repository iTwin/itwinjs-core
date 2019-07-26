/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { expect, assert } from "chai";
import { OpenMode, DbResult, Id64String, Id64, PerfLogger, ChangeSetStatus, using, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { ChangeSet } from "@bentley/imodeljs-clients";
import { IModelVersion, IModelStatus, ChangeOpCode, ChangedValueState, IModel, SubCategoryAppearance, ColorDef, RelatedElement } from "@bentley/imodeljs-common";
import {
  BriefcaseManager, ChangeSummaryManager, ChangeSummary,
  IModelDb, OpenParams, IModelJsFs, AuthorizedBackendRequestContext, ElementOwnsChildElements,
} from "../../imodeljs-backend";
import { IModelTestUtils, DisableNativeAssertions, TestIModelInfo } from "../IModelTestUtils";
import { TestUsers } from "../TestUsers";
import { KnownTestLocations } from "../KnownTestLocations";
import { HubUtility } from "./HubUtility";
import { KeepBriefcase } from "../../BriefcaseManager";
import { SpatialCategory } from "../../Category";
import { ConcurrencyControl } from "../../ConcurrencyControl";

function setupTest(iModelId: string): void {
  const cacheFilePath: string = BriefcaseManager.getChangeCachePathName(iModelId);
  if (IModelJsFs.existsSync(cacheFilePath))
    IModelJsFs.removeSync(cacheFilePath);
}

function getChangeSummaryAsJson(iModel: IModelDb, changeSummaryId: string) {
  const changeSummary: ChangeSummary = ChangeSummaryManager.queryChangeSummary(iModel, changeSummaryId);
  const content = { id: changeSummary.id, changeSet: changeSummary.changeSet, instanceChanges: new Array<any>() };

  iModel.withPreparedStatement("SELECT ECInstanceId FROM ecchange.change.InstanceChange WHERE Summary.Id=? ORDER BY ECInstanceId", (stmt) => {
    stmt.bindId(1, changeSummary.id);
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const row = stmt.getRow();

      const instanceChange: any = ChangeSummaryManager.queryInstanceChange(iModel, Id64.fromJSON(row.id));
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
          rows = iModel.executeQuery(ChangeSummaryManager.buildPropertyValueChangesECSql(iModel, instanceChange, ChangedValueState.AfterUpdate));
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
  });

  return content;
}

describe("ChangeSummary (#integration)", () => {
  let requestContext: AuthorizedBackendRequestContext;
  let testProjectId: string;

  let readOnlyTestIModel: TestIModelInfo;
  let readWriteTestIModel: TestIModelInfo;

  before(async () => {
    Logger.setLevel("ECDb", LogLevel.Info);
    requestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.regular);

    testProjectId = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");
    readOnlyTestIModel = await IModelTestUtils.getTestModelInfo(requestContext, testProjectId, "ReadOnlyTest");
    readWriteTestIModel = await IModelTestUtils.getTestModelInfo(requestContext, testProjectId, "ReadWriteTest");

    // Purge briefcases that are close to reaching the acquire limit
    const managerRequestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.manager);
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, "iModelJsIntegrationTest", "ReadOnlyTest");
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, "iModelJsIntegrationTest", "ReadWriteTest");
  });

  it("Attach / Detach ChangeCache file to PullAndPush briefcase", async () => {
    setupTest(readWriteTestIModel.id);

    const iModel: IModelDb = await IModelDb.open(requestContext, testProjectId, readWriteTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
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

      expect(IModelJsFs.existsSync(BriefcaseManager.getChangeCachePathName(readWriteTestIModel.id)));

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
      await iModel.close(requestContext, KeepBriefcase.No);
    }
  });

  it("Attach / Detach ChangeCache file to readonly briefcase", async () => {
    setupTest(readOnlyTestIModel.id);

    const iModel: IModelDb = await IModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.latest());
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

      expect(IModelJsFs.existsSync(BriefcaseManager.getChangeCachePathName(readOnlyTestIModel.id)));

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
      await iModel.close(requestContext);
    }
  });

  it("ECSqlStatementCache after detaching Changes Cache", async () => {
    setupTest(readOnlyTestIModel.id);

    const iModel: IModelDb = await IModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.latest());
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
      await iModel.close(requestContext);
    }
  });

  it("Attach / Detach ChangeCache file to closed imodel", async () => {
    setupTest(readOnlyTestIModel.id);

    const iModel: IModelDb = await IModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.latest());
    await iModel.close(requestContext);
    assert.exists(iModel);
    assert.throw(() => ChangeSummaryManager.isChangeCacheAttached(iModel));
    assert.throw(() => ChangeSummaryManager.attachChangeCache(iModel));
    assert.throw(() => ChangeSummaryManager.detachChangeCache(iModel));
  });

  it("Extract ChangeSummaries", async () => {
    setupTest(readOnlyTestIModel.id);

    const iModel: IModelDb = await IModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    assert.exists(iModel);
    try {
      const summaryIds: Id64String[] = await ChangeSummaryManager.extractChangeSummaries(requestContext, iModel);
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

      iModel.withPreparedStatement("SELECT ECClassId,Summary,WsgId,ParentWsgId,Description,PushDate,UserCreated FROM imodelchange.ChangeSet ORDER BY Summary.Id", (myStmt) => {
        let rowCount: number = 0;
        while (myStmt.step() === DbResult.BE_SQLITE_ROW) {
          rowCount++;
          const row: any = myStmt.getRow();
          assert.equal(row.className, "IModelChange.ChangeSet");
          assert.equal(row.summary.id, summaryIds[rowCount - 1]);
          assert.equal(row.summary.relClassName, "IModelChange.ChangeSummaryIsExtractedFromChangeset");
          assert.isDefined(row.pushDate, "IModelChange.ChangeSet.PushDate is expected to be set for the changesets used in this test.");
          assert.isDefined(row.userCreated, "IModelChange.ChangeSet.UserCreated is expected to be set for the changesets used in this test.");
          // the other properties are not used, but using them in the ECSQL is important to verify preparation works
        }
        assert.isAtLeast(rowCount, 3);
      });

    } finally {
      await iModel.close(requestContext, KeepBriefcase.No);
    }
  });

  it("Extract ChangeSummary for single changeset", async () => {
    setupTest(readOnlyTestIModel.id);

    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.changeSets.get(requestContext, readOnlyTestIModel.id);
    assert.isAtLeast(changeSets.length, 3);
    // extract summary for second changeset
    const changesetId: string = changeSets[1].wsgId;

    const iModel: IModelDb = await IModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    try {
      assert.exists(iModel);
      await iModel.reverseChanges(requestContext, IModelVersion.asOfChangeSet(changesetId));

      // now extract change summary for that one changeset
      const summaryIds: Id64String[] = await ChangeSummaryManager.extractChangeSummaries(requestContext, iModel, { currentVersionOnly: true });
      assert.equal(summaryIds.length, 1);
      assert.isTrue(Id64.isValidId64(summaryIds[0]));
      assert.isTrue(IModelJsFs.existsSync(BriefcaseManager.getChangeCachePathName(readOnlyTestIModel.id)));
      assert.exists(iModel);
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      iModel.withPreparedStatement("SELECT WsgId, Summary, ParentWsgId, Description, PushDate, UserCreated FROM imodelchange.ChangeSet", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.isDefined(row.wsgId);
        assert.equal(row.wsgId, changesetId);
        assert.isDefined(row.summary);
        assert.equal(row.summary.id, summaryIds[0]);
        assert.isDefined(row.pushDate, "IModelChange.ChangeSet.PushDate is expected to be set for the changesets used in this test.");
        assert.isDefined(row.userCreated, "IModelChange.ChangeSet.UserCreated is expected to be set for the changesets used in this test.");
        // the other properties are not used, but using them in the ECSQL is important to verify preparation works
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_DONE);
      });
    } finally {
      await iModel.close(requestContext, KeepBriefcase.No);
    }
  });

  it("Extracting ChangeSummaries for a range of changesets", async () => {
    setupTest(readOnlyTestIModel.id);

    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.changeSets.get(requestContext, readOnlyTestIModel.id);
    assert.isAtLeast(changeSets.length, 3);
    const startChangeSetId: string = changeSets[0].id!;
    const endChangeSetId: string = changeSets[1].id!;
    const startVersion: IModelVersion = IModelVersion.asOfChangeSet(startChangeSetId);
    const endVersion: IModelVersion = IModelVersion.asOfChangeSet(endChangeSetId);

    const iModel: IModelDb = await IModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), endVersion);
    try {
      assert.exists(iModel);
      const summaryIds: Id64String[] = await ChangeSummaryManager.extractChangeSummaries(requestContext, iModel, { startVersion });
      assert.equal(summaryIds.length, 2);
      assert.isTrue(IModelJsFs.existsSync(BriefcaseManager.getChangeCachePathName(readOnlyTestIModel.id)));

      assert.exists(iModel);
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      iModel.withPreparedStatement("SELECT WsgId, Summary, ParentWsgId, Description, PushDate, UserCreated FROM imodelchange.ChangeSet ORDER BY Summary.Id", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        let row: any = myStmt.getRow();
        assert.isDefined(row.wsgId);
        // Change summaries are extracted from end to start, so order is inverse of changesets
        assert.equal(row.wsgId, endChangeSetId);
        assert.isDefined(row.summary);
        assert.equal(row.summary.id, summaryIds[0]);
        assert.isDefined(row.pushDate, "IModelChange.ChangeSet.PushDate is expected to be set for the changesets used in this test.");
        assert.isDefined(row.userCreated, "IModelChange.ChangeSet.UserCreated is expected to be set for the changesets used in this test.");
        // the other properties are not used, but using them in the ECSQL is important to verify preparation works
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        row = myStmt.getRow();
        assert.isDefined(row.wsgId);
        assert.equal(row.wsgId, startChangeSetId);
        assert.isDefined(row.summary);
        assert.equal(row.summary.id, summaryIds[1]);
        assert.isDefined(row.pushDate, "IModelChange.ChangeSet.PushDate is expected to be set for the changesets used in this test.");
        assert.isDefined(row.userCreated, "IModelChange.ChangeSet.UserCreated is expected to be set for the changesets used in this test.");
      });
    } finally {
      await iModel.close(requestContext, KeepBriefcase.No);
    }
  });

  it("Subsequent ChangeSummary extractions", async () => {
    setupTest(readOnlyTestIModel.id);

    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.changeSets.get(requestContext, readOnlyTestIModel.id);
    assert.isAtLeast(changeSets.length, 3);
    // first extraction: just first changeset
    const firstChangesetId: string = changeSets[0].id!;

    let iModel: IModelDb = await IModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    try {
      assert.exists(iModel);
      await iModel.reverseChanges(requestContext, IModelVersion.asOfChangeSet(firstChangesetId));

      // now extract change summary for that one changeset
      const summaryIds: Id64String[] = await ChangeSummaryManager.extractChangeSummaries(requestContext, iModel, { currentVersionOnly: true });
      assert.equal(summaryIds.length, 1);
      assert.isTrue(IModelJsFs.existsSync(BriefcaseManager.getChangeCachePathName(readOnlyTestIModel.id)));

      assert.exists(iModel);
      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      iModel.withPreparedStatement("SELECT WsgId, Summary, ParentWsgId, Description, PushDate, UserCreated FROM imodelchange.ChangeSet", (myStmt) => {
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_ROW);
        const row: any = myStmt.getRow();
        assert.isDefined(row.wsgId);
        assert.equal(row.wsgId, firstChangesetId);
        assert.isDefined(row.summary);
        assert.equal(row.summary.id, summaryIds[0]);
        assert.isDefined(row.pushDate, "IModelChange.ChangeSet.PushDate is expected to be set for the changesets used in this test.");
        assert.isDefined(row.userCreated, "IModelChange.ChangeSet.UserCreated is expected to be set for the changesets used in this test.");
        // the other properties are not used, but using them in the ECSQL is important to verify preparation works
        assert.equal(myStmt.step(), DbResult.BE_SQLITE_DONE);
      });

      // now do second extraction for last changeset
      const lastChangesetId: string = changeSets[changeSets.length - 1].id!;
      await iModel.close(requestContext, KeepBriefcase.No);
      iModel = await IModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.asOfChangeSet(lastChangesetId));
      // WIP not working yet until cache can be detached.
      // await iModel.pullAndMergeChanges(accessToken, IModelVersion.asOfChangeSet(lastChangesetId));

      await ChangeSummaryManager.extractChangeSummaries(requestContext, iModel, { currentVersionOnly: true });

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
      await iModel.close(requestContext);
    }
  });

  it("Extract ChangeSummaries with invalid input", async () => {
    setupTest(readOnlyTestIModel.id);

    // extract on fixedVersion(exclusive access) iModel should fail
    let iModel: IModelDb = await IModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion());
    try {
      assert.exists(iModel);
      await using(new DisableNativeAssertions(), async (_r) => {
        await ChangeSummaryManager.extractChangeSummaries(requestContext, iModel);
      });
    } catch (e) {
      assert.isDefined(e.errorNumber);
      assert.equal(e.errorNumber, ChangeSetStatus.ApplyError);
    } finally {
      await iModel.close(requestContext);
    }

    // extract on fixedVersion(shared access) iModel should fail
    iModel = await IModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion());
    try {
      assert.exists(iModel);
      await using(new DisableNativeAssertions(), async (_r) => {
        await ChangeSummaryManager.extractChangeSummaries(requestContext, iModel);
      });
    } catch (e) {
      assert.isDefined(e.errorNumber);
      assert.equal(e.errorNumber, ChangeSetStatus.ApplyError);
    } finally {
      await iModel.close(requestContext);
    }

    // extract on closed iModel should fail
    iModel = await IModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion());
    try {
      assert.exists(iModel);
      await iModel.close(requestContext);
      await using(new DisableNativeAssertions(), async (_r) => {
        await ChangeSummaryManager.extractChangeSummaries(requestContext, iModel);
      });
    } catch (e) {
      assert.isDefined(e.errorNumber);
      assert.equal(e.errorNumber, IModelStatus.NotOpen);
    }

    // extract on snapshot iModel should fail
    iModel = IModelDb.openSnapshot(IModelTestUtils.resolveAssetFile("test.bim"));
    assert.exists(iModel);
    assert.exists(iModel.briefcase);
    assert.isTrue(iModel.isStandalone);
    try {
      await using(new DisableNativeAssertions(), async (_r) => {
        await ChangeSummaryManager.extractChangeSummaries(requestContext, iModel);
      });
    } catch (e) {
      assert.isDefined(e.errorNumber);
      assert.equal(e.errorNumber, IModelStatus.BadArg);
    } finally {
      iModel.closeSnapshot();
    }
  });

  it("Query ChangeSummary content", async () => {
    const testIModelId: string = readOnlyTestIModel.id;
    setupTest(testIModelId);

    let perfLogger = new PerfLogger("IModelDb.open");
    const iModel: IModelDb = await IModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    perfLogger.dispose();
    try {
      await ChangeSummaryManager.extractChangeSummaries(requestContext, iModel);
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
          const csum: ChangeSummary = ChangeSummaryManager.queryChangeSummary(iModel, Id64.fromJSON(row.id));
          changeSummaries.push(csum);
        }
        perfLogger.dispose();
      });

      for (const changeSummary of changeSummaries) {
        const filePath = path.join(outDir, "imodelid_" + readWriteTestIModel.id + "_changesummaryid_" + changeSummary.id + ".changesummary.json");
        if (IModelJsFs.existsSync(filePath))
          IModelJsFs.unlinkSync(filePath);

        const content = { id: changeSummary.id, changeSet: changeSummary.changeSet, instanceChanges: new Array<any>() };
        iModel.withPreparedStatement("SELECT ECInstanceId FROM ecchange.change.InstanceChange WHERE Summary.Id=? ORDER BY ECInstanceId", (stmt) => {
          stmt.bindId(1, changeSummary.id);
          perfLogger = new PerfLogger("ChangeSummaryManager.queryInstanceChange for all instances in ChangeSummary " + changeSummary.id);
          while (stmt.step() === DbResult.BE_SQLITE_ROW) {
            const row = stmt.getRow();

            const instanceChange: any = ChangeSummaryManager.queryInstanceChange(iModel, Id64.fromJSON(row.id));
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
      await iModel.close(requestContext, KeepBriefcase.No);
    }
  });

  it("Create ChangeSummary-s for changes to parent elements", async () => {
    // Generate a unique name for the iModel (so that this test can be run simultaneously by multiple users+hosts simultaneously)
    const iModelName = HubUtility.generateUniqueName("ParentElementChangeTest");

    // Recreate iModel
    const managerRequestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.manager);
    const projectId: string = await HubUtility.queryProjectIdByName(managerRequestContext, "iModelJsIntegrationTest");
    const iModelId = await HubUtility.recreateIModel(managerRequestContext, projectId, iModelName);

    // Cleanup local cache
    setupTest(iModelId);

    // Populate the iModel with 3 elements
    const iModel = await IModelDb.open(managerRequestContext, projectId, iModelId, OpenParams.pullAndPush(), IModelVersion.latest());
    iModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    const [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(iModel, IModelTestUtils.getUniqueModelCode(iModel, "TestPhysicalModel"), true);
    await iModel.concurrencyControl.request(managerRequestContext);
    iModel.saveChanges("Added test model");
    const categoryId = SpatialCategory.insert(iModel, IModel.dictionaryId, "TestSpatialCategory", new SubCategoryAppearance({ color: new ColorDef("rgb(255,0,0)") }));
    await iModel.concurrencyControl.request(managerRequestContext);
    iModel.saveChanges("Added test category");
    const elementId1: Id64String = iModel.elements.insertElement(IModelTestUtils.createPhysicalObject(iModel, modelId, categoryId));
    const elementId2: Id64String = iModel.elements.insertElement(IModelTestUtils.createPhysicalObject(iModel, modelId, categoryId));
    const elementId3: Id64String = iModel.elements.insertElement(IModelTestUtils.createPhysicalObject(iModel, modelId, categoryId));
    await iModel.concurrencyControl.request(managerRequestContext);
    iModel.saveChanges("Added test elements");

    // Setup the hierarchy as element3 -> element1
    const element3 = iModel.elements.getElement(elementId3);
    element3.parent = new RelatedElement({ id: elementId1, relClassName: ElementOwnsChildElements.classFullName });
    iModel.elements.updateElement(element3);
    iModel.saveChanges("Updated element1 as the parent of element3");

    // Push changes to the hub
    await iModel.pushChanges(managerRequestContext, () => "Setup test model");

    // Modify the hierarchy to element3 -> element2
    element3.parent = new RelatedElement({ id: elementId2, relClassName: ElementOwnsChildElements.classFullName });
    iModel.elements.updateElement(element3);
    iModel.saveChanges("Updated element2 as the parent of element3");

    // Push changes to the hub
    await iModel.pushChanges(managerRequestContext, () => "Updated parent element");

    // Validate that the second change summary captures the change to the parent correctly
    try {
      const changeSummaryIds: string[] = await ChangeSummaryManager.extractChangeSummaries(requestContext, iModel);
      assert.strictEqual(2, changeSummaryIds.length);

      ChangeSummaryManager.attachChangeCache(iModel);
      assert.isTrue(ChangeSummaryManager.isChangeCacheAttached(iModel));

      const changeSummaryJson = getChangeSummaryAsJson(iModel, changeSummaryIds[0]);
      // console.log(JSON.stringify(changeSummaryJson)); // tslint:disable-line

      assert.strictEqual(changeSummaryJson.instanceChanges.length, 2);

      const instanceChange = changeSummaryJson.instanceChanges[0];
      assert.strictEqual(instanceChange.changedInstance.id, elementId3);
      assert.strictEqual(instanceChange.changedInstance.className, "[Generic].[PhysicalObject]");
      assert.strictEqual(instanceChange.before["parent.id"], elementId1);
      assert.strictEqual(instanceChange.after["parent.id"], elementId2);

      const relInstanceChange = changeSummaryJson.instanceChanges[1];
      assert.strictEqual(relInstanceChange.changedInstance.className, "[BisCore].[ElementOwnsChildElements]");
      assert.strictEqual(relInstanceChange.before.sourceId, elementId1);
      assert.strictEqual(relInstanceChange.before.targetId, elementId3);
      assert.strictEqual(relInstanceChange.after.sourceId, elementId2);
      assert.strictEqual(relInstanceChange.after.targetId, elementId3);
    } finally {
      await iModel.close(requestContext, KeepBriefcase.No);
    }

    await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, iModelId);
  });

});
