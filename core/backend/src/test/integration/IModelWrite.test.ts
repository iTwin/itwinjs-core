/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect, assert } from "chai";
import * as os from "os";
import { Id64String, DbOpcode, DbResult, Id64 } from "@bentley/bentleyjs-core";
import { IModelVersion, SubCategoryAppearance, IModel, CodeSpec, CodeScopeSpec } from "@bentley/imodeljs-common";
import { IModelJsFs } from "../../IModelJsFs";
import {
  KeepBriefcase, IModelDb, OpenParams, Element, DictionaryModel, BriefcaseManager,
  SpatialCategory, SqliteStatement, SqliteValue, SqliteValueType, BriefcaseEntry,
  AuthorizedBackendRequestContext,
} from "../../imodeljs-backend";
import { ConcurrencyControl } from "../../ConcurrencyControl";
import { CodeState, HubIModel, HubCode, IModelQuery, MultiCode, Lock, LockType, LockLevel } from "@bentley/imodeljs-clients";
import { IModelTestUtils, Timer, TestIModelInfo } from "../IModelTestUtils";
import { TestUsers } from "../TestUsers";
import { HubUtility } from "./HubUtility";

export async function createNewModelAndCategory(requestContext: AuthorizedBackendRequestContext, rwIModel: IModelDb) {
  // Create a new physical model.
  let modelId: Id64String;
  [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);

  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.dictionaryId) as DictionaryModel;
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value!, new SubCategoryAppearance({ color: 0xff0000 }));

  // Reserve all of the codes that are required by the new model and category.
  try {
    await rwIModel.concurrencyControl.request(requestContext);
  } catch (err) {
    if (err instanceof ConcurrencyControl.RequestError) {
      assert.fail(JSON.stringify(err.unavailableCodes) + ", " + JSON.stringify(err.unavailableLocks));
    }
  }

  return { modelId, spatialCategoryId };
}

