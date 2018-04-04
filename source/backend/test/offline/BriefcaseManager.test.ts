import * as TypeMoq from "typemoq";
import * as path from "path";
import { expect, assert } from "chai";
import { IModelJsFs } from "../../IModelJsFs";
import { OpenMode, Id64 } from "@bentley/bentleyjs-core";
import { Appearance, ColorDef, IModelVersion, IModel } from "@bentley/imodeljs-common";
import { IModelTestUtils } from "../IModelTestUtils";
import { BriefcaseManager, DictionaryModel, Element, IModelDb, IModelHost } from "../../backend";
import { ConcurrencyControl } from "../../ConcurrencyControl";
import { TestIModelInfo, MockAssetUtil, MockAccessToken, Timer } from "../MockAssetUtil";
import {
  ConnectClient, Project, IModelHubClient, IModel as HubIModel, MultiCode, CodeState,
  AccessToken,
} from "@bentley/imodeljs-clients";

describe("BriefcaseManagerUnitTests", () => {
  const getElementCount = (iModel: IModelDb): number => {
    const rows: any[] = iModel.executeQuery("SELECT COUNT(*) AS cnt FROM bis.Element");
    const count = +(rows[0].cnt);
    return count;
  };

  let testProjectId: string;
  const testIModels: TestIModelInfo[] = [
    new TestIModelInfo("ReadOnlyTest"),
    new TestIModelInfo("ReadWriteTest"),
    new TestIModelInfo("NoVersionsTest"),
  ];
  const assetDir = "./test/assets/_mocks_";
  const spoofAccessToken: MockAccessToken = new MockAccessToken();
  const iModelHubClientMock = TypeMoq.Mock.ofType(IModelHubClient);
  const iModelVersionMock = TypeMoq.Mock.ofType(IModelVersion);
  const connectClientMock = TypeMoq.Mock.ofType(ConnectClient);
  const cacheDir = IModelHost.configuration!.briefcaseCacheDir;

  before(async () => {
    const startTime = new Date().getTime();

    console.log("    Setting up mock objects..."); // tslint:disable-line:no-console

    MockAssetUtil.setupConnectClientMock(connectClientMock, assetDir);
    MockAssetUtil.setupIModelHubClientMock(iModelHubClientMock, assetDir);
    MockAssetUtil.setupIModelVersionMock(iModelVersionMock);

    BriefcaseManager.hubClient = iModelHubClientMock.object;

    // Get test projectId from the mocked connection client
    const project: Project = await connectClientMock.object.getProject(spoofAccessToken as any, {
      $select: "*",
      $filter: "Name+eq+'NodeJstestproject'",
    });
    // connectClientMock.verify((f: ConnectClient) => f.getProject(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));
    assert(project && project.wsgId, "No projectId returned from connectionClient mock");
    testProjectId = project.wsgId;

    // Get test iModelIds from the mocked iModelHub client
    for (const iModelInfo of testIModels) {
      const iModels = await iModelHubClientMock.object.getIModels(spoofAccessToken as any, testProjectId, {
        $select: "*",
        $filter: `Name+eq+'${iModelInfo.name}'`,
      });
      assert(iModels.length > 0, `No IModels returned from iModelHubClient mock for ${iModelInfo.name} iModel`);
      assert(iModels[0].wsgId, `No IModelId returned for ${iModelInfo.name} iModel`);
      iModelInfo.id = iModels[0].wsgId;
      iModelInfo.localReadonlyPath = path.join(cacheDir, iModelInfo.id, "readOnly");
      iModelInfo.localReadWritePath = path.join(cacheDir, iModelInfo.id, "readWrite");

      // getChangeSets
      iModelInfo.changeSets = await iModelHubClientMock.object.getChangeSets(spoofAccessToken as any, iModelInfo.id, false);
      expect(iModelInfo.changeSets);

      // downloadChangeSets
      const csetDir = path.join(cacheDir, iModelInfo.id, "csets");
      await iModelHubClientMock.object.downloadChangeSets(iModelInfo.changeSets, csetDir);
    }
    MockAssetUtil.verifyIModelInfo(testIModels);

    console.log(`    ...getting information on Project+IModel+ChangeSets for test case from mock data: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console

  });

  it("should be able to open a first version IModel in Readonly mode", async () => {
    let onOpenCalled: boolean = false;
    const onOpenListener = (accessTokenIn: AccessToken, contextIdIn: string, iModelIdIn: string, openModeIn: OpenMode, _versionIn: IModelVersion) => {
      onOpenCalled = true;
      assert.deepEqual(accessTokenIn, spoofAccessToken);
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
    IModelDb.onOpened.addListener(onOpenedListener);

    // Act
    const iModel: IModelDb = await IModelDb.open(spoofAccessToken as any, testProjectId, testIModels[0].id, OpenMode.Readonly, iModelVersionMock.object);

    // Assert
    assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");
    assert(iModel.openMode === OpenMode.Readonly, "iModel not set to Readonly mode");

    assert.isTrue(onOpenedCalled);
    assert.isTrue(onOpenCalled);
    IModelDb.onOpen.removeListener(onOpenListener);
    IModelDb.onOpened.removeListener(onOpenedListener);

    expect(IModelJsFs.existsSync(testIModels[0].localReadonlyPath), "Local path to iModel does not exist");
    const files = IModelJsFs.readdirSync(path.join(testIModels[0].localReadonlyPath, "0"));
    expect(files.length).greaterThan(0, "iModel .bim file could not be read");
  });

  it("should create a new iModel", async () => {
    // Act
    const iModel: IModelDb = await IModelDb.create(spoofAccessToken as any, testProjectId, testIModels[1].name, testIModels[1].name);

    // Assert
    assert.exists(iModel, "No iModel returned from call to IModelDb.create");
    assert(iModel.iModelToken.iModelId === testIModels[1].id);

    expect(IModelJsFs.existsSync(testIModels[1].localReadWritePath), "Local path to iModel does not exist");
    const files = IModelJsFs.readdirSync(path.join(testIModels[1].localReadWritePath, "376"));
    expect(files.length).greaterThan(0, "iModel .bim file could not be read");
  });

  it("should be able to open a cached first version IModel in ReadWrite mode", async () => {
    // Act
    const iModel: IModelDb = await IModelDb.open(spoofAccessToken as any, testProjectId, testIModels[1].id, OpenMode.ReadWrite, iModelVersionMock.object); // Note: No frontend support for ReadWrite open yet
    // Assert
    assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");
    assert(iModel.openMode === OpenMode.ReadWrite, "iModel not set to ReadWrite mode");

    expect(IModelJsFs.existsSync(testIModels[1].localReadWritePath), "Local path to iModel does not exist");
    const files = IModelJsFs.readdirSync(testIModels[1].localReadWritePath);
    expect(files.length).greaterThan(0, "iModel .bim file could not be read");

    // iModel.close(accessToken);
  });

  it("should reuse open briefcases in Readonly mode", async () => {
    // Act
    let timer = new Timer("open briefcase first time");
    const iModel0: IModelDb = await IModelDb.open(spoofAccessToken as any, testProjectId, testIModels[0].id, OpenMode.Readonly, iModelVersionMock.object);
    assert.exists(iModel0, "No iModel returned from call to BriefcaseManager.open");
    assert(iModel0.iModelToken.iModelId === testIModels[0].id, "Incorrect iModel ID");
    timer.end();

    const briefcases = IModelJsFs.readdirSync(testIModels[0].localReadonlyPath);
    expect(briefcases.length).greaterThan(0, "iModel .bim file could not be read");

    timer = new Timer("open briefcase 5 more times");
    const iModels = new Array<IModelDb>();
    for (let ii = 0; ii < 5; ii++) {
      const iModel: IModelDb = await IModelDb.open(spoofAccessToken as any, testProjectId, testIModels[0].id, OpenMode.Readonly, iModelVersionMock.object);
      assert.exists(iModel, "No iModel returned from repeat call to BriefcaseManager.open");
      iModels.push(iModel);
    }
    timer.end();

    // Assert
    const briefcases2 = IModelJsFs.readdirSync(testIModels[0].localReadonlyPath);
    expect(briefcases2.length).equals(briefcases.length, "Extra or missing briefcases detected in the cache");
    const diff = briefcases2.filter((item) => briefcases.indexOf(item) < 0);
    expect(diff.length).equals(0, "Briefcase changed after repeat calls to BriefcaseManager.open");
  });

  it("should reuse open briefcases in ReadWrite mode", async () => {
    // Act
    let timer = new Timer("open briefcase first time");
    const iModel0: IModelDb = await IModelDb.open(spoofAccessToken as any, testProjectId, testIModels[1].id, OpenMode.Readonly, iModelVersionMock.object);
    assert.exists(iModel0, "No iModel returned from call to BriefcaseManager.open");
    assert(iModel0.iModelToken.iModelId === testIModels[1].id, "Incorrect iModel ID");
    timer.end();

    const briefcases = IModelJsFs.readdirSync(testIModels[1].localReadonlyPath);
    expect(briefcases.length).greaterThan(0, "iModel .bim file could not be read");

    timer = new Timer("open briefcase 5 more times");
    const iModels = new Array<IModelDb>();
    for (let ii = 0; ii < 5; ii++) {
      const iModel: IModelDb = await IModelDb.open(spoofAccessToken as any, testProjectId, testIModels[1].id, OpenMode.Readonly, iModelVersionMock.object);
      assert.exists(iModel, "No iModel returned from repeat call to BriefcaseManager.open");
      iModels.push(iModel);
    }
    timer.end();

    // Assert
    const briefcases2 = IModelJsFs.readdirSync(testIModels[1].localReadonlyPath);
    expect(briefcases2.length).equals(briefcases.length, "Extra or missing briefcases detected in the cache");
    const diff = briefcases2.filter((item) => briefcases.indexOf(item) < 0);
    expect(diff.length).equals(0, "Briefcase changed after repeat calls to BriefcaseManager.open");
  });

  it("should open a briefcase of an iModel with no versions", async () => {
    // Act
    const queryRes = await iModelHubClientMock.object.getIModels(spoofAccessToken as any, testProjectId, {
      $select: "*",
      $filter: "Name+eq+'" + testIModels[2].name + "'",
    });
    assert(queryRes.length === 1 && queryRes[0].wsgId, "Correct iModel not found");
    const iModelNoVerId = queryRes[0].wsgId;
    const iModelNoVer: IModelDb = await IModelDb.open(spoofAccessToken as any, testProjectId, iModelNoVerId, OpenMode.Readonly);

    // Assert
    assert.exists(iModelNoVer);
  });

  it.skip("should open briefcases of specific versions in Readonly mode", async () => {
    const testVersionNames = ["FirstVersion", "SecondVersion", "ThirdVersion"];
    const testElementCounts = [80, 81, 82];

    BriefcaseManager.hubClient = iModelHubClientMock.object;

    const iModelFirstVersion: IModelDb = await IModelDb.open(spoofAccessToken as any, testProjectId, testIModels[0].id, OpenMode.Readonly, IModelVersion.first());
    assert.exists(iModelFirstVersion);

    for (const [arrayIndex, versionName] of testVersionNames.entries()) {
      const iModelFromVersion: IModelDb = await IModelDb.open(spoofAccessToken as any, testProjectId, testIModels[0].id, OpenMode.Readonly, IModelVersion.asOfChangeSet(testIModels[0].changeSets[arrayIndex].wsgId));
      assert.exists(iModelFromVersion);

      const iModelFromChangeSet: IModelDb = await IModelDb.open(spoofAccessToken as any, testProjectId, testIModels[0].id, OpenMode.Readonly, IModelVersion.named(versionName));
      assert.exists(iModelFromChangeSet);

      const elementCount = getElementCount(iModelFromVersion);
      assert.equal(elementCount, testElementCounts[arrayIndex]);
    }

    const iModelLatestVersion: IModelDb = await IModelDb.open(spoofAccessToken as any, testProjectId, testIModels[0].id, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(iModelLatestVersion);
  });

  it.skip("should write to briefcase with optimistic concurrency", async () => {
    debugger; // tslint:disable-line:no-debugger
    // Inject hub client mock into the briefcase manager
    MockAssetUtil.setupHubMultiCodes(iModelHubClientMock, assetDir, testIModels[2].id, testIModels[2].name, false);
    BriefcaseManager.hubClient = iModelHubClientMock.object;

    let timer = new Timer("delete iModels");

    // Delete any existing iModels with the same name as the OpConTest iModel
    const iModels: HubIModel[] = await iModelHubClientMock.object.getIModels(spoofAccessToken as any, testProjectId, {
      $select: "*",
      $filter: "Name+eq+'" + testIModels[2].name + "'",
    });
    for (const iModel of iModels) {
      await iModelHubClientMock.object.deleteIModel(spoofAccessToken, testProjectId, iModel.wsgId);
    }
    timer.end();

    // Create a new iModel on the Hub (by uploading a seed file)
    timer = new Timer("create iModel");
    const rwIModel: IModelDb = await IModelDb.create(spoofAccessToken as any, testProjectId, testIModels[2].name, "TestSubject");
    const rwIModelId = rwIModel.iModelToken.iModelId;
    assert.isNotEmpty(rwIModelId);
    timer.end();

    timer = new Timer("make local changes");

    // Inject hub client mock into the new iModel's concurrency control
    rwIModel.concurrencyControl.setIModelHubClient(iModelHubClientMock.object);

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
    spatialCategoryId.toString();
    newCategoryCode.getValue();

    timer.end();

    timer = new Timer("query Codes I");

    // iModel.concurrencyControl should have recorded the codes that are required by the new elements.
    assert.isTrue(rwIModel.concurrencyControl.hasPendingRequests());
    assert.isTrue(await rwIModel.concurrencyControl.areAvailable(spoofAccessToken as any));

    timer.end();
    timer = new Timer("reserve Codes");

    // Reserve all of the codes that are required by the new model and category.
    try {
      await rwIModel.concurrencyControl.request(spoofAccessToken as any);
    } catch (err) {
      if (err instanceof ConcurrencyControl.RequestError) {
        assert.fail(JSON.stringify(err.unavailableCodes) + ", " + JSON.stringify(err.unavailableLocks));
      }
    }
    // Reconfigure the corresponding setup calls to now return reserved codes on .getMultipleCodes(...)
    MockAssetUtil.setupHubMultiCodes(iModelHubClientMock, assetDir, testIModels[2].id, testIModels[2].name, true);

    timer.end();
    timer = new Timer("query Codes II");

    // Verify that the codes are reserved.
    const category = rwIModel.elements.getElement(spatialCategoryId);
    assert.isTrue(category.code.value !== undefined);
    const codeStates: MultiCode[] = await rwIModel.concurrencyControl.codes.query(spoofAccessToken as any, category.code.spec, category.code.scope);
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
    await rwIModel.pushChanges(spoofAccessToken as any);
    const postPushChangeSetId = rwIModel.iModelToken.changeSetId;
    assert(!!postPushChangeSetId);
    expect(prePushChangeSetId !== postPushChangeSetId);

    timer.end();

    // // Open a readonly copy of the iModel
    // const roIModel: IModelDb = await IModelDb.open(accessToken, testProjectId, rwIModelId!, OpenMode.Readonly, IModelVersion.latest());
    // assert.exists(roIModel);

    // rwIModel.close(accessToken, KeepBriefcase.No);
    // roIModel.close(accessToken);
  });

});
