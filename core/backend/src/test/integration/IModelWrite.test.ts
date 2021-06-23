/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { DbOpcode, DbResult, Id64String, IModelHubStatus } from "@bentley/bentleyjs-core";
import {
  CodeState, HubCode, HubIModel, IModelHubError, IModelQuery, Lock, LockLevel, LockQuery, LockType, MultiCode,
} from "@bentley/imodelhub-client";
import { CodeScopeSpec, CodeSpec, ColorDef, IModel, IModelError, IModelVersion, SubCategoryAppearance, SyncMode } from "@bentley/imodeljs-common";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import {
  AuthorizedBackendRequestContext, BriefcaseDb, BriefcaseEntry, BriefcaseManager, ConcurrencyControl, DictionaryModel, DisplayStyle3d, Element, IModelJsFs,
  SpatialCategory, SqliteStatement, SqliteValue, SqliteValueType,
} from "../../imodeljs-backend";
import { IModelTestUtils, TestIModelInfo, Timer } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

export async function createNewModelAndCategory(requestContext: AuthorizedBackendRequestContext, rwIModel: BriefcaseDb, parent?: Id64String) {
  // Create a new physical model.
  let modelId: Id64String;
  [, modelId] = await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(requestContext, rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true, parent);
  requestContext.enter();

  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.dictionaryId) as DictionaryModel;
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const category = SpatialCategory.create(rwIModel, IModel.dictionaryId, newCategoryCode.value!);
  await rwIModel.concurrencyControl.requestResourcesForInsert(requestContext, [category]);
  requestContext.enter();
  const spatialCategoryId = rwIModel.elements.insertElement(category);
  category.setDefaultAppearance(new SubCategoryAppearance({ color: 0xff0000 }));
  // const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value!, new SubCategoryAppearance({ color: 0xff0000 }));

  // Reserve all of the codes that are required by the new model and category.
  try {
    await rwIModel.concurrencyControl.request(requestContext);
  } catch (err) {
    if (err instanceof IModelHubError) {
      assert.fail(JSON.stringify(err));
    }
  }

  return { modelId, spatialCategoryId };
}

