/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as semver from "semver";
import { DbResult, GuidString, Id64String } from "@bentley/bentleyjs-core";
import { IModel, RequestNewBriefcaseProps, SchemaState, SubCategoryAppearance } from "@bentley/imodeljs-common";
import {
  AuthorizedBackendRequestContext, BriefcaseDb, BriefcaseManager, DictionaryModel, Element, IModelHost, IModelJsFs, SpatialCategory, SqliteStatement,
  SqliteValue, SqliteValueType,
} from "../../imodeljs-backend";
import { HubMock } from "../HubMock";
import { IModelTestUtils, TestUserType, Timer } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

export async function createNewModelAndCategory(requestContext: AuthorizedBackendRequestContext, rwIModel: BriefcaseDb, parent?: Id64String) {
  // Create a new physical model.
  const [, modelId] = await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true, parent);
  requestContext.enter();

  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel<DictionaryModel>(IModel.dictionaryId);
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const category = SpatialCategory.create(rwIModel, IModel.dictionaryId, newCategoryCode.value);
  const spatialCategoryId = rwIModel.elements.insertElement(category);
  category.setDefaultAppearance(new SubCategoryAppearance({ color: 0xff0000 }));
  // const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value!, new SubCategoryAppearance({ color: 0xff0000 }));

  return { modelId, spatialCategoryId };
}

