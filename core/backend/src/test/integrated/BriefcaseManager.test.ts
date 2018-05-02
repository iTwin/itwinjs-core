import * as path from "path";
import { expect, assert } from "chai";
import { IModelJsFs } from "../../IModelJsFs";
import { Id64, OpenMode, DbOpcode, BeEvent, ChangeSetApplyOption, ChangeSetStatus } from "@bentley/bentleyjs-core";
import { Code, IModelVersion, Appearance, IModel, IModelError} from "@bentley/imodeljs-common";
import { IModelTestUtils, TestUsers, Timer } from "../IModelTestUtils";
import { ChangeSetToken, KeepBriefcase, IModelDb, Element, DictionaryModel, SpatialCategory, AutoPush, AutoPushState, AutoPushEventHandler, AutoPushEventType } from "../../backend";
import { ConcurrencyControl } from "../../ConcurrencyControl";
import { KnownTestLocations } from "../KnownTestLocations";
import { TestIModelInfo } from "../MockAssetUtil";
import { HubTestUtils } from "../HubTestUtils";
import { ErrorStatusOrResult } from "@bentley/imodeljs-native-platform-api";
import { AccessToken, CodeState, ContainsSchemaChanges, IModel as HubIModel, Code as HubCode, IModelQuery, MultiCode } from "@bentley/imodeljs-clients";

let lastPushTimeMillis = 0;
let lastAutoPushEventType: AutoPushEventType | undefined;

// Combine all local Txns and generate a changeset file. Then delete all local Txns.
function createChangeSet(imodel: IModelDb): ChangeSetToken {
  const res: ErrorStatusOrResult<ChangeSetStatus, string> = imodel.briefcase!.nativeDb!.startCreateChangeSet();
  if (res.error)
    throw new IModelError(res.error.status);

  const token: ChangeSetToken = JSON.parse(res.result!);

  // finishCreateChangeSet deletes the file that startCreateChangeSet created.
  // We make a copy of it now, before he does that.
  const csfilename = path.join(KnownTestLocations.outputDir, token.id + ".cs");
  IModelJsFs.copySync(token.pathname, csfilename);
  token.pathname = csfilename;

  const status: ChangeSetStatus = imodel.briefcase!.nativeDb!.finishCreateChangeSet();
  if (ChangeSetStatus.Success !== status)
    throw new IModelError(status);

  return token;
}

function applyChangeSet(imodel: IModelDb, cstoken: ChangeSetToken) {
  const status: ChangeSetStatus = imodel.briefcase!.nativeDb!.applyChangeSets(JSON.stringify([cstoken]), ChangeSetApplyOption.Merge, cstoken.containsSchemaChanges === ContainsSchemaChanges.Yes);
  imodel.onChangesetApplied.raiseEvent();
  assert.equal(status, ChangeSetStatus.Success);
}

async function createNewModelAndCategory(rwIModel: IModelDb, accessToken: AccessToken) {
  // Create a new physical model.
  let modelId: Id64;
  [, modelId] = IModelTestUtils.createAndInsertPhysicalModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);

  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.dictionaryId) as DictionaryModel;
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const spatialCategoryId: Id64 = IModelTestUtils.createAndInsertSpatialCategory(dictionary, newCategoryCode.value!, new Appearance({ color: 0xff0000 }));

  // Reserve all of the codes that are required by the new model and category.
  try {
    await rwIModel.concurrencyControl.request(accessToken);
  } catch (err) {
    if (err instanceof ConcurrencyControl.RequestError) {
      assert.fail(JSON.stringify(err.unavailableCodes) + ", " + JSON.stringify(err.unavailableLocks));
    }
  }

  return { modelId, spatialCategoryId };
}