describe("IModelWriteTest (#integration)", () => {
  let managerRequestContext: AuthorizedBackendRequestContext;
  let superRequestContext: AuthorizedBackendRequestContext;
  let testProjectId: string;
  let writeTestProjectId: string;
  let readOnlyTestIModel: TestIModelInfo;
  let readWriteTestIModel: TestIModelInfo;

  const validateBriefcaseCache = () => {
    const paths = new Array<string>();
    (BriefcaseManager as any)._cache._briefcases.forEach((briefcase: BriefcaseEntry, key: string) => {
      assert.isTrue(IModelJsFs.existsSync(briefcase.pathname), `File corresponding to briefcase cache entry not found: ${briefcase.pathname}`);
      assert.strictEqual<string>(briefcase.getKey(), key, `Cached key ${key} doesn't match the current generated key ${briefcase.getKey()}`);
      assert.isFalse(paths.includes(briefcase.pathname), `Briefcase with path: ${briefcase.pathname} (key: ${key}) has a duplicate in the cache`);
      paths.push(briefcase.pathname);
    });
  };

  let readWriteTestIModelName: string;

  before(async () => {
    managerRequestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.manager);
    superRequestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.super);
    testProjectId = await HubUtility.queryProjectIdByName(managerRequestContext, "iModelJsIntegrationTest");
    readOnlyTestIModel = await IModelTestUtils.getTestModelInfo(managerRequestContext, testProjectId, "ReadOnlyTest");

    let username = "";
    try {
      username = os.userInfo().username;
    } catch (err) {
    }
    readWriteTestIModelName = "ReadWriteTest".concat("_", username, "_", os.hostname() || "");

    try {
      await HubUtility.deleteIModel(managerRequestContext, "iModelJsIntegrationTest", readWriteTestIModelName);
    } catch (err) {
    }
    await BriefcaseManager.imodelClient.iModels.create(managerRequestContext, testProjectId, readWriteTestIModelName, undefined, "TestSubject", undefined, 2 * 60 * 1000);
    readWriteTestIModel = await IModelTestUtils.getTestModelInfo(managerRequestContext, testProjectId, readWriteTestIModelName);

    writeTestProjectId = await HubUtility.queryProjectIdByName(managerRequestContext, "iModelJsTest");

    // Purge briefcases that are close to reaching the acquire limit
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, "iModelJsIntegrationTest", "ReadOnlyTest");
  });

  afterEach(() => {
    validateBriefcaseCache();
  });

  after(async () => {
    try {
      await HubUtility.deleteIModel(managerRequestContext, "iModelJsIntegrationTest", readWriteTestIModelName);
    } catch (err) {
    }
  });

  it("acquire codespec lock", async () => {
    const iModel: IModelDb = await IModelDb.open(superRequestContext, testProjectId, readWriteTestIModel.id, OpenParams.pullAndPush());
    const code1 = new CodeSpec(iModel, Id64.invalid, "MyCode", CodeScopeSpec.Type.Model);
    iModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    const locks = await iModel.concurrencyControl.lockCodeSpecs(superRequestContext);
    assert.equal(locks.length, 1);
    iModel.insertCodeSpec(code1);
    await iModel.close(superRequestContext, KeepBriefcase.No);
  });

  it("acquire codespec lock - example", async () => {
    const model: IModelDb = await IModelDb.open(superRequestContext, testProjectId, readWriteTestIModel.id, OpenParams.pullAndPush());
    const code1 = new CodeSpec(model, Id64.invalid, "MyCode", CodeScopeSpec.Type.Model);

    model.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());  // needed for writing to iModels

    const codeSpecsLock = new Lock();
    codeSpecsLock.briefcaseId = model.briefcase.briefcaseId;
    codeSpecsLock.lockLevel = LockLevel.Exclusive;
    codeSpecsLock.lockType = LockType.CodeSpecs;
    codeSpecsLock.objectId = "0x1";
    codeSpecsLock.seedFileId = model.briefcase.fileId;

    const locks = await BriefcaseManager.imodelClient.locks.update(superRequestContext, model.briefcase.iModelId, [codeSpecsLock]);
    assert.equal(locks.length, 1);
    model.insertCodeSpec(code1);
    await model.close(superRequestContext, KeepBriefcase.No);
  });

  it("test change-merging scenarios in optimistic concurrency mode (#integration)", async () => {
    const firstUserRequestContext: AuthorizedBackendRequestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.super);
    const secondUserRequestContext: AuthorizedBackendRequestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.superManager);
    const neutralObserverUserRequestContext: AuthorizedBackendRequestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.manager);

    const firstIModel: IModelDb = await IModelDb.open(firstUserRequestContext, testProjectId, readWriteTestIModel.id, OpenParams.pullAndPush());
    const secondIModel: IModelDb = await IModelDb.open(secondUserRequestContext, testProjectId, readWriteTestIModel.id, OpenParams.pullAndPush());
    const neutralObserverIModel: IModelDb = await IModelDb.open(neutralObserverUserRequestContext, testProjectId, readWriteTestIModel.id, OpenParams.pullOnly());
    assert.notEqual(firstIModel, secondIModel);

    // Set up optimistic concurrency. Note the defaults are:
    firstIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    secondIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    // Note: neutralObserver's IModel does not need to be configured for optimistic concurrency. He just pulls changes.

    // firstUser: create model, category, and element el1
    const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(firstUserRequestContext, firstIModel);
    const el1 = firstIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(firstIModel, r.modelId, r.spatialCategoryId));
    // const el2 = firstIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(firstIModel, r.modelId, r.spatialCategoryId));
    firstIModel.saveChanges("firstUser created model, category, and two elements");
    await firstIModel.pushChanges(firstUserRequestContext);

    // secondUser: pull and merge
    await secondIModel.pullAndMergeChanges(secondUserRequestContext);

    // --- Test 1: Overlapping changes that really are conflicts => conflict-resolution policy is applied ---

    // firstUser: modify el1.userLabel
    if (true) {
      const el1cc: Element = firstIModel.elements.getElement(el1);
      el1cc.userLabel = el1cc.userLabel + " -> changed by firstUser";
      firstIModel.elements.updateElement(el1cc);
      firstIModel.saveChanges("firstUser modified el1.userLabel");
      await firstIModel.pushChanges(firstUserRequestContext);
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
      await secondIModel.pullAndMergeChanges(secondUserRequestContext);
      const el1after = secondIModel.elements.getElement(el1);
      assert.equal(el1after.userLabel, expectedValueofEl1UserLabel);

      await secondIModel.pushChanges(secondUserRequestContext);
    }

    // Make sure a neutral observer sees secondUser's change.
    if (true) {
      await neutralObserverIModel.pullAndMergeChanges(neutralObserverUserRequestContext);
      const elobj = neutralObserverIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
    }

    // firstUser: pull and see that secondUser has overridden my change
    if (true) {
      await firstIModel.pullAndMergeChanges(firstUserRequestContext);
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

  });

  // Does not work with mocks
  it.skip("should build concurrency control request", async () => {
    const iModel: IModelDb = await IModelDb.open(managerRequestContext, testProjectId, readWriteTestIModel.id, OpenParams.pullAndPush());

    const el: Element = iModel.elements.getRootSubject();
    el.buildConcurrencyControlRequest(DbOpcode.Update);    // make a list of the locks, etc. that will be needed to update this element
    const reqAsAny: any = ConcurrencyControl.convertRequestToAny(iModel.concurrencyControl.pendingRequest);
    assert.isDefined(reqAsAny);
    assert.isArray(reqAsAny.Locks);
    assert.equal(reqAsAny.Locks.length, 3, " we expect to need a lock on the element (exclusive), its model (shared), and the db itself (shared)");
    assert.isArray(reqAsAny.Codes);
    assert.equal(reqAsAny.Codes.length, 0, " since we didn't add or change the element's code, we don't expect to need a code reservation");

    await iModel.close(managerRequestContext);
  });

  it("should push changes with codes (#integration)", async () => {
    const adminRequestContext: AuthorizedBackendRequestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.superManager);
    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "CodesPushTest";
    const iModels: HubIModel[] = await BriefcaseManager.imodelClient.iModels.get(adminRequestContext, writeTestProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await BriefcaseManager.imodelClient.iModels.delete(adminRequestContext, writeTestProjectId, iModelTemp.id!);
    }
    timer.end();

    // Create a new empty iModel on the Hub & obtain a briefcase
    timer = new Timer("create iModel");
    const rwIModel: IModelDb = await IModelDb.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    const rwIModelId = rwIModel.iModelToken.iModelId;
    assert.isNotEmpty(rwIModelId);
    timer.end();

    timer = new Timer("querying codes");
    const initialCodes = await BriefcaseManager.imodelClient.codes.get(adminRequestContext, rwIModelId!);
    timer.end();

    timer = new Timer("make local changes");
    const code = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel");
    IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, code, true);

    rwIModel.saveChanges("inserted generic objects");
    timer.end();

    timer = new Timer("push changes");

    // Push the changes to the hub
    const prePushChangeSetId = rwIModel.iModelToken.changeSetId;
    await rwIModel.pushChanges(adminRequestContext);
    const postPushChangeSetId = rwIModel.iModelToken.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    timer = new Timer("querying codes");
    const codes = await BriefcaseManager.imodelClient.codes.get(adminRequestContext, rwIModelId!);
    timer.end();
    expect(codes.length > initialCodes.length);
  });

  it("should push changes with code conflicts (#integration)", async () => {
    const adminRequestContext: AuthorizedBackendRequestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.superManager);
    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "CodesConflictTest";
    const iModels: HubIModel[] = await BriefcaseManager.imodelClient.iModels.get(adminRequestContext, writeTestProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await BriefcaseManager.imodelClient.iModels.delete(adminRequestContext, writeTestProjectId, iModelTemp.id!);
    }
    timer.end();

    // Create a new empty iModel on the Hub & obtain a briefcase
    timer = new Timer("create iModel");
    const rwIModel: IModelDb = await IModelDb.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    const rwIModelId = rwIModel.iModelToken.iModelId;
    assert.isNotEmpty(rwIModelId);
    timer.end();

    const code = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel");
    const otherBriefcase = await BriefcaseManager.imodelClient.briefcases.create(adminRequestContext, rwIModelId!);
    const hubCode = new HubCode();
    hubCode.value = code.value;
    hubCode.codeSpecId = code.spec;
    hubCode.codeScope = code.scope;
    hubCode.briefcaseId = otherBriefcase.briefcaseId;
    hubCode.state = CodeState.Reserved;
    await BriefcaseManager.imodelClient.codes.update(adminRequestContext, rwIModelId!, [hubCode]);

    timer = new Timer("querying codes");
    const initialCodes = await BriefcaseManager.imodelClient.codes.get(adminRequestContext, rwIModelId!);
    timer.end();

    timer = new Timer("make local changes");
    IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, code, true);

    rwIModel.saveChanges("inserted generic objects");
    timer.end();

    timer = new Timer("push changes");

    // Push the changes to the hub
    const prePushChangeSetId = rwIModel.iModelToken.changeSetId;
    await rwIModel.pushChanges(adminRequestContext);
    const postPushChangeSetId = rwIModel.iModelToken.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    timer = new Timer("querying codes");
    const codes = await BriefcaseManager.imodelClient.codes.get(managerRequestContext, rwIModelId!);
    timer.end();
    expect(codes.length === initialCodes.length);
    expect(codes[0].state === CodeState.Reserved);
  });

  it("should write to briefcase with optimistic concurrency (#integration)", async () => {
    const adminRequestContext: AuthorizedBackendRequestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.superManager);

    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the OptimisticConcurrencyTest iModel
    const iModelName = "OptimisticConcurrencyTest";
    const iModels: HubIModel[] = await BriefcaseManager.imodelClient.iModels.get(adminRequestContext, writeTestProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await BriefcaseManager.imodelClient.iModels.delete(adminRequestContext, writeTestProjectId, iModelTemp.id!);
    }
    timer.end();

    // Create a new empty iModel on the Hub & obtain a briefcase
    timer = new Timer("create iModel");
    const rwIModel: IModelDb = await IModelDb.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
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
    let newModelId: Id64String;
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);

    // Find or create a SpatialCategory.
    const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.dictionaryId) as DictionaryModel;
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value!, new SubCategoryAppearance({ color: 0xff0000 }));

    timer.end();

    timer = new Timer("query Codes I");

    // iModel.concurrencyControl should have recorded the codes that are required by the new elements.
    assert.isTrue(rwIModel.concurrencyControl.hasPendingRequests);
    assert.isTrue(await rwIModel.concurrencyControl.areAvailable(adminRequestContext));

    timer.end();
    timer = new Timer("reserve Codes");

    // Reserve all of the codes that are required by the new model and category.
    try {
      await rwIModel.concurrencyControl.request(adminRequestContext);
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
    const codeStates: MultiCode[] = await rwIModel.concurrencyControl.codes.query(adminRequestContext, category.code.spec, category.code.scope);
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
    await rwIModel.pushChanges(adminRequestContext);
    const postPushChangeSetId = rwIModel.iModelToken.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    // Open a readonly copy of the iModel
    const roIModel: IModelDb = await IModelDb.open(adminRequestContext, writeTestProjectId, rwIModelId!, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.exists(roIModel);

    await rwIModel.close(adminRequestContext, KeepBriefcase.No);
    await roIModel.close(adminRequestContext);
  });

  it("Run plain SQL against pull-only connection", async () => {
    const iModel: IModelDb = await IModelDb.open(managerRequestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullOnly());
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

      await iModel.close(managerRequestContext, KeepBriefcase.No);
      if (!!briefcasePath && IModelJsFs.existsSync(briefcasePath))
        IModelJsFs.unlinkSync(briefcasePath);
    }
  });

  it("Run plain SQL against readonly connection", async () => {
    const iModel: IModelDb = await IModelDb.open(managerRequestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion());

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
    await iModel.close(managerRequestContext);
  });
});
