/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import { BriefcaseStatus, ClientRequestContext, GuidString, IModelStatus, Logger, LogLevel, OpenMode } from "@bentley/bentleyjs-core";
import { BriefcaseQuery, Briefcase as HubBriefcase, HubIModel } from "@bentley/imodelhub-client";
import { BriefcaseDownloader, BriefcaseProps, IModelError, IModelVersion, SyncMode } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext, ProgressInfo, UserCancelledError } from "@bentley/itwin-client";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import {
  AuthorizedBackendRequestContext, BackendLoggerCategory, BriefcaseDb, BriefcaseEntry, BriefcaseIdValue, BriefcaseManager, Element, IModelDb,
  IModelHost, IModelHostConfiguration, IModelJsFs, KnownLocations,
} from "../../imodeljs-backend";
import { IModelTestUtils, TestIModelInfo } from "../IModelTestUtils";
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
  const testProjectName = "iModelJsIntegrationTest";

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
    testProjectId = await HubUtility.queryProjectIdByName(requestContext, testProjectName);
    readOnlyTestIModel = await IModelTestUtils.getTestModelInfo(requestContext, testProjectId, "ReadOnlyTest");
    noVersionsTestIModel = await IModelTestUtils.getTestModelInfo(requestContext, testProjectId, "NoVersionsTest");
    readWriteTestIModel = await IModelTestUtils.getTestModelInfo(requestContext, testProjectId, "ReadWriteTest");

    // Purge briefcases that are close to reaching the acquire limit
    await HubUtility.purgeAcquiredBriefcases(requestContext, testProjectName, "ReadOnlyTest");
    await HubUtility.purgeAcquiredBriefcases(requestContext, testProjectName, "NoVersionsTest");
    await HubUtility.purgeAcquiredBriefcases(requestContext, testProjectName, "ReadWriteTest");
    await HubUtility.purgeAcquiredBriefcases(requestContext, testProjectName, "Stadium Dataset 1");
    managerRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, testProjectName, "ReadOnlyTest");
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, testProjectName, "NoVersionsTest");
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, testProjectName, "ReadWriteTest");
  });

  after(() => {
    // IModelTestUtils.resetDebugLogLevels();
  });

  afterEach(() => {
    validateBriefcaseCache();
  });

  it("should open and close an iModel from the Hub", async () => {
    let onOpenCalled: boolean = false;
    const onOpenListener = (requestContextIn: AuthorizedClientRequestContext | ClientRequestContext, briefcaseProps: BriefcaseProps) => {
      onOpenCalled = true;
      const { contextId, iModelId, openMode } = briefcaseProps;
      assert.isTrue(requestContextIn instanceof AuthorizedClientRequestContext);
      if (requestContextIn instanceof AuthorizedClientRequestContext)
        assert.deepEqual(requestContextIn.accessToken, requestContext.accessToken);
      assert.equal(contextId, testProjectId);
      assert.equal(iModelId, readOnlyTestIModel.id);
      assert.equal(openMode, OpenMode.Readonly);
    };
    BriefcaseDb.onOpen.addListener(onOpenListener);

    let onOpenedCalled: boolean = false;
    const onOpenedListener = (_requestContextIn: AuthorizedClientRequestContext | ClientRequestContext, iModelDb: IModelDb) => {
      onOpenedCalled = true;
      assert.equal(iModelDb.iModelId, readOnlyTestIModel.id);
    };
    BriefcaseDb.onOpened.addListener(onOpenedListener);

    let onBeforeCloseCalled: boolean = false;
    const onBeforeCloseListener = () => {
      onBeforeCloseCalled = true;
    };

    try {
      const iModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.first());
      assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");

      iModel.onBeforeClose.addListener(onBeforeCloseListener);

      // Validate that the IModelDb is readonly
      assert(iModel.openMode === OpenMode.Readonly, "iModel not set to Readonly mode");

      const expectedChangeSetId = await IModelVersion.first().evaluateChangeSet(requestContext, readOnlyTestIModel.id, BriefcaseManager.imodelClient);
      assert.strictEqual<string>(iModel.briefcase.parentChangeSetId, expectedChangeSetId);
      assert.strictEqual<string>(iModel.changeSetId, expectedChangeSetId);

      assert.isTrue(onOpenedCalled);
      assert.isTrue(onOpenCalled);

      const pathname = iModel.briefcase.pathname;
      assert.isTrue(IModelJsFs.existsSync(pathname));
      await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel);

      assert.isFalse(IModelJsFs.existsSync(pathname), `Briefcase continues to exist at ${pathname}`);
      assert.isTrue(onBeforeCloseCalled);
    } finally {

      BriefcaseDb.onOpen.removeListener(onOpenListener);
      BriefcaseDb.onOpened.removeListener(onOpenedListener);
    }
  });

  it("should reuse fixed version briefcases", async () => {
    const iModel1 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.named("FirstVersion"));
    assert.exists(iModel1, "No iModel returned from call to BriefcaseManager.open");

    const iModel2 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.named("FirstVersion"));
    assert.exists(iModel2, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel1, iModel2, "previously open briefcase was expected to be shared");

    const iModel3 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.named("SecondVersion"));
    assert.exists(iModel3, "No iModel returned from call to BriefcaseManager.open");
    assert.notEqual(iModel3, iModel2, "opening two different versions should not cause briefcases to be shared when the older one is open");
    assert.notEqual(iModel3.briefcase, iModel2.briefcase, "opening two different versions should not cause briefcases to be shared when the older one is open");

    const briefcase2 = iModel2.briefcase;
    const pathname2 = briefcase2.pathname;
    iModel2.close();
    assert.isTrue(IModelJsFs.existsSync(pathname2));

    const briefcase3 = iModel3.briefcase;
    const pathname3 = briefcase3.pathname;
    iModel3.close();
    assert.isTrue(IModelJsFs.existsSync(pathname3));

    const iModel4 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.named("FirstVersion"));
    assert.exists(iModel4, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel4.briefcase.pathname, briefcase2.pathname, "previously closed briefcase was expected to be shared");

    const iModel5 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.named("SecondVersion"));
    assert.exists(iModel5, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel5.briefcase.pathname, briefcase3.pathname, "previously closed briefcase was expected to be shared");

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel4);
    assert.isFalse(IModelJsFs.existsSync(pathname2));

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel5);
    assert.isFalse(IModelJsFs.existsSync(pathname3));
  });

  it("should reuse open or closed PullAndPush briefcases", async () => {
    const iModel1 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullAndPush, IModelVersion.latest());
    assert.exists(iModel1, "No iModel returned from call to BriefcaseManager.open");

    const iModel2 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullAndPush, IModelVersion.latest());
    assert.exists(iModel2, "No iModel returned from call to BriefcaseManager.open");

    assert.equal(iModel1, iModel2);
    const pathname = iModel1.briefcase.pathname;
    iModel1.close();

    const iModel3 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullAndPush, IModelVersion.latest());
    assert.exists(iModel3, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel3.briefcase.pathname, pathname, "previously closed briefcase was expected to be shared");

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel3);
  });

  it("should reuse open or closed PullOnly briefcases", async () => {
    const iModel1 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullOnly, IModelVersion.latest());
    assert.exists(iModel1, "No iModel returned from call to BriefcaseManager.open");

    const iModel2 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullOnly, IModelVersion.latest());
    assert.exists(iModel2, "No iModel returned from call to BriefcaseManager.open");

    assert.equal(iModel1, iModel2);
    const pathname = iModel1.briefcase.pathname;
    iModel1.close();

    const iModel3 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullOnly, IModelVersion.latest());
    assert.exists(iModel3, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel3.briefcase.pathname, pathname, "previously closed briefcase was expected to be shared");

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel3);
  });

  it("should open iModels of specific versions from the Hub", async () => {
    const iModelFirstVersion = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.first());
    assert.exists(iModelFirstVersion);
    assert.strictEqual<string>(iModelFirstVersion.briefcase.currentChangeSetId, "");

    for (const [arrayIndex, versionName] of readOnlyTestVersions.entries()) {
      const iModelFromVersion = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.asOfChangeSet(readOnlyTestIModel.changeSets[arrayIndex + 1].wsgId));
      assert.exists(iModelFromVersion);
      assert.strictEqual<string>(iModelFromVersion.briefcase.currentChangeSetId, readOnlyTestIModel.changeSets[arrayIndex + 1].wsgId);

      const iModelFromChangeSet = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.named(versionName));
      assert.exists(iModelFromChangeSet);
      assert.strictEqual(iModelFromChangeSet, iModelFromVersion);
      assert.strictEqual<string>(iModelFromChangeSet.briefcase.currentChangeSetId, readOnlyTestIModel.changeSets[arrayIndex + 1].wsgId);

      const elementCount = getElementCount(iModelFromVersion);
      assert.equal(elementCount, readOnlyTestElementCounts[arrayIndex], `Count isn't what's expected for ${iModelFromVersion.briefcase.pathname}, version ${versionName}`);

      iModelFromVersion.close();
    }

    const iModelLatestVersion = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.latest());
    assert.exists(iModelLatestVersion);
    assert.isUndefined(iModelLatestVersion.briefcase.reversedChangeSetId);
    assert.strictEqual<string>(iModelLatestVersion.briefcase.parentChangeSetId, readOnlyTestIModel.changeSets[3].wsgId);
    assert.strictEqual<string>(iModelLatestVersion.briefcase.nativeDb.getParentChangeSetId(), readOnlyTestIModel.changeSets[3].wsgId);
    assert.isNotTrue(!!iModelLatestVersion.briefcase.reversedChangeSetId);

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelFirstVersion);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelLatestVersion);
  });

  it("should open an iModel with no versions", async () => {
    const iModelNoVer = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, noVersionsTestIModel.id, SyncMode.FixedVersion);
    assert.exists(iModelNoVer);
    assert(iModelNoVer.iModelId === noVersionsTestIModel.id, "Correct iModel not found");
  });

  it("should be able to pull or reverse changes only if allowed", async () => {
    const secondChangeSetId = readOnlyTestIModel.changeSets[1].wsgId;

    const iModelFixed = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.asOfChangeSet(secondChangeSetId));
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

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelFixed);
  });

  it("should be able to edit only if it's allowed", async () => {
    const iModelFixed = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readWriteTestIModel.id, SyncMode.FixedVersion, IModelVersion.latest());
    assert.exists(iModelFixed);

    let rootEl: Element = iModelFixed.elements.getRootSubject();
    rootEl.userLabel = `${rootEl.userLabel}changed`;
    assert.throws(() => iModelFixed.elements.updateElement(rootEl));

    const iModelPullAndPush: BriefcaseDb = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readWriteTestIModel.id, SyncMode.PullAndPush, IModelVersion.latest());
    assert.exists(iModelPullAndPush);
    assert.isTrue(!iModelPullAndPush.isReadonly);
    assert.equal(iModelPullAndPush.openMode, OpenMode.ReadWrite);

    rootEl = iModelPullAndPush.elements.getRootSubject();
    rootEl.userLabel = `${rootEl.userLabel}changed`;
    await iModelPullAndPush.concurrencyControl.requestResourcesForUpdate(requestContext, [rootEl]);
    iModelPullAndPush.elements.updateElement(rootEl);

    await iModelPullAndPush.concurrencyControl.request(requestContext);
    iModelPullAndPush.saveChanges(); // Push is tested out in a separate test

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelFixed);

    iModelPullAndPush.close();
    assert.isFalse(iModelPullAndPush.isOpen);

    // Reopen the briefcase as readonly to validate
    const iModelPullAndPush2 = await BriefcaseDb.open(requestContext, iModelPullAndPush.briefcaseKey, { openAsReadOnly: true });
    assert.exists(iModelPullAndPush2);
    assert.isTrue(iModelPullAndPush2.isReadonly);
    assert.isTrue(iModelPullAndPush2.isOpen);
    assert.equal(iModelPullAndPush2.openMode, OpenMode.Readonly);

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelPullAndPush2);
  });

  it("should set the briefcase cache directory to expected locations", async () => {
    const config = new IModelHostConfiguration();
    const cacheSubDir = `v${(BriefcaseManager as any)._cacheMajorVersion}_${(BriefcaseManager as any)._cacheMinorVersion}`;

    // Test legacy 1.0 cache location
    await IModelHost.shutdown();
    config.briefcaseCacheDir = path.join(KnownLocations.tmpdir, "Bentley/IModelJs/cache/"); // eslint-disable-line deprecation/deprecation
    await IModelHost.startup(config);
    let expectedDir = path.join(path.normalize(config.briefcaseCacheDir), cacheSubDir); // eslint-disable-line deprecation/deprecation
    assert.strictEqual(expectedDir, (BriefcaseManager as any).cacheDir); // eslint-disable-line deprecation/deprecation

    // Test 2.0 cache default location
    await IModelHost.shutdown();
    config.briefcaseCacheDir = undefined; // eslint-disable-line deprecation/deprecation
    await IModelHost.startup(config);
    expectedDir = path.join(IModelHost.cacheDir, "bc", cacheSubDir);
    assert.strictEqual(expectedDir, (BriefcaseManager as any).cacheDir);

    // Test 2.0 custom cache location
    await IModelHost.shutdown();
    config.briefcaseCacheDir = undefined; // eslint-disable-line deprecation/deprecation
    config.cacheDir = KnownLocations.tmpdir;
    await IModelHost.startup(config);
    expectedDir = path.join(KnownLocations.tmpdir, "bc", cacheSubDir);
    assert.strictEqual(expectedDir, (BriefcaseManager as any).cacheDir);

    // Restore defaults
    await IModelHost.shutdown();
    config.briefcaseCacheDir = undefined; // eslint-disable-line deprecation/deprecation
    config.cacheDir = undefined;
    await IModelHost.startup(config);
  });

  it("should be able to reuse existing briefcases from a previous session", async () => {
    let iModelShared = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.latest());
    assert.exists(iModelShared);
    assert.strictEqual(iModelShared.openMode, OpenMode.Readonly);
    const sharedPathname = iModelShared.briefcase.pathname;

    let iModelPullAndPush = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullAndPush, IModelVersion.latest());
    assert.exists(iModelPullAndPush);
    assert.strictEqual(iModelPullAndPush.openMode, OpenMode.ReadWrite);
    const pullAndPushPathname = iModelPullAndPush.briefcase.pathname;

    let iModelPullOnly = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullOnly, IModelVersion.latest());
    assert.exists(iModelPullOnly);
    assert.strictEqual(iModelPullOnly.openMode, OpenMode.ReadWrite); // Note: PullOnly briefcases must be set to ReadWrite to accept change sets
    const pullOnlyPathname = iModelPullOnly.briefcase.pathname;

    iModelShared.close();
    iModelPullAndPush.close();
    iModelPullOnly.close();

    await IModelHost.shutdown();

    assert.isTrue(IModelJsFs.existsSync(sharedPathname));
    assert.isTrue(IModelJsFs.existsSync(pullAndPushPathname));
    assert.isTrue(IModelJsFs.existsSync(pullOnlyPathname));

    await IModelHost.startup();

    iModelShared = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.latest());
    assert.exists(iModelShared);
    assert.strictEqual<string>(iModelShared.briefcase.pathname, sharedPathname);

    iModelPullAndPush = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullAndPush, IModelVersion.latest());
    assert.exists(iModelPullAndPush);
    assert.strictEqual<string>(iModelPullAndPush.briefcase.pathname, pullAndPushPathname);

    iModelPullOnly = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullOnly, IModelVersion.latest());
    assert.exists(iModelPullOnly);
    assert.strictEqual<string>(iModelPullOnly.briefcase.pathname, pullOnlyPathname);

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelShared);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelPullAndPush);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelPullOnly);

    assert.isFalse(IModelJsFs.existsSync(sharedPathname));
    assert.isFalse(IModelJsFs.existsSync(pullAndPushPathname));
    assert.isFalse(IModelJsFs.existsSync(pullOnlyPathname));
  });

  // TODO: This test succeeds on Linux when it's expected to fail
  it.skip("should be able to gracefully error out if a bad cache dir is specified", async () => {
    const config = new IModelHostConfiguration();
    config.cacheDir = "\\\\blah\\blah\\blah";
    await IModelTestUtils.shutdownBackend();

    let exceptionThrown = false;
    try {
      await IModelHost.startup(config);
    } catch (error) {
      exceptionThrown = true;
    }
    assert.isTrue(exceptionThrown);

    // Restart the backend to the default configuration
    await IModelHost.shutdown();
    await IModelTestUtils.startBackend();
  });

  it("should be able to reverse and reinstate changes", async () => {
    const iModelPullAndPush = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullAndPush, IModelVersion.latest());
    const iModelPullOnly = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullOnly, IModelVersion.latest());

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

    iModelPullAndPush.close();
    iModelPullOnly.close();
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
    const iModel1 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullAndPush, IModelVersion.latest());
    const briefcaseId1: number = iModel1.briefcase.briefcaseId;
    let exists = await briefcaseExistsOnHub(readOnlyTestIModel.id, briefcaseId1);
    assert.isTrue(exists);

    await BriefcaseManager.purgeCache(managerRequestContext);

    exists = await briefcaseExistsOnHub(readOnlyTestIModel.id, briefcaseId1);
    assert.isFalse(exists);
  });

  it("Open iModel-s with various names causing potential issues on Windows/Unix", async () => {
    const projectId: string = await HubUtility.queryProjectIdByName(managerRequestContext, testProjectName);

    let iModelName = "iModel Name With Spaces";
    let iModelId = await createIModelOnHub(managerRequestContext, projectId, iModelName);
    assert.isDefined(iModelId);
    let iModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, projectId, iModelId, SyncMode.FixedVersion, IModelVersion.latest());
    assert.isDefined(iModel);

    iModelName = "iModel Name With :\/<>?* Characters";
    iModelId = await createIModelOnHub(managerRequestContext, projectId, iModelName);
    assert.isDefined(iModelId);
    iModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, projectId, iModelId, SyncMode.FixedVersion, IModelVersion.latest());
    assert.isDefined(iModel);

    iModelName = "iModel Name Thats Excessively Long " +
      "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789" +
      "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789" +
      "01234567890123456789"; // 35 + 2*100 + 20 = 255
    // Note: iModelHub does not accept a name that's longer than 255 characters.
    assert.equal(255, iModelName.length);
    iModelId = await createIModelOnHub(managerRequestContext, projectId, iModelName);
    assert.isDefined(iModelId);
    iModel = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, projectId, iModelId, SyncMode.FixedVersion, IModelVersion.latest());
    assert.isDefined(iModel);
  });

  it("should set appropriate briefcae ids for FixedVersion, PullOnly and PullAndPush workflows", async () => {
    const iModel1 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.FixedVersion, IModelVersion.latest());
    assert.equal(BriefcaseIdValue.Standalone, iModel1.briefcase.briefcaseId);

    const iModel2 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullOnly, IModelVersion.latest());
    assert.equal(BriefcaseIdValue.Standalone, iModel2.briefcase.briefcaseId);

    const iModel3 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullAndPush, IModelVersion.latest());
    assert.isTrue(iModel3.briefcase.briefcaseId >= BriefcaseIdValue.FirstValid && iModel3.briefcase.briefcaseId <= BriefcaseIdValue.LastValid);

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel1);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel2);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel3);
  });

  it("should reuse a briefcaseId when re-opening iModel-s for pullAndPush workflows", async () => {
    const iModel1 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullAndPush, IModelVersion.latest());
    const briefcaseId1: number = iModel1.briefcase.briefcaseId;
    iModel1.close(); // Keeps the briefcase by default

    const iModel3 = await IModelTestUtils.downloadAndOpenBriefcaseDb(requestContext, testProjectId, readOnlyTestIModel.id, SyncMode.PullAndPush, IModelVersion.latest());
    const briefcaseId3: number = iModel3.briefcase.briefcaseId;
    assert.strictEqual(briefcaseId3, briefcaseId1);

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel3);
  });

  it("should reuse a briefcaseId when re-opening iModel-s of different versions for pullAndPush and pullOnly workflows", async () => {
    const userContext1 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    const userContext2 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);

    // User1 creates an iModel on the Hub
    const testUtility = new TestChangeSetUtility(userContext1, "BriefcaseReuseTest");
    await testUtility.createTestIModel();

    // User2 opens and then closes the iModel pullOnly/pullPush, keeping the briefcase
    const iModelPullAndPush = await IModelTestUtils.downloadAndOpenBriefcaseDb(userContext2, testUtility.projectId, testUtility.iModelId, SyncMode.PullAndPush, IModelVersion.latest());
    const briefcaseIdPullAndPush: number = iModelPullAndPush.briefcase.briefcaseId;
    const changeSetIdPullAndPush = iModelPullAndPush.changeSetId;
    iModelPullAndPush.close();

    const iModelPullOnly = await IModelTestUtils.downloadAndOpenBriefcaseDb(userContext2, testUtility.projectId, testUtility.iModelId, SyncMode.PullOnly, IModelVersion.latest());
    const briefcaseIdPullOnly: number = iModelPullOnly.briefcase.briefcaseId;
    const changeSetIdPullOnly = iModelPullOnly.changeSetId;
    iModelPullOnly.close();

    // User1 pushes a change set
    await testUtility.pushTestChangeSet();

    // User 2 reopens the iModel pullOnly/pullPush => Expect the same briefcase to be re-used, but the changeSet should have been updated!!
    const iModelPullAndPush2 = await IModelTestUtils.downloadAndOpenBriefcaseDb(userContext2, testUtility.projectId, testUtility.iModelId, SyncMode.PullAndPush, IModelVersion.latest());
    const briefcaseIdPullAndPush2: number = iModelPullAndPush2.briefcase.briefcaseId;
    assert.strictEqual(briefcaseIdPullAndPush2, briefcaseIdPullAndPush);
    const changeSetIdPullAndPush2 = iModelPullAndPush2.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush2, changeSetIdPullAndPush);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(userContext2, iModelPullAndPush2);

    const iModelPullOnly2 = await IModelTestUtils.downloadAndOpenBriefcaseDb(userContext2, testUtility.projectId, testUtility.iModelId, SyncMode.PullOnly, IModelVersion.latest());
    const briefcaseIdPullOnly2: number = iModelPullOnly2.briefcase.briefcaseId;
    assert.strictEqual(briefcaseIdPullOnly2, briefcaseIdPullOnly);
    const changeSetIdPullOnly2 = iModelPullOnly2.changeSetId;
    assert.notStrictEqual(changeSetIdPullOnly2, changeSetIdPullOnly);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(userContext2, iModelPullOnly2);

    // Delete iModel from the Hub and disk
    await testUtility.deleteTestIModel();
  });

  it("should not be able to edit PullOnly briefcases", async () => {
    const userContext1 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager); // User1 is just used to create and update the iModel
    const userContext2 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager); // User2 is used for the test

    // User1 creates an iModel on the Hub
    const testUtility = new TestChangeSetUtility(userContext1, "PullOnlyTest");
    await testUtility.createTestIModel();

    // User2 opens the iModel pullOnly and is not able to edit (even if the db is opened read-write!)
    let iModelPullOnly = await IModelTestUtils.downloadAndOpenBriefcaseDb(userContext2, testUtility.projectId, testUtility.iModelId, SyncMode.PullOnly, IModelVersion.latest());
    assert.exists(iModelPullOnly);
    assert.isTrue(!iModelPullOnly.isReadonly);
    assert.isTrue(iModelPullOnly.isOpen);
    assert.equal(iModelPullOnly.openMode, OpenMode.ReadWrite);

    const briefcaseId = iModelPullOnly.briefcase.briefcaseId;
    const pathname = iModelPullOnly.briefcase.pathname;

    const rootEl: Element = iModelPullOnly.elements.getRootSubject();
    rootEl.userLabel = `${rootEl.userLabel}changed`;
    let errorThrown1 = false;
    try {
      await iModelPullOnly.concurrencyControl.requestResourcesForUpdate(userContext2, [rootEl]);
    } catch (err) {
      errorThrown1 = err instanceof IModelError && err.errorNumber === IModelStatus.NotOpenForWrite;
    }
    assert.isTrue(errorThrown1);

    let errorThrown2 = false;
    try {
      iModelPullOnly.elements.updateElement(rootEl);
    } catch (err) {
      errorThrown2 = true;
    }
    assert.isTrue(errorThrown2);

    iModelPullOnly.close();

    // User2 should be able to re-open the iModel pullOnly again
    iModelPullOnly = await IModelTestUtils.downloadAndOpenBriefcaseDb(userContext2, testUtility.projectId, testUtility.iModelId, SyncMode.PullOnly, IModelVersion.latest());
    const changeSetIdPullAndPush = iModelPullOnly.changeSetId;
    assert.strictEqual(iModelPullOnly.briefcase.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullOnly.briefcase.pathname, pathname);
    assert.isFalse(iModelPullOnly.nativeDb.hasUnsavedChanges());
    assert.isFalse(iModelPullOnly.nativeDb.hasPendingTxns());

    // User1 pushes a change set
    await testUtility.pushTestChangeSet();

    // User2 should be able to re-open the iModel pullOnly again as of a newer version
    // - the briefcase will NOT be upgraded to the newer version since it was left open.
    iModelPullOnly = await IModelTestUtils.downloadAndOpenBriefcaseDb(userContext2, testUtility.projectId, testUtility.iModelId, SyncMode.PullOnly, IModelVersion.latest());
    const changeSetIdPullAndPush2 = iModelPullOnly.changeSetId;
    assert.strictEqual(changeSetIdPullAndPush2, changeSetIdPullAndPush); // Briefcase remains at the same version
    assert.strictEqual(iModelPullOnly.briefcase.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullOnly.briefcase.pathname, pathname);
    assert.isFalse(iModelPullOnly.nativeDb.hasUnsavedChanges());
    assert.isFalse(iModelPullOnly.nativeDb.hasPendingTxns());

    // User2 closes and reopens the iModel pullOnly as of the newer version
    // - the briefcase will be upgraded to the newer version since it was closed and re-opened.
    iModelPullOnly.close();
    iModelPullOnly = await IModelTestUtils.downloadAndOpenBriefcaseDb(userContext2, testUtility.projectId, testUtility.iModelId, SyncMode.PullOnly, IModelVersion.latest());
    const changeSetIdPullAndPush3 = iModelPullOnly.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush3, changeSetIdPullAndPush);
    assert.strictEqual(iModelPullOnly.briefcase.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullOnly.briefcase.pathname, pathname);
    assert.isFalse(iModelPullOnly.nativeDb.hasUnsavedChanges());
    assert.isFalse(iModelPullOnly.nativeDb.hasPendingTxns());

    // User1 pushes another change set
    await testUtility.pushTestChangeSet();

    // User2 should be able pull and merge changes
    await iModelPullOnly.pullAndMergeChanges(userContext2, IModelVersion.latest());
    const changeSetIdPullAndPush4 = iModelPullOnly.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush4, changeSetIdPullAndPush3);

    // User2 should NOT be able to push the changes
    let errorThrown = false;
    try {
      await iModelPullOnly.pushChanges(userContext2, "test change");
    } catch (err) {
      errorThrown = true;
    }
    assert.isTrue(errorThrown);

    // Delete iModel from the Hub and disk
    await IModelTestUtils.closeAndDeleteBriefcaseDb(userContext2, iModelPullOnly);
    await testUtility.deleteTestIModel();
  });

  it("should be able to edit a PullAndPush briefcase, reopen it as of a new version, and then push changes", async () => {
    const userContext1 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager); // User1 is just used to create and update the iModel
    const userContext2 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager); // User2 is used for the test

    // User1 creates an iModel on the Hub
    const testUtility = new TestChangeSetUtility(userContext1, "PullAndPushTest");
    await testUtility.createTestIModel();

    // User2 opens the iModel pullAndPush and is able to edit and save changes
    let iModelPullAndPush = await IModelTestUtils.downloadAndOpenBriefcaseDb(userContext2, testUtility.projectId, testUtility.iModelId, SyncMode.PullAndPush, IModelVersion.latest());
    assert.exists(iModelPullAndPush);
    const briefcaseId = iModelPullAndPush.briefcase.briefcaseId;
    const pathname = iModelPullAndPush.briefcase.pathname;

    const rootEl: Element = iModelPullAndPush.elements.getRootSubject();
    rootEl.userLabel = `${rootEl.userLabel}changed`;
    await iModelPullAndPush.concurrencyControl.requestResourcesForUpdate(userContext2, [rootEl]);
    iModelPullAndPush.elements.updateElement(rootEl);

    await iModelPullAndPush.concurrencyControl.request(userContext2);
    assert.isTrue(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isFalse(iModelPullAndPush.nativeDb.hasPendingTxns());
    iModelPullAndPush.saveChanges();
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasPendingTxns());

    iModelPullAndPush.close();

    // User2 should be able to re-open the iModel pullAndPush again
    // - the changes will still be there
    iModelPullAndPush = await IModelTestUtils.downloadAndOpenBriefcaseDb(userContext2, testUtility.projectId, testUtility.iModelId, SyncMode.PullAndPush, IModelVersion.latest());
    const changeSetIdPullAndPush = iModelPullAndPush.changeSetId;
    assert.strictEqual(iModelPullAndPush.briefcase.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullAndPush.briefcase.pathname, pathname);
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasPendingTxns());

    // User1 pushes a change set
    await testUtility.pushTestChangeSet();

    // User2 should be able to re-open the iModel pullAndPush again as of a newer version
    // - the changes will still be there, but
    // - the briefcase will NOT be upgraded to the newer version since it was left open.
    iModelPullAndPush = await IModelTestUtils.downloadAndOpenBriefcaseDb(userContext2, testUtility.projectId, testUtility.iModelId, SyncMode.PullAndPush, IModelVersion.latest());
    const changeSetIdPullAndPush2 = iModelPullAndPush.changeSetId;
    assert.strictEqual(changeSetIdPullAndPush2, changeSetIdPullAndPush); // Briefcase remains at the same version
    assert.strictEqual(iModelPullAndPush.briefcase.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullAndPush.briefcase.pathname, pathname);
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasPendingTxns());

    // User2 closes and reopens the iModel pullAndPush as of the newer version
    // - the changes will still be there, AND
    // - the briefcase will be upgraded to the newer version since it was closed and re-opened.
    iModelPullAndPush.close();
    iModelPullAndPush = await IModelTestUtils.downloadAndOpenBriefcaseDb(userContext2, testUtility.projectId, testUtility.iModelId, SyncMode.PullAndPush, IModelVersion.latest());
    const changeSetIdPullAndPush3 = iModelPullAndPush.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush3, changeSetIdPullAndPush);
    assert.strictEqual(iModelPullAndPush.briefcase.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullAndPush.briefcase.pathname, pathname);
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasPendingTxns());

    // User2 should be able to push the changes now
    await iModelPullAndPush.pushChanges(userContext2, "test change");
    const changeSetIdPullAndPush4 = iModelPullAndPush.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush4, changeSetIdPullAndPush3);

    // Delete iModel from the Hub and disk
    await IModelTestUtils.closeAndDeleteBriefcaseDb(userContext2, iModelPullAndPush);
    await testUtility.deleteTestIModel();
  });

  it("should be able to show progress when downloading a briefcase (#integration)", async () => {
    const testIModelName = "Stadium Dataset 1";
    const testIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, testIModelName);

    const syncMode = SyncMode.PullOnly;

    let numProgressCalls: number = 0;

    readline.clearLine(process.stdout, 0);
    readline.moveCursor(process.stdout, -20, 0);
    const downloadProgress = (progress: ProgressInfo) => {
      const percent = progress.percent === undefined ? 0 : progress.percent;
      const message = `${testIModelName} Download Progress ... ${percent.toFixed(2)}%`;
      process.stdout.write(message);
      readline.moveCursor(process.stdout, -1 * message.length, 0);
      if (percent >= 100) {
        process.stdout.write(os.EOL);
      }
      numProgressCalls++;
    };

    const briefcaseDownloader: BriefcaseDownloader = await BriefcaseManager.requestDownload(requestContext, testProjectId, testIModelId, { syncMode }, IModelVersion.latest(), downloadProgress);
    requestContext.enter();

    await briefcaseDownloader.downloadPromise;
    requestContext.enter();

    const iModel = await BriefcaseDb.open(requestContext, briefcaseDownloader.briefcaseProps.key);
    requestContext.enter();

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel);
    assert(numProgressCalls > 200);
  });

  it("Should be able to cancel an in progress download (#integration)", async () => {
    const testIModelName = "Stadium Dataset 1";
    const testIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, testIModelName);

    const syncMode = SyncMode.PullOnly;

    const briefcaseDownloader = await BriefcaseManager.requestDownload(requestContext, testProjectId, testIModelId, { syncMode }, IModelVersion.latest());
    requestContext.enter();

    let cancelled1: boolean = false;
    setTimeout(async () => {
      cancelled1 = await briefcaseDownloader.requestCancel();
      requestContext.enter();
    }, 10000);

    let cancelled2: boolean = false;
    try {
      await briefcaseDownloader.downloadPromise;
      requestContext.enter();
    } catch (err) {
      requestContext.enter();
      assert.equal(err.errorNumber, BriefcaseStatus.DownloadCancelled);
      assert.isTrue(err instanceof UserCancelledError);
      cancelled2 = true;
    }

    assert.isTrue(cancelled1);
    assert.isTrue(cancelled2);
  });

});
