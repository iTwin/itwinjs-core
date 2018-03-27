/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { expect, assert } from "chai";
import { Id64, OpenMode, DbOpcode, BeEvent } from "@bentley/bentleyjs-core";
import { AccessToken, ChangeSet, IModel as HubIModel, MultiCode, CodeState, SeedFile } from "@bentley/imodeljs-clients";
import { Code, IModelVersion, Appearance, ColorDef, IModel, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { KeepBriefcase, IModelDb, Element, DictionaryModel, SpatialCategory, IModelHost, AutoPush, AutoPushState, AutoPushEventHandler, AutoPushEventType } from "../../backend";
import { ConcurrencyControl } from "../../ConcurrencyControl";
import { IModelTestUtils, TestUsers } from "../IModelTestUtils";
import { IModelJsFs } from "../../IModelJsFs";

let lastPushTimeMillis = 0;
let lastAutoPushEventType: AutoPushEventType | undefined;

class Timer {
  private label: string;
  constructor(label: string) {
    // tslint:disable-next-line:no-console
    console.time(this.label = "\t" + label);
  }

  public end() {
    // tslint:disable-next-line:no-console
    console.timeEnd(this.label);
  }
}

async function createNewModelAndCategory(rwIModel: IModelDb, accessToken: AccessToken) {
  // Create a new physical model.
  let modelId: Id64;
  [, modelId] = IModelTestUtils.createAndInsertPhysicalModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);

  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.getDictionaryId()) as DictionaryModel;
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const spatialCategoryId: Id64 = IModelTestUtils.createAndInsertSpatialCategory(dictionary, newCategoryCode.value!, new Appearance({ color: new ColorDef("rgb(255,0,0)") }));

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
  let accessToken: AccessToken;
  let testProjectId: string;
  let testIModelId: string;
  let testChangeSets: ChangeSet[];
  const testVersionNames = ["FirstVersion", "SecondVersion", "ThirdVersion"];
  const testElementCounts = [80, 81, 82];

  let iModelLocalReadonlyPath: string;
  let iModelLocalReadWritePath: string;

  const getElementCount = (iModel: IModelDb): number => {
    const rows: any[] = iModel.executeQuery("SELECT COUNT(*) AS cnt FROM bis.Element");
    const count = +(rows[0].cnt);
    return count;
  };

  const dumpTestCase = async (projectName: string, iModelName: string) => {
    const projectId: string = await IModelTestUtils.getTestProjectId(accessToken, projectName);
    const iModelId: string = await IModelTestUtils.getTestIModelId(accessToken, projectId, iModelName);

    const rootPath = "d:\\temp\\imjsTestFiles\\";
    if (!IModelJsFs.existsSync(rootPath))
      IModelJsFs.mkdirSync(rootPath);

    const imodelPath = path.join(rootPath, iModelName, "\\");
    if (!IModelJsFs.existsSync(imodelPath))
      IModelJsFs.mkdirSync(imodelPath);

    // Get seed file information including the download link
    const seedFile: SeedFile[] = await IModelTestUtils.hubClient.getSeedFiles(accessToken, iModelId, true);
    const downloadUrl = seedFile[0].downloadUrl!;

    // Download seed
    const downloadToPathname = path.join(imodelPath, `${iModelName}.bim`);
    await IModelTestUtils.hubClient.downloadFile(downloadUrl, downloadToPathname);

    // Get all change set information including the download link
    const changeSets: ChangeSet[] = await IModelTestUtils.hubClient.getChangeSets(accessToken, iModelId, true /*=includeDownloadLink*/);

    // Download change sets
    await IModelTestUtils.hubClient.downloadChangeSets(changeSets, imodelPath);
  };

  before(async () => {
    let startTime = new Date().getTime();
    console.log("    Started monitoring briefcase manager performance..."); // tslint:disable-line:no-console

    accessToken = await IModelTestUtils.getTestUserAccessToken();
    console.log(`    ...getting user access token from IMS: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console
    startTime = new Date().getTime();

    testProjectId = await IModelTestUtils.getTestProjectId(accessToken, "iModelJsTest");
    testIModelId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, "ReadOnlyTest");

    testChangeSets = await IModelTestUtils.hubClient.getChangeSets(accessToken, testIModelId, false);
    expect(testChangeSets.length).greaterThan(2);

    const cacheDir = IModelHost.configuration!.briefcaseCacheDir;
    iModelLocalReadonlyPath = path.join(cacheDir, testIModelId, "readOnly");
    iModelLocalReadWritePath = path.join(cacheDir, testIModelId, "readWrite");

    // Delete briefcases if the cache has been cleared, *and* we cannot acquire any more briefcases
    if (!IModelJsFs.existsSync(cacheDir)) {
      await IModelTestUtils.deleteBriefcasesIfAcquireLimitReached(accessToken, "iModelJsTest", "ReadOnlyTest");
      await IModelTestUtils.deleteBriefcasesIfAcquireLimitReached(accessToken, "iModelJsTest", "NoVersionsTest");
    }

    console.log(`    ...getting information on Project+IModel+ChangeSets for test case from the Hub: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console
  });

  it("should download seed files and change sets for all test cases", async () => {
    await dumpTestCase("NodeJsTestProject", "TestModel");
    await dumpTestCase("NodeJsTestProject", "NoVersionsTest");
  });

  it("should open multiple versions of iModels", async () => {
    // const iModelNames = ["NoVersionsTest", "ReadOnlyTest"];
    // for (const name of iModelNames) {
    //    const iModelId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, name);

    //    await IModelDb.open(accessToken, testProjectId, iModelId, OpenMode.Readonly, IModelVersion.first());
    //    await IModelDb.open(accessToken, testProjectId, iModelId, OpenMode.Readonly, IModelVersion.latest());

    //    // Get all change set information including the download link
    //    const changeSets: ChangeSet[] = await IModelTestUtils.hubClient.getChangeSets(accessToken, iModelId, true /*=includeDownloadLink*/);

    //   // Download change sets
    //    await IModelTestUtils.hubClient.downloadChangeSets(changeSets, "C:/Users/Charles.Goepfert/AppData/Local/Temp/Bentley/IModelJs/cache/iModels/c3e1146f-8c81-430d-a974-ac840657b7ac/readWrite/176/csets");
    // }

    const iModel = await IModelDb.open(accessToken, testProjectId, "000-00000-00000-0-000", OpenMode.ReadWrite, IModelVersion.first());

    // const iD = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, iModelNames[1]);
    // const iModel = await IModelDb.open(accessToken, testProjectId, iD, OpenMode.ReadWrite, IModelVersion.first());

    // // Get all change set information including the download link
    // const changeSets: ChangeSet[] = await IModelTestUtils.hubClient.getChangeSets(accessToken, iD, true /*=includeDownloadLink*/);

    // // Download change sets
    // await IModelTestUtils.hubClient.downloadChangeSets(changeSets, "C:/Users/Charles.Goepfert/AppData/Local/Temp/Bentley/IModelJs/cache/iModels/c3e1146f-8c81-430d-a974-ac840657b7ac/readWrite/176/csets");

    iModel.close(accessToken, KeepBriefcase.No);
  });

  it("The same promise can have two subscribers, and it will notify both.", async () => {
    const testPromise = new Promise((resolve, _reject) => {
      setTimeout(() => resolve("Success!"), 250);
    });

    let callbackcount = 0;
    testPromise.then(() => {
      ++callbackcount;
    });
    testPromise.then(() => {
      ++callbackcount;
    });

    await testPromise;

    assert.equal(callbackcount, 2);
  });

  it.skip("test change-merging scenarios in optimistic concurrency mode", async () => {
    const firstUser = accessToken;
    const secondUser = await IModelTestUtils.getTestUserAccessToken(TestUsers.superManager);
    const neutralObserverUser = await IModelTestUtils.getTestUserAccessToken(TestUsers.user2);

    const firstIModel: IModelDb = await IModelDb.open(firstUser, testProjectId, testIModelId, OpenMode.ReadWrite);
    const secondIModel: IModelDb = await IModelDb.open(secondUser, testProjectId, testIModelId, OpenMode.ReadWrite);
    const neutralObserverIModel: IModelDb = await IModelDb.open(neutralObserverUser, testProjectId, testIModelId, OpenMode.Readonly);
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
      el1cc.userLabel = el1cc.userLabel + " - changed by firstUser";
      firstIModel.elements.updateElement(el1cc);
      firstIModel.saveChanges("firstUser modified el1.userLabel");
      await firstIModel.pushChanges(firstUser);
    }

    // secondUser: modify el1.userLabel
    let expectedValueofEl1UserLabel: string;
    if (true) {
      const el1before = (secondIModel.elements.getElement(el1)).copyForEdit<Element>();
      expectedValueofEl1UserLabel = el1before.userLabel + " - changed by secondUser";
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
      expectedValueofEl1UserLabel = el1cc.userLabel + " - changed again by firstUser";
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

    // firstUser: pull and see that both changes
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

    // --- Test 1: Non-overlapping changes ---

  });

  it("should be able to open an IModel from the Hub in Readonly mode", async () => {
    let onOpenCalled: boolean = false;
    const onOpenListener = (accessTokenIn: AccessToken, contextIdIn: string, iModelIdIn: string, openModeIn: OpenMode, _versionIn: IModelVersion) => {
      onOpenCalled = true;
      assert.deepEqual(accessTokenIn, accessToken);
      assert.equal(contextIdIn, testProjectId);
      assert.equal(iModelIdIn, testIModelId);
      assert.equal(openModeIn, OpenMode.Readonly);
    };
    IModelDb.onOpen.addListener(onOpenListener);
    let onOpenedCalled: boolean = false;
    const onOpenedListener = (iModelDb: IModelDb) => {
      onOpenedCalled = true;
      assert.equal(iModelDb.iModelToken.iModelId, testIModelId);
    };
    IModelDb.onOpened.addListener(onOpenedListener);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly);
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.Readonly);

    assert.isTrue(onOpenedCalled);
    assert.isTrue(onOpenCalled);
    IModelDb.onOpen.removeListener(onOpenListener);
    IModelDb.onOpened.removeListener(onOpenedListener);

    expect(IModelJsFs.existsSync(iModelLocalReadonlyPath));
    const files = IModelJsFs.readdirSync(iModelLocalReadonlyPath);
    expect(files.length).greaterThan(0);

    iModel.close(accessToken);
  });

  it("should be able to open an IModel from the Hub in ReadWrite mode", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite, IModelVersion.latest()); // Note: No frontend support for ReadWrite open yet
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.ReadWrite);

    expect(IModelJsFs.existsSync(iModelLocalReadWritePath));
    const files = IModelJsFs.readdirSync(iModelLocalReadWritePath);
    expect(files.length).greaterThan(0);

    iModel.close(accessToken);
  });

  it("should reuse open briefcases in Readonly mode", async () => {
    let timer = new Timer("open briefcase first time");
    const iModel0: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId);
    assert.exists(iModel0);
    timer.end();

    const briefcases = IModelJsFs.readdirSync(iModelLocalReadonlyPath);
    expect(briefcases.length).greaterThan(0);

    timer = new Timer("open briefcase 5 more times");
    const iModels = new Array<IModelDb>();
    for (let ii = 0; ii < 5; ii++) {
      const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId);
      assert.exists(iModel);
      iModels.push(iModel);
    }
    timer.end();

    const briefcases2 = IModelJsFs.readdirSync(iModelLocalReadonlyPath);
    expect(briefcases2.length).equals(briefcases.length);
    const diff = briefcases2.filter((item) => briefcases.indexOf(item) < 0);
    expect(diff.length).equals(0);
  });

  it("should reuse closed briefcases in ReadWrite mode", async () => {
    const files = IModelJsFs.readdirSync(iModelLocalReadWritePath);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite); // Note: No frontend support for ReadWrite open yet
    assert.exists(iModel);

    const files2 = IModelJsFs.readdirSync(iModelLocalReadWritePath);
    expect(files2.length).equals(files.length);
    const diff = files2.filter((item) => files.indexOf(item) < 0);
    expect(diff.length).equals(0);

    iModel.close(accessToken);
  });

  it("should open briefcases of specific versions in Readonly mode", async () => {
    const iModelFirstVersion: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.first());
    assert.exists(iModelFirstVersion);

    for (const [arrayIndex, versionName] of testVersionNames.entries()) {
      const iModelFromVersion: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.asOfChangeSet(testChangeSets[arrayIndex].wsgId));
      assert.exists(iModelFromVersion);

      const iModelFromChangeSet: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.named(versionName));
      assert.exists(iModelFromChangeSet);

      const elementCount = getElementCount(iModelFromVersion);
      assert.equal(elementCount, testElementCounts[arrayIndex]);
    }

    const iModelLatestVersion: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(iModelLatestVersion);
  });

  it.only("should open a briefcase of an iModel with no versions", async () => {
    const iModelNoVerId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, "NoVersionsTest");
    const iModelNoVer: IModelDb = await IModelDb.open(accessToken, testProjectId, iModelNoVerId, OpenMode.Readonly);
    assert.exists(iModelNoVer);
  });

  it.skip("should open briefcase of an iModel in both DEV and QA", async () => {
    // Note: This test is commented out since it causes the entire cache to be discarded and is therefore expensive.
    IModelTestUtils.setIModelHubDeployConfig("DEV");
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Turn off SSL validation in DEV
    const devProjectId = await IModelTestUtils.getTestProjectId(accessToken, "iModelJsTest");
    assert(devProjectId);
    const devIModelId = await IModelTestUtils.getTestIModelId(accessToken, devProjectId, "ReadOnlyTest");
    assert(devIModelId);
    const devChangeSets: ChangeSet[] = await IModelTestUtils.hubClient.getChangeSets(accessToken, devIModelId, false);
    expect(devChangeSets.length).equals(0); // needs change sets
    const devIModel: IModelDb = await IModelDb.open(accessToken, devProjectId, devIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(devIModel);

    IModelTestUtils.setIModelHubDeployConfig("QA");
    const qaProjectId = await IModelTestUtils.getTestProjectId(accessToken, "iModelJsTest");
    assert(qaProjectId);
    const qaIModelId = await IModelTestUtils.getTestIModelId(accessToken, qaProjectId, "ReadOnlyTest");
    assert(qaIModelId);
    const qaChangeSets: ChangeSet[] = await IModelTestUtils.hubClient.getChangeSets(accessToken, qaIModelId, false);
    expect(qaChangeSets.length).greaterThan(0);
    const qaIModel: IModelDb = await IModelDb.open(accessToken, qaProjectId, qaIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(qaIModel);
  });

  it("Should track the AccessTokens that are used to open IModels", async () => {
    await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly);
    assert.deepEqual(IModelDb.getAccessToken(testIModelId), accessToken);

    try {
      IModelDb.getAccessToken("--invalidid--");
      assert.fail("Asking for an AccessToken on an iModel that is not open should fail");
    } catch (err) {
      assert.equal((err as IModelError).errorNumber, IModelStatus.NotFound);
    }
  });

  it("should be able to reverse and reinstate changes", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.latest());

    let arrayIndex: number;
    for (arrayIndex = testVersionNames.length - 1; arrayIndex >= 0; arrayIndex--) {
      await iModel.reverseChanges(accessToken, IModelVersion.named(testVersionNames[arrayIndex]));
      assert.equal(testElementCounts[arrayIndex], getElementCount(iModel));
    }

    await iModel.reverseChanges(accessToken, IModelVersion.first());

    for (arrayIndex = 0; arrayIndex < testVersionNames.length; arrayIndex++) {
      await iModel.reinstateChanges(accessToken, IModelVersion.named(testVersionNames[arrayIndex]));
      assert.equal(testElementCounts[arrayIndex], getElementCount(iModel));
    }

    await iModel.reinstateChanges(accessToken, IModelVersion.latest());
  });

  it("should build concurrency control request", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite);

    const el: Element = iModel.elements.getRootSubject();
    el.buildConcurrencyControlRequest(DbOpcode.Update);    // make a list of the locks, etc. that will be needed to update this element
    const reqAsAny: any = ConcurrencyControl.convertRequestToAny(iModel.concurrencyControl.pendingRequest);
    assert.isDefined(reqAsAny);
    assert.isArray(reqAsAny.Locks);
    assert.equal(reqAsAny.Locks.length, 3, " we expect to need a lock on the element (exclusive), its model (shared), and the db itself (shared)");
    assert.isArray(reqAsAny.Codes);
    assert.equal(reqAsAny.Codes.length, 0, " since we didn't add or change the element's code, we don't expect to need a code reservation");

    iModel.close(accessToken);
  });

  it.skip("should write to briefcase with optimistic concurrency", async () => {
    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "ReadWriteTest";
    const iModels: HubIModel[] = await IModelTestUtils.hubClient.getIModels(accessToken, testProjectId, {
      $select: "*",
      $filter: "Name+eq+'" + iModelName + "'",
    });
    for (const iModelTemp of iModels) {
      await IModelTestUtils.hubClient.deleteIModel(accessToken, testProjectId, iModelTemp.wsgId);
    }
    timer.end();

    // Create a new iModel on the Hub (by uploading a seed file)
    timer = new Timer("create iModel");
    const rwIModel: IModelDb = await IModelDb.create(accessToken, testProjectId, "ReadWriteTest", "TestSubject");
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
    const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.getDictionaryId()) as DictionaryModel;
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    const spatialCategoryId: Id64 = IModelTestUtils.createAndInsertSpatialCategory(dictionary, newCategoryCode.value!, new Appearance({ color: new ColorDef("rgb(255,0,0)") }));

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

    // // NEEDS WORK - query just this one code
    // assert.isTrue(category.code.value !== undefined);
    // const codeStates2 = await iModel.concurrencyControl.codes.query(accessToken, category.code.spec, category.code.scope, category.code.value!);
    // assert.equal(codeStates2.length, 1);
    // assert.equal(codeStates2[0].values.length, 1);
    // assert.equal(codeStates2[0].values[0], category.code.value!);

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
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite);
    assert.exists(iModel);

    const dictionary: DictionaryModel = iModel.models.getModel(IModel.getDictionaryId()) as DictionaryModel;

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

  it("should be able to create a standalone IModel", async () => {
    const iModel: IModelDb = IModelTestUtils.createStandaloneIModel("TestStandalone.bim", "TestSubject");
    iModel.closeStandalone();
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
        await new Promise((resolve, _reject) => { setTimeout(resolve, fakePushTimeRequired); }); // sleep, in order to simulate time spent doing push
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
