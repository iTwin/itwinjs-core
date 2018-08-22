import * as TypeMoq from "typemoq";
import { expect, assert } from "chai";
import { IModelJsFs } from "../../IModelJsFs";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelVersion, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { IModelTestUtils } from "../IModelTestUtils";
import { KeepBriefcase, IModelDb, OpenParams, AccessMode, Element, IModelHost, IModelHostConfiguration, BriefcaseManager, BriefcaseEntry } from "../../backend";
import { TestIModelInfo, MockAssetUtil, MockAccessToken } from "../MockAssetUtil";
import { HubUtility } from "./HubUtility";
import { TestConfig } from "../TestConfig";
import { AccessToken, ChangeSet, ConnectClient, IModelHubClient } from "@bentley/imodeljs-clients";

describe("BriefcaseManager", () => {
  const index = process.argv.indexOf("--offline");
  const offline: boolean = process.argv[index + 1] === "mock";
  let testProjectId: string;
  const testIModels: TestIModelInfo[] = [
    new TestIModelInfo("ReadOnlyTest"),
    new TestIModelInfo("ReadWriteTest"),
    new TestIModelInfo("NoVersionsTest"),
  ];
  const testVersionNames = ["FirstVersion", "SecondVersion", "ThirdVersion"];
  const testElementCounts = [27, 28, 29];

  const assetDir = "./src/test/assets/_mocks_";
  let cacheDir: string = "";
  let accessToken: AccessToken = new MockAccessToken();
  const iModelHubClientMock = TypeMoq.Mock.ofType(IModelHubClient);
  const connectClientMock = TypeMoq.Mock.ofType(ConnectClient);

  const getElementCount = (iModel: IModelDb): number => {
    const rows: any[] = iModel.executeQuery("SELECT COUNT(*) AS cnt FROM bis.Element");
    const count = +(rows[0].cnt);
    return count;
  };

  const validateBriefcaseCache = () => {
    (BriefcaseManager as any)._cache._briefcases.forEach((briefcase: BriefcaseEntry, key: string) => {
      assert.isTrue(IModelJsFs.existsSync(briefcase.pathname), `File corresponding to briefcase cache entry not found: ${briefcase.pathname}`);
      assert.strictEqual<string>(briefcase.getKey(), key, `Cached key ${key} doesn't match the current generated key ${briefcase.getKey()}`);
      if (briefcase.isOpen) {
        assert.strictEqual<string>(briefcase.nativeDb.getParentChangeSetId(), briefcase.changeSetId, `Parent change set id of Db doesn't match what's cached in memory`);
        if (briefcase.openParams!.accessMode === AccessMode.Shared) {
          assert.isTrue(!briefcase.reversedChangeSetId, "Found a shared briefcase that was reversed!");
          assert.isTrue(!briefcase.nativeDb.getReversedChangeSetId(), "Found a shared briefcase that was reversed!");
        }
      }
    });
  };

  before(async () => {
    if (offline) {
      MockAssetUtil.setupMockAssets(assetDir);
      testProjectId = await MockAssetUtil.setupOfflineFixture(accessToken, iModelHubClientMock, connectClientMock, assetDir, cacheDir, testIModels);
    } else {
      [accessToken, testProjectId, cacheDir] = await IModelTestUtils.setupIntegratedFixture(testIModels);

      // Clearing the briefcases for frontend tests here since the frontend is not setup with the CORS proxy.
      await HubUtility.purgeAcquiredBriefcases(accessToken, "iModelJsTest", "ConnectionReadTest");
    }

  });

  after(() => {
    if (offline)
      MockAssetUtil.tearDownOfflineFixture();
  });

  afterEach(() => {
    validateBriefcaseCache();
  });

  it("should create a valid in memory cache", async () => {
    await (BriefcaseManager as any).initCache(accessToken);
    validateBriefcaseCache();
  });

  it.skip("should open and close an iModel from the Hub", async () => {
    let onOpenCalled: boolean = false;
    const onOpenListener = (accessTokenIn: AccessToken, contextIdIn: string, iModelIdIn: string, openParams: OpenParams, _version: IModelVersion) => {
      onOpenCalled = true;
      assert.deepEqual(accessTokenIn, accessToken);
      assert.equal(contextIdIn, testProjectId);
      assert.equal(iModelIdIn, testIModels[0].id);
      assert.equal(openParams.openMode, OpenMode.Readonly);
    };
    IModelDb.onOpen.addListener(onOpenListener);

    let onOpenedCalled: boolean = false;
    const onOpenedListener = (iModelDb: IModelDb) => {
      onOpenedCalled = true;
      assert.equal(iModelDb.iModelToken.iModelId, testIModels[0].id);
    };
    IModelDb.onOpened.addListener(onOpenedListener);

    let onBeforeCloseCalled: boolean = false;
    const onBeforeCloseListener = () => {
      onBeforeCloseCalled = true;
    };

    try {
      const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(), IModelVersion.latest());
      assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");

      iModel.onBeforeClose.addListener(onBeforeCloseListener);

      // Validate that the IModelDb is readonly
      assert(iModel.openParams.openMode === OpenMode.Readonly, "iModel not set to Readonly mode");

      const expectedChangeSetId = await IModelVersion.latest().evaluateChangeSet(accessToken, testIModels[0].id, BriefcaseManager.imodelClient);
      assert.strictEqual<string>(iModel.briefcase.changeSetId, expectedChangeSetId);
      assert.strictEqual<string>(iModel.iModelToken.changeSetId!, expectedChangeSetId);

      assert.isTrue(onOpenedCalled);
      assert.isTrue(onOpenCalled);

      const pathname = iModel.briefcase.pathname;
      assert.isTrue(IModelJsFs.existsSync(pathname));
      await iModel.close(accessToken, KeepBriefcase.No);
      assert.equal(iModel.briefcase, undefined);
      assert.isFalse(IModelJsFs.existsSync(pathname));
      assert.isTrue(onBeforeCloseCalled);
    } finally {

      IModelDb.onOpen.removeListener(onOpenListener);
      IModelDb.onOpened.removeListener(onOpenedListener);
    }
  });

  it.skip("should reuse briefcases", async () => {
    const iModel1: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(AccessMode.Shared), IModelVersion.named("FirstVersion"));
    assert.exists(iModel1, "No iModel returned from call to BriefcaseManager.open");

    const iModel2: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(AccessMode.Shared), IModelVersion.named("FirstVersion"));
    assert.exists(iModel2, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel1, iModel2, "previously open briefcase was expected to be shared");

    const iModel3: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(AccessMode.Shared), IModelVersion.named("SecondVersion"));
    assert.exists(iModel3, "No iModel returned from call to BriefcaseManager.open");
    assert.notEqual(iModel3, iModel2, "opening two different versions should not cause briefcases to be shared when the older one is open");
    assert.notEqual(iModel3.briefcase, iModel2.briefcase, "opening two different versions should not cause briefcases to be shared when the older one is open");

    const briefcase2 = iModel2.briefcase;
    const pathname2 = briefcase2.pathname;
    await iModel2.close(accessToken);
    assert.equal(iModel2.briefcase, undefined);
    assert.isTrue(IModelJsFs.existsSync(pathname2));

    const briefcase3 = iModel3.briefcase;
    const pathname3 = briefcase3.pathname;
    await iModel3.close(accessToken);
    assert.equal(iModel3.briefcase, undefined);
    assert.isTrue(IModelJsFs.existsSync(pathname3));

    const iModel4: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(AccessMode.Shared), IModelVersion.named("FirstVersion"));
    assert.exists(iModel4, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel4.briefcase, briefcase2, "previously closed briefcase was expected to be shared");

    const iModel5: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(AccessMode.Shared), IModelVersion.named("SecondVersion"));
    assert.exists(iModel5, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel5.briefcase, briefcase3, "previously closed briefcase was expected to be shared");

    await iModel4.close(accessToken, KeepBriefcase.No);
    assert.isFalse(IModelJsFs.existsSync(pathname2));

    await iModel5.close(accessToken, KeepBriefcase.No);
    assert.isFalse(IModelJsFs.existsSync(pathname3));
  });

  it.skip("should open iModels of specific versions from the Hub", async () => {
    const iModelFirstVersion: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(), IModelVersion.first());
    assert.exists(iModelFirstVersion);
    assert.strictEqual<string>(iModelFirstVersion.briefcase.changeSetId, "");
    assert.equal(+iModelFirstVersion.briefcase.nativeDb.getParentChangeSetId(), 0);
    assert.isNotTrue(!!iModelFirstVersion.briefcase.reversedChangeSetId);
    assert.isNotTrue(!!iModelFirstVersion.briefcase.nativeDb.getReversedChangeSetId());

    for (const [arrayIndex, versionName] of testVersionNames.entries()) {
      const iModelFromVersion = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(), IModelVersion.asOfChangeSet(testIModels[0].changeSets[arrayIndex].wsgId));
      assert.exists(iModelFromVersion);

      assert.strictEqual<string>(iModelFromVersion.briefcase.changeSetId, testIModels[0].changeSets[arrayIndex].wsgId);
      assert.strictEqual<string>(iModelFromVersion.briefcase.nativeDb.getParentChangeSetId(), testIModels[0].changeSets[arrayIndex].wsgId);
      assert.isNotTrue(!!iModelFromVersion.briefcase.reversedChangeSetId);
      assert.isNotTrue(!!iModelFromVersion.briefcase.nativeDb.getReversedChangeSetId());

      const iModelFromChangeSet = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(), IModelVersion.named(versionName));
      assert.exists(iModelFromChangeSet);

      assert.strictEqual(iModelFromChangeSet, iModelFromVersion);
      assert.strictEqual<string>(iModelFromChangeSet.briefcase.changeSetId, testIModels[0].changeSets[arrayIndex].wsgId);
      assert.strictEqual<string>(iModelFromChangeSet.briefcase.nativeDb.getParentChangeSetId(), testIModels[0].changeSets[arrayIndex].wsgId);
      assert.isNotTrue(!!iModelFromChangeSet.briefcase.reversedChangeSetId);
      assert.isNotTrue(!!iModelFromChangeSet.briefcase.nativeDb.getReversedChangeSetId());

      const elementCount = getElementCount(iModelFromVersion);
      assert.equal(elementCount, testElementCounts[arrayIndex], `Count isn't what's expected for ${iModelFromVersion.briefcase.pathname}, version ${versionName}`);

      await iModelFromVersion.close(accessToken, KeepBriefcase.Yes);
    }

    const iModelLatestVersion: IModelDb = await IModelDb.open(accessToken as any, testProjectId, testIModels[0].id, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.exists(iModelLatestVersion);
    assert.strictEqual<string>(iModelLatestVersion.briefcase.changeSetId, testIModels[0].changeSets[2].wsgId);
    assert.strictEqual<string>(iModelLatestVersion.briefcase.nativeDb.getParentChangeSetId(), testIModels[0].changeSets[2].wsgId);
    assert.isNotTrue(!!iModelLatestVersion.briefcase.reversedChangeSetId);

    await iModelFirstVersion.close(accessToken, KeepBriefcase.No);
    await iModelLatestVersion.close(accessToken, KeepBriefcase.No);
  });

  it("should open an iModel with no versions", async () => {
    const iModelNoVer: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[2].id, OpenParams.fixedVersion());
    assert.exists(iModelNoVer);
    assert(iModelNoVer.iModelToken.iModelId && iModelNoVer.iModelToken.iModelId === testIModels[2].id, "Correct iModel not found");
  });

  it.skip("should be able to pull or reverse changes only if allowed", async () => {
    const secondChangeSetId = testIModels[0].changeSets[1].wsgId;

    const iModelFixed: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(AccessMode.Shared), IModelVersion.asOfChangeSet(secondChangeSetId));
    assert.exists(iModelFixed);
    assert.strictEqual<string>(iModelFixed.briefcase.changeSetId, secondChangeSetId);

    const iModelPullOnly: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.pullOnly(AccessMode.Shared), IModelVersion.asOfChangeSet(secondChangeSetId));
    assert.exists(iModelPullOnly);
    assert.strictEqual<string>(iModelPullOnly.briefcase.changeSetId, secondChangeSetId);

    assert.notStrictEqual<string>(iModelPullOnly.briefcase.pathname, iModelFixed.briefcase.pathname, "pull only and fixed versions should not share the same briefcase");

    const thirdChangeSetId = testIModels[0].changeSets[2].wsgId;

    await iModelPullOnly.pullAndMergeChanges(accessToken, IModelVersion.asOfChangeSet(thirdChangeSetId));
    assert.strictEqual<string>(iModelPullOnly.briefcase.changeSetId, thirdChangeSetId);

    let exceptionThrown = false;
    try {
      await iModelFixed.pullAndMergeChanges(accessToken, IModelVersion.asOfChangeSet(thirdChangeSetId));
    } catch (error) {
      exceptionThrown = true;
    }
    assert.isTrue(exceptionThrown);
    assert.strictEqual<string>(iModelFixed.briefcase.changeSetId, secondChangeSetId);

    try {
      const firstChangeSetId = testIModels[0].changeSets[1].wsgId;
      await iModelFixed.reverseChanges(accessToken, IModelVersion.asOfChangeSet(firstChangeSetId));
    } catch (error) {
      exceptionThrown = true;
    }
    assert.isTrue(exceptionThrown);

    await iModelPullOnly.close(accessToken, KeepBriefcase.No);
    await iModelFixed.close(accessToken, KeepBriefcase.No);
  });

  it("should be able to edit and push only if it's allowed (#integration)", async () => {
    const iModelFixed: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[1].id, OpenParams.fixedVersion(AccessMode.Shared), IModelVersion.latest());
    assert.exists(iModelFixed);

    let rootEl: Element = iModelFixed.elements.getRootSubject();
    rootEl.userLabel = rootEl.userLabel + "changed";
    assert.throws(() => iModelFixed.elements.updateElement(rootEl));

    const iModelPullOnly: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[1].id, OpenParams.pullOnly(AccessMode.Shared), IModelVersion.latest());
    assert.exists(iModelPullOnly);

    rootEl = iModelPullOnly.elements.getRootSubject();
    rootEl.userLabel = rootEl.userLabel + "changed";
    iModelPullOnly.elements.updateElement(rootEl);
    iModelPullOnly.saveChanges();

    let exceptionThrown = false;
    try {
      await iModelPullOnly.pushChanges(accessToken);
    } catch (error) {
      exceptionThrown = true;
    }
    assert.isTrue(exceptionThrown);

    const iModelPullAndPush: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[1].id, OpenParams.pullAndPush(), IModelVersion.latest());
    assert.exists(iModelPullAndPush);

    rootEl = iModelPullAndPush.elements.getRootSubject();
    rootEl.userLabel = rootEl.userLabel + "changed";
    iModelPullAndPush.elements.updateElement(rootEl);

    iModelPullAndPush.saveChanges(); // Push is tested out in a separate test

    await iModelFixed.close(accessToken, KeepBriefcase.No);
    await iModelPullOnly.close(accessToken, KeepBriefcase.No);
    await iModelPullAndPush.close(accessToken, KeepBriefcase.No);
  });

  it("should be able to allow exclusive access to iModels (#integration)", async () => {
    const iModelShared: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[1].id, OpenParams.fixedVersion(AccessMode.Shared), IModelVersion.latest());
    assert.exists(iModelShared);

    const iModelFixed: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[1].id, OpenParams.fixedVersion(AccessMode.Exclusive), IModelVersion.latest());
    assert.exists(iModelFixed);
    assert.notStrictEqual(iModelFixed.briefcase.pathname, iModelShared.briefcase.pathname);

    const iModelFixed2: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[1].id, OpenParams.fixedVersion(AccessMode.Exclusive), IModelVersion.latest());
    assert.exists(iModelFixed);
    assert.notStrictEqual(iModelFixed.briefcase.pathname, iModelFixed2.briefcase.pathname);

    const iModelPullOnly: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[1].id, OpenParams.pullOnly(AccessMode.Exclusive), IModelVersion.latest());
    assert.exists(iModelPullOnly);
    assert.notStrictEqual(iModelPullOnly.briefcase.pathname, iModelShared.briefcase.pathname);
    assert.notStrictEqual(iModelPullOnly.briefcase.pathname, iModelFixed.briefcase.pathname);

    const iModelPullOnly2: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[1].id, OpenParams.pullOnly(AccessMode.Exclusive), IModelVersion.latest());
    assert.exists(iModelPullOnly2);
    assert.notStrictEqual(iModelPullOnly2.briefcase.pathname, iModelPullOnly.briefcase.pathname);

    const iModelPullAndPush: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[1].id, OpenParams.pullAndPush(), IModelVersion.latest());
    assert.exists(iModelPullAndPush);
    assert.notStrictEqual(iModelPullAndPush.briefcase.pathname, iModelShared.briefcase.pathname);
    assert.notStrictEqual(iModelPullAndPush.briefcase.pathname, iModelFixed.briefcase.pathname);
    assert.notStrictEqual(iModelPullAndPush.briefcase.pathname, iModelPullOnly.briefcase.pathname);

    await iModelShared.close(accessToken, KeepBriefcase.No);
    await iModelFixed.close(accessToken, KeepBriefcase.No);
    await iModelPullOnly.close(accessToken, KeepBriefcase.No);
    await iModelPullAndPush.close(accessToken, KeepBriefcase.No);
  });

  it("should be able to reuse existing briefcases from a previous session (#integration)", async () => {
    let iModelShared: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(AccessMode.Shared), IModelVersion.latest());
    assert.exists(iModelShared);
    const sharedPathname = iModelShared.briefcase.pathname;

    let iModelExclusive: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.pullAndPush(), IModelVersion.latest());
    assert.exists(iModelExclusive);
    const exclusivePathname = iModelExclusive.briefcase.pathname;

    await iModelShared.close(accessToken, KeepBriefcase.Yes);
    await iModelExclusive.close(accessToken, KeepBriefcase.Yes);

    IModelHost.shutdown();

    assert.isTrue(IModelJsFs.existsSync(sharedPathname));
    assert.isTrue(IModelJsFs.existsSync(exclusivePathname));

    IModelHost.startup();

    iModelShared = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(AccessMode.Shared), IModelVersion.latest());
    assert.exists(iModelShared);
    assert.strictEqual<string>(iModelShared.briefcase.pathname, sharedPathname);

    iModelExclusive = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.pullAndPush(), IModelVersion.latest());
    assert.exists(iModelExclusive);
    assert.strictEqual<string>(iModelExclusive.briefcase.pathname, exclusivePathname);

    await iModelShared.close(accessToken, KeepBriefcase.No);
    await iModelExclusive.close(accessToken, KeepBriefcase.No);
  });

  it.skip("should open briefcase of an iModel in both DEV and QA (#integration)", async () => {
    // Note: This test is commented out since it causes the entire cache to be discarded and is therefore expensive.
    const config = new IModelHostConfiguration();

    IModelHost.shutdown();
    config.hubDeploymentEnv = "DEV";
    IModelHost.startup(config);

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Turn off SSL validation in DEV
    const devProjectId = await HubUtility.queryProjectIdByName(accessToken, TestConfig.projectName);
    assert(devProjectId);
    const devIModelId = await HubUtility.queryIModelIdByName(accessToken, devProjectId, TestConfig.iModelName);
    assert(devIModelId);
    const devChangeSets: ChangeSet[] = await BriefcaseManager.imodelClient.ChangeSets().get(accessToken, devIModelId);
    expect(devChangeSets.length).equals(0); // needs change sets
    const devIModel: IModelDb = await IModelDb.open(accessToken, devProjectId, devIModelId, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.exists(devIModel);

    IModelHost.shutdown();
    config.hubDeploymentEnv = "QA";
    IModelHost.startup(config);

    const qaProjectId = await HubUtility.queryProjectIdByName(accessToken, TestConfig.projectName);
    assert(qaProjectId);
    const qaIModelId = await HubUtility.queryIModelIdByName(accessToken, qaProjectId, TestConfig.iModelName);
    assert(qaIModelId);
    const qaChangeSets: ChangeSet[] = await BriefcaseManager.imodelClient.ChangeSets().get(accessToken, qaIModelId);
    expect(qaChangeSets.length).greaterThan(0);
    const qaIModel: IModelDb = await IModelDb.open(accessToken, qaProjectId, qaIModelId, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.exists(qaIModel);
  });

  it("Should track the AccessTokens that are used to open IModels (#integration)", async () => {
    await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.fixedVersion(AccessMode.Exclusive));
    assert.deepEqual(IModelDb.getAccessToken(testIModels[0].id), accessToken);

    try {
      IModelDb.getAccessToken("--invalidid--");
      assert.fail("Asking for an AccessToken on an iModel that is not open should fail");
    } catch (err) {
      assert.equal((err as IModelError).errorNumber, IModelStatus.NotFound);
    }
  });

  it("should be able to reverse and reinstate changes (#integration)", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenParams.pullOnly(), IModelVersion.latest());

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
});
