/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { Id64, DbOpcode, DbResult, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelVersion, SubCategoryAppearance, IModel } from "@bentley/imodeljs-common";
import { IModelTestUtils, TestUsers, Timer } from "../IModelTestUtils";
import { IModelJsFs } from "../../IModelJsFs";
import { KeepBriefcase, IModelDb, OpenParams, Element, DictionaryModel, BriefcaseManager, SqliteStatement, SqliteValue, SqliteValueType } from "../../backend";
import { ConcurrencyControl } from "../../ConcurrencyControl";
import { TestIModelInfo, MockAccessToken, MockAssetUtil } from "../MockAssetUtil";
import { AccessToken, CodeState, HubIModel, HubCode, IModelQuery, MultiCode, ConnectClient, IModelHubClient } from "@bentley/imodeljs-clients";

import * as TypeMoq from "typemoq";

const actx = new ActivityLoggingContext("");

export async function createNewModelAndCategory(rwIModel: IModelDb, accessToken: AccessToken) {
  // Create a new physical model.
  let modelId: Id64;
  [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);

  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.dictionaryId) as DictionaryModel;
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const spatialCategoryId: Id64 = IModelTestUtils.createAndInsertSpatialCategory(dictionary, newCategoryCode.value!, new SubCategoryAppearance({ color: 0xff0000 }));

  // Reserve all of the codes that are required by the new model and category.
  try {
    await rwIModel.concurrencyControl.request(actx, accessToken);
  } catch (err) {
    if (err instanceof ConcurrencyControl.RequestError) {
      assert.fail(JSON.stringify(err.unavailableCodes) + ", " + JSON.stringify(err.unavailableLocks));
    }
  }

  return { modelId, spatialCategoryId };
}