describe("BriefcaseManager", () => {
  let testProjectId: string;
  let accessToken: AccessToken;
  let startTime = new Date().getTime();
  let cacheDir: string = "";
  const testIModels: TestIModelInfo[] = [
    new TestIModelInfo("ReadOnlyTest"),
    new TestIModelInfo("ReadWriteTest"),
    new TestIModelInfo("NoVersionsTest"),
  ];

  before(async () => {
    startTime = new Date().getTime();
    console.log(`    ...getting user access token from IMS: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console

    [accessToken, testProjectId, cacheDir] = await IModelTestUtils.setupIntegratedFixture(testIModels);

    console.log(`    ...getting information on Project+IModel+ChangeSets for test case from the Hub: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console
  });

  it.skip("test change-merging scenarios in optimistic concurrency mode", async () => {
    const firstUser = accessToken;
    const secondUser = await IModelTestUtils.getTestUserAccessToken(TestUsers.superManager);
    const neutralObserverUser = await IModelTestUtils.getTestUserAccessToken(TestUsers.user2);

    const firstIModel: IModelDb = await IModelDb.open(firstUser, testProjectId, testIModels[1].id, OpenMode.ReadWrite);
    const secondIModel: IModelDb = await IModelDb.open(secondUser, testProjectId, testIModels[1].id, OpenMode.ReadWrite);
    const neutralObserverIModel: IModelDb = await IModelDb.open(neutralObserverUser, testProjectId, testIModels[1].id , OpenMode.Readonly);
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
    await firstIModel.pushChanges(firstUser);

    // secondUser: pull and merge
    await secondIModel.pullAndMergeChanges(secondUser);

    // --- Test 1: Overlapping changes that really are conflicts => conflict-resolution policy is applied ---

    // firstUser: modify el1.userLabel
    if (true) {
      const el1cc = (firstIModel.elements.getElement(el1)).copyForEdit<Element>();
      el1cc.userLabel = el1cc.userLabel + " -> changed by firstUser";
      firstIModel.elements.updateElement(el1cc);
      firstIModel.saveChanges("firstUser modified el1.userLabel");
      await firstIModel.pushChanges(firstUser);
    }

    // secondUser: modify el1.userLabel
    let expectedValueofEl1UserLabel: string;
    if (true) {
      const el1before = (secondIModel.elements.getElement(el1)).copyForEdit<Element>();
      expectedValueofEl1UserLabel = el1before.userLabel + " -> changed by secondUser";
      el1before.userLabel = expectedValueofEl1UserLabel;
      secondIModel.elements.updateElement(el1before);
      secondIModel.saveChanges("secondUser modified el1.userLabel");

      // pull + merge => take secondUser's change (RejectIncomingChange). That's because the default updateVsUpdate settting is RejectIncomingChange
      await secondIModel.pullAndMergeChanges(secondUser);
      const el1after = secondIModel.elements.getElement(el1);
      assert.equal(el1after.userLabel, expectedValueofEl1UserLabel);

      await secondIModel.pushChanges(secondUser);
    }

    // Make sure a neutral observer sees secondUser's change.
    if (true) {
      await neutralObserverIModel.pullAndMergeChanges(neutralObserverUser);
      const elobj = neutralObserverIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
    }

    // firstUser: pull and see that secondUser has overridden my change
    if (true) {
      await firstIModel.pullAndMergeChanges(firstUser);
      const elobj = firstIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
    }

    // --- Test 2: Overlapping changes that are not conflicts  ---

    // firstUser: modify el1.userLabel
    const wasExpectedValueofEl1UserLabel = expectedValueofEl1UserLabel;
    if (true) {
      const el1cc = (firstIModel.elements.getElement(el1)).copyForEdit<Element>();
      assert.equal(el1cc.userLabel, wasExpectedValueofEl1UserLabel);
      expectedValueofEl1UserLabel = el1cc.userLabel + " -> changed again by firstUser";
      el1cc.userLabel = expectedValueofEl1UserLabel;
      firstIModel.elements.updateElement(el1cc);
      firstIModel.saveChanges("firstUser modified el1.userLabel");
      await firstIModel.pushChanges(firstUser);
    }

    // Make sure a neutral observer sees firstUser's changes.
    if (true) {
      await neutralObserverIModel.pullAndMergeChanges(neutralObserverUser);
      const elobj = neutralObserverIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
    }

    // secondUser: modify el1.userProperties
    const secondUserPropNs = "secondUser";
    const secondUserPropName = "property";
    const expectedValueOfSecondUserProp: string = "x";
    if (true) {
      const el1before = (secondIModel.elements.getElement(el1)).copyForEdit<Element>();
      assert.equal(el1before.userLabel, wasExpectedValueofEl1UserLabel);
      el1before.setUserProperties(secondUserPropNs, { property: expectedValueOfSecondUserProp }); // secondUser changes userProperties
      secondIModel.elements.updateElement(el1before);
      secondIModel.saveChanges("secondUser modified el1.userProperties");
      assert.equal(el1before.userLabel, wasExpectedValueofEl1UserLabel, "secondUser does not change userLabel");

      // pull + merge => no conflict + both changes should be intact
      await secondIModel.pullAndMergeChanges(secondUser);
      const el1after = secondIModel.elements.getElement(el1);
      assert.equal(el1after.userLabel, expectedValueofEl1UserLabel);
      assert.equal(el1after.getUserProperties(secondUserPropNs)[secondUserPropName], expectedValueOfSecondUserProp);

      await secondIModel.pushChanges(secondUser);
    }

    // firstUser: pull and see both changes
    if (true) {
      await firstIModel.pullAndMergeChanges(firstUser);
      const elobj = firstIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
      assert.equal(elobj.getUserProperties(secondUserPropNs)[secondUserPropName], expectedValueOfSecondUserProp);
    }

    // Make sure a neutral observer sees both changes.
    if (true) {
      await neutralObserverIModel.pullAndMergeChanges(neutralObserverUser);
      const elobj = neutralObserverIModel.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
      assert.equal(elobj.getUserProperties(secondUserPropNs)[secondUserPropName], expectedValueOfSecondUserProp);
    }

    // --- Test 3: Non-overlapping changes ---

  });

  it.skip("should merge changes so that two branches of an iModel converge", () => {
    // Make sure that the seed imodel has had all schema/profile upgrades applied, before we make copies of it.
    // (Otherwise, the upgrade Txn will appear to be in the changesets of the copies.)
    const upgraded: IModelDb = IModelTestUtils.openIModel("testImodel.bim", { copyFilename: "upgraded.bim", openMode: OpenMode.ReadWrite, enableTransactions: true });
    upgraded.saveChanges();
    createChangeSet(upgraded);

    // Open two copies of the seed file.
    const first: IModelDb = IModelTestUtils.openIModelFromOut("upgraded.bim", { copyFilename: "first.bim", openMode: OpenMode.ReadWrite, enableTransactions: true });
    const second: IModelDb = IModelTestUtils.openIModelFromOut("upgraded.bim", { copyFilename: "second.bim", openMode: OpenMode.ReadWrite, enableTransactions: true });
    const neutral: IModelDb = IModelTestUtils.openIModelFromOut("upgraded.bim", { copyFilename: "neutral.bim", openMode: OpenMode.ReadWrite, enableTransactions: true });
    assert.isTrue(first !== second);

    first.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    second.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    // Note: neutral observer's IModel does not need to be configured for optimistic concurrency. He just pulls changes.

    const cshistory: ChangeSetToken[] = [];

    let firstparent: number = -1;
    let secondparent: number = -1;
    let neutralparent: number = -1;

    let modelId: Id64;
    let spatialCategoryId: Id64;
    let el1: Id64;
    // first. Create a new model, category, and element.  =>  #0
    if (true) {
      [, modelId] = IModelTestUtils.createAndInsertPhysicalModel(first, IModelTestUtils.getUniqueModelCode(first, "newPhysicalModel"), true);
      const dictionary: DictionaryModel = first.models.getModel(IModel.dictionaryId) as DictionaryModel;
      const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
      spatialCategoryId = IModelTestUtils.createAndInsertSpatialCategory(dictionary, newCategoryCode.value!, new Appearance({ color: 0xff0000 }));
      el1 = first.elements.insertElement(IModelTestUtils.createPhysicalObject(first, modelId, spatialCategoryId));
      first.saveChanges();
      cshistory.push(createChangeSet(first));
      ++firstparent; // (This automatically becomes my parent)
      assert.isTrue((cshistory.length - 1) === firstparent);
    }

    if (true) {
      // first -> second, neutral
      applyChangeSet(second, cshistory[++secondparent]);
      assert.isTrue(second.models.getModel(modelId) !== undefined);
      assert.isTrue(second.elements.getElement(spatialCategoryId) !== undefined);
      assert.isTrue(second.elements.getElement(el1) !== undefined);

      applyChangeSet(neutral, cshistory[++neutralparent]);
      assert.isTrue(neutral.models.getModel(modelId) !== undefined);
      assert.isTrue(neutral.elements.getElement(spatialCategoryId) !== undefined);
      assert.isTrue(neutral.elements.getElement(el1) !== undefined);
    }

    // --- Test 1: Overlapping changes that really are conflicts => conflict-resolution policy is applied ---

    // first: modify el1.userLabel
    if (true) {
      const el1cc = (first.elements.getElement(el1)).copyForEdit<Element>();
      el1cc.userLabel = el1cc.userLabel + " -> changed by first";
      first.elements.updateElement(el1cc);
      first.saveChanges("first modified el1.userLabel");
      cshistory.push(createChangeSet(first));
      ++firstparent; // (This automatically becomes my parent)
    }

    // second: modify el1.userLabel
    let expectedValueofEl1UserLabel: string;
    if (true) {
      const el1before = (second.elements.getElement(el1)).copyForEdit<Element>();
      expectedValueofEl1UserLabel = el1before.userLabel + " -> changed by second";
      el1before.userLabel = expectedValueofEl1UserLabel;
      second.elements.updateElement(el1before);
      second.saveChanges("second modified el1.userLabel");

      // merge => take second's change (RejectIncomingChange). That's because the default updateVsUpdate settting is RejectIncomingChange
      applyChangeSet(second, cshistory[++secondparent]);
      const el1after = second.elements.getElement(el1);
      assert.equal(el1after.userLabel, expectedValueofEl1UserLabel);
      cshistory.push(createChangeSet(second));
      ++secondparent; // (This automatically becomes my parent)
    }

    // Make sure a neutral observer sees secondUser's change.
    if (true) {
      applyChangeSet(neutral, cshistory[++neutralparent]);
      const elobj = neutral.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
    }

    // firstUser: pull and see that secondUser has overridden my change
    if (true) {
      applyChangeSet(first, cshistory[++firstparent]);
      const elobj = first.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
    }
  });

  it("should push changes with codes", async () => {
    const adminAccessToken = await IModelTestUtils.getTestUserAccessToken(TestUsers.superManager);
    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "CodesPushTest";
    const iModels: HubIModel[] = await HubTestUtils.hubClient!.IModels().get(adminAccessToken, testProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await HubTestUtils.hubClient!.IModels().delete(adminAccessToken, testProjectId, iModelTemp.wsgId);
    }
    timer.end();

    // Create a new iModel on the Hub (by uploading a seed file)
    timer = new Timer("create iModel");
    const rwIModel: IModelDb = await IModelDb.create(adminAccessToken, testProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    const rwIModelId = rwIModel.iModelToken.iModelId;
    assert.isNotEmpty(rwIModelId);
    timer.end();

    timer = new Timer("querying codes");
    const initialCodes = await HubTestUtils.hubClient!.Codes().get(adminAccessToken, rwIModelId!);
    timer.end();

    timer = new Timer("make local changes");
    let newModelId: Id64;
    const code = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel");
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalModel(rwIModel, code, true);

    rwIModel.saveChanges("inserted generic objects");
    timer.end();

    timer = new Timer("push changes");

    // Push the changes to the hub
    const prePushChangeSetId = rwIModel.iModelToken.changeSetId;
    await rwIModel.pushChanges(adminAccessToken);
    const postPushChangeSetId = rwIModel.iModelToken.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    timer = new Timer("querying codes");
    const codes = await HubTestUtils.hubClient!.Codes().get(adminAccessToken, rwIModelId!);
    timer.end();
    expect(codes.length > initialCodes.length);
  });

  it("should push changes with code conflicts", async () => {
    const adminAccessToken = await IModelTestUtils.getTestUserAccessToken(TestUsers.superManager);
    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "CodesPushTest";
    const iModels: HubIModel[] = await HubTestUtils.hubClient!.IModels().get(adminAccessToken, testProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await HubTestUtils.hubClient!.IModels().delete(adminAccessToken, testProjectId, iModelTemp.wsgId);
    }
    timer.end();

    // Create a new iModel on the Hub (by uploading a seed file)
    timer = new Timer("create iModel");
    const rwIModel: IModelDb = await IModelDb.create(adminAccessToken, testProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    const rwIModelId = rwIModel.iModelToken.iModelId;
    assert.isNotEmpty(rwIModelId);
    timer.end();

    const code = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel");
    const otherBriefcase = await HubTestUtils.hubClient!.Briefcases().create(adminAccessToken, rwIModelId!);
    const hubCode = new HubCode();
    hubCode.value = code.value;
    hubCode.codeSpecId = code.spec.toString();
    hubCode.codeScope = code.scope;
    hubCode.briefcaseId = otherBriefcase.briefcaseId;
    hubCode.state = CodeState.Reserved;
    await HubTestUtils.hubClient!.Codes().update(adminAccessToken, rwIModelId!, [hubCode]);

    timer = new Timer("querying codes");
    const initialCodes = await HubTestUtils.hubClient!.Codes().get(adminAccessToken, rwIModelId!);
    timer.end();

    timer = new Timer("make local changes");
    let newModelId: Id64;
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalModel(rwIModel, code, true);

    rwIModel.saveChanges("inserted generic objects");
    timer.end();

    timer = new Timer("push changes");

    // Push the changes to the hub
    const prePushChangeSetId = rwIModel.iModelToken.changeSetId;
    await rwIModel.pushChanges(adminAccessToken);
    const postPushChangeSetId = rwIModel.iModelToken.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    timer = new Timer("querying codes");
    const codes = await HubTestUtils.hubClient!.Codes().get(accessToken, rwIModelId!);
    timer.end();
    expect(codes.length === initialCodes.length);
    expect(codes[0].state === CodeState.Reserved);
  });

  it.skip("should write to briefcase with optimistic concurrency", async () => {
    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "ReadWriteTest";
    const iModels: HubIModel[] = await HubTestUtils.hubClient!.IModels().get(accessToken, testProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await HubTestUtils.hubClient!.IModels().delete(accessToken, testProjectId, iModelTemp.wsgId);
    }
    timer.end();

    // Create a new iModel on the Hub (by uploading a seed file)
    timer = new Timer("create iModel");
    const rwIModel: IModelDb = await IModelDb.create(accessToken, testProjectId, "ReadWriteTest", { rootSubject: { name: "TestSubject" } });
    const rwIModelId = rwIModel.iModelToken.iModelId;
    assert.isNotEmpty(rwIModelId);
    timer.end();

    timer = new Timer("make local changes");

    // Turn on optimistic concurrency control. This allows the app to modify elements, models, etc. without first acquiring locks.
    // Later, when the app downloads and merges changeSets from the Hub into the briefcase, BriefcaseManager will merge changes and handle conflicts.
    // The app still has to reserve codes.
    rwIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());

    // Show that we can modify the properties of an element. In this case, we modify the root element itself.
    const rootEl: Element = (rwIModel.elements.getRootSubject()).copyForEdit<Element>();
    rootEl.userLabel = rootEl.userLabel + "changed";
    rwIModel.elements.updateElement(rootEl);

    assert.isFalse(rwIModel.concurrencyControl.hasPendingRequests());

    rwIModel.saveChanges(JSON.stringify({ userid: "user1", description: "changed a userLabel" }));  // save it, to show that saveChanges will accumulate local txn descriptions

    // Create a new physical model.
    let newModelId: Id64;
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);

    // Find or create a SpatialCategory.
    const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.dictionaryId) as DictionaryModel;
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    const spatialCategoryId: Id64 = IModelTestUtils.createAndInsertSpatialCategory(dictionary, newCategoryCode.value!, new Appearance({ color: 0xff0000 }));

    timer.end();

    timer = new Timer("query Codes I");

    // iModel.concurrencyControl should have recorded the codes that are required by the new elements.
    assert.isTrue(rwIModel.concurrencyControl.hasPendingRequests());
    assert.isTrue(await rwIModel.concurrencyControl.areAvailable(accessToken));

    timer.end();
    timer = new Timer("reserve Codes");

    // Reserve all of the codes that are required by the new model and category.
    try {
      await rwIModel.concurrencyControl.request(accessToken);
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
    const codeStates: MultiCode[] = await rwIModel.concurrencyControl.codes.query(accessToken, category.code.spec, category.code.scope);
    const foundCode: MultiCode[] = codeStates.filter((cs) => cs.values!.includes(category.code.value!) && (cs.state === CodeState.Reserved));
    assert.equal(foundCode.length, 1);

    /* NEEDS WORK - query just this one code
  assert.isTrue(category.code.value !== undefined);
  const codeStates2 = await iModel.concurrencyControl.codes.query(accessToken, category.code.spec, category.code.scope, category.code.value!);
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
    // (Note that this ends the bulk operation automatically, so there's no need to call endBulkOperation.)
    rwIModel.saveChanges(JSON.stringify({ userid: "user1", description: "inserted generic objects" }));

    rwIModel.elements.getElement(elid1); // throws if elid1 is not found
    rwIModel.elements.getElement(spatialCategoryId); // throws if spatialCategoryId is not found

    timer.end();

    timer = new Timer("pullmergepush");

    // Push the changes to the hub
    const prePushChangeSetId = rwIModel.iModelToken.changeSetId;
    await rwIModel.pushChanges(accessToken);
    const postPushChangeSetId = rwIModel.iModelToken.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    // Open a readonly copy of the iModel
    const roIModel: IModelDb = await IModelDb.open(accessToken, testProjectId, rwIModelId!, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(roIModel);

    rwIModel.close(accessToken, KeepBriefcase.No);
    roIModel.close(accessToken);
  });

  it.skip("should make change sets", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenMode.ReadWrite);
    assert.exists(iModel);

    const dictionary: DictionaryModel = iModel.models.getModel(IModel.dictionaryId) as DictionaryModel;

    let newModelId: Id64;
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalModel(iModel, Code.createEmpty(), true);

    const spatialCategoryId: Id64 = SpatialCategory.create(dictionary, "Cat1").insert();

    // Insert a few elements
    const elements: Element[] = [
      IModelTestUtils.createPhysicalObject(iModel, newModelId, spatialCategoryId),
      IModelTestUtils.createPhysicalObject(iModel, newModelId, spatialCategoryId),
    ];

    for (const el of elements) {
      el.buildConcurrencyControlRequest(DbOpcode.Insert);    // make a list of the resources that will be needed to insert this element (e.g., a shared lock on the model and a code)
    }

    await iModel.concurrencyControl.request(accessToken); // In a pessimistic concurrency regime, we must request locks and codes *before* writing to the local IModelDb.

    for (const el of elements)
      iModel.elements.insertElement(el);

    iModel.saveChanges("inserted generic objects");

    iModel.close(accessToken);
  });

  it.skip("should test AutoPush", async () => {
    let isIdle: boolean = true;
    const activityMonitor = {
      isIdle: () => isIdle,
    };

    const fakePushTimeRequired = 1; // pretend that it takes 1/1000 of a second to do the push
    const millisToWaitForAutoPush = (5 * fakePushTimeRequired); // a long enough wait to ensure that auto-push ran.

    const iModel = {
      pushChanges: async (_clientAccessToken: AccessToken) => {
        await new Promise((resolve, _reject) => { setTimeout(resolve, fakePushTimeRequired); }); // sleep, to simulate time spent doing push
        lastPushTimeMillis = Date.now();
      },
      iModelToken: {
        changeSetId: "",
      },
      concurrencyControl: {
        request: async (_clientAccessToken: AccessToken) => { },
      },
      onBeforeClose: new BeEvent<() => void>(),
      Txns: {
        hasLocalChanges: () => true,
      },
    };
    lastPushTimeMillis = 0;
    lastAutoPushEventType = undefined;

    // Create an autopush in manual-schedule mode.
    const autoPush = new AutoPush(iModel as any, { pushIntervalSecondsMin: 0, pushIntervalSecondsMax: 1, autoSchedule: false }, activityMonitor);
    assert.equal(autoPush.state, AutoPushState.NotRunning, "I configured auto-push NOT to start automatically");
    assert.isFalse(autoPush.autoSchedule);

    // Schedule the next push
    autoPush.scheduleNextPush();
    assert.equal(autoPush.state, AutoPushState.Scheduled);

    // Wait long enough for the auto-push to happen
    await new Promise((resolve, _reject) => { setTimeout(resolve, millisToWaitForAutoPush); });

    // Verify that push happened during the time that I was asleep.
    assert.equal(autoPush.state, AutoPushState.NotRunning, "I configured auto-push NOT to restart automatically");
    assert.notEqual(lastPushTimeMillis, 0);
    assert.isAtLeast(autoPush.durationOfLastPushMillis, fakePushTimeRequired);
    assert.isUndefined(lastAutoPushEventType);  // not listening to events yet.

    // Cancel the next scheduled push
    autoPush.cancel();
    assert.equal(autoPush.state, AutoPushState.NotRunning, "cancel does NOT automatically schedule the next push");

    // Register an event handler
    const autoPushEventHandler: AutoPushEventHandler = (etype: AutoPushEventType, _theAutoPush: AutoPush) => { lastAutoPushEventType = etype; };
    autoPush.event.addListener(autoPushEventHandler);

    lastPushTimeMillis = 0;

    // Explicitly schedule the next auto-push
    autoPush.scheduleNextPush();
    assert.equal(autoPush.state, AutoPushState.Scheduled);

    // wait long enough for the auto-push to happen
    await new Promise((resolve, _reject) => { setTimeout(resolve, millisToWaitForAutoPush); });
    assert.equal(autoPush.state, AutoPushState.NotRunning, "I configured auto-push NOT to start automatically");
    assert.notEqual(lastPushTimeMillis, 0);
    assert.equal(lastAutoPushEventType, AutoPushEventType.PushFinished, "event handler should have been called");

    // Just verify that this doesn't blow up.
    autoPush.reserveCodes();

    // Now turn on auto-schedule and verify that we get a few auto-pushes
    lastPushTimeMillis = 0;
    autoPush.autoSchedule = true;
    await new Promise((resolve, _reject) => { setTimeout(resolve, millisToWaitForAutoPush); }); // let auto-push run
    assert.notEqual(lastPushTimeMillis, 0);
    lastPushTimeMillis = 0;
    await new Promise((resolve, _reject) => { setTimeout(resolve, millisToWaitForAutoPush); }); // let auto-push run
    assert.notEqual(lastPushTimeMillis, 0);
    autoPush.cancel();
    await new Promise((resolve, _reject) => { setTimeout(resolve, millisToWaitForAutoPush); }); // let auto-push run
    assert(autoPush.state === AutoPushState.NotRunning);
    assert.isFalse(autoPush.autoSchedule, "cancel turns off autoSchedule");

    // Test auto-push when isIdle returns false
    isIdle = false;
    lastPushTimeMillis = 0;
    autoPush.autoSchedule = true; // start running AutoPush...
    await new Promise((resolve, _reject) => { setTimeout(resolve, millisToWaitForAutoPush); }); // let auto-push run
    assert.equal(lastPushTimeMillis, 0); // auto-push should not have run, because isIdle==false.
    assert.equal(autoPush.state, AutoPushState.Scheduled); // Instead, it should have re-scheduled
    autoPush.cancel();
    isIdle = true;

    // Test auto-push when Txn.hasLocalChanges returns false
    iModel.Txns.hasLocalChanges = () => false;
    lastPushTimeMillis = 0;
    autoPush.cancel();
    autoPush.autoSchedule = true; // start running AutoPush...
    await new Promise((resolve, _reject) => { setTimeout(resolve, millisToWaitForAutoPush); }); // let auto-push run
    assert.equal(lastPushTimeMillis, 0); // auto-push should not have run, because isIdle==false.
    assert.equal(autoPush.state, AutoPushState.Scheduled); // Instead, it should have re-scheduled
    autoPush.cancel();

    // ... now turn it back on
    iModel.Txns.hasLocalChanges = () => true;
    autoPush.autoSchedule = true; // start running AutoPush...
    await new Promise((resolve, _reject) => { setTimeout(resolve, millisToWaitForAutoPush); }); // let auto-push run
    assert.notEqual(lastPushTimeMillis, 0); // AutoPush should have run

  });
});
