/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { OpenMode, GuidString, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelVersion } from "@bentley/imodeljs-common";
import { BriefcaseQuery, Briefcase as HubBriefcase, AuthorizedClientRequestContext, HubIModel } from "@bentley/imodeljs-clients";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { IModelTestUtils, TestIModelInfo } from "../IModelTestUtils";
import {
  KeepBriefcase, IModelDb, OpenParams, Element, IModelJsFs,
  IModelHost, IModelHostConfiguration, BriefcaseManager, BriefcaseEntry, AuthorizedBackendRequestContext, BackendLoggerCategory, BriefcaseIModelDb,
} from "../../imodeljs-backend";
import { HubUtility } from "./HubUtility";
import { TestChangeSetUtility } from "./TestChangeSetUtility";

async function createIModelOnHub(requestContext: AuthorizedBackendRequestContext, projectId: GuidString, iModelName: string): Promise<string> {
  let iModel: HubIModel | undefined = await HubUtility.queryIModelByName(requestContext, projectId, iModelName);
  if (!iModel)
    iModel = await BriefcaseManager.imodelClient.iModels.create(requestContext, projectId, iModelName, { description: `Description for iModel` });
  assert.isDefined(iModel.wsgId);
  return iModel.wsgId;
}

describe("BriefcaseManager (#integration)", () => {
  let testProjectId: string;

  let readOnlyTestIModel: TestIModelInfo;
  const readOnlyTestVersions = ["FirstVersion", "SecondVersion", "ThirdVersion"];
  const readOnlyTestElementCounts = [27, 28, 29];

  let readWriteTestIModel: TestIModelInfo;
  let noVersionsTestIModel: TestIModelInfo;

  let requestContext: AuthorizedBackendRequestContext;
  let managerRequestContext: AuthorizedBackendRequestContext;

  const getElementCount = (iModel: IModelDb): number => {
    const rows: any[] = IModelTestUtils.executeQuery(iModel, "SELECT COUNT(*) AS cnt FROM bis.Element");
    const count = +(rows[0].cnt);
    return count;
  };

  const validateBriefcaseCache = () => {
    const paths = new Array<string>();
    (BriefcaseManager as any)._cache._briefcases.forEach((briefcase: BriefcaseEntry, key: string) => {
      assert.isTrue(IModelJsFs.existsSync(briefcase.pathname), `File corresponding to briefcase cache entry not found: ${briefcase.pathname}`);
      assert.strictEqual<string>(briefcase.getKey(), key, `Cached key ${key} doesn't match the current generated key ${briefcase.getKey()}`);
      if (briefcase.isOpen) {
        assert.strictEqual<string>(briefcase.nativeDb.getParentChangeSetId(), briefcase.parentChangeSetId, `Parent change set id of Db doesn't match what's cached in memory`);
      }
      assert.isFalse(paths.includes(briefcase.pathname), `Briefcase with path: ${briefcase.pathname} (key: ${key}) has a duplicate in the cache`);
      paths.push(briefcase.pathname);
    });
  };

  before(async () => {
    IModelTestUtils.setupLogging();
    // IModelTestUtils.setupDebugLogLevels();

    requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    testProjectId = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");
    readOnlyTestIModel = await IModelTestUtils.getTestModelInfo(requestContext, testProjectId, "ReadOnlyTest");
    noVersionsTestIModel = await IModelTestUtils.getTestModelInfo(requestContext, testProjectId, "NoVersionsTest");
    readWriteTestIModel = await IModelTestUtils.getTestModelInfo(requestContext, testProjectId, "ReadWriteTest");

    // Purge briefcases that are close to reaching the acquire limit
    managerRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, "iModelJsIntegrationTest", "ReadOnlyTest");
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, "iModelJsIntegrationTest", "NoVersionsTest");
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, "iModelJsIntegrationTest", "ReadWriteTest");
  });

  after(() => {
    // IModelTestUtils.resetDebugLogLevels();
  });

  afterEach(() => {
    validateBriefcaseCache();
  });

  it("should open and close an iModel from the Hub", async () => {
    let onOpenCalled: boolean = false;
    const onOpenListener = (requestContextIn: AuthorizedClientRequestContext, contextIdIn: string, iModelIdIn: string, openParams: OpenParams, _version: IModelVersion) => {
      onOpenCalled = true;
      assert.deepEqual(requestContextIn.accessToken, requestContext.accessToken);
      assert.equal(contextIdIn, testProjectId);
      assert.equal(iModelIdIn, readOnlyTestIModel.id);
      assert.equal(openParams.openMode, OpenMode.Readonly);
    };
    IModelDb.onOpen.addListener(onOpenListener);

    let onOpenedCalled: boolean = false;
    const onOpenedListener = (_requestContextIn: AuthorizedClientRequestContext, iModelDb: IModelDb) => {
      onOpenedCalled = true;
      assert.equal(iModelDb.iModelToken.iModelId, readOnlyTestIModel.id);
    };
    IModelDb.onOpened.addListener(onOpenedListener);

    let onBeforeCloseCalled: boolean = false;
    const onBeforeCloseListener = () => {
      onBeforeCloseCalled = true;
    };

    try {
      const iModel = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.first());
      assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");

      iModel.onBeforeClose.addListener(onBeforeCloseListener);

      // Validate that the IModelDb is readonly
      assert(iModel.openParams.openMode === OpenMode.Readonly, "iModel not set to Readonly mode");

      const expectedChangeSetId = await IModelVersion.first().evaluateChangeSet(requestContext, readOnlyTestIModel.id, BriefcaseManager.imodelClient);
      assert.strictEqual<string>(iModel.briefcase.parentChangeSetId, expectedChangeSetId);
      assert.strictEqual<string>(iModel.iModelToken.changeSetId!, expectedChangeSetId);

      assert.isTrue(onOpenedCalled);
      assert.isTrue(onOpenCalled);

      const pathname = iModel.briefcase.pathname;
      assert.isTrue(IModelJsFs.existsSync(pathname));
      await iModel.close(requestContext, KeepBriefcase.No);
      assert.isFalse(IModelJsFs.existsSync(pathname), `Briefcase continues to exist at ${pathname}`);
      assert.isTrue(onBeforeCloseCalled);
    } finally {

      IModelDb.onOpen.removeListener(onOpenListener);
      IModelDb.onOpened.removeListener(onOpenedListener);
    }
  });

  it("should reuse fixed version briefcases", async () => {
    const iModel1 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.named("FirstVersion"));
    assert.exists(iModel1, "No iModel returned from call to BriefcaseManager.open");

    const iModel2 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.named("FirstVersion"));
    assert.exists(iModel2, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel1, iModel2, "previously open briefcase was expected to be shared");

    const iModel3 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.named("SecondVersion"));
    assert.exists(iModel3, "No iModel returned from call to BriefcaseManager.open");
    assert.notEqual(iModel3, iModel2, "opening two different versions should not cause briefcases to be shared when the older one is open");
    assert.notEqual(iModel3.briefcase, iModel2.briefcase, "opening two different versions should not cause briefcases to be shared when the older one is open");

    const briefcase2 = iModel2.briefcase;
    const pathname2 = briefcase2.pathname;
    await iModel2.close(requestContext);
    assert.isTrue(IModelJsFs.existsSync(pathname2));

    const briefcase3 = iModel3.briefcase;
    const pathname3 = briefcase3.pathname;
    await iModel3.close(requestContext);
    assert.isTrue(IModelJsFs.existsSync(pathname3));

    const iModel4 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.named("FirstVersion"));
    assert.exists(iModel4, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel4.briefcase.pathname, briefcase2.pathname, "previously closed briefcase was expected to be shared");

    const iModel5 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.named("SecondVersion"));
    assert.exists(iModel5, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel5.briefcase.pathname, briefcase3.pathname, "previously closed briefcase was expected to be shared");

    await iModel4.close(requestContext, KeepBriefcase.No);
    assert.isFalse(IModelJsFs.existsSync(pathname2));

    await iModel5.close(requestContext, KeepBriefcase.No);
    assert.isFalse(IModelJsFs.existsSync(pathname3));
  });

  it("should reuse open or closed PullAndPush briefcases", async () => {
    const iModel1 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    assert.exists(iModel1, "No iModel returned from call to BriefcaseManager.open");

    const iModel2 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    assert.exists(iModel2, "No iModel returned from call to BriefcaseManager.open");

    assert.equal(iModel1, iModel2);
    const pathname = iModel1.briefcase.pathname;
    await iModel1.close(requestContext, KeepBriefcase.Yes);

    const iModel3 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    assert.exists(iModel3, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel3.briefcase.pathname, pathname, "previously closed briefcase was expected to be shared");

    await iModel3.close(requestContext, KeepBriefcase.No);
  });

  it("should reuse open or closed PullOnly briefcases", async () => {
    const iModel1 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullOnly(), IModelVersion.latest());
    assert.exists(iModel1, "No iModel returned from call to BriefcaseManager.open");

    const iModel2 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullOnly(), IModelVersion.latest());
    assert.exists(iModel2, "No iModel returned from call to BriefcaseManager.open");

    assert.equal(iModel1, iModel2);
    const pathname = iModel1.briefcase.pathname;
    await iModel1.close(requestContext, KeepBriefcase.Yes);

    const iModel3 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullOnly(), IModelVersion.latest());
    assert.exists(iModel3, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel3.briefcase.pathname, pathname, "previously closed briefcase was expected to be shared");

    await iModel3.close(requestContext, KeepBriefcase.No);
  });

  it("should open iModels of specific versions from the Hub", async () => {
    const iModelFirstVersion = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.first());
    assert.exists(iModelFirstVersion);
    assert.strictEqual<string>(iModelFirstVersion.briefcase.currentChangeSetId, "");

    for (const [arrayIndex, versionName] of readOnlyTestVersions.entries()) {
      const iModelFromVersion = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.asOfChangeSet(readOnlyTestIModel.changeSets[arrayIndex + 1].wsgId));
      assert.exists(iModelFromVersion);
      assert.strictEqual<string>(iModelFromVersion.briefcase.currentChangeSetId, readOnlyTestIModel.changeSets[arrayIndex + 1].wsgId);

      const iModelFromChangeSet = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.named(versionName));
      assert.exists(iModelFromChangeSet);
      assert.strictEqual(iModelFromChangeSet, iModelFromVersion);
      assert.strictEqual<string>(iModelFromChangeSet.briefcase.currentChangeSetId, readOnlyTestIModel.changeSets[arrayIndex + 1].wsgId);

      const elementCount = getElementCount(iModelFromVersion);
      assert.equal(elementCount, readOnlyTestElementCounts[arrayIndex], `Count isn't what's expected for ${iModelFromVersion.briefcase.pathname}, version ${versionName}`);

      await iModelFromVersion.close(requestContext, KeepBriefcase.Yes);
    }

    const iModelLatestVersion = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.exists(iModelLatestVersion);
    assert.isUndefined(iModelLatestVersion.briefcase.reversedChangeSetId);
    assert.strictEqual<string>(iModelLatestVersion.briefcase.parentChangeSetId, readOnlyTestIModel.changeSets[3].wsgId);
    assert.strictEqual<string>(iModelLatestVersion.briefcase.nativeDb.getParentChangeSetId(), readOnlyTestIModel.changeSets[3].wsgId);
    assert.isNotTrue(!!iModelLatestVersion.briefcase.reversedChangeSetId);

    await iModelFirstVersion.close(requestContext, KeepBriefcase.No);
    await iModelLatestVersion.close(requestContext, KeepBriefcase.No);
  });

  it("should open an iModel with no versions", async () => {
    const iModelNoVer = await BriefcaseIModelDb.open(requestContext, testProjectId, noVersionsTestIModel.id, OpenParams.fixedVersion());
    assert.exists(iModelNoVer);
    assert(iModelNoVer.iModelToken.iModelId && iModelNoVer.iModelToken.iModelId === noVersionsTestIModel.id, "Correct iModel not found");
  });

  it("should be able to pull or reverse changes only if allowed", async () => {
    const secondChangeSetId = readOnlyTestIModel.changeSets[1].wsgId;

    const iModelFixed = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.asOfChangeSet(secondChangeSetId));
    assert.exists(iModelFixed);
    assert.strictEqual<string>(iModelFixed.briefcase.currentChangeSetId, secondChangeSetId);

    const thirdChangeSetId = readOnlyTestIModel.changeSets[2].wsgId;

    const prevLogLevel: LogLevel | undefined = Logger.getLevel(BackendLoggerCategory.IModelDb);
    Logger.setLevel(BackendLoggerCategory.IModelDb, LogLevel.None);
    let exceptionThrown = false;
    try {
      await iModelFixed.pullAndMergeChanges(requestContext, IModelVersion.asOfChangeSet(thirdChangeSetId));
    } catch (error) {
      exceptionThrown = true;
    }
    assert.isTrue(exceptionThrown);
    assert.strictEqual<string>(iModelFixed.briefcase.currentChangeSetId, secondChangeSetId);

    try {
      const firstChangeSetId = readOnlyTestIModel.changeSets[0].wsgId;
      await iModelFixed.reverseChanges(requestContext, IModelVersion.asOfChangeSet(firstChangeSetId));
    } catch (error) {
      exceptionThrown = true;
    }
    assert.isTrue(exceptionThrown);
    Logger.setLevel(BackendLoggerCategory.IModelDb, prevLogLevel || LogLevel.None);

    await iModelFixed.close(requestContext, KeepBriefcase.No);
  });

  it("should be able to edit only if it's allowed", async () => {
    const iModelFixed = await BriefcaseIModelDb.open(requestContext, testProjectId, readWriteTestIModel.id, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.exists(iModelFixed);

    let rootEl: Element = iModelFixed.elements.getRootSubject();
    rootEl.userLabel = rootEl.userLabel + "changed";
    assert.throws(() => iModelFixed.elements.updateElement(rootEl));

    const iModelPullAndPush = await BriefcaseIModelDb.open(requestContext, testProjectId, readWriteTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    assert.exists(iModelPullAndPush);

    rootEl = iModelPullAndPush.elements.getRootSubject();
    rootEl.userLabel = rootEl.userLabel + "changed";
    await iModelPullAndPush.concurrencyControl.requestResourcesForUpdate(requestContext, [rootEl]);
    iModelPullAndPush.elements.updateElement(rootEl);

    await iModelPullAndPush.concurrencyControl.request(requestContext);
    iModelPullAndPush.saveChanges(); // Push is tested out in a separate test

    await iModelFixed.close(requestContext, KeepBriefcase.No);
    await iModelPullAndPush.close(requestContext, KeepBriefcase.No);
  });

  it("should be able to reuse existing briefcases from a previous session", async () => {
    let iModelShared = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.exists(iModelShared);
    assert.strictEqual(iModelShared.openParams.openMode, OpenMode.Readonly);
    const sharedPathname = iModelShared.briefcase.pathname;

    let iModelPullAndPush = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    assert.exists(iModelPullAndPush);
    assert.strictEqual(iModelPullAndPush.openParams.openMode, OpenMode.ReadWrite);
    const pullAndPushPathname = iModelPullAndPush.briefcase.pathname;

    let iModelPullOnly = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullOnly(), IModelVersion.latest());
    assert.exists(iModelPullOnly);
    assert.strictEqual(iModelPullOnly.openParams.openMode, OpenMode.ReadWrite); // Note: PullOnly briefcases must be set to ReadWrite to accept change sets
    const pullOnlyPathname = iModelPullOnly.briefcase.pathname;

    await iModelShared.close(requestContext, KeepBriefcase.Yes);
    await iModelPullAndPush.close(requestContext, KeepBriefcase.Yes);
    await iModelPullOnly.close(requestContext, KeepBriefcase.Yes);

    IModelHost.shutdown();

    assert.isTrue(IModelJsFs.existsSync(sharedPathname));
    assert.isTrue(IModelJsFs.existsSync(pullAndPushPathname));
    assert.isTrue(IModelJsFs.existsSync(pullOnlyPathname));

    IModelHost.startup();

    iModelShared = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.exists(iModelShared);
    assert.strictEqual<string>(iModelShared.briefcase.pathname, sharedPathname);

    iModelPullAndPush = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    assert.exists(iModelPullAndPush);
    assert.strictEqual<string>(iModelPullAndPush.briefcase.pathname, pullAndPushPathname);

    iModelPullOnly = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullOnly(), IModelVersion.latest());
    assert.exists(iModelPullOnly);
    assert.strictEqual<string>(iModelPullOnly.briefcase.pathname, pullOnlyPathname);

    await iModelShared.close(requestContext, KeepBriefcase.No);
    await iModelPullAndPush.close(requestContext, KeepBriefcase.No);
    await iModelPullOnly.close(requestContext, KeepBriefcase.No);

    assert.isFalse(IModelJsFs.existsSync(sharedPathname));
    assert.isFalse(IModelJsFs.existsSync(pullAndPushPathname));
    assert.isFalse(IModelJsFs.existsSync(pullOnlyPathname));
  });

  it("should be able to gracefully error out if a bad cache dir is specified", async () => {
    const config = new IModelHostConfiguration();
    config.briefcaseCacheDir = "\\\\blah\\blah\\blah";
    IModelTestUtils.shutdownBackend();

    let exceptionThrown = false;
    try {
      IModelHost.startup(config);
    } catch (error) {
      exceptionThrown = true;
    }
    assert.isTrue(exceptionThrown);

    // Restart the backend to the default configuration
    IModelHost.shutdown();
    IModelTestUtils.startBackend();
  });

  it("should be able to reverse and reinstate changes", async () => {
    const iModelPullAndPush = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    const iModelPullOnly = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullOnly(), IModelVersion.latest());

    let arrayIndex: number;
    for (arrayIndex = readOnlyTestVersions.length - 1; arrayIndex >= 0; arrayIndex--) {
      await iModelPullAndPush.reverseChanges(requestContext, IModelVersion.named(readOnlyTestVersions[arrayIndex]));
      assert.equal(readOnlyTestElementCounts[arrayIndex], getElementCount(iModelPullAndPush));

      await iModelPullOnly.reverseChanges(requestContext, IModelVersion.named(readOnlyTestVersions[arrayIndex]));
      assert.equal(readOnlyTestElementCounts[arrayIndex], getElementCount(iModelPullOnly));
    }

    await iModelPullAndPush.reverseChanges(requestContext, IModelVersion.first());
    await iModelPullOnly.reverseChanges(requestContext, IModelVersion.first());

    for (arrayIndex = 0; arrayIndex < readOnlyTestVersions.length; arrayIndex++) {
      await iModelPullAndPush.reinstateChanges(requestContext, IModelVersion.named(readOnlyTestVersions[arrayIndex]));
      assert.equal(readOnlyTestElementCounts[arrayIndex], getElementCount(iModelPullAndPush));

      await iModelPullOnly.reinstateChanges(requestContext, IModelVersion.named(readOnlyTestVersions[arrayIndex]));
      assert.equal(readOnlyTestElementCounts[arrayIndex], getElementCount(iModelPullOnly));
    }

    await iModelPullAndPush.reinstateChanges(requestContext, IModelVersion.latest());
    await iModelPullOnly.reinstateChanges(requestContext, IModelVersion.latest());

    await iModelPullAndPush.close(requestContext, KeepBriefcase.Yes);
    await iModelPullOnly.close(requestContext, KeepBriefcase.Yes);
  });

  const briefcaseExistsOnHub = async (iModelId: GuidString, briefcaseId: number): Promise<boolean> => {
    try {
      const hubBriefcases: HubBriefcase[] = await BriefcaseManager.imodelClient.briefcases.get(requestContext, iModelId, new BriefcaseQuery().byId(briefcaseId));
      return (hubBriefcases.length > 0) ? true : false;
    } catch (e) {
      return false;
    }
  };

  it("should allow purging the cache and delete any acquired briefcases from the hub", async () => {
    const iModel1 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    const briefcaseId1: number = iModel1.briefcase.briefcaseId;
    let exists = await briefcaseExistsOnHub(readOnlyTestIModel.id, briefcaseId1);
    assert.isTrue(exists);

    const iModel2 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullOnly(), IModelVersion.latest());
    const briefcaseId2: number = iModel2.briefcase.briefcaseId;
    exists = await briefcaseExistsOnHub(readOnlyTestIModel.id, briefcaseId2);
    assert.isTrue(exists);

    await BriefcaseManager.purgeCache(managerRequestContext);

    exists = await briefcaseExistsOnHub(readOnlyTestIModel.id, briefcaseId1);
    assert.isFalse(exists);

    exists = await briefcaseExistsOnHub(readOnlyTestIModel.id, briefcaseId2);
    assert.isFalse(exists);
  });

  it("Open iModel-s with various names causing potential issues on Windows/Unix", async () => {
    const projectId: string = await HubUtility.queryProjectIdByName(managerRequestContext, "iModelJsIntegrationTest");

    let iModelName = "iModel Name With Spaces";
    let iModelId = await createIModelOnHub(managerRequestContext, projectId, iModelName);
    assert.isDefined(iModelId);
    let iModel = await BriefcaseIModelDb.open(requestContext, projectId, iModelId, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.isDefined(iModel);

    iModelName = "iModel Name With :\/<>?* Characters";
    iModelId = await createIModelOnHub(managerRequestContext, projectId, iModelName);
    assert.isDefined(iModelId);
    iModel = await BriefcaseIModelDb.open(requestContext, projectId, iModelId, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.isDefined(iModel);

    iModelName = "iModel Name Thats Excessively Long " +
      "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789" +
      "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789" +
      "01234567890123456789"; // 35 + 2*100 + 20 = 255
    // Note: iModelHub does not accept a name that's longer than 255 characters.
    assert.equal(255, iModelName.length);
    iModelId = await createIModelOnHub(managerRequestContext, projectId, iModelName);
    assert.isDefined(iModelId);
    iModel = await BriefcaseIModelDb.open(requestContext, projectId, iModelId, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.isDefined(iModel);
  });

  it("should reuse a briefcaseId when re-opening iModel-s for pullOnly and pullAndPush workflows", async () => {
    const iModel1 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    const briefcaseId1: number = iModel1.briefcase.briefcaseId;
    const iModel2 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullOnly(), IModelVersion.latest());
    const briefcaseId2: number = iModel2.briefcase.briefcaseId;
    assert.notStrictEqual(briefcaseId1, briefcaseId2); // PullOnly and PullAndPush should allocate different briefcase ids

    await iModel1.close(requestContext); // Keeps the briefcase by default
    await iModel2.close(requestContext); // Keeps the briefcase by default

    const iModel3 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullAndPush(), IModelVersion.latest());
    const briefcaseId3: number = iModel3.briefcase.briefcaseId;
    assert.strictEqual(briefcaseId3, briefcaseId1);

    const iModel4 = await BriefcaseIModelDb.open(requestContext, testProjectId, readOnlyTestIModel.id, OpenParams.pullOnly(), IModelVersion.latest());
    const briefcaseId4: number = iModel4.briefcase.briefcaseId;
    assert.strictEqual(briefcaseId4, briefcaseId2);

    await iModel3.close(requestContext, KeepBriefcase.No);
    await iModel4.close(requestContext, KeepBriefcase.No);
  });

  it("should reuse a briefcaseId when re-opening iModel-s of different versions for pullAndPush and pullOnly workflows", async () => {
    const userContext1 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    const userContext2 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);

    // User1 creates an iModel on the Hub
    const testUtility = new TestChangeSetUtility(userContext1, "BriefcaseReuseTest");
    await testUtility.createTestIModel();

    // User2 opens and then closes the iModel pullOnly/pullPush, keeping the briefcase
    const iModelPullAndPush = await BriefcaseIModelDb.open(userContext2, testUtility.projectId, testUtility.iModelId, OpenParams.pullAndPush(), IModelVersion.latest());
    const briefcaseIdPullAndPush: number = iModelPullAndPush.briefcase.briefcaseId;
    const changeSetIdPullAndPush = iModelPullAndPush.iModelToken.changeSetId;
    await iModelPullAndPush.close(userContext2);

    const iModelPullOnly = await BriefcaseIModelDb.open(userContext2, testUtility.projectId, testUtility.iModelId, OpenParams.pullOnly(), IModelVersion.latest());
    const briefcaseIdPullOnly: number = iModelPullOnly.briefcase.briefcaseId;
    const changeSetIdPullOnly = iModelPullOnly.iModelToken.changeSetId;
    await iModelPullOnly.close(userContext2);

    // User1 pushes a change set
    await testUtility.pushTestChangeSet();

    // User 2 reopens the iModel pullOnly/pullPush => Expect the same briefcase to be re-used, but the changeSet should have been updated!!
    const iModelPullAndPush2 = await BriefcaseIModelDb.open(userContext2, testUtility.projectId, testUtility.iModelId, OpenParams.pullAndPush(), IModelVersion.latest());
    const briefcaseIdPullAndPush2: number = iModelPullAndPush2.briefcase.briefcaseId;
    assert.strictEqual(briefcaseIdPullAndPush2, briefcaseIdPullAndPush);
    const changeSetIdPullAndPush2 = iModelPullAndPush2.iModelToken.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush2, changeSetIdPullAndPush);
    await iModelPullAndPush2.close(userContext2, KeepBriefcase.No); // Delete iModel from disk

    const iModelPullOnly2 = await BriefcaseIModelDb.open(userContext2, testUtility.projectId, testUtility.iModelId, OpenParams.pullOnly(), IModelVersion.latest());
    const briefcaseIdPullOnly2: number = iModelPullOnly2.briefcase.briefcaseId;
    assert.strictEqual(briefcaseIdPullOnly2, briefcaseIdPullOnly);
    const changeSetIdPullOnly2 = iModelPullOnly2.iModelToken.changeSetId;
    assert.notStrictEqual(changeSetIdPullOnly2, changeSetIdPullOnly);
    await iModelPullOnly2.close(userContext2, KeepBriefcase.No); // Delete iModel from disk

    // Delete iModel from the Hub and disk
    await testUtility.deleteTestIModel();
  });

  it("should be able to edit PullOnly briefcases and upgrade versions on re-open as necessary, but not be able to push changes", async () => {
    const userContext1 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager); // User1 is just used to create and update the iModel
    const userContext2 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager); // User2 is used for the test

    // User1 creates an iModel on the Hub
    const testUtility = new TestChangeSetUtility(userContext1, "PullOnlyTest");
    await testUtility.createTestIModel();

    // User2 opens the iModel pullOnly and is able to edit and save changes (it's after all ReadWrite!!)
    let iModelPullOnly = await BriefcaseIModelDb.open(userContext2, testUtility.projectId, testUtility.iModelId, OpenParams.pullOnly(), IModelVersion.latest());
    assert.exists(iModelPullOnly);
    const briefcaseId = iModelPullOnly.briefcase.briefcaseId;
    const pathname = iModelPullOnly.briefcase.pathname;

    const rootEl: Element = iModelPullOnly.elements.getRootSubject();
    rootEl.userLabel = rootEl.userLabel + "changed";
    await iModelPullOnly.concurrencyControl.requestResourcesForUpdate(userContext2, [rootEl]);
    iModelPullOnly.elements.updateElement(rootEl);

    await iModelPullOnly.concurrencyControl.request(userContext2);
    assert.isTrue(iModelPullOnly.nativeDb.hasUnsavedChanges());
    assert.isFalse(iModelPullOnly.nativeDb.hasSavedChanges());
    iModelPullOnly.saveChanges();
    assert.isFalse(iModelPullOnly.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullOnly.nativeDb.hasSavedChanges());

    await iModelPullOnly.close(userContext2, KeepBriefcase.Yes);

    // User2 should be able to re-open the iModel pullOnly again
    // - the changes will still be there
    iModelPullOnly = await BriefcaseIModelDb.open(userContext2, testUtility.projectId, testUtility.iModelId, OpenParams.pullOnly(), IModelVersion.latest());
    const changeSetIdPullAndPush = iModelPullOnly.iModelToken.changeSetId;
    assert.strictEqual(iModelPullOnly.briefcase.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullOnly.briefcase.pathname, pathname);
    assert.isFalse(iModelPullOnly.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullOnly.nativeDb.hasSavedChanges());

    // User1 pushes a change set
    await testUtility.pushTestChangeSet();

    // User2 should be able to re-open the iModel pullOnly again as of a newer version
    // - the changes will still be there, but
    // - the briefcase will NOT be upgraded to the newer version since it was left open.
    iModelPullOnly = await BriefcaseIModelDb.open(userContext2, testUtility.projectId, testUtility.iModelId, OpenParams.pullOnly(), IModelVersion.latest());
    const changeSetIdPullAndPush2 = iModelPullOnly.iModelToken.changeSetId;
    assert.strictEqual(changeSetIdPullAndPush2, changeSetIdPullAndPush); // Briefcase remains at the same version
    assert.strictEqual(iModelPullOnly.briefcase.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullOnly.briefcase.pathname, pathname);
    assert.isFalse(iModelPullOnly.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullOnly.nativeDb.hasSavedChanges());

    // User2 closes and reopens the iModel pullOnly as of the newer version
    // - the changes will still be there, AND
    // - the briefcase will be upgraded to the newer version since it was closed and re-opened.
    await iModelPullOnly.close(userContext2, KeepBriefcase.Yes);
    iModelPullOnly = await BriefcaseIModelDb.open(userContext2, testUtility.projectId, testUtility.iModelId, OpenParams.pullOnly(), IModelVersion.latest());
    const changeSetIdPullAndPush3 = iModelPullOnly.iModelToken.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush3, changeSetIdPullAndPush);
    assert.strictEqual(iModelPullOnly.briefcase.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullOnly.briefcase.pathname, pathname);
    assert.isFalse(iModelPullOnly.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullOnly.nativeDb.hasSavedChanges());

    // User1 pushes another change set
    await testUtility.pushTestChangeSet();

    // User2 should be able pull and merge changes
    await iModelPullOnly.pullAndMergeChanges(userContext2, IModelVersion.latest());
    const changeSetIdPullAndPush4 = iModelPullOnly.iModelToken.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush4, changeSetIdPullAndPush3);

    // User2 should NOT be able to push the changes
    let errorThrown = false;
    try {
      await iModelPullOnly.pushChanges(userContext2);
    } catch (err) {
      errorThrown = true;
    }
    assert.isTrue(errorThrown);

    // NEEDS_WORK -> User2 needs the ability to abandon saved changes, and this needs a new method.

    // Delete iModel from the Hub and disk
    await iModelPullOnly.close(userContext2, KeepBriefcase.No);
    await testUtility.deleteTestIModel();
  });

  it("should be able to edit a PullAndPush briefcase, reopen it as of a new version, and then push changes", async () => {
    const userContext1 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager); // User1 is just used to create and update the iModel
    const userContext2 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager); // User2 is used for the test

    // User1 creates an iModel on the Hub
    const testUtility = new TestChangeSetUtility(userContext1, "PullAndPushTest");
    await testUtility.createTestIModel();

    // User2 opens the iModel pullAndPush and is able to edit and save changes
    let iModelPullAndPush = await BriefcaseIModelDb.open(userContext2, testUtility.projectId, testUtility.iModelId, OpenParams.pullAndPush(), IModelVersion.latest());
    assert.exists(iModelPullAndPush);
    const briefcaseId = iModelPullAndPush.briefcase.briefcaseId;
    const pathname = iModelPullAndPush.briefcase.pathname;

    const rootEl: Element = iModelPullAndPush.elements.getRootSubject();
    rootEl.userLabel = rootEl.userLabel + "changed";
    await iModelPullAndPush.concurrencyControl.requestResourcesForUpdate(userContext2, [rootEl]);
    iModelPullAndPush.elements.updateElement(rootEl);

    await iModelPullAndPush.concurrencyControl.request(userContext2);
    assert.isTrue(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isFalse(iModelPullAndPush.nativeDb.hasSavedChanges());
    iModelPullAndPush.saveChanges();
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasSavedChanges());

    await iModelPullAndPush.close(userContext2, KeepBriefcase.Yes);

    // User2 should be able to re-open the iModel pullAndPush again
    // - the changes will still be there
    iModelPullAndPush = await BriefcaseIModelDb.open(userContext2, testUtility.projectId, testUtility.iModelId, OpenParams.pullAndPush(), IModelVersion.latest());
    const changeSetIdPullAndPush = iModelPullAndPush.iModelToken.changeSetId;
    assert.strictEqual(iModelPullAndPush.briefcase.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullAndPush.briefcase.pathname, pathname);
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasSavedChanges());

    // User1 pushes a change set
    await testUtility.pushTestChangeSet();

    // User2 should be able to re-open the iModel pullAndPush again as of a newer version
    // - the changes will still be there, but
    // - the briefcase will NOT be upgraded to the newer version since it was left open.
    iModelPullAndPush = await BriefcaseIModelDb.open(userContext2, testUtility.projectId, testUtility.iModelId, OpenParams.pullAndPush(), IModelVersion.latest());
    const changeSetIdPullAndPush2 = iModelPullAndPush.iModelToken.changeSetId;
    assert.strictEqual(changeSetIdPullAndPush2, changeSetIdPullAndPush); // Briefcase remains at the same version
    assert.strictEqual(iModelPullAndPush.briefcase.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullAndPush.briefcase.pathname, pathname);
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasSavedChanges());

    // User2 closes and reopens the iModel pullAndPush as of the newer version
    // - the changes will still be there, AND
    // - the briefcase will be upgraded to the newer version since it was closed and re-opened.
    await iModelPullAndPush.close(userContext2, KeepBriefcase.Yes);
    iModelPullAndPush = await BriefcaseIModelDb.open(userContext2, testUtility.projectId, testUtility.iModelId, OpenParams.pullAndPush(), IModelVersion.latest());
    const changeSetIdPullAndPush3 = iModelPullAndPush.iModelToken.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush3, changeSetIdPullAndPush);
    assert.strictEqual(iModelPullAndPush.briefcase.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullAndPush.briefcase.pathname, pathname);
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasSavedChanges());

    // User2 should be able to push the changes now
    await iModelPullAndPush.pushChanges(userContext2);
    const changeSetIdPullAndPush4 = iModelPullAndPush.iModelToken.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush4, changeSetIdPullAndPush3);

    // Delete iModel from the Hub and disk
    await iModelPullAndPush.close(userContext2, KeepBriefcase.No);
    await testUtility.deleteTestIModel();
  });
});