describe("IModelWriteTest (#integration)", () => {
  let managerRequestContext: AuthorizedBackendRequestContext;
  let superRequestContext: AuthorizedBackendRequestContext;
  let testContextId: string;
  let readWriteTestIModelId: GuidString;

  let readWriteTestIModelName: string;

  before(async () => {
    // IModelTestUtils.setupDebugLogLevels();
    HubMock.startup("IModelWriteTest");

    managerRequestContext = await IModelTestUtils.getUserContext(TestUserType.Manager);
    superRequestContext = await IModelTestUtils.getUserContext(TestUserType.Super);
    (superRequestContext as any).activityId = "IModelWriteTest (#integration)";

    testContextId = await HubUtility.getTestContextId(managerRequestContext);
    readWriteTestIModelName = HubUtility.generateUniqueName("ReadWriteTest");
    readWriteTestIModelId = await HubUtility.recreateIModel(managerRequestContext, testContextId, readWriteTestIModelName);

    // Purge briefcases that are close to reaching the acquire limit
    await HubUtility.purgeAcquiredBriefcasesById(managerRequestContext, readWriteTestIModelId);
  });

  after(async () => {
    try {
      await HubUtility.deleteIModel(managerRequestContext, "iModelJsIntegrationTest", readWriteTestIModelName);
      HubMock.shutdown();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
    }
  });

  it("test change-merging scenarios in optimistic concurrency mode (#integration)", async () => {
    const firstUserRequestContext = await IModelTestUtils.getUserContext(TestUserType.Super);
    (firstUserRequestContext as any).activityId = "test change-merging scenarios in optimistic concurrency mode (#integration)";
    const secondUserRequestContext = await IModelTestUtils.getUserContext(TestUserType.SuperManager);
    const neutralObserverUserRequestContext = await IModelTestUtils.getUserContext(TestUserType.Manager);

    const firstIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: firstUserRequestContext, contextId: testContextId, iModelId: readWriteTestIModelId });
    const secondIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: secondUserRequestContext, contextId: testContextId, iModelId: readWriteTestIModelId });
    const neutralObserverIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: neutralObserverUserRequestContext, contextId: testContextId, iModelId: readWriteTestIModelId });
    assert.notEqual(firstIModel, secondIModel);
    assert.equal(firstIModel.nativeDb.getBriefcaseId(), firstIModel.briefcaseId);
    assert.isAbove(firstIModel.briefcaseId, 0);
    assert.equal(secondIModel.nativeDb.getBriefcaseId(), secondIModel.briefcaseId);
    assert.isAbove(secondIModel.briefcaseId, 0);
    assert.equal(neutralObserverIModel.nativeDb.getBriefcaseId(), neutralObserverIModel.briefcaseId);
    assert.isAbove(neutralObserverIModel.briefcaseId, 0);

    // Note: neutralObserver's IModel does not need to be configured for optimistic concurrency. He just pulls changes.

    // firstUser: create model, category, and element el1
    const r = await createNewModelAndCategory(firstUserRequestContext, firstIModel);
    const el1 = firstIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(firstIModel, r.modelId, r.spatialCategoryId));
    // const el2 = firstIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(firstIModel, r.modelId, r.spatialCategoryId));
    firstIModel.saveChanges("firstUser created model, category, and two elements");
    await firstIModel.pushChanges(firstUserRequestContext, "test");

    // secondUser: pull and merge
    await secondIModel.pullAndMergeChanges(secondUserRequestContext);

    // --- Test 1: Overlapping changes that really are conflicts => conflict-resolution policy is applied ---

    // firstUser: modify el1.userLabel
    if (true) {
      const el1cc: Element = firstIModel.elements.getElement(el1);
      el1cc.userLabel = `${el1cc.userLabel} -> changed by firstUser`;
      firstIModel.elements.updateElement(el1cc);
      firstIModel.saveChanges("firstUser modified el1.userLabel");
      await firstIModel.pushChanges(firstUserRequestContext, "test");
    }

    // secondUser: modify el1.userLabel
    let expectedValueOfEl1UserLabel: string;
    if (true) {
      const el1before: Element = (secondIModel.elements.getElement(el1));
      expectedValueOfEl1UserLabel = `${el1before.userLabel} -> changed by secondUser`;
      el1before.userLabel = expectedValueOfEl1UserLabel;
      secondIModel.elements.updateElement(el1before);
      secondIModel.saveChanges("secondUser modified el1.userLabel");

      // pull + merge => take secondUser's change (RejectIncomingChange). That's because the default updateVsUpdate setting is RejectIncomingChange
      await secondIModel.pullAndMergeChanges(secondUserRequestContext);
      const el1after = secondIModel.elements.getElement(el1);
      assert.equal(el1after.userLabel, expectedValueOfEl1UserLabel);

      await secondIModel.pushChanges(secondUserRequestContext, "test");
    }

    // Make sure a neutral observer sees secondUser's change.
    if (true) {
      await neutralObserverIModel.pullAndMergeChanges(neutralObserverUserRequestContext);
      const elObj = neutralObserverIModel.elements.getElement(el1);
      assert.equal(elObj.userLabel, expectedValueOfEl1UserLabel);
    }

    // firstUser: pull and see that secondUser has overridden my change
    if (true) {
      await firstIModel.pullAndMergeChanges(firstUserRequestContext);
      const elObj = firstIModel.elements.getElement(el1);
      assert.equal(elObj.userLabel, expectedValueOfEl1UserLabel);
    }

    // --- Test 2: Overlapping changes that are not conflicts  ---
    /* **************** No. We do not support property-level change-merging.

    // firstUser: modify el1.userLabel
    const wasExpectedValueofEl1UserLabel = expectedValueofEl1UserLabel;
    if (true) {
      const el1cc: Element = firstIModel.elements.getElement(el1);
      assert.equal(el1cc.userLabel, wasExpectedValueofEl1UserLabel);
      expectedValueofEl1UserLabel = el1cc.userLabel + " -> changed again by firstUser";
      el1cc.userLabel = expectedValueofEl1UserLabel;
      firstIModel.elements.updateElement(el1cc);
      firstIModel.saveChanges("firstUser modified el1.userLabel");
      await firstIModel.pushChanges(firstUserRequestContext);
    }

    // Make sure a neutral observer sees firstUser's changes.
    if (true) {
      await neutralObserverIModel.pullAndMergeChanges(neutralObserverUserRequestContext);
      const elobj = neutralObserverIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
    }

    // secondUser: modify el1.userProperties
    const secondUserPropNs = "secondUser";
    const secondUserPropName = "property";
    const expectedValueOfSecondUserProp: string = "x";
    if (true) {
      const el1before: Element = secondIModel.elements.getElement(el1);
      assert.equal(el1before.userLabel, wasExpectedValueofEl1UserLabel);

      el1before.setUserProperties(secondUserPropNs, { property: expectedValueOfSecondUserProp }); // secondUser changes userProperties
      secondIModel.elements.updateElement(el1before);
      secondIModel.saveChanges("secondUser modified el1.userProperties");
      assert.equal(el1before.userLabel, wasExpectedValueofEl1UserLabel, "secondUser does not change userLabel");

      // pull + merge => no conflict + both changes should be intact
      await secondIModel.pullAndMergeChanges(secondUserRequestContext);
      const el1after = secondIModel.elements.getElement(el1);
      assert.equal(el1after.userLabel, expectedValueofEl1UserLabel);
      assert.equal(el1after.getUserProperties(secondUserPropNs)[secondUserPropName], expectedValueOfSecondUserProp);

      await secondIModel.pushChanges(secondUserRequestContext);
    }

    // firstUser: pull and see both changes
    if (true) {
      await firstIModel.pullAndMergeChanges(firstUserRequestContext);
      const elobj = firstIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
      assert.equal(elobj.getUserProperties(secondUserPropNs)[secondUserPropName], expectedValueOfSecondUserProp);
    }

    // Make sure a neutral observer sees both changes.
    if (true) {
      await neutralObserverIModel.pullAndMergeChanges(neutralObserverUserRequestContext);
      const elobj = neutralObserverIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
      assert.equal(elobj.getUserProperties(secondUserPropNs)[secondUserPropName], expectedValueOfSecondUserProp);
    }
  */
    // --- Test 3: Non-overlapping changes ---
    firstIModel.close();
    secondIModel.close();
    neutralObserverIModel.close();

  });

  it("should handle undo/redo (#integration)", async () => {
    const adminRequestContext = await IModelTestUtils.getUserContext(TestUserType.SuperManager);
    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "CodesUndoRedoPushTest";
    const iModelId = await IModelHost.hubAccess.queryIModelByName({ requestContext: adminRequestContext, contextId: testContextId, iModelName });
    if (iModelId)
      await IModelHost.hubAccess.deleteIModel({ requestContext: adminRequestContext, contextId: testContextId, iModelId });
    timer.end();

    // Create a new empty iModel on the Hub & obtain a briefcase
    timer = new Timer("create iModel");
    const rwIModelId = await IModelHost.hubAccess.createIModel({ requestContext: adminRequestContext, contextId: testContextId, iModelName, description: "TestSubject" });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: adminRequestContext, contextId: testContextId, iModelId: rwIModelId });
    timer.end();

    // create and insert a new model with code1
    const code1 = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel1");
    await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(rwIModel, code1, true);
    adminRequestContext.enter();

    assert.isTrue(rwIModel.elements.getElement(code1) !== undefined); // throws if element is not found

    // create a local txn with that change
    rwIModel.saveChanges("inserted newPhysicalModel");

    // Reverse that local txn
    rwIModel.txns.reverseSingleTxn();

    try {
      //  The model that I just created with code1 should no longer be there.
      const theNewModel = rwIModel.elements.getElement(code1); // throws if element is not found
      assert.isTrue(theNewModel === undefined); // really should not be here.
      assert.fail(); // should not be here.
    } catch (_err) {
      // this is what I expect
    }

    // Create and insert a model with code2
    const code2 = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel2");
    await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(rwIModel, code2, true);
    adminRequestContext.enter();

    rwIModel.saveChanges("inserted generic objects");

    // The iModel should have a model with code1 and not code2
    assert.isTrue(rwIModel.elements.getElement(code2) !== undefined); // throws if element is not found

    timer = new Timer("push changes");

    // Push the changes to the hub
    const prePushChangeset = rwIModel.changeset;
    await rwIModel.pushChanges(adminRequestContext, "test");
    const postPushChangeset = rwIModel.changeset;
    assert(!!postPushChangeset);
    expect(prePushChangeset !== postPushChangeset);

    timer.end();

    rwIModel.close();
    // The iModel should have code1 marked as used and not code2
    // timer = new Timer("querying codes");
    // const codes = await IModelHubAccess.iModelClient.codes.get(adminRequestContext, rwIModelId);
    // timer.end();
    // assert.isTrue(codes.find((code) => (code.value === "newPhysicalModel2" && code.state === CodeState.Used)) !== undefined);
    // assert.isFalse(codes.find((code) => (code.value === "newPhysicalModel" && code.state === CodeState.Used)) !== undefined);
  });

  it("Run plain SQL against fixed version connection", async () => {
    const iModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: managerRequestContext, contextId: testContextId, iModelId: readWriteTestIModelId });
    try {
      iModel.withPreparedSqliteStatement("CREATE TABLE Test(Id INTEGER PRIMARY KEY, Name TEXT NOT NULL, Code INTEGER)", (stmt: SqliteStatement) => {
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      iModel.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(?,?)", (stmt: SqliteStatement) => {
        stmt.bindValue(1, "Dummy 1");
        stmt.bindValue(2, 100);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      iModel.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(?,?)", (stmt: SqliteStatement) => {
        stmt.bindValues(["Dummy 2", 200]);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      iModel.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(:p1,:p2)", (stmt: SqliteStatement) => {
        stmt.bindValue(":p1", "Dummy 3");
        stmt.bindValue(":p2", 300);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      iModel.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(:p1,:p2)", (stmt: SqliteStatement) => {
        stmt.bindValues({ ":p1": "Dummy 4", ":p2": 400 });
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      iModel.saveChanges();

      iModel.withPreparedSqliteStatement("SELECT Id,Name,Code FROM Test ORDER BY Id", (stmt: SqliteStatement) => {
        for (let i: number = 1; i <= 4; i++) {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          assert.equal(stmt.getColumnCount(), 3);
          const val0: SqliteValue = stmt.getValue(0);
          assert.equal(val0.columnName, "Id");
          assert.equal(val0.type, SqliteValueType.Integer);
          assert.isFalse(val0.isNull);
          assert.equal(val0.getInteger(), i);

          const val1: SqliteValue = stmt.getValue(1);
          assert.equal(val1.columnName, "Name");
          assert.equal(val1.type, SqliteValueType.String);
          assert.isFalse(val1.isNull);
          assert.equal(val1.getString(), `Dummy ${i}`);

          const val2: SqliteValue = stmt.getValue(2);
          assert.equal(val2.columnName, "Code");
          assert.equal(val2.type, SqliteValueType.Integer);
          assert.isFalse(val2.isNull);
          assert.equal(val2.getInteger(), i * 100);

          const row: any = stmt.getRow();
          assert.equal(row.id, i);
          assert.equal(row.name, `Dummy ${i}`);
          assert.equal(row.code, i * 100);
        }
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });
    } finally {
      // delete the briefcase as the test modified it locally.
      let briefcasePath: string | undefined;
      if (iModel.isOpen)
        briefcasePath = iModel.pathName;

      await IModelTestUtils.closeAndDeleteBriefcaseDb(managerRequestContext, iModel);
      if (!!briefcasePath && IModelJsFs.existsSync(briefcasePath))
        IModelJsFs.unlinkSync(briefcasePath);
    }
  });

  it("Run plain SQL against readonly connection", async () => {
    const iModel = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext: managerRequestContext, contextId: testContextId, iModelId: readWriteTestIModelId });

    iModel.withPreparedSqliteStatement("SELECT Name,StrData FROM be_Prop WHERE Namespace='ec_Db'", (stmt: SqliteStatement) => {
      let rowCount = 0;
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        rowCount++;
        assert.equal(stmt.getColumnCount(), 2);
        const nameVal: SqliteValue = stmt.getValue(0);
        assert.equal(nameVal.columnName, "Name");
        assert.equal(nameVal.type, SqliteValueType.String);
        assert.isFalse(nameVal.isNull);
        const name: string = nameVal.getString();

        const versionVal = stmt.getValue(1);
        assert.equal(versionVal.columnName, "StrData");
        assert.equal(versionVal.type, SqliteValueType.String);
        assert.isFalse(versionVal.isNull);
        const profileVersion: any = JSON.parse(versionVal.getString());

        assert.isTrue(name === "SchemaVersion" || name === "InitialSchemaVersion");
        if (name === "SchemaVersion") {
          assert.equal(profileVersion.major, 4);
          assert.equal(profileVersion.minor, 0);
          assert.equal(profileVersion.sub1, 0);
          assert.isAtLeast(profileVersion.sub2, 1);
        } else if (name === "InitialSchemaVersion") {
          assert.equal(profileVersion.major, 4);
          assert.equal(profileVersion.minor, 0);
          assert.equal(profileVersion.sub1, 0);
          assert.isAtLeast(profileVersion.sub2, 1);
        }
      }
      assert.equal(rowCount, 2);
    });
    iModel.close();
  });

  it("should be able to upgrade a briefcase with an older schema", async () => {
    const projectId = await HubUtility.getTestContextId(managerRequestContext);

    /**
     * Test validates that -
     * - User "manager" upgrades the BisCore schema in the briefcase from version 1.0.0 to 1.0.10+
     * - User "super" can get the upgrade "manager" made
     */

    /* Setup test - Push an iModel with an old BisCore schema up to the Hub */
    const pathname = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const hubName = HubUtility.generateUniqueName("CompatibilityTest");
    const iModelId = await HubUtility.pushIModel(managerRequestContext, projectId, pathname, hubName, true);

    // Download two copies of the briefcase - manager and super
    const args: RequestNewBriefcaseProps = { contextId: projectId, iModelId };
    const managerBriefcaseProps = await BriefcaseManager.downloadBriefcase(managerRequestContext, args);
    const superBriefcaseProps = await BriefcaseManager.downloadBriefcase(superRequestContext, args);

    /* User "manager" upgrades the briefcase */

    // Validate the original state of the BisCore schema in the briefcase
    let iModel = await BriefcaseDb.open(managerRequestContext, { fileName: managerBriefcaseProps.fileName });
    const beforeVersion = iModel.querySchemaVersion("BisCore");
    assert.isTrue(semver.satisfies(beforeVersion!, "= 1.0.0"));
    assert.isFalse(iModel.nativeDb.hasPendingTxns());
    iModel.close();

    // Validate that the BisCore schema is recognized as a recommended upgrade
    let schemaState = BriefcaseDb.validateSchemas(managerBriefcaseProps.fileName, true);
    assert.strictEqual(schemaState, SchemaState.UpgradeRecommended);

    // Upgrade the schemas
    await BriefcaseDb.upgradeSchemas(managerRequestContext, managerBriefcaseProps);

    // Validate state after upgrade
    iModel = await BriefcaseDb.open(managerRequestContext, { fileName: managerBriefcaseProps.fileName });
    managerRequestContext.enter();
    const afterVersion = iModel.querySchemaVersion("BisCore");
    assert.isTrue(semver.satisfies(afterVersion!, ">= 1.0.10"));
    assert.isFalse(iModel.nativeDb.hasPendingTxns());
    assert.isFalse(iModel.holdsSchemaLock);
    assert.isFalse(iModel.nativeDb.hasUnsavedChanges());
    iModel.close();

    /* User "super" can get the upgrade "manager" made */

    // Validate that the BisCore schema is recognized as a recommended upgrade
    schemaState = BriefcaseDb.validateSchemas(superBriefcaseProps.fileName, true);
    assert.strictEqual(schemaState, SchemaState.UpgradeRecommended);

    // SKIPPED FOR NOW - locking not mocked yet
    // Upgrade the schemas - should fail, since user hasn't pulled changes done by manager
    // // let result: IModelHubStatus = IModelHubStatus.Success;
    // try {
    //   await BriefcaseDb.upgradeSchemas(superRequestContext, superBriefcaseProps);
    // } catch (err) {
    //   // result = err.errorNumber;
    // }
    // assert.strictEqual(result, IModelHubStatus.PullIsRequired);

    // Open briefcase and pull change sets to upgrade
    const superIModel = await BriefcaseDb.open(superRequestContext, { fileName: superBriefcaseProps.fileName });
    superBriefcaseProps.changeset = await superIModel.pullAndMergeChanges(superRequestContext);
    const superVersion = superIModel.querySchemaVersion("BisCore");
    assert.isTrue(semver.satisfies(superVersion!, ">= 1.0.10"));
    assert.isFalse(superIModel.nativeDb.hasUnsavedChanges()); // Validate no changes were made
    assert.isFalse(superIModel.nativeDb.hasPendingTxns()); // Validate no changes were made
    superIModel.close();

    // Validate that there are no upgrades required
    schemaState = BriefcaseDb.validateSchemas(superBriefcaseProps.fileName, true);
    assert.strictEqual(schemaState, SchemaState.UpToDate);

    // Upgrade the schemas - ensure this is a no-op
    await BriefcaseDb.upgradeSchemas(superRequestContext, superBriefcaseProps);
    superRequestContext.enter();

    await IModelHost.hubAccess.deleteIModel({ requestContext: managerRequestContext, contextId: projectId, iModelId });
  });
});
