/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbOpcode, DbResult, Id64String, IModelHubStatus } from "@bentley/bentleyjs-core";
import {
  CodeState, HubCode, IModelHubError, IModelQuery, Lock, LockLevel, LockQuery, LockType, MultiCode,
} from "@bentley/imodelhub-client";
import { CodeScopeSpec, CodeSpec, IModel, IModelError, RequestNewBriefcaseProps, SchemaState, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { WsgError } from "@bentley/itwin-client";
import { assert, expect } from "chai";
import * as semver from "semver";
import {
  AuthorizedBackendRequestContext, BriefcaseDb, BriefcaseManager, ConcurrencyControl, DictionaryModel, Element, IModelHost, IModelJsFs, SpatialCategory,
  SqliteStatement, SqliteValue, SqliteValueType,
} from "../../imodeljs-backend";
import { IModelTestUtils, TestIModelInfo, Timer } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

export async function createNewModelAndCategory(requestContext: AuthorizedBackendRequestContext, rwIModel: BriefcaseDb, parent?: Id64String) {
  // Create a new physical model.
  const [, modelId] = await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(requestContext, rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true, parent);
  requestContext.enter();

  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel<DictionaryModel>(IModel.dictionaryId);
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const category = SpatialCategory.create(rwIModel, IModel.dictionaryId, newCategoryCode.value);
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
  return lock;
}

describe("IModelWriteTest (#integration)", () => {
  let managerRequestContext: AuthorizedBackendRequestContext;
  let superRequestContext: AuthorizedBackendRequestContext;
  let testProjectId: string;
  let writeTestProjectId: string;
  let readOnlyTestIModel: TestIModelInfo;
  let readWriteTestIModel: TestIModelInfo;

  let readWriteTestIModelName: string;

  before(async () => {
    // IModelTestUtils.setupLogging();
    // IModelTestUtils.setupDebugLogLevels();

    managerRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    superRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.super);
    (superRequestContext as any).activityId = "IModelWriteTest (#integration)";

    testProjectId = await HubUtility.queryProjectIdByName(managerRequestContext, "iModelJsIntegrationTest");
    readOnlyTestIModel = await IModelTestUtils.getTestModelInfo(managerRequestContext, testProjectId, "ReadOnlyTest");
    readWriteTestIModelName = HubUtility.generateUniqueName("ReadWriteTest");

    try {
      await HubUtility.deleteIModel(managerRequestContext, "iModelJsIntegrationTest", readWriteTestIModelName);
    } catch (err) {
    }
    await IModelHost.iModelClient.iModels.create(managerRequestContext, testProjectId, readWriteTestIModelName, { description: "TestSubject" });
    readWriteTestIModel = await IModelTestUtils.getTestModelInfo(managerRequestContext, testProjectId, readWriteTestIModelName);

    writeTestProjectId = await HubUtility.queryProjectIdByName(managerRequestContext, "iModelJsIntegrationTest");

    // Purge briefcases that are close to reaching the acquire limit
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, "iModelJsIntegrationTest", "ReadOnlyTest");
  });

  afterEach(() => {
  });

  after(async () => {
    try {
      await HubUtility.deleteIModel(managerRequestContext, "iModelJsIntegrationTest", readWriteTestIModelName);
    } catch (err) {
    }
  });

  it("acquire codespec lock", async () => {
    const iModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: superRequestContext, contextId: testProjectId, iModelId: readWriteTestIModel.id });
    const codeSpec1 = CodeSpec.create(iModel, "MyCodeSpec1", CodeScopeSpec.Type.Model);
    iModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());

    const locks = await iModel.concurrencyControl.locks.lockCodeSpecs(superRequestContext);
    assert.equal(locks.length, 1);
    const locksRedundant = await iModel.concurrencyControl.locks.lockCodeSpecs(superRequestContext);
    assert.equal(locksRedundant.length, 1);
    assert.isTrue(iModel.concurrencyControl.locks.hasCodeSpecsLock);
    iModel.insertCodeSpec(codeSpec1);
    iModel.saveChanges();
    await iModel.pushChanges(superRequestContext, "inserted MyCodeSpec1");
    assert.isFalse(iModel.concurrencyControl.locks.hasCodeSpecsLock, "pushChanges should automatically release all locks");

    // Verify that locks are released even if there are no changes.
    const prePushChangesetId = iModel.changeSetId;
    await iModel.concurrencyControl.locks.lockCodeSpecs(superRequestContext);
    assert.isTrue(iModel.concurrencyControl.locks.hasCodeSpecsLock);
    /* make no changes */
    await iModel.pushChanges(superRequestContext, "did nothing");
    assert.equal(prePushChangesetId, iModel.changeSetId, "no changeset was pushed");

    assert.isFalse(iModel.concurrencyControl.locks.hasCodeSpecsLock, "pushChanges should automatically release all locks");

    let found = false;
    let briefcases = BriefcaseManager.getCachedBriefcases(readWriteTestIModel.id);
    for (const briefcase of briefcases) {
      if (briefcase.briefcaseId === iModel.briefcaseId && briefcase.contextId === testProjectId && briefcase.iModelId === readWriteTestIModel.id) {
        assert.equal(briefcase.fileName, iModel.pathName);
        found = true;
      }
    }
    assert.isTrue(found);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(superRequestContext, iModel);

    found = false;
    briefcases = BriefcaseManager.getCachedBriefcases(); // test getCachedBriefcases without iModelId
    for (const briefcase of briefcases) {
      if (briefcase.briefcaseId === iModel.briefcaseId && briefcase.contextId === testProjectId && briefcase.iModelId === readWriteTestIModel.id)
        found = true;
    }
    assert.isFalse(found);
  });

  it("acquire codespec lock - example", async () => {
    const model = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: superRequestContext, contextId: testProjectId, iModelId: readWriteTestIModel.id });
    const codeSpec1 = CodeSpec.create(model, "MyCodeSpec", CodeScopeSpec.Type.Model);

    model.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());  // needed for writing to iModels

    const codeSpecsLock = new Lock();
    codeSpecsLock.briefcaseId = model.briefcaseId;
    codeSpecsLock.lockLevel = LockLevel.Exclusive;
    codeSpecsLock.lockType = LockType.CodeSpecs;
    codeSpecsLock.objectId = "0x1";
    await model.pullAndMergeChanges(superRequestContext);
    codeSpecsLock.releasedWithChangeSet = model.changeSetId;
    const locks = await IModelHost.iModelClient.locks.update(superRequestContext, model.iModelId, [codeSpecsLock]);
    assert.equal(locks.length, 1);
    model.insertCodeSpec(codeSpec1);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(superRequestContext, model);
  });

  it("should verify that briefcase A can acquire Schema lock while briefcase B holds an element lock", async () => {
    const bcA = await IModelHost.iModelClient.briefcases.create(managerRequestContext, readWriteTestIModel.id);
    const bcB = await IModelHost.iModelClient.briefcases.create(managerRequestContext, readWriteTestIModel.id);
    assert.notEqual(bcA.briefcaseId, bcB.briefcaseId);
    assert.isTrue(bcA.briefcaseId !== undefined);
    assert.isTrue(bcB.briefcaseId !== undefined);
    const bcALockReq = toHubLock(ConcurrencyControl.Request.schemaLock, bcA.briefcaseId!);
    const bcBLockReq = toHubLock(ConcurrencyControl.Request.getElementLock("0x1", LockLevel.Exclusive), bcB.briefcaseId!);
    // First, B acquires element lock
    const bcBLocksAcquired = await IModelHost.iModelClient.locks.update(managerRequestContext, readWriteTestIModel.id, [bcBLockReq]);
    // Next, A acquires schema lock
    const bcALocksAcquired = await IModelHost.iModelClient.locks.update(managerRequestContext, readWriteTestIModel.id, [bcALockReq]);

    assert.isTrue(bcALocksAcquired.length !== 0);
    assert.equal(bcALocksAcquired[0].briefcaseId, bcA.briefcaseId);
    assert.equal(bcALocksAcquired[0].lockType, bcALockReq.lockType);

    assert.isTrue(bcBLocksAcquired.length !== 0);
    assert.equal(bcBLocksAcquired[0].briefcaseId, bcB.briefcaseId);
    assert.equal(bcBLocksAcquired[0].lockType, bcBLockReq.lockType);

    const bcALocksQueryResults = await IModelHost.iModelClient.locks.get(managerRequestContext, readWriteTestIModel.id, new LockQuery().byBriefcaseId(bcA.briefcaseId!));
    const bcBLocksQueryResults = await IModelHost.iModelClient.locks.get(managerRequestContext, readWriteTestIModel.id, new LockQuery().byBriefcaseId(bcB.briefcaseId!));
    assert.deepEqual(bcALocksAcquired, bcALocksQueryResults);
    assert.deepEqual(bcBLocksAcquired, bcBLocksQueryResults);

    bcBLockReq.lockLevel = LockLevel.None;
    await IModelHost.iModelClient.locks.update(managerRequestContext, readWriteTestIModel.id, [bcBLockReq]);
    bcALockReq.lockLevel = LockLevel.None;
    await IModelHost.iModelClient.locks.update(managerRequestContext, readWriteTestIModel.id, [bcALockReq]);

    await IModelHost.iModelClient.briefcases.delete(managerRequestContext, readWriteTestIModel.id, bcA.briefcaseId!);
    await IModelHost.iModelClient.briefcases.delete(managerRequestContext, readWriteTestIModel.id, bcB.briefcaseId!);
  });

  it("test change-merging scenarios in optimistic concurrency mode (#integration)", async () => {
    const firstUserRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.super);
    (firstUserRequestContext as any).activityId = "test change-merging scenarios in optimistic concurrency mode (#integration)";
    const secondUserRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);
    const neutralObserverUserRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);

    const firstIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: firstUserRequestContext, contextId: testProjectId, iModelId: readWriteTestIModel.id });
    const secondIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: secondUserRequestContext, contextId: testProjectId, iModelId: readWriteTestIModel.id });
    const neutralObserverIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: neutralObserverUserRequestContext, contextId: testProjectId, iModelId: readWriteTestIModel.id });
    assert.notEqual(firstIModel, secondIModel);
    assert.equal(firstIModel.nativeDb.getBriefcaseId(), firstIModel.briefcaseId);
    assert.isAbove(firstIModel.briefcaseId, 0);
    assert.equal(secondIModel.nativeDb.getBriefcaseId(), secondIModel.briefcaseId);
    assert.isAbove(secondIModel.briefcaseId, 0);
    assert.equal(neutralObserverIModel.nativeDb.getBriefcaseId(), neutralObserverIModel.briefcaseId);
    assert.isAbove(neutralObserverIModel.briefcaseId, 0);

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
    const r = await createNewModelAndCategory(firstUserRequestContext, firstIModel);
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
    const iModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: managerRequestContext, contextId: testProjectId, iModelId: readWriteTestIModel.id });

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
    const adminRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);
    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "CodesPushTest";
    const iModels = await IModelHost.iModelClient.iModels.get(adminRequestContext, writeTestProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await IModelHost.iModelClient.iModels.delete(adminRequestContext, writeTestProjectId, iModelTemp.id!);
    }
    timer.end();

    // Create a new empty iModel on the Hub & obtain a briefcase
    timer = new Timer("create iModel");
    const rwIModelId = await BriefcaseManager.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: adminRequestContext, contextId: writeTestProjectId, iModelId: rwIModelId });
    timer.end();

    timer = new Timer("querying codes");
    const initialCodes = await IModelHost.iModelClient.codes.get(adminRequestContext, rwIModelId);
    timer.end();

    timer = new Timer("make local changes");
    const code = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel");
    await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(adminRequestContext, rwIModel, code, true);
    adminRequestContext.enter();

    await rwIModel.concurrencyControl.request(adminRequestContext);
    rwIModel.saveChanges("inserted generic objects");
    timer.end();

    assert.isTrue(rwIModel.concurrencyControl.codes.isReserved(code), "I reserved the code newPhysicalModel");

    timer = new Timer("push changes");

    // Push the changes to the hub
    const prePushChangeSetId = rwIModel.changeSetId;
    await rwIModel.pushChanges(adminRequestContext, "test");
    const postPushChangeSetId = rwIModel.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    timer = new Timer("querying codes");
    const codes = await IModelHost.iModelClient.codes.get(adminRequestContext, rwIModelId);
    timer.end();
    expect(codes.length > initialCodes.length);
    assert.isTrue(codes.some((hcode) => (hcode.value === code.value) && (hcode.state === CodeState.Used)), "verify that I got the code that I reserved and used");

    // Now verify that code reservations are released even if we call pushChanges with no changes.
    const code2 = IModelTestUtils.getUniqueModelCode(rwIModel, "anotherCode");
    await rwIModel.concurrencyControl.codes.reserve(adminRequestContext, [code2]);
    assert.isTrue(rwIModel.concurrencyControl.codes.isReserved(code2), "I reserved the code anotherCode");
    /* make no changes */
    await rwIModel.pushChanges(adminRequestContext, "no changes");
    assert.equal(postPushChangeSetId, rwIModel.changeSetId), "no changeset created or pushed";
    assert.isFalse(rwIModel.concurrencyControl.codes.isReserved(code2), "I released my reservation of the code anotherCode");

    const codesAfter = await IModelHost.iModelClient.codes.get(adminRequestContext, rwIModelId);
    assert.deepEqual(codesAfter, codes, "The code that used above is still marked as used");
  });

  it("should defer locks and codes in bulk mode (#integration)", async () => {
    const adminRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "ConcurrencyControlBulkModeTest";
    const iModels = await IModelHost.iModelClient.iModels.get(adminRequestContext, writeTestProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await IModelHost.iModelClient.iModels.delete(adminRequestContext, writeTestProjectId, iModelTemp.id!);
    }

    // Create a new empty iModel on the Hub & obtain a briefcase
    const rwIModelId = await BriefcaseManager.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: adminRequestContext, contextId: writeTestProjectId, iModelId: rwIModelId });

    const dictionary: DictionaryModel = rwIModel.models.getModel<DictionaryModel>(IModel.dictionaryId);
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    const newCategoryCode2 = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory2");
    assert.isTrue(await rwIModel.concurrencyControl.codes.areAvailable(adminRequestContext, [newCategoryCode]));
    const subCategory = new SubCategoryAppearance({ color: 0xff0000 });
    const newModelCode = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel");

    assert.isFalse(rwIModel.concurrencyControl.hasPendingRequests);

    assert.throws(() => IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, newModelCode, true), IModelError);  // s/ have errorNumber=RepositoryStatus.LockNotHeld
    assert.throws(() => SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value, subCategory), IModelError);  // s/ have errorNumber=RepositoryStatus.LockNotHeld

    // assert.isUndefined(rwIModel.models.tryGetModelProps())
    assert.isUndefined(rwIModel.elements.tryGetElement(newCategoryCode));
    assert.isUndefined(rwIModel.elements.tryGetElement(newCategoryCode2));

    rwIModel.concurrencyControl.startBulkMode();
    // rwIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());

    assert.isFalse(rwIModel.concurrencyControl.hasPendingRequests);

    IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, newModelCode, true);
    SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value, subCategory);
    SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode2.value, subCategory);

    assert.isTrue(undefined !== rwIModel.elements.getElement(newCategoryCode));
    assert.isTrue(undefined !== rwIModel.elements.getElement(newCategoryCode2));

    assert.isTrue(rwIModel.concurrencyControl.hasPendingRequests);
    await rwIModel.concurrencyControl.request(adminRequestContext);
    assert.isFalse(rwIModel.concurrencyControl.hasPendingRequests);
    rwIModel.saveChanges("inserted generic objects");

    // While we're here, do a quick test of lock management
    const bcId = rwIModel.concurrencyControl.iModel.briefcaseId;
    const iModelId = rwIModel.concurrencyControl.iModel.iModelId;

    let heldLocks = await IModelHost.iModelClient.locks.get(adminRequestContext, iModelId, new LockQuery().byBriefcaseId(bcId));
    assert.isTrue(heldLocks.length !== 0);

    await expect(rwIModel.concurrencyControl.abandonResources(adminRequestContext)).to.be.rejectedWith(IModelError, "");

    await rwIModel.pushChanges(adminRequestContext, "");

    heldLocks = await IModelHost.iModelClient.locks.get(adminRequestContext, iModelId, new LockQuery().byBriefcaseId(bcId));
    assert.isTrue(heldLocks.length === 0);

    await rwIModel.concurrencyControl.abandonResources(adminRequestContext); // should do nothing and be harmless

  });

  it("should handle undo/redo (#integration)", async () => {
    const adminRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);
    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "CodesUndoRedoPushTest";
    const iModels = await IModelHost.iModelClient.iModels.get(adminRequestContext, writeTestProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await IModelHost.iModelClient.iModels.delete(adminRequestContext, writeTestProjectId, iModelTemp.id!);
    }
    timer.end();

    // Create a new empty iModel on the Hub & obtain a briefcase
    timer = new Timer("create iModel");
    const rwIModelId = await BriefcaseManager.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: adminRequestContext, contextId: writeTestProjectId, iModelId: rwIModelId });
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
    const codes = await IModelHost.iModelClient.codes.get(adminRequestContext, rwIModelId);
    timer.end();
    assert.isTrue(codes.find((code) => (code.value === "newPhysicalModel2" && code.state === CodeState.Used)) !== undefined);
    assert.isFalse(codes.find((code) => (code.value === "newPhysicalModel" && code.state === CodeState.Used)) !== undefined);
  });

  it("should not push changes with lock conflicts (#integration)", async () => {
    const adminRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);
    let timer = new Timer("delete iModels");
    const iModelName = "LocksConflictTest";
    const iModels = await IModelHost.iModelClient.iModels.get(adminRequestContext, writeTestProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await IModelHost.iModelClient.iModels.delete(adminRequestContext, writeTestProjectId, iModelTemp.id!);
      adminRequestContext.enter();
    }
    timer.end();

    timer = new Timer("create iModel");
    const rwIModelId = await BriefcaseManager.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });

    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: adminRequestContext, contextId: writeTestProjectId, iModelId: rwIModelId });
    adminRequestContext.enter();
    timer.end();

    rwIModel.concurrencyControl.startBulkMode();  // in bulk mode, we don't have to get locks before we make local changes. They are tracked and deferred until saveChanges requests them all at once.

    //  Create a new model and put two elements in it
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);
    const dictionary: DictionaryModel = rwIModel.models.getModel<DictionaryModel>(IModel.dictionaryId);
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    assert.isTrue(await rwIModel.concurrencyControl.codes.areAvailable(adminRequestContext, [newCategoryCode]));
    const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value, new SubCategoryAppearance({ color: 0xff0000 }));
    const elid1 = rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, newModelId, spatialCategoryId));
    const elid2 = rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, newModelId, spatialCategoryId));

    await rwIModel.concurrencyControl.request(adminRequestContext);
    adminRequestContext.enter();
    rwIModel.saveChanges("created newPhysicalModel");
    timer = new Timer("pullmergepush");
    await rwIModel.pushChanges(adminRequestContext, "newPhysicalModel");
    adminRequestContext.enter();

    //  Have another briefcase take out an exclusive lock on element #1
    const otherBriefcase = await IModelHost.iModelClient.briefcases.create(adminRequestContext, rwIModelId);
    assert.notEqual(otherBriefcase.briefcaseId, rwIModel.briefcaseId);
    const otherBriefcaseLockReq = ConcurrencyControl.Request.toHubLock(rwIModel.concurrencyControl, ConcurrencyControl.Request.getElementLock(elid1, LockLevel.Exclusive));
    otherBriefcaseLockReq.briefcaseId = otherBriefcase.briefcaseId; // We want this lock to be held by another briefcase
    const otherBriefcaseLockResult = await IModelHost.iModelClient.locks.update(adminRequestContext, rwIModelId, [otherBriefcaseLockReq]);
    assert.isTrue(otherBriefcaseLockResult.length === 1);
    assert.equal(otherBriefcase.briefcaseId, otherBriefcaseLockResult[0].briefcaseId);
    assert.equal(elid1, otherBriefcaseLockResult[0].objectId);
    assert.equal(LockLevel.Exclusive, otherBriefcaseLockResult[0].lockLevel);

    assert.isUndefined(rwIModel.elements.getElement(elid1).userLabel, "element #1 should have no userLabel");

    // This briefcase can insert elements with no problem
    const elid4 = rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, newModelId, spatialCategoryId));
    await rwIModel.concurrencyControl.request(adminRequestContext);
    rwIModel.saveChanges("inserted element #4");
    // (don't push! We want this newly inserted element to be in the local briefcase and its fake local lock to be in the cctl lock cache together with
    // the changes that we are about to try and fail to make in the next step.)

    // This briefcase will now try to modify the locked element, and that should fail.
    let elid3: Id64String | undefined;
    if (true) {
      const el1Props = rwIModel.elements.getElement(elid1);
      el1Props.userLabel = "try to change it in this briefcase (won't work)";
      rwIModel.elements.updateElement(el1Props);
      // Also create another new element as part of the same txn.
      elid3 = rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, newModelId, spatialCategoryId));
      assert.isTrue(rwIModel.concurrencyControl.locks.holdsLock(ConcurrencyControl.Request.getElementLock(elid3, LockLevel.Exclusive))); // (tricky: ccmgr pretends that new elements are locked.)
      assert.isTrue(rwIModel.concurrencyControl.hasPendingRequests); // we have to get the lock before we can carry through with this
      let rejectedWithError: Error | undefined;
      try {
        await rwIModel.concurrencyControl.request(adminRequestContext);
      } catch (err) {
        rejectedWithError = err;
      }
      assert.isTrue(rejectedWithError !== undefined);
      assert.isTrue(rejectedWithError instanceof IModelHubError);
      assert.equal((rejectedWithError as IModelHubError).errorNumber, IModelHubStatus.LockOwnedByAnotherBriefcase);
    }

    // This briefcase has no choice but to abandon everything it did since the last call to saveChanges. That includes both the change to the locked element and the insert of the new element.
    rwIModel.abandonChanges();

    // Verify that all uncommitted changes and temporary locks were rolled back
    assert.isFalse(rwIModel.concurrencyControl.hasPendingRequests); // when we abandon changes, we also abandon the pending resource request
    assert.isUndefined(rwIModel.elements.getElement(elid1).userLabel, "the modification of element #1 should have been unwound");
    assert.isUndefined(rwIModel.elements.tryGetElement(elid3), "the insert of element #3 should have been unwound");
    assert.isFalse(rwIModel.concurrencyControl.locks.holdsLock(ConcurrencyControl.Request.getElementLock(elid3, LockLevel.Exclusive)), "The fake local lock on element #3 should have been discarded");
    // ... but all committed changes and temporary locks were retained.
    assert.isTrue(undefined !== rwIModel.elements.tryGetElement(elid4), "the insert of the first new element should have been retained");
    assert.isTrue(rwIModel.concurrencyControl.locks.holdsLock(ConcurrencyControl.Request.getElementLock(elid4, LockLevel.Exclusive)), "The fake local lock on element #4 should have been retained");

    // This briefcase should be able to modify element #2.
    if (true) {
      const el2Props = rwIModel.elements.getElement(elid2);
      el2Props.userLabel = "changed by this briefcase";
      rwIModel.elements.updateElement(el2Props);
      assert.isTrue(rwIModel.concurrencyControl.hasPendingRequests); // we have to get the lock before we can carry through with this
      await rwIModel.concurrencyControl.request(adminRequestContext);
      adminRequestContext.enter();
      rwIModel.saveChanges("this briefcase changed el2");
      await rwIModel.pushChanges(adminRequestContext, "this briefcase changed el2");
    }

    // Now make the other briefcase release its lock and show that this briefcase can update element #1.
    otherBriefcaseLockReq.lockLevel = LockLevel.None;
    await IModelHost.iModelClient.locks.update(adminRequestContext, rwIModelId, [otherBriefcaseLockReq]);
    if (true) {
      const el1Props = rwIModel.elements.getElement(elid1);
      el1Props.userLabel = "changed by this briefcase";
      assert.isFalse(rwIModel.concurrencyControl.hasPendingRequests);
      rwIModel.elements.updateElement(el1Props);
      assert.isTrue(rwIModel.concurrencyControl.hasPendingRequests); // we have to get the lock before we can carry through with this
      await rwIModel.concurrencyControl.request(adminRequestContext);
      assert.isFalse(rwIModel.concurrencyControl.hasPendingRequests);
      adminRequestContext.enter();
      rwIModel.saveChanges("this briefcase change to el2");
      await rwIModel.pushChanges(adminRequestContext, "this briefcase change to el2");
    }

    await IModelTestUtils.closeAndDeleteBriefcaseDb(adminRequestContext, rwIModel);
  });

  it("Locks conflict test II (#integration)", async () => {
    const adminRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);
    let timer = new Timer("delete iModels");
    const iModelName = "LocksConflictTestII";
    const iModels = await IModelHost.iModelClient.iModels.get(adminRequestContext, writeTestProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await IModelHost.iModelClient.iModels.delete(adminRequestContext, writeTestProjectId, iModelTemp.id!);
      adminRequestContext.enter();
    }
    timer.end();

    timer = new Timer("create iModel");
    const rwIModelId = await BriefcaseManager.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });

    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: adminRequestContext, contextId: writeTestProjectId, iModelId: rwIModelId });
    adminRequestContext.enter();
    timer.end();

    rwIModel.concurrencyControl.startBulkMode();  // in bulk mode, we don't have to get locks before we make local changes. They are tracked and deferred until saveChanges requests them all at once.

    //  Create a new model and put an element in it (elid1)
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);
    const dictionary: DictionaryModel = rwIModel.models.getModel<DictionaryModel>(IModel.dictionaryId);
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    assert.isTrue(await rwIModel.concurrencyControl.codes.areAvailable(adminRequestContext, [newCategoryCode]));
    const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value, new SubCategoryAppearance({ color: 0xff0000 }));
    const elid1 = rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, newModelId, spatialCategoryId));

    await rwIModel.concurrencyControl.request(adminRequestContext);
    adminRequestContext.enter();
    rwIModel.saveChanges("created newPhysicalModel");
    timer = new Timer("pullmergepush");
    await rwIModel.pushChanges(adminRequestContext, "newPhysicalModel");
    adminRequestContext.enter();

    await rwIModel.concurrencyControl.endBulkMode(adminRequestContext); // leave bulk mode. Now we will have to get locks before making changes.
    adminRequestContext.enter();

    //  --- Briefcase 2
    //  Have another briefcase take out an exclusive lock on element #1
    const briefcase2 = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: superRequestContext, contextId: writeTestProjectId, iModelId: rwIModelId });
    superRequestContext.enter();

    assert.notEqual(briefcase2.briefcaseId, rwIModel.briefcaseId);

    const el1bc2 = briefcase2.elements.getElement(elid1);
    await briefcase2.concurrencyControl.requestResourcesForUpdate(superRequestContext, [el1bc2]);
    superRequestContext.enter();

    // --- Briefcase 1
    // Now let the first briefcase try to delete element #1. That should fail with a lock error.
    const el1bc1 = rwIModel.elements.getElement(elid1);
    assert.throws(() => rwIModel.elements.deleteElement(elid1)); // this should throw, because we haven't requested a lock yet
    await expect(rwIModel.concurrencyControl.requestResourcesForDelete(adminRequestContext, [el1bc1])).to.be.rejectedWith(WsgError, "Lock(s) is owned by another briefcase.");

    briefcase2.close();
    await IModelTestUtils.closeAndDeleteBriefcaseDb(adminRequestContext, rwIModel);
  });

  it("should not push changes with code conflicts (#integration)", async () => {
    const adminRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);
    let timer = new Timer("delete iModels");
    const iModelName = "CodesConflictTest";
    const iModels = await IModelHost.iModelClient.iModels.get(adminRequestContext, writeTestProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await IModelHost.iModelClient.iModels.delete(adminRequestContext, writeTestProjectId, iModelTemp.id!);
    }
    timer.end();

    timer = new Timer("create iModel");
    const rwIModelId = await BriefcaseManager.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    assert.isNotEmpty(rwIModelId);

    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: adminRequestContext, contextId: writeTestProjectId, iModelId: rwIModelId });
    timer.end();

    const code = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel");
    const otherBriefcase = await IModelHost.iModelClient.briefcases.create(adminRequestContext, rwIModelId);

    let codesReserved = (await IModelHost.iModelClient.codes.get(adminRequestContext, rwIModelId)).filter((c) => c.state === CodeState.Reserved);
    assert.equal(codesReserved.length, 0);

    const hubCode = new HubCode();
    hubCode.value = code.value;
    hubCode.codeSpecId = code.spec;
    hubCode.codeScope = code.scope;
    hubCode.briefcaseId = otherBriefcase.briefcaseId;
    hubCode.state = CodeState.Reserved;
    await IModelHost.iModelClient.codes.update(adminRequestContext, rwIModelId, [hubCode]);
    adminRequestContext.enter();
    await rwIModel.concurrencyControl.syncCache(adminRequestContext); // I must tell ConcurrencyControl whenever I make changes to locks/codes in iModelHub by using the lower-level API directly.
    adminRequestContext.enter();

    timer = new Timer("querying codes");
    codesReserved = (await IModelHost.iModelClient.codes.get(adminRequestContext, rwIModelId)).filter((c) => c.state === CodeState.Reserved);
    timer.end();
    assert.equal(codesReserved.length, 1);
    assert.equal(codesReserved[0].value, hubCode.value);

    let rejectedWithError: Error | undefined;
    try {
      await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(adminRequestContext, rwIModel, code, true);
    } catch (err) {
      rejectedWithError = err;
    }
    assert.isTrue(rejectedWithError !== undefined);
    assert.isTrue(rejectedWithError instanceof IModelHubError);
    assert.equal((rejectedWithError as IModelHubError).errorNumber, IModelHubStatus.CodeReservedByAnotherBriefcase);
  });

  it("should write to briefcase with optimistic concurrency (#integration)", async () => {
    const adminRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);

    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the OptimisticConcurrencyTest iModel
    const iModelName = "OptimisticConcurrencyTest";
    const iModels = await IModelHost.iModelClient.iModels.get(adminRequestContext, writeTestProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await IModelHost.iModelClient.iModels.delete(adminRequestContext, writeTestProjectId, iModelTemp.id!);
    }
    timer.end();

    // Create a new empty iModel on the Hub & obtain a briefcase
    timer = new Timer("create iModel");
    const rwIModelId = await BriefcaseManager.create(adminRequestContext, writeTestProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: adminRequestContext, contextId: writeTestProjectId, iModelId: rwIModelId });
    timer.end();

    timer = new Timer("make local changes");

    // Turn on optimistic concurrency control. This allows the app to modify elements, models, etc. without first acquiring locks.
    // Later, when the app downloads and merges changeSets from the Hub into the briefcase, BriefcaseManager will merge changes and handle conflicts.
    // The app still has to reserve codes.
    rwIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());

    // Show that we can modify the properties of an element. In this case, we modify the root element itself.
    const rootEl: Element = rwIModel.elements.getRootSubject();
    rootEl.userLabel = `${rootEl.userLabel}changed`;
    rwIModel.elements.updateElement(rootEl);

    assert.isFalse(rwIModel.concurrencyControl.hasPendingRequests);

    rwIModel.saveChanges(JSON.stringify({ userid: "user1", description: "changed a userLabel" }));  // save it, to show that saveChanges will accumulate local txn descriptions

    // Create a new physical model.
    const [, newModelId] = await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(adminRequestContext, rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);
    adminRequestContext.enter();

    // Find or create a SpatialCategory.
    const dictionary: DictionaryModel = rwIModel.models.getModel<DictionaryModel>(IModel.dictionaryId);
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    assert.isTrue(await rwIModel.concurrencyControl.codes.areAvailable(adminRequestContext, [newCategoryCode]));
    const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value, new SubCategoryAppearance({ color: 0xff0000 }));

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
    const codeStates = await rwIModel.concurrencyControl.codes.query(adminRequestContext, category.code.spec, category.code.scope);
    const foundCode: MultiCode[] = codeStates.filter((cs) => (cs.value === category.code.value) && (cs.state === CodeState.Reserved));
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
    const roIModel = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext: adminRequestContext, contextId: writeTestProjectId, iModelId: rwIModelId });
    assert.exists(roIModel);

    await IModelTestUtils.closeAndDeleteBriefcaseDb(adminRequestContext, rwIModel);
    roIModel.close();
  });

  it("Run plain SQL against fixed version connection", async () => {
    const iModel = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: managerRequestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id });
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
    const iModel = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext: managerRequestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id });

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

  it("should be able to upgrade a briefcase with an older schema", async () => {
    const projectName = "iModelJsIntegrationTest";
    const projectId = await HubUtility.queryProjectIdByName(managerRequestContext, projectName);

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
    const args: RequestNewBriefcaseProps = {
      contextId: projectId,
      iModelId,
    };
    const managerBriefcaseProps = await BriefcaseManager.downloadBriefcase(managerRequestContext, args);
    managerRequestContext.enter();
    const superBriefcaseProps = await BriefcaseManager.downloadBriefcase(superRequestContext, args);
    superRequestContext.enter();

    /* User "manager" upgrades the briefcase */

    // Validate the original state of the BisCore schema in the briefcase
    let iModel = await BriefcaseDb.open(managerRequestContext, { fileName: managerBriefcaseProps.fileName });
    const beforeVersion = iModel.querySchemaVersion("BisCore");
    assert.isTrue(semver.satisfies(beforeVersion!, "= 1.0.0"));
    assert.isFalse(iModel.nativeDb.hasPendingTxns());
    iModel.close();

    // Validate that the BisCore schema is recognized as a recommended upgrade
    let schemaState: SchemaState = BriefcaseDb.validateSchemas(managerBriefcaseProps.fileName, true);
    assert.strictEqual(schemaState, SchemaState.UpgradeRecommended);

    // Upgrade the schemas
    await BriefcaseDb.upgradeSchemas(managerRequestContext, managerBriefcaseProps);
    managerRequestContext.enter();

    // Validate state after upgrade
    const schemaLocks = await IModelHost.iModelClient.locks.get(managerRequestContext, iModelId, new LockQuery().byLockType(LockType.Schemas).byLockLevel(LockLevel.Exclusive));
    managerRequestContext.enter();
    assert.isTrue(schemaLocks.length === 0); // Validate no schema locks held by the hub
    iModel = await BriefcaseDb.open(managerRequestContext, { fileName: managerBriefcaseProps.fileName });
    managerRequestContext.enter();
    const afterVersion = iModel.querySchemaVersion("BisCore");
    assert.isTrue(semver.satisfies(afterVersion!, ">= 1.0.10"));
    assert.isFalse(iModel.nativeDb.hasPendingTxns());
    assert.isFalse(iModel.concurrencyControl.locks.hasSchemaLock);
    assert.isFalse(iModel.nativeDb.hasUnsavedChanges());

    /* User "super" can get the upgrade "manager" made */

    // Validate that the BisCore schema is recognized as a recommended upgrade
    schemaState = BriefcaseDb.validateSchemas(superBriefcaseProps.fileName, true);
    assert.strictEqual(schemaState, SchemaState.UpgradeRecommended);

    // Upgrade the schemas - should fail, since user hasn't pulled changes done by manager
    let result: IModelHubStatus = IModelHubStatus.Success;
    try {
      await BriefcaseDb.upgradeSchemas(superRequestContext, superBriefcaseProps);
      managerRequestContext.enter();
    } catch (err) {
      superRequestContext.enter();
      assert(err instanceof IModelHubError);
      result = err.errorNumber;
    }
    assert.strictEqual(result, IModelHubStatus.PullIsRequired);

    // Open briefcase and pull change sets to upgrade
    const superIModel = await BriefcaseDb.open(superRequestContext, { fileName: superBriefcaseProps.fileName });
    superRequestContext.enter();
    await superIModel.pullAndMergeChanges(superRequestContext);
    superRequestContext.enter();
    const superVersion = superIModel.querySchemaVersion("BisCore");
    assert.isTrue(semver.satisfies(superVersion!, ">= 1.0.10"));
    assert.isFalse(iModel.nativeDb.hasUnsavedChanges()); // Validate no changes were made
    assert.isFalse(superIModel.nativeDb.hasPendingTxns()); // Validate no changes were made

    /* Cleanup after test */
    const filename = iModel.pathName;
    const superName = superIModel.pathName;
    iModel.close();
    await BriefcaseManager.deleteBriefcaseFiles(filename, managerRequestContext); // delete from local disk
    superIModel.close();
    await BriefcaseManager.deleteBriefcaseFiles(superName, superRequestContext); // delete from local disk
    managerRequestContext.enter();
    await HubUtility.deleteIModel(managerRequestContext, projectName, hubName); // delete from hub
    managerRequestContext.enter();
  });

});