function toHubLock(props: ConcurrencyControl.LockProps, briefcaseId: number): Lock {
  const lock = new Lock();
  lock.briefcaseId = briefcaseId;
  lock.lockLevel = props.level;
  lock.lockType = props.type;
  lock.objectId = props.objectId;
  // lock.releasedWithChangeSet =
  // lock.seedFileId = concurrencyControl.iModel.briefcase.fileId!;
  return lock;
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
    managerRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    superRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.super);
    testProjectId = await HubUtility.queryProjectIdByName(managerRequestContext, "iModelJsIntegrationTest");
    readOnlyTestIModel = await IModelTestUtils.getTestModelInfo(managerRequestContext, testProjectId, "ReadOnlyTest");
    readWriteTestIModelName = HubUtility.generateUniqueName("ReadWriteTest");

    try {
      await HubUtility.deleteIModel(managerRequestContext, "iModelJsIntegrationTest", readWriteTestIModelName);
    } catch (err) {
    }
    await BriefcaseManager.imodelClient.iModels.create(managerRequestContext, testProjectId, readWriteTestIModelName, { description: "TestSubject" });
    readWriteTestIModel = await IModelTestUtils.getTestModelInfo(managerRequestContext, testProjectId, readWriteTestIModelName);

    writeTestProjectId = await HubUtility.queryProjectIdByName(managerRequestContext, "iModelJsIntegrationTest");

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
    const iModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(superRequestContext, testProjectId, readWriteTestIModel.id, SyncMode.PullAndPush);
    const codeSpec1 = CodeSpec.create(iModel, "MyCodeSpec", CodeScopeSpec.Type.Model);
    iModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    const locks = await iModel.concurrencyControl.lockCodeSpecs(superRequestContext);
    assert.equal(locks.length, 1);
    const locksRedundant = await iModel.concurrencyControl.lockCodeSpecs(superRequestContext);
    assert.equal(locksRedundant.length, 1);
    iModel.insertCodeSpec(codeSpec1);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(superRequestContext, iModel);
  });

  it("acquire codespec lock - example", async () => {
    const model = await IModelTestUtils.downloadAndOpenBriefcaseDb(superRequestContext, testProjectId, readWriteTestIModel.id, SyncMode.PullAndPush);
    const codeSpec1 = CodeSpec.create(model, "MyCodeSpec", CodeScopeSpec.Type.Model);

    model.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());  // needed for writing to iModels

    const codeSpecsLock = new Lock();
    codeSpecsLock.briefcaseId = model.briefcase.briefcaseId;
    codeSpecsLock.lockLevel = LockLevel.Exclusive;
    codeSpecsLock.lockType = LockType.CodeSpecs;
    codeSpecsLock.objectId = "0x1";
    codeSpecsLock.seedFileId = model.briefcase.fileId;

    const locks = await BriefcaseManager.imodelClient.locks.update(superRequestContext, model.briefcase.iModelId, [codeSpecsLock]);
    assert.equal(locks.length, 1);
    model.insertCodeSpec(codeSpec1);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(superRequestContext, model);
  });

  it("should verify that briefcase A can acquire Schema lock while briefcase B holds an element lock", async () => {
    const bcA = await BriefcaseManager.imodelClient.briefcases.create(managerRequestContext, readWriteTestIModel.id);
    const bcB = await BriefcaseManager.imodelClient.briefcases.create(managerRequestContext, readWriteTestIModel.id);
    assert.notEqual(bcA.briefcaseId, bcB.briefcaseId);
    assert.isTrue(bcA.briefcaseId !== undefined);
    assert.isTrue(bcB.briefcaseId !== undefined);
    const bcALockReq = toHubLock(ConcurrencyControl.Request.schemaLock, bcA.briefcaseId!);
    const bcBLockReq = toHubLock(ConcurrencyControl.Request.getElementLock("0x1", LockLevel.Exclusive), bcB.briefcaseId!);
    // First, B acquires element lock
    const bcBLocksAcquired = await BriefcaseManager.imodelClient.locks.update(managerRequestContext, readWriteTestIModel.id, [bcBLockReq]);
    // Next, A acquires schema lock
    const bcALocksAcquired = await BriefcaseManager.imodelClient.locks.update(managerRequestContext, readWriteTestIModel.id, [bcALockReq]);

    assert.isTrue(bcALocksAcquired.length !== 0);
    assert.equal(bcALocksAcquired[0].briefcaseId, bcA.briefcaseId);
    assert.equal(bcALocksAcquired[0].lockType, bcALockReq.lockType);

    assert.isTrue(bcBLocksAcquired.length !== 0);
    assert.equal(bcBLocksAcquired[0].briefcaseId, bcB.briefcaseId);
    assert.equal(bcBLocksAcquired[0].lockType, bcBLockReq.lockType);

    const bcALocksQueryResults = await BriefcaseManager.imodelClient.locks.get(managerRequestContext, readWriteTestIModel.id, new LockQuery().byBriefcaseId(bcA.briefcaseId!));
    const bcBLocksQueryResults = await BriefcaseManager.imodelClient.locks.get(managerRequestContext, readWriteTestIModel.id, new LockQuery().byBriefcaseId(bcB.briefcaseId!));
    assert.deepEqual(bcALocksAcquired, bcALocksQueryResults);
    assert.deepEqual(bcBLocksAcquired, bcBLocksQueryResults);

    bcBLockReq.lockLevel = LockLevel.None;
    await BriefcaseManager.imodelClient.locks.update(managerRequestContext, readWriteTestIModel.id, [bcBLockReq]);
    bcALockReq.lockLevel = LockLevel.None;
    await BriefcaseManager.imodelClient.locks.update(managerRequestContext, readWriteTestIModel.id, [bcALockReq]);

    await BriefcaseManager.imodelClient.briefcases.delete(managerRequestContext, readWriteTestIModel.id, bcA.briefcaseId!);
    await BriefcaseManager.imodelClient.briefcases.delete(managerRequestContext, readWriteTestIModel.id, bcB.briefcaseId!);
  });

  it("test change-merging scenarios in optimistic concurrency mode (#integration)", async () => {
    const firstUserRequestContext: AuthorizedBackendRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.super);
    const secondUserRequestContext: AuthorizedBackendRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);
    const neutralObserverUserRequestContext: AuthorizedBackendRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);

    const firstIModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(firstUserRequestContext, testProjectId, readWriteTestIModel.id, SyncMode.PullAndPush);
    const secondIModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(secondUserRequestContext, testProjectId, readWriteTestIModel.id, SyncMode.PullAndPush);
    const neutralObserverIModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(neutralObserverUserRequestContext, testProjectId, readWriteTestIModel.id, SyncMode.PullAndPush);
    assert.notEqual(firstIModel, secondIModel);
    assert.equal(firstIModel.briefcase.nativeDb.getBriefcaseId(), firstIModel.briefcase.briefcaseId);
    assert.isAbove(firstIModel.briefcase.briefcaseId, 0);
    assert.equal(secondIModel.briefcase.nativeDb.getBriefcaseId(), secondIModel.briefcase.briefcaseId);
    assert.isAbove(secondIModel.briefcase.briefcaseId, 0);
    assert.equal(neutralObserverIModel.briefcase.nativeDb.getBriefcaseId(), neutralObserverIModel.briefcase.briefcaseId);
    assert.isAbove(neutralObserverIModel.briefcase.briefcaseId, 0);

    // Set up optimistic concurrency. Note the defaults are:
    firstIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    secondIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    // Note: neutralObserver's IModel does not need to be configured for optimistic concurrency. He just pulls changes.

    // Check that the policy has been setup correctly
    let secondPolicy = secondIModel.concurrencyControl.getPolicy();
    assert.isDefined(secondPolicy);
    assert.isTrue(secondPolicy instanceof ConcurrencyControl.OptimisticPolicy);
    assert.equal((secondPolicy as ConcurrencyControl.OptimisticPolicy).conflictResolution.updateVsUpdate, ConcurrencyControl.OnConflict.RejectIncomingChange);
    assert.equal((secondPolicy as ConcurrencyControl.OptimisticPolicy).conflictResolution.updateVsDelete, ConcurrencyControl.OnConflict.AcceptIncomingChange);
    assert.equal((secondPolicy as ConcurrencyControl.OptimisticPolicy).conflictResolution.deleteVsUpdate, ConcurrencyControl.OnConflict.RejectIncomingChange);

    // firstUser: create model, category, and element el1
    const r: { modelId: Id64String, spatialCategoryId: Id64String } = await createNewModelAndCategory(firstUserRequestContext, firstIModel);
    const el1 = firstIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(firstIModel, r.modelId, r.spatialCategoryId));
    // const el2 = firstIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(firstIModel, r.modelId, r.spatialCategoryId));
    firstIModel.saveChanges("firstUser created model, category, and two elements");
    await firstIModel.pushChanges(firstUserRequestContext, "test");

    // secondUser: pull and merge
    await secondIModel.pullAndMergeChanges(secondUserRequestContext);

    // Validate that the policy has been setup correctly after pullAndMerge (that causes the briefcase to reopen)
    secondPolicy = secondIModel.concurrencyControl.getPolicy();
    assert.isDefined(secondPolicy);
    assert.isTrue(secondPolicy instanceof ConcurrencyControl.OptimisticPolicy);
    assert.equal((secondPolicy as ConcurrencyControl.OptimisticPolicy).conflictResolution.updateVsUpdate, ConcurrencyControl.OnConflict.RejectIncomingChange);
    assert.equal((secondPolicy as ConcurrencyControl.OptimisticPolicy).conflictResolution.updateVsDelete, ConcurrencyControl.OnConflict.AcceptIncomingChange);
    assert.equal((secondPolicy as ConcurrencyControl.OptimisticPolicy).conflictResolution.deleteVsUpdate, ConcurrencyControl.OnConflict.RejectIncomingChange);

    // --- Test 1: Overlapping changes that really are conflicts => conflict-resolution policy is applied ---

    // firstUser: modify el1.userLabel
    if (true) {
      const el1cc: Element = firstIModel.elements.getElement(el1);
      el1cc.userLabel = el1cc.userLabel + " -> changed by firstUser";
      firstIModel.elements.updateElement(el1cc);
      firstIModel.saveChanges("firstUser modified el1.userLabel");
      await firstIModel.pushChanges(firstUserRequestContext, "test");
    }

    // secondUser: modify el1.userLabel
    let expectedValueOfEl1UserLabel: string;
    if (true) {
      const el1before: Element = (secondIModel.elements.getElement(el1));
      expectedValueOfEl1UserLabel = el1before.userLabel + " -> changed by secondUser";
      el1before.userLabel = expectedValueOfEl1UserLabel;
      secondIModel.elements.updateElement(el1before);
      secondIModel.saveChanges("secondUser modified el1.userLabel");

      // pull + merge => take secondUser's change (RejectIncomingChange). That's because the default updateVsUpdate settting is RejectIncomingChange
      await secondIModel.pullAndMergeChanges(secondUserRequestContext);
      const el1after = secondIModel.elements.getElement(el1);
      assert.equal(el1after.userLabel, expectedValueOfEl1UserLabel);

      await secondIModel.pushChanges(secondUserRequestContext, "test");
    }

    // Make sure a neutral observer sees secondUser's change.
    if (true) {
      await neutralObserverIModel.pullAndMergeChanges(neutralObserverUserRequestContext);
      const elobj = neutralObserverIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueOfEl1UserLabel);
    }

    // firstUser: pull and see that secondUser has overridden my change
    if (true) {
      await firstIModel.pullAndMergeChanges(firstUserRequestContext);
      const elobj = firstIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueOfEl1UserLabel);
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
    const iModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(managerRequestContext, testProjectId, readWriteTestIModel.id, SyncMode.PullAndPush);

    const el: Element = iModel.elements.getRootSubject();
    el.buildConcurrencyControlRequest(DbOpcode.Update);    // make a list of the locks, etc. that will be needed to update this element
    const req = iModel.concurrencyControl.pendingRequest;
    assert.isDefined(req);
    assert.isArray(req.locks);
    assert.equal(req.locks.length, 3, " we expect to need a lock on the element (exclusive), its model (shared), and the db itself (shared)");
    assert.isArray(req.codes);
    assert.equal(req.codes.length, 0, " since we didn't add or change the element's code, we don't expect to need a code reservation");

    iModel.close();
  });

  it("should push changes with codes (#integration)", async () => {
    const adminRequestContext: AuthorizedBackendRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);
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
    const rwIModelId = await BriefcaseManager.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(adminRequestContext, writeTestProjectId, rwIModelId, SyncMode.PullAndPush);
    timer.end();

    timer = new Timer("querying codes");
    const initialCodes = await BriefcaseManager.imodelClient.codes.get(adminRequestContext, rwIModelId!);
    timer.end();

    timer = new Timer("make local changes");
    const code = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel");
    await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(adminRequestContext, rwIModel, code, true);
    adminRequestContext.enter();

    await rwIModel.concurrencyControl.request(adminRequestContext);
    rwIModel.saveChanges("inserted generic objects");
    timer.end();

    timer = new Timer("push changes");

    // Push the changes to the hub
    const prePushChangeSetId = rwIModel.changeSetId;
    await rwIModel.pushChanges(adminRequestContext, "test");
    const postPushChangeSetId = rwIModel.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    timer = new Timer("querying codes");
    const codes = await BriefcaseManager.imodelClient.codes.get(adminRequestContext, rwIModelId!);
    timer.end();
    expect(codes.length > initialCodes.length);
  });

  it("should defer locks and codes in bulk mode (#integration)", async () => {
    const adminRequestContext: AuthorizedBackendRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "ConcurrencyControlBulkModeTest";
    const iModels: HubIModel[] = await BriefcaseManager.imodelClient.iModels.get(adminRequestContext, writeTestProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await BriefcaseManager.imodelClient.iModels.delete(adminRequestContext, writeTestProjectId, iModelTemp.id!);
    }

    // Create a new empty iModel on the Hub & obtain a briefcase
    const rwIModelId = await BriefcaseManager.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(adminRequestContext, writeTestProjectId, rwIModelId, SyncMode.PullAndPush);

    const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.dictionaryId) as DictionaryModel;
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    const newCategoryCode2 = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory2");
    assert.isTrue(await rwIModel.concurrencyControl.areCodesAvailable2(adminRequestContext, [newCategoryCode]));
    const subCategory = new SubCategoryAppearance({ color: 0xff0000 });
    const newModelCode = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel");

    assert.isFalse(rwIModel.concurrencyControl.hasPendingRequests);

    assert.throws(() => IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, newModelCode, true), IModelError);  // s/ have errorNumber=RepositoryStatus.LockNotHeld
    assert.throws(() => SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value!, subCategory), IModelError);  // s/ have errorNumber=RepositoryStatus.LockNotHeld

    // assert.isUndefined(rwIModel.models.tryGetModelProps())
    assert.isUndefined(rwIModel.elements.tryGetElement(newCategoryCode));
    assert.isUndefined(rwIModel.elements.tryGetElement(newCategoryCode2));

    rwIModel.concurrencyControl.startBulkMode();
    // rwIModel.concurrencyControl.setPolicy(ConcurrencyControl.OptimisticPolicy);

    assert.isFalse(rwIModel.concurrencyControl.hasPendingRequests);

    IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, newModelCode, true);
    SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value!, subCategory);
    SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode2.value!, subCategory);

    assert.isTrue(undefined !== rwIModel.elements.getElement(newCategoryCode));
    assert.isTrue(undefined !== rwIModel.elements.getElement(newCategoryCode2));

    assert.isTrue(rwIModel.concurrencyControl.hasPendingRequests);
    await rwIModel.concurrencyControl.request(adminRequestContext);
    assert.isFalse(rwIModel.concurrencyControl.hasPendingRequests);
    rwIModel.saveChanges("inserted generic objects");

  });

  it("should handle undo/redo (#integration)", async () => {
    const adminRequestContext: AuthorizedBackendRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);
    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "CodesUndoRedoPushTest";
    const iModels: HubIModel[] = await BriefcaseManager.imodelClient.iModels.get(adminRequestContext, writeTestProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await BriefcaseManager.imodelClient.iModels.delete(adminRequestContext, writeTestProjectId, iModelTemp.id!);
    }
    timer.end();

    // Create a new empty iModel on the Hub & obtain a briefcase
    timer = new Timer("create iModel");
    const rwIModelId = await BriefcaseManager.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(adminRequestContext, writeTestProjectId, rwIModelId, SyncMode.PullAndPush);
    timer.end();

    // create and insert a new model with code1
    const code1 = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel1");
    await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(adminRequestContext, rwIModel, code1, true);
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
    await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(adminRequestContext, rwIModel, code2, true);
    adminRequestContext.enter();

    rwIModel.saveChanges("inserted generic objects");

    // The iModel should have a model with code1 and not code2
    assert.isTrue(rwIModel.elements.getElement(code2) !== undefined); // throws if element is not found

    timer = new Timer("push changes");

    // Push the changes to the hub
    const prePushChangeSetId = rwIModel.changeSetId;
    await rwIModel.pushChanges(adminRequestContext, "test");
    const postPushChangeSetId = rwIModel.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    // The iModel should have code1 marked as used and not code2
    timer = new Timer("querying codes");
    const codes = await BriefcaseManager.imodelClient.codes.get(adminRequestContext, rwIModelId!);
    timer.end();
    assert.isTrue(codes.find((code) => (code.value === "newPhysicalModel2" && code.state === CodeState.Used)) !== undefined);
    assert.isFalse(codes.find((code) => (code.value === "newPhysicalModel" && code.state === CodeState.Used)) !== undefined);
  });

  it("should not push changes with code conflicts (#integration)", async () => {
    const adminRequestContext: AuthorizedBackendRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);
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
    const rwIModelId = await BriefcaseManager.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(adminRequestContext, writeTestProjectId, rwIModelId, SyncMode.PullAndPush);
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
    adminRequestContext.enter();
    await rwIModel.concurrencyControl.syncCache(adminRequestContext);
    adminRequestContext.enter();

    timer = new Timer("querying codes");
    /* const initialCodes =*/
    await BriefcaseManager.imodelClient.codes.get(adminRequestContext, rwIModelId!);
    timer.end();

    try {
      timer = new Timer("make local changes");
      await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(adminRequestContext, rwIModel, code, true);
      assert.fail("I should not get here. The Code that I am trying to use was reserved by the other briefcase.");
    } catch (err) {
      assert.isTrue(err instanceof IModelHubError);
      assert.equal((err as IModelHubError).errorNumber, IModelHubStatus.CodeReservedByAnotherBriefcase);
    }
    // rwIModel.saveChanges("inserted generic objects");
    // timer.end();

    // timer = new Timer("push changes");

    // // Push the changes to the hub
    // const prePushChangeSetId = rwIModel.iModelToken.changeSetId;
    // await rwIModel.pushChanges(adminRequestContext);
    // const postPushChangeSetId = rwIModel.iModelToken.changeSetId;
    // assert(!!postPushChangeSetId);
    // expect(prePushChangeSetId !== postPushChangeSetId);

    // timer.end();

    // timer = new Timer("querying codes");
    // const codes = await BriefcaseManager.imodelClient.codes.get(managerRequestContext, rwIModelId!);
    // timer.end();
    // expect(codes.length === initialCodes.length);
    // expect(codes[0].state === CodeState.Reserved);
  });

  it("should write to briefcase with optimistic concurrency (#integration)", async () => {
    const adminRequestContext: AuthorizedBackendRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);

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
    const rwIModelId = await BriefcaseManager.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(adminRequestContext, writeTestProjectId, rwIModelId, SyncMode.PullAndPush);
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
    [, newModelId] = await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(adminRequestContext, rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);
    adminRequestContext.enter();

    // Find or create a SpatialCategory.
    const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.dictionaryId) as DictionaryModel;
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    assert.isTrue(await rwIModel.concurrencyControl.areCodesAvailable2(adminRequestContext, [newCategoryCode]));
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
      if (err instanceof IModelHubError) {
        assert.fail(JSON.stringify(err));
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
    const prePushChangeSetId = rwIModel.changeSetId;
    await rwIModel.pushChanges(adminRequestContext, "test");
    const postPushChangeSetId = rwIModel.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    // Open a readonly copy of the iModel
    const roIModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(adminRequestContext, writeTestProjectId, rwIModelId!, SyncMode.FixedVersion, IModelVersion.latest());
    assert.exists(roIModel);

    await IModelTestUtils.closeAndDeleteBriefcaseDb(adminRequestContext, rwIModel);
    roIModel.close();
  });

  it("Run plain SQL against fixed version connection", async () => {
    const iModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(managerRequestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullAndPush);
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

      await IModelTestUtils.closeAndDeleteBriefcaseDb(managerRequestContext, iModel);
      if (!!briefcasePath && IModelJsFs.existsSync(briefcasePath))
        IModelJsFs.unlinkSync(briefcasePath);
    }
  });

  it("Run plain SQL against readonly connection", async () => {
    const iModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(managerRequestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion);

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
    iModel.close();
  });

  it("should create a briefcase and insert ViewDefinition element to that (#integration)", async () => {
    const requestContext: AuthorizedBackendRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);

    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the InsertViewDefinitionTest iModel
    const iModelName = "InsertViewDefinitionTest";
    const iModels: HubIModel[] = await BriefcaseManager.imodelClient.iModels.get(requestContext, writeTestProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await BriefcaseManager.imodelClient.iModels.delete(requestContext, writeTestProjectId, iModelTemp.id!);
    }
    timer.end();

    // Create a new empty iModel on the Hub & obtain a briefcase
    timer = new Timer("create iModel");
    const rwIModelId = await BriefcaseManager.create(requestContext, writeTestProjectId, iModelName, { rootSubject: { name: "defaultRoot" } });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, writeTestProjectId, rwIModelId, SyncMode.PullAndPush);
    timer.end();

    timer = new Timer("create SpatialCategory");

    rwIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());

    // Create a SpatialCategory.
    const spatialCategoryId = SpatialCategory.insert(rwIModel, IModel.dictionaryId, "DefaultSpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));
    await rwIModel.concurrencyControl.request(requestContext);
    rwIModel.saveChanges("Added default category");
    assert.isNotEmpty(spatialCategoryId);
    timer.end();

    timer = new Timer("query Codes I");
    // iModel.concurrencyControl should have recorded the codes that are required by the new elements.
    assert.isTrue(rwIModel.concurrencyControl.hasPendingRequests);
    assert.isTrue(await rwIModel.concurrencyControl.areAvailable(requestContext));
    timer.end();

    timer = new Timer("create DisplayStyle");
    const displayStyle3d: DisplayStyle3d = DisplayStyle3d.create(rwIModel, IModel.dictionaryId, "defaultDisplayStyle", { backgroundColor: ColorDef.fromString("rgb(255,0,0)") });
    assert.isNotEmpty(displayStyle3d);
    timer.end();

    timer = new Timer("make more local changes");

    const element = IModelTestUtils.createViewDefinitionElement(rwIModel, spatialCategoryId, displayStyle3d.id);
    assert.isTrue(element);

    // The application crashes while executing this
    const elid1 = rwIModel.elements.insertElement(element);

    // Commit the local changes to a local transaction in the briefcase.
    rwIModel.saveChanges(JSON.stringify({ userid: "user1", description: "inserted generic objects" }));

    rwIModel.elements.getElement(elid1); // throws if elid1 is not found
    rwIModel.elements.getElement(spatialCategoryId); // throws if spatialCategoryId is not found

    timer.end();

    // Open a readonly copy of the iModel
    const roIModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, writeTestProjectId, rwIModelId!, SyncMode.FixedVersion, IModelVersion.latest());
    assert.exists(roIModel);

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, rwIModel);
    roIModel.close();
  });
});
