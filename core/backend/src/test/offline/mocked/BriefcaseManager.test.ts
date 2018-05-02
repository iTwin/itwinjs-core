import * as TypeMoq from "typemoq";
import * as path from "path";
import { expect, assert } from "chai";
import { IModelJsFs } from "../../../IModelJsFs";
import { OpenMode, DbOpcode } from "@bentley/bentleyjs-core";
import { IModelVersion, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { IModelTestUtils, Timer } from "../../IModelTestUtils";
import { IModelDb, Element, IModelHost, IModelHostConfiguration } from "../../../backend";
import { ConcurrencyControl } from "../../../ConcurrencyControl";
import { TestIModelInfo, MockAssetUtil, MockAccessToken } from "../../MockAssetUtil";
import { HubTestUtils } from "../../HubTestUtils";
import { TestConfig } from "../../TestConfig";
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
  let startTime = new Date().getTime();
  const iModelHubClientMock = TypeMoq.Mock.ofType(IModelHubClient);
  const connectClientMock = TypeMoq.Mock.ofType(ConnectClient);

  const getElementCount = (iModel: IModelDb): number => {
    const rows: any[] = iModel.executeQuery("SELECT COUNT(*) AS cnt FROM bis.Element");
    const count = +(rows[0].cnt);
    return count;
  };

  before(async () => {
    startTime = new Date().getTime();

    if (offline) {
      console.log("    Setting up mock objects..."); // tslint:disable-line:no-console
      startTime = new Date().getTime();

      MockAssetUtil.setupMockAssets(assetDir);
      testProjectId = await MockAssetUtil.setupOfflineFixture(accessToken, iModelHubClientMock, connectClientMock, assetDir, cacheDir, testIModels);

      console.log(`    ...getting information on Project+IModel+ChangeSets for test case from mock data: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console
    } else {
      startTime = new Date().getTime();

      [accessToken, testProjectId, cacheDir] = await IModelTestUtils.setupIntegratedFixture(testIModels);

      console.log(`    ...getting information on Project+IModel+ChangeSets for test case from the Hub: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console
    }

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

  it("should be able to open an IModel from the Hub in Readonly mode", async () => {
    let onOpenCalled: boolean = false;
    const onOpenListener = (accessTokenIn: AccessToken, contextIdIn: string, iModelIdIn: string, openModeIn: OpenMode, _versionIn: IModelVersion) => {
      onOpenCalled = true;
      assert.deepEqual(accessTokenIn, accessToken);
      assert.equal(contextIdIn, testProjectId);
      assert.equal(iModelIdIn, testIModels[0].id);
      assert.equal(openModeIn, OpenMode.Readonly);
    };
    IModelDb.onOpen.addListener(onOpenListener);
    let onOpenedCalled: boolean = false;
    const onOpenedListener = (iModelDb: IModelDb) => {
      onOpenedCalled = true;
      assert.equal(iModelDb.iModelToken.iModelId, testIModels[0].id);
    };

    try {
      const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenMode.Readonly, IModelVersion.latest());

      assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");
      assert(iModel.openMode === OpenMode.Readonly, "iModel not set to Readonly mode");

      assert.isTrue(onOpenedCalled);
      assert.isTrue(onOpenCalled);

      expect(IModelJsFs.existsSync(testIModels[0].localReadonlyPath), "Local path to iModel does not exist");
      const files = IModelJsFs.readdirSync(path.join(testIModels[0].localReadonlyPath, "0"));
      expect(files.length).greaterThan(0, "iModel .bim file could not be read");
    } catch (e) {

      IModelDb.onOpen.removeListener(onOpenListener);
      IModelDb.onOpened.removeListener(onOpenedListener);
    }
  });

  it("should be able to open an IModel from the Hub in ReadWrite mode", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[1].id, OpenMode.ReadWrite); // Note: No frontend support for ReadWrite open yet
    assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");
    assert(iModel.openMode === OpenMode.ReadWrite, "iModel not set to ReadWrite mode");

    expect(IModelJsFs.existsSync(testIModels[1].localReadWritePath), "Local path to iModel does not exist");
    const files = IModelJsFs.readdirSync(testIModels[1].localReadWritePath);
    expect(files.length).greaterThan(0, "iModel .bim not found in cache directory");

    iModel.close(accessToken);
  });

  it("should reuse open briefcases in Readonly mode", async () => {
    let timer = new Timer("open briefcase first time");
    const iModel0: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(iModel0, "No iModel returned from call to BriefcaseManager.open");
    assert(iModel0.iModelToken.iModelId === testIModels[0].id, "Incorrect iModel ID");
    timer.end();

    const briefcases = IModelJsFs.readdirSync(testIModels[0].localReadonlyPath);
    expect(briefcases.length).greaterThan(0, "iModel .bim file could not be read");

    timer = new Timer("open briefcase 5 more times");
    const iModels = new Array<IModelDb>();
    for (let ii = 0; ii < 5; ii++) {
      const iModel = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenMode.Readonly, IModelVersion.latest());
      assert.exists(iModel, "No iModel returned from repeat call to BriefcaseManager.open");
      iModels.push(iModel);
    }
    timer.end();

    const briefcases2 = IModelJsFs.readdirSync(testIModels[0].localReadonlyPath);
    expect(briefcases2.length).equals(briefcases.length, "Extra or missing briefcases detected in the cache");
    const diff = briefcases2.filter((item) => briefcases.indexOf(item) < 0);
    expect(diff.length).equals(0, "Cache changed after repeat calls to BriefcaseManager.open");
  });

  it("should reuse closed briefcases in ReadWrite mode", async () => {
    const files = IModelJsFs.readdirSync(testIModels[1].localReadWritePath);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[1].id, OpenMode.ReadWrite); // Note: No frontend support for ReadWrite open yet
    assert.exists(iModel);

    const files2 = IModelJsFs.readdirSync(testIModels[1].localReadWritePath);
    expect(files2.length).equals(files.length);
    const diff = files2.filter((item) => files.indexOf(item) < 0);
    expect(diff.length).equals(0);

    iModel.close(accessToken);
  });

  it("should open briefcases of specific versions in Readonly mode", async () => {

    const iModelFirstVersion: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenMode.Readonly, IModelVersion.first());
    assert.exists(iModelFirstVersion);

    for (const [arrayIndex, versionName] of testVersionNames.entries()) {
      const iModelFromVersion: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenMode.Readonly, IModelVersion.asOfChangeSet(testIModels[0].changeSets[arrayIndex].wsgId));
      assert.exists(iModelFromVersion);

      const iModelFromChangeSet: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenMode.Readonly, IModelVersion.named(versionName));
      assert.exists(iModelFromChangeSet);

      const elementCount = getElementCount(iModelFromVersion);
      assert.equal(elementCount, testElementCounts[arrayIndex]);
    }

    const iModelLatestVersion: IModelDb = await IModelDb.open(accessToken as any, testProjectId, testIModels[0].id, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(iModelLatestVersion);
  });

  it("should open a briefcase of an iModel with no versions", async () => {
    const iModelNoVer: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[2].id, OpenMode.Readonly);
    assert.exists(iModelNoVer);
  });

  it.skip("should open briefcase of an iModel in both DEV and QA", async () => {
    // Note: This test is commented out since it causes the entire cache to be discarded and is therefore expensive.
    const config = new IModelHostConfiguration();

    IModelHost.shutdown();
    config.iModelHubDeployConfig = "DEV";
    IModelHost.startup(config);

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Turn off SSL validation in DEV
    const devProjectId = await HubTestUtils.queryProjectIdByName(accessToken, TestConfig.projectName);
    assert(devProjectId);
    const devIModelId = await HubTestUtils.queryIModelIdByName(accessToken, devProjectId, TestConfig.iModelName);
    assert(devIModelId);
    const devChangeSets: ChangeSet[] = await HubTestUtils.hubClient!.ChangeSets().get(accessToken, devIModelId);
    expect(devChangeSets.length).equals(0); // needs change sets
    const devIModel: IModelDb = await IModelDb.open(accessToken, devProjectId, devIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(devIModel);

    IModelHost.shutdown();
    config.iModelHubDeployConfig = "QA";
    IModelHost.startup(config);

    const qaProjectId = await HubTestUtils.queryProjectIdByName(accessToken, TestConfig.projectName);
    assert(qaProjectId);
    const qaIModelId = await HubTestUtils.queryIModelIdByName(accessToken, qaProjectId, TestConfig.iModelName);
    assert(qaIModelId);
    const qaChangeSets: ChangeSet[] = await HubTestUtils.hubClient!.ChangeSets().get(accessToken, qaIModelId);
    expect(qaChangeSets.length).greaterThan(0);
    const qaIModel: IModelDb = await IModelDb.open(accessToken, qaProjectId, qaIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(qaIModel);
  });

  it("should open a briefcase of an iModel with no versions", async () => {
      const iModelNoVer = await IModelDb.open(accessToken, testProjectId, testIModels[2].id, OpenMode.Readonly, IModelVersion.latest());
      assert.exists(iModelNoVer);
      assert(iModelNoVer.iModelToken.iModelId && iModelNoVer.iModelToken.iModelId === testIModels[2].id, "Correct iModel not found");

    });

  it("Should track the AccessTokens that are used to open IModels", async () => {
    await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenMode.Readonly);
    assert.deepEqual(IModelDb.getAccessToken(testIModels[0].id), accessToken);

    try {
      IModelDb.getAccessToken("--invalidid--");
      assert.fail("Asking for an AccessToken on an iModel that is not open should fail");
    } catch (err) {
      assert.equal((err as IModelError).errorNumber, IModelStatus.NotFound);
    }
  });

  it("should be able to reverse and reinstate changes", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[0].id, OpenMode.Readonly, IModelVersion.latest());

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
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModels[1].id, OpenMode.ReadWrite);

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
});