describe.skip("IModelWriteTest", () => {
  const index = process.argv.indexOf("--offline");
  const offline: boolean = process.argv[index + 1] === "mock";
  let testProjectId: string;
  const testIModels: TestIModelInfo[] = [
    new TestIModelInfo("ReadOnlyTest"),
    new TestIModelInfo("ReadWriteTest"),
    new TestIModelInfo("NoVersionsTest"),
  ];

  const assetDir = "./src/test/assets/_mocks_";
  let cacheDir: string = "";
  let accessToken: AccessToken = new MockAccessToken();
  const iModelHubClientMock = TypeMoq.Mock.ofType(IModelHubClient);
  const connectClientMock = TypeMoq.Mock.ofType(ConnectClient);

  before(async () => {
    if (offline) {
      MockAssetUtil.setupMockAssets(assetDir);
      testProjectId = await MockAssetUtil.setupOfflineFixture(accessToken, iModelHubClientMock, connectClientMock, assetDir, cacheDir, testIModels);
    } else {
      [accessToken, testProjectId, cacheDir] = await IModelTestUtils.setupIntegratedFixture(testIModels);
    }
  });

  it("test change-merging scenarios in optimistic concurrency mode (#integration)", async () => {
    const firstUser = await IModelTestUtils.getTestUserAccessToken(TestUsers.super);
    const secondUser = await IModelTestUtils.getTestUserAccessToken(TestUsers.superManager);
    const neutralObserverUser = await IModelTestUtils.getTestUserAccessToken(TestUsers.manager);

    const firstIModel: IModelDb = await IModelDb.open(actx, firstUser, testProjectId, testIModels[1].id, OpenParams.pullAndPush());
    const secondIModel: IModelDb = await IModelDb.open(actx, secondUser, testProjectId, testIModels[1].id, OpenParams.pullAndPush());
    const neutralObserverIModel: IModelDb = await IModelDb.open(actx, neutralObserverUser, testProjectId, testIModels[1].id, OpenParams.pullOnly());
    assert.notEqual(firstIModel, secondIModel);

    // Set up optimistic concurrency. Note the defaults are:
    firstIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    secondIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    // Note: neutralObserver's IModel does not need to be configured for optimistic concurrency. He just pulls changes.

    // firstUser: create model, category, and element el1
    const r: { modelId: Id64, spatialCategoryId: Id64 } = await createNewModelAndCategory(firstIModel, firstUser);
    const el1 = firstIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(firstIModel, r.modelId, r.spatialCategoryId));
    // const el2 = firstIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(firstIModel, r.modelId, r.spatialCategoryId));
    firstIModel.saveChanges("firstUser created model, category, and two elements");
    await firstIModel.pushChanges(actx, firstUser);

    // secondUser: pull and merge
    await secondIModel.pullAndMergeChanges(actx, secondUser);

    // --- Test 1: Overlapping changes that really are conflicts => conflict-resolution policy is applied ---

    // firstUser: modify el1.userLabel
    if (true) {
      const el1cc: Element = firstIModel.elements.getElement(el1);
      el1cc.userLabel = el1cc.userLabel + " -> changed by firstUser";
      firstIModel.elements.updateElement(el1cc);
      firstIModel.saveChanges("firstUser modified el1.userLabel");
      await firstIModel.pushChanges(actx, firstUser);
    }

    // secondUser: modify el1.userLabel
    let expectedValueofEl1UserLabel: string;
    if (true) {
      const el1before: Element = (secondIModel.elements.getElement(el1));
      expectedValueofEl1UserLabel = el1before.userLabel + " -> changed by secondUser";
      el1before.userLabel = expectedValueofEl1UserLabel;
      secondIModel.elements.updateElement(el1before);
      secondIModel.saveChanges("secondUser modified el1.userLabel");

      // pull + merge => take secondUser's change (RejectIncomingChange). That's because the default updateVsUpdate settting is RejectIncomingChange
      await secondIModel.pullAndMergeChanges(actx, secondUser);
      const el1after = secondIModel.elements.getElement(el1);
      assert.equal(el1after.userLabel, expectedValueofEl1UserLabel);

      await secondIModel.pushChanges(actx, secondUser);
    }

    // Make sure a neutral observer sees secondUser's change.
    if (true) {
      await neutralObserverIModel.pullAndMergeChanges(actx, neutralObserverUser);
      const elobj = neutralObserverIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
    }

    // firstUser: pull and see that secondUser has overridden my change
    if (true) {
      await firstIModel.pullAndMergeChanges(actx, firstUser);
      const elobj = firstIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
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
      await firstIModel.pushChanges(actx, firstUser);
    }

    // Make sure a neutral observer sees firstUser's changes.
    if (true) {
      await neutralObserverIModel.pullAndMergeChanges(actx, neutralObserverUser);
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
      await secondIModel.pullAndMergeChanges(actx, secondUser);
      const el1after = secondIModel.elements.getElement(el1);
      assert.equal(el1after.userLabel, expectedValueofEl1UserLabel);
      assert.equal(el1after.getUserProperties(secondUserPropNs)[secondUserPropName], expectedValueOfSecondUserProp);

      await secondIModel.pushChanges(actx, secondUser);
    }

    // firstUser: pull and see both changes
    if (true) {
      await firstIModel.pullAndMergeChanges(actx, firstUser);
      const elobj = firstIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
      assert.equal(elobj.getUserProperties(secondUserPropNs)[secondUserPropName], expectedValueOfSecondUserProp);
    }

    // Make sure a neutral observer sees both changes.
    if (true) {
      await neutralObserverIModel.pullAndMergeChanges(actx, neutralObserverUser);
      const elobj = neutralObserverIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
      assert.equal(elobj.getUserProperties(secondUserPropNs)[secondUserPropName], expectedValueOfSecondUserProp);
    }
*/
    // --- Test 3: Non-overlapping changes ---

  });

  // Does not work with mocks
  it.skip("should build concurrency control request", async () => {
    const iModel: IModelDb = await IModelDb.open(actx, accessToken, testProjectId, testIModels[1].id, OpenParams.pullAndPush());

    const el: Element = iModel.elements.getRootSubject();
    el.buildConcurrencyControlRequest(DbOpcode.Update);    // make a list of the locks, etc. that will be needed to update this element
    const reqAsAny: any = ConcurrencyControl.convertRequestToAny(iModel.concurrencyControl.pendingRequest);
    assert.isDefined(reqAsAny);
    assert.isArray(reqAsAny.Locks);
    assert.equal(reqAsAny.Locks.length, 3, " we expect to need a lock on the element (exclusive), its model (shared), and the db itself (shared)");
    assert.isArray(reqAsAny.Codes);
    assert.equal(reqAsAny.Codes.length, 0, " since we didn't add or change the element's code, we don't expect to need a code reservation");

    await iModel.close(actx, accessToken);
  });

  it("should push changes with codes (#integration)", async () => {
    const adminAccessToken = await IModelTestUtils.getTestUserAccessToken(TestUsers.superManager);
    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "CodesPushTest";
    const iModels: HubIModel[] = await BriefcaseManager.imodelClient.IModels().get(actx, adminAccessToken, testProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await BriefcaseManager.imodelClient.IModels().delete(actx, adminAccessToken, testProjectId, iModelTemp.wsgId);
    }
    timer.end();

    // Create a new iModel on the Hub (by uploading a seed file)
    timer = new Timer("create iModel");
    const rwIModel: IModelDb = await IModelDb.create(actx, adminAccessToken, testProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    const rwIModelId = rwIModel.iModelToken.iModelId;
    assert.isNotEmpty(rwIModelId);
    timer.end();

    timer = new Timer("querying codes");
    const initialCodes = await BriefcaseManager.imodelClient.Codes().get(actx, adminAccessToken, rwIModelId!);
    timer.end();

    timer = new Timer("make local changes");
    let newModelId: Id64;
    const code = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel");
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, code, true);

    rwIModel.saveChanges("inserted generic objects");
    timer.end();

    timer = new Timer("push changes");

    // Push the changes to the hub
    const prePushChangeSetId = rwIModel.iModelToken.changeSetId;
    await rwIModel.pushChanges(actx, adminAccessToken);
    const postPushChangeSetId = rwIModel.iModelToken.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    timer = new Timer("querying codes");
    const codes = await BriefcaseManager.imodelClient.Codes().get(actx, adminAccessToken, rwIModelId!);
    timer.end();
    expect(codes.length > initialCodes.length);
  });

  it("should push changes with code conflicts (#integration)", async () => {
    const adminAccessToken = await IModelTestUtils.getTestUserAccessToken(TestUsers.superManager);
    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "CodesConflictTest";
    const iModels: HubIModel[] = await BriefcaseManager.imodelClient.IModels().get(actx, adminAccessToken, testProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await BriefcaseManager.imodelClient.IModels().delete(actx, adminAccessToken, testProjectId, iModelTemp.wsgId);
    }
    timer.end();

    // Create a new iModel on the Hub (by uploading a seed file)
    timer = new Timer("create iModel");
    const rwIModel: IModelDb = await IModelDb.create(actx, adminAccessToken, testProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    const rwIModelId = rwIModel.iModelToken.iModelId;
    assert.isNotEmpty(rwIModelId);
    timer.end();

    const code = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel");
    const otherBriefcase = await BriefcaseManager.imodelClient.Briefcases().create(actx, adminAccessToken, rwIModelId!);
    const hubCode = new HubCode();
    hubCode.value = code.value;
    hubCode.codeSpecId = code.spec.toString();
    hubCode.codeScope = code.scope;
    hubCode.briefcaseId = otherBriefcase.briefcaseId;
    hubCode.state = CodeState.Reserved;
    await BriefcaseManager.imodelClient.Codes().update(actx, adminAccessToken, rwIModelId!, [hubCode]);

    timer = new Timer("querying codes");
    const initialCodes = await BriefcaseManager.imodelClient.Codes().get(actx, adminAccessToken, rwIModelId!);
    timer.end();

    timer = new Timer("make local changes");
    let newModelId: Id64;
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, code, true);

    rwIModel.saveChanges("inserted generic objects");
    timer.end();

    timer = new Timer("push changes");

    // Push the changes to the hub
    const prePushChangeSetId = rwIModel.iModelToken.changeSetId;
    await rwIModel.pushChanges(actx, adminAccessToken);
    const postPushChangeSetId = rwIModel.iModelToken.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    timer = new Timer("querying codes");
    const codes = await BriefcaseManager.imodelClient.Codes().get(actx, accessToken, rwIModelId!);
    timer.end();
    expect(codes.length === initialCodes.length);
    expect(codes[0].state === CodeState.Reserved);
  });

  it("should write to briefcase with optimistic concurrency (#integration)", async () => {
    const adminAccessToken = await IModelTestUtils.getTestUserAccessToken(TestUsers.superManager);

    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the OptimisticConcurrencyTest iModel
    const iModelName = "OptimisticConcurrencyTest";
    const iModels: HubIModel[] = await BriefcaseManager.imodelClient.IModels().get(actx, adminAccessToken, testProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await BriefcaseManager.imodelClient.IModels().delete(actx, adminAccessToken, testProjectId, iModelTemp.wsgId);
    }
    timer.end();

    // Create a new iModel on the Hub (by uploading a seed file)
    timer = new Timer("create iModel");
    const rwIModel: IModelDb = await IModelDb.create(actx, adminAccessToken, testProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    const rwIModelId = rwIModel.iModelToken.iModelId;
    assert.isNotEmpty(rwIModelId);
    timer.end();

    timer = new Timer("make local changes");

    // Turn on optimistic concurrency control. This allows the app to modify elements, models, etc. without first acquiring locks.
    // Later, when the app downloads and merges changeSets from the Hub into the briefcase, BriefcaseManager will merge changes and handle conflicts.
    // The app still has to reserve codes.
    rwIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());

    // Show that we can modify the properties of an element. In this case, we modify the root element itself.
    const rootEl: Element = rwIModel.elements.getRootSubject();
    rootEl.userLabel = rootEl.userLabel + "changed";
    rwIModel.elements.updateElement(rootEl);

    assert.isFalse(rwIModel.concurrencyControl.hasPendingRequests);

    rwIModel.saveChanges(JSON.stringify({ userid: "user1", description: "changed a userLabel" }));  // save it, to show that saveChanges will accumulate local txn descriptions

    // Create a new physical model.
    let newModelId: Id64;
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);

    // Find or create a SpatialCategory.
    const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.dictionaryId) as DictionaryModel;
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    const spatialCategoryId: Id64 = IModelTestUtils.createAndInsertSpatialCategory(dictionary, newCategoryCode.value!, new SubCategoryAppearance({ color: 0xff0000 }));

    timer.end();

    timer = new Timer("query Codes I");

    // iModel.concurrencyControl should have recorded the codes that are required by the new elements.
    assert.isTrue(rwIModel.concurrencyControl.hasPendingRequests);
    assert.isTrue(await rwIModel.concurrencyControl.areAvailable(actx, adminAccessToken));

    timer.end();
    timer = new Timer("reserve Codes");

    // Reserve all of the codes that are required by the new model and category.
    try {
      await rwIModel.concurrencyControl.request(actx, adminAccessToken);
    } catch (err) {
      if (err instanceof ConcurrencyControl.RequestError) {
        assert.fail(JSON.stringify(err.unavailableCodes) + ", " + JSON.stringify(err.unavailableLocks));
      }
    }

    timer.end();
    timer = new Timer("query Codes II");

    // Verify that the codes are reserved.
    const category = rwIModel.elements.getElement(spatialCategoryId);
    assert.isTrue(category.code.value !== undefined);
    const codeStates: MultiCode[] = await rwIModel.concurrencyControl.codes.query(actx, adminAccessToken, category.code.spec, category.code.scope);
    const foundCode: MultiCode[] = codeStates.filter((cs) => (cs.value === category.code.value!) && (cs.state === CodeState.Reserved));
    assert.equal(foundCode.length, 1);

    /* NEEDS WORK - query just this one code
  assert.isTrue(category.code.value !== undefined);
  const codeStates2 = await iModel.concurrencyControl.codes.query(adminAccessToken, category.code.spec, category.code.scope, category.code.value!);
  assert.equal(codeStates2.length, 1);
  assert.equal(codeStates2[0].values.length, 1);
  assert.equal(codeStates2[0].values[0], category.code.value!);
  */

    timer.end();

    timer = new Timer("make more local changes");

    // Create a couple of physical elements.
    const elid1 = rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, newModelId, spatialCategoryId));
    rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, newModelId, spatialCategoryId));

    // Commit the local changes to a local transaction in the briefcase.
    rwIModel.saveChanges(JSON.stringify({ userid: "user1", description: "inserted generic objects" }));

    rwIModel.elements.getElement(elid1); // throws if elid1 is not found
    rwIModel.elements.getElement(spatialCategoryId); // throws if spatialCategoryId is not found

    timer.end();

    timer = new Timer("pullmergepush");

    // Push the changes to the hub
    const prePushChangeSetId = rwIModel.iModelToken.changeSetId;
    await rwIModel.pushChanges(actx, adminAccessToken);
    const postPushChangeSetId = rwIModel.iModelToken.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    // Open a readonly copy of the iModel
    const roIModel: IModelDb = await IModelDb.open(actx, adminAccessToken, testProjectId, rwIModelId!, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.exists(roIModel);

    await rwIModel.close(actx, adminAccessToken, KeepBriefcase.No);
    await roIModel.close(actx, adminAccessToken);
  });

  it("Run plain SQL against pull-only connection", async () => {
    const iModel: IModelDb = await IModelDb.open(actx, accessToken, testProjectId, testIModels[0].id, OpenParams.pullOnly());
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
      if (!!iModel.briefcase)
        briefcasePath = iModel.briefcase.pathname;

      await iModel.close(actx, accessToken, KeepBriefcase.No);
      if (!!briefcasePath && IModelJsFs.existsSync(briefcasePath))
        IModelJsFs.unlinkSync(briefcasePath);
    }
  });

  it("Run plain SQL against readonly connection", async () => {
    const iModel: IModelDb = await IModelDb.open(actx, accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion());

    iModel.withPreparedSqliteStatement("SELECT Name,StrData FROM be_Prop WHERE Namespace='ec_Db'", (stmt: SqliteStatement) => {
      let rowCount: number = 0;
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        rowCount++;
        assert.equal(stmt.getColumnCount(), 2);
        const nameVal: SqliteValue = stmt.getValue(0);
        assert.equal(nameVal.columnName, "Name");
        assert.equal(nameVal.type, SqliteValueType.String);
        assert.isFalse(nameVal.isNull);
        const name: string = nameVal.getString();

        const versionVal: SqliteValue = stmt.getValue(1);
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
    await iModel.close(actx, accessToken);
  });
});
