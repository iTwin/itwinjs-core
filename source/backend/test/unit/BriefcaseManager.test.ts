import * as TypeMoq from "typemoq";
import * as path from "path";
import { expect, assert } from "chai";
import { IModelJsFs } from "../../IModelJsFs";
import { OpenMode, Id64 } from "@bentley/bentleyjs-core";
import { SeedFile, SeedFileInitState, RequestQueryOptions } from "@bentley/imodeljs-clients";
import { Appearance, ColorDef, IModelVersion, IModel } from "@bentley/imodeljs-common";
import { IModelTestUtils } from "../IModelTestUtils";
import { /*KeepBriefcase,*/ BriefcaseManager, ConcurrencyControl, DictionaryModel, Element, IModelDb, IModelHost } from "../../backend";
import {
  AccessToken, UserProfile, ConnectClient, Project, IModelHubClient, WsgInstance, ECJsonTypeMap,
  Response, ChangeSet, IModel as HubIModel, Briefcase, MultiCode, CodeState,
} from "@bentley/imodeljs-clients";

// debugger; // tslint:disable-line:no-debugger

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

class TestIModelInfo {
  private _name: string;
  private _id: string;
  private _localReadonlyPath: string;
  private _localReadWritePath: string;

  constructor(name: string) { this._name = name; }

  get name(): string { return this._name; }
  set name(name: string) { this._name = name; }
  get id(): string { return this._id; }
  set id(id: string) { this._id = id; }
  get localReadonlyPath(): string { return this._localReadonlyPath; }
  set localReadonlyPath(localReadonlyPath: string) { this._localReadonlyPath = localReadonlyPath; }
  get localReadWritePath(): string { return this._localReadWritePath; }
  set localReadWritePath(localReadWritePath: string) { this._localReadWritePath = localReadWritePath; }
}

/** Class to allow mocking of accessToken needed for various client operations */
class MockAccessToken extends AccessToken {
  public constructor() { super(""); }
  public getUserProfile(): UserProfile|undefined {
    return new UserProfile ("test", "user", "testuser001@mailinator.com", "596c0d8b-eac2-46a0-aa4a-b590c3314e7c", "Bentley");
  }
  public toTokenString() { return ""; }
}

/** Parse a single typed instance from a JSON string using ECJsonTypeMap */
const getTypedInstance = <T extends WsgInstance>(typedConstructor: new () => T, jsonBody: any): T => {
  const instance: T | undefined = ECJsonTypeMap.fromJson<T>(typedConstructor, "wsg", jsonBody);
  if (!instance) { throw new Error("Unable to parse JSON into typed instance"); }
  return instance!;
};

/** Parse multiple typed instances from a JSON string using ECJsonTypeMap */
const getTypedInstances = <T extends WsgInstance>(typedConstructor: new () => T, jsonBody: any): T[] => {
  const instances: T[] = new Array<T>();
  for (const ecJsonInstance of jsonBody) {
    const typedInstance: T | undefined = ECJsonTypeMap.fromJson<T>(typedConstructor, "wsg",  ecJsonInstance);
    if (typedInstance) { instances.push(typedInstance); }
  }
  return instances;
};

describe("BriefcaseManagerUnitTests", () => {
  let testProjectId: string;
  const testIModels: TestIModelInfo[] = [
    new TestIModelInfo("ReadOnlyTest"),
    new TestIModelInfo("ReadWriteTest"),
    new TestIModelInfo("OpConTest"),
    new TestIModelInfo("NoVersionsTest"),
  ];
  const assetDir = "./test/assets/_mocks_";

  const spoofAccessToken: MockAccessToken = new MockAccessToken();
  const iModelHubClientMock = TypeMoq.Mock.ofType(IModelHubClient);
  const iModelVersionMock = TypeMoq.Mock.ofType(IModelVersion);
  const connectClientMock = TypeMoq.Mock.ofType(ConnectClient);

  before(async () => {
    const startTime = new Date().getTime();
    const cacheDir = IModelHost.configuration!.briefcaseCacheDir;

    console.log("    Setting up mock objects..."); // tslint:disable-line:no-console

    MockAssetUtil.setupConnectClientMock(connectClientMock, assetDir);
    MockAssetUtil.setupIModelHubClientMock(iModelHubClientMock, assetDir);
    MockAssetUtil.setupIModelVersionMock(iModelVersionMock);

    // Get test projectId from the mocked connection client
    const project: Project = await connectClientMock.object.getProject(spoofAccessToken as any, {
      $select: "*",
      $filter: "Name+eq+'NodeJstestproject'",
    });
    connectClientMock.verify((f: ConnectClient) => f.getProject(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));
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

      // // getChangeSets
      // testChangeSets = await iModelHubClientMock.object.getChangeSets(spoofAccessToken as any, pair[0], false);
      // expect(testChangeSets.length).greaterThan(2);

      // downloadChangeSets (Not needed if we assume cache is in initialized state)
      // const csetDir = path.join(cacheDir, testIModelId, "csets");
      // await iModelHubClientMock.object.downloadChangeSets(testChangeSets, csetDir);
    }
    MockAssetUtil.verifyIModelInfo(testIModels);
    iModelHubClientMock.verify((f: IModelHubClient) => f.getIModels(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());
    // iModelHubClientMock.verify((f: IModelHubClient) => f.getChangeSets(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());

    console.log(`    ...getting information on Project+IModel+ChangeSets for test case from mock data: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console

  });

  it("should be able to open a first version IModel in Readonly mode", async () => {
    // Arrange

    BriefcaseManager.hubClient = iModelHubClientMock.object;

    // Act
    const iModel: IModelDb = await IModelDb.open(spoofAccessToken as any, testProjectId, testIModels[0].id, OpenMode.Readonly, iModelVersionMock.object);

    // Assert
    assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");
    assert(iModel.openMode === OpenMode.Readonly, "iModel not set to Readonly mode");

    expect(IModelJsFs.existsSync(testIModels[0].localReadonlyPath), "Local path to iModel does not exist");
    const files = IModelJsFs.readdirSync(path.join(testIModels[0].localReadonlyPath, "0"));
    expect(files.length).greaterThan(0, "iModel .bim file could not be read");
  });

  it.skip("should throw an error when opening a nonexistent IModel in ReadOnly mode", async () => {
    // Arrange
    const capturedError: Error = new Error("InstanceNotFound: Instance 'iModel' with specified ID was not found.");
    iModelHubClientMock.setup((f: IModelHubClient) => f.getIModel(TypeMoq.It.isAny(),
                                                                    TypeMoq.It.isAnyString(),
                                                                    TypeMoq.It.is<string>((x: string) => x === "000")))
      .callback((err: Error) => err = capturedError);

    BriefcaseManager.hubClient = iModelHubClientMock.object;

    debugger; // tslint:disable-line:no-debugger
    // Act
    const iModel: IModelDb = await IModelDb.open(spoofAccessToken as any, testProjectId, "000", OpenMode.Readonly, iModelVersionMock.object);

    // Assert
    assert.isUndefined(iModel, "An iModel was unexpectedly returned");
    assert.instanceOf<Error>(capturedError, Error, "Error was not thrown" );
  });

  it("should create a new iModel", async () => {
    // Delete the iModel if it currently exists in the cache. We're replacing it anyways
    if (IModelJsFs.existsSync(testIModels[1].localReadWritePath)) {
      IModelJsFs.removeSync(testIModels[1].localReadWritePath);
    }

    BriefcaseManager.hubClient = iModelHubClientMock.object;

    const iModel: IModelDb = await IModelDb.create(spoofAccessToken as any, testProjectId, testIModels[1].name, testIModels[1].name);

    assert.exists(iModel, "No iModel returned from call to IModelDb.create");
    assert(iModel.iModelToken.iModelId === testIModels[1].id);

    expect(IModelJsFs.existsSync(testIModels[1].localReadWritePath), "Local path to iModel does not exist");
    const files = IModelJsFs.readdirSync(path.join(testIModels[1].localReadWritePath, "376"));
    expect(files.length).greaterThan(0, "iModel .bim file could not be read");
  });

  it("should be able to open a cached first version IModel in ReadWrite mode", async () => {
    // Arrange
    iModelHubClientMock.setup((f: IModelHubClient) => f.acquireBriefcase(TypeMoq.It.isAny(), TypeMoq.It.isValue(testIModels[1].id)))
      .returns(() => Promise.resolve(999));

    BriefcaseManager.hubClient = iModelHubClientMock.object;

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
    // Arrange
    BriefcaseManager.hubClient = iModelHubClientMock.object;

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
    // Arrange
    BriefcaseManager.hubClient = iModelHubClientMock.object;

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

  it.only("should write to briefcase with optimistic concurrency", async () => {
    // NOTE: shouldn't need to delete anything from the hub since we're mocking...
    // let timer = new Timer("delete iModels");
    // // Delete any existing iModels with the same name as the read-write test iModel
    // const iModelName = "ReadWriteTest";
    // const iModels: HubIModel[] = await IModelTestUtils.hubClient.getIModels(accessToken, testProjectId, {
    //   $select: "*",
    //   $filter: "Name+eq+'" + iModelName + "'",
    // });
    // for (const iModelTemp of iModels) {
    //   await IModelTestUtils.hubClient.deleteIModel(accessToken, testProjectId, iModelTemp.wsgId);
    // }
    // timer.end();

    // Inject hub client mock into the briefcase manager
    MockAssetUtil.setupHubMultiCodes(iModelHubClientMock, assetDir, testIModels[2].id, testIModels[2].name, false);
    BriefcaseManager.hubClient = iModelHubClientMock.object;

    debugger; // tslint:disable-line:no-debugger
    // Create a new iModel on the Hub (by uploading a seed file)
    let timer = new Timer("create iModel");
    const rwIModel: IModelDb = await IModelDb.create(spoofAccessToken as any, testProjectId, testIModels[2].name, "TestSubject");
    const rwIModelId = rwIModel.iModelToken.iModelId;
    assert.isNotEmpty(rwIModelId);
    timer.end();

    timer = new Timer("make local changes");

    // Inject hub client mock into the new iModel's concurrency control
    rwIModel.concurrencyControl.hubClient = iModelHubClientMock.object;

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

/** Provides utility functions for working with mock objects */
class MockAssetUtil {
  private static iModelMap = new Map<string, string>([["c3e1146f-8c81-430d-a974-ac840657b7ac", "ReadOnlyTest"],
                                                      ["b74b6451-cca3-40f1-9890-42c769a28f3e", "ReadWriteTest"],
                                                      ["077e23a9-d974-408c-aeb8-79b01d37d289", "OpConTest"],
                                                      ["0aea4c09-09f4-449d-bf47-045228d259ba", "NoVersionsTest"]]); // <IModelID, IModelName>

  public static verifyIModelInfo(testIModelInfos: TestIModelInfo[]) {
    assert(testIModelInfos.length === this.iModelMap.size, "IModelInfo array has the wrong number of entries");
    for (const iModelInfo of testIModelInfos) {
      assert(iModelInfo.name === this.iModelMap.get(iModelInfo.id), `Bad information for ${iModelInfo.name} iModel`);
    }
  }

  // TODO: setup for multiple versions...
  /** Setup functions for the IModelVersion mock */
  public static async setupIModelVersionMock(iModelVersionMock: TypeMoq.IMock<IModelVersion>) {
    // For any valid parameters passed, return an empty string indicating first version
    iModelVersionMock.setup((f: IModelVersion) => f.evaluateChangeSet(TypeMoq.It.isAny(),
                                                                      TypeMoq.It.isAnyString(),
                                                                      TypeMoq.It.isAny()))
      .returns(() => Promise.resolve(""));

    // iModelVersionMock.setup((f: IModelVersion) => f.latest())
  }

  /** Setup functions for the ConnectClient mock */
  public static async setupConnectClientMock(connectClientMock: TypeMoq.IMock<ConnectClient>, assetDir: string) {
    // For any parameters passed, grab the Sample Project json file from the assets folder and parse it into an instance
    connectClientMock.setup((f: ConnectClient) => f.getProject(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(() => {
      const assetPath = path.join(assetDir, "Project", "SampleProject.json");
      const buff = IModelJsFs.readFileSync(assetPath);
      const jsonObj = JSON.parse(buff.toString())[0];
      return Promise.resolve(getTypedInstance<Project>(Project, jsonObj));
    }).verifiable();
  }

  /** Setup functions for the iModelHubClient mock */
  public static async setupIModelHubClientMock(iModelHubClientMock: TypeMoq.IMock<IModelHubClient>, assetDir: string) {
    const seedFileMock = TypeMoq.Mock.ofType(SeedFile);
    seedFileMock.object.downloadUrl = "www.bentley.com";
    seedFileMock.object.mergedChangeSetId = "";
    seedFileMock.object.initializationState = SeedFileInitState.Successful;

    // We need to set up unique return callbacks for all the iModels we have stored in the assets folder
    for (const pair of this.iModelMap) {
      // For any call with the specified iModel name, grab that iModel's json file and parse it into an instance
      iModelHubClientMock.setup((f: IModelHubClient) => f.createIModel(TypeMoq.It.isAny(),
                                                                       TypeMoq.It.isAnyString(),
                                                                       TypeMoq.It.is<string>((x: string) => x === pair[1]),
                                                                       TypeMoq.It.isAny()))
        .returns(() => {
          setTimeout(() => {}, 100);
          const sampleIModelPath = path.join(assetDir, pair[1], `${pair[1]}.json`);
          const buff = IModelJsFs.readFileSync(sampleIModelPath);
          const jsonObj = JSON.parse(buff.toString())[0];
          return Promise.resolve(getTypedInstance<HubIModel>(HubIModel, jsonObj));
        }).verifiable();

      iModelHubClientMock.setup((f: IModelHubClient) => f.uploadSeedFile(TypeMoq.It.isAny(),
                                                                         TypeMoq.It.is<string>((x: string) => x === pair[0]),
                                                                         TypeMoq.It.is<string>((x: string) => x.includes(pair[1])),
                                                                         TypeMoq.It.isAny()))
        .returns(() => Promise.resolve(seedFileMock.object));

      iModelHubClientMock.setup((f: IModelHubClient) => f.confirmUploadSeedFile(TypeMoq.It.isAny(),
                                                                                TypeMoq.It.is<string>((x: string) => x === pair[0]),
                                                                                TypeMoq.It.is<SeedFile>((x: SeedFile) => x.downloadUrl === seedFileMock.object.downloadUrl)))
        .returns(() => Promise.resolve(seedFileMock.object));

      // For any call with request parameters contianing the iModel name, grab that iModel's json file
      // and parse it into an instance
      iModelHubClientMock.setup((f: IModelHubClient) => f.getIModels(TypeMoq.It.isAny(),
                                                                     TypeMoq.It.isAnyString(),
                                                                     TypeMoq.It.is<RequestQueryOptions>((x: RequestQueryOptions) => x.$filter!.includes(pair[1]))))
        .returns(() => {
          const sampleIModelPath = path.join(assetDir, pair[1], `${pair[1]}.json`);
          const buff = IModelJsFs.readFileSync(sampleIModelPath);
          const jsonObj = JSON.parse(buff.toString());
          return Promise.resolve(getTypedInstances<HubIModel>(HubIModel, jsonObj));
        }).verifiable();

      // For any call with a specified iModelId, grab the iModel's json file and parse it into an instance
      iModelHubClientMock.setup((f: IModelHubClient) => f.getIModel(TypeMoq.It.isAny(),
                                                                    TypeMoq.It.isAnyString(),
                                                                    TypeMoq.It.is<string>((x: string) => x === pair[0])))
        .returns(() => {
          const sampleIModelPath = path.join(assetDir, pair[1], `${pair[1]}.json`);
          const buff = IModelJsFs.readFileSync(sampleIModelPath);
          const jsonObj = JSON.parse(buff.toString())[0];
          return Promise.resolve(getTypedInstance<HubIModel>(HubIModel, jsonObj));
        }).verifiable();

      // For any call with a path containing a specified iModel name, grab the correct .bim asset and copy it
      // into the provided cache location
      iModelHubClientMock.setup((f: IModelHubClient) => f.downloadFile(TypeMoq.It.isAnyString(),
                                                                       TypeMoq.It.is<string>((x: string) => x.includes(pair[1]))))
        .returns((seedUrl: string, seedPathname: string) => {
          seedUrl.italics();
          const testModelPath = path.join(assetDir, pair[1], `${pair[1]}.bim`);
          IModelJsFs.copySync(testModelPath, seedPathname);
          const retResponse: Response = {
            status: 200,
            header: undefined,
            body: undefined,
          };
          return Promise.resolve(retResponse)
          .then(() => Promise.resolve());
        });

      // For any call with a specified iModelId, return a dummy briefcaseId. If future test cases demand so, we may
      // need to change this to return specific briefcaseIds
      iModelHubClientMock.setup((f: IModelHubClient) => f.acquireBriefcase(TypeMoq.It.isAny(),
                                                                           TypeMoq.It.is<string>((x: string) => x === pair[0])))
        .returns(() => Promise.resolve(999));

      // For any call with the specified iModelId, grab the corresponding briefcase json file and parse it into
      // an instance. For now, we grab the same briefcase for each IModel regardless of the briefcaseId passed.
      // If future test cases demand so, we may need to support multiple briefcases per IModel.
      iModelHubClientMock.setup((f: IModelHubClient) => f.getBriefcase(TypeMoq.It.isAny(),
                                                                       TypeMoq.It.is<string>((x: string) => x === pair[0]),
                                                                       TypeMoq.It.isAnyNumber(),
                                                                       TypeMoq.It.isValue(true)))
      .returns(() => {
        const sampleIModelPath = path.join(assetDir, pair[1], `${pair[1]}Briefcase.json`);
        const buff = IModelJsFs.readFileSync(sampleIModelPath);
        const jsonObj = JSON.parse(buff.toString())[0];
        return Promise.resolve(getTypedInstance<Briefcase>(Briefcase, jsonObj));
      }).verifiable();

      // For any call with the specified iModelId, grab the corresponding breifcase json file and parse it into
      // an instance (we don't really care what else is in the cache, that's the point of mocking)
      iModelHubClientMock.setup((f: IModelHubClient) => f.getBriefcases(TypeMoq.It.isAny(),
                                                                        TypeMoq.It.is<string>((x: string) => x === pair[0])))
        .returns(() => {
          const sampleIModelPath = path.join(assetDir, pair[1], `${pair[1]}Briefcase.json`);
          const buff = IModelJsFs.readFileSync(sampleIModelPath);
          const jsonObj = JSON.parse(buff.toString())[0];
          const briefcaseInstance = getTypedInstance<Briefcase>(Briefcase, jsonObj);
          return Promise.resolve([briefcaseInstance]);
        }).verifiable();

      // For any call with a specified iModelId, grab the asset file with the associated changeset json objs
      // and parse them into instances
      iModelHubClientMock.setup((f: IModelHubClient) => f.getChangeSets(TypeMoq.It.isAny(),
                                                                        TypeMoq.It.is<string>((x: string) => x.includes(pair[0])),
                                                                        TypeMoq.It.isAny()))
        .returns(() => {
          const sampleChangeSetPath = path.join(assetDir, pair[1], `${pair[1]}ChangeSets.json`);
          const buff = IModelJsFs.readFileSync(sampleChangeSetPath);
          const jsonObj = JSON.parse(buff.toString());
          return Promise.resolve(getTypedInstances<ChangeSet>(ChangeSet, jsonObj));
        }).verifiable();

      // Same set up as before, but for calls with all optional parameters
      iModelHubClientMock.setup((f: IModelHubClient) => f.getChangeSets(TypeMoq.It.isAny(),
                                                                          TypeMoq.It.is<string>((x: string) => x === pair[0]),
                                                                          TypeMoq.It.isAny(),
                                                                          TypeMoq.It.isAny()))
        .returns(() => {
            const sampleChangeSetsPath = path.join(assetDir, pair[1], `${pair[1]}ChangeSets.json`);
            const buff = IModelJsFs.readFileSync(sampleChangeSetsPath);
            const jsonObj = JSON.parse(buff.toString());
            const sampleChangeSets = getTypedInstances<ChangeSet>(ChangeSet, jsonObj);
            return Promise.resolve(sampleChangeSets);
          }).verifiable();

      // For any call with a specified iModelId, grab the asset file with the associated changeset json objs
      // and parse them into instances
      iModelHubClientMock.setup((f: IModelHubClient) => f.getChangeSet(TypeMoq.It.isAny(),
                                                                        TypeMoq.It.is<string>((x: string) => x.includes(pair[0])),
                                                                        TypeMoq.It.isAnyString(),
                                                                        TypeMoq.It.isValue(false)))
        .returns(() => {
          const sampleChangeSetPath = path.join(assetDir, pair[1], `${pair[1]}ChangeSets.json`);
          const buff = IModelJsFs.readFileSync(sampleChangeSetPath);
          const jsonObj = JSON.parse(buff.toString())[0];
          return Promise.resolve(getTypedInstance<ChangeSet>(ChangeSet, jsonObj));
        }).verifiable();

      // For any call with a path containing a specified iModel name, grab the associated change set files and copy them
      // into the provided cache location
      iModelHubClientMock.setup((f: IModelHubClient) => f.downloadChangeSets(TypeMoq.It.isAny(),
                                                                             TypeMoq.It.is<string>((x: string) => x.includes(pair[0]))))
        .returns((boundCsets: ChangeSet[], outPath: string) => {
          for (const changeSet of boundCsets) {
            const filePath = path.join(assetDir, pair[1], "csets", changeSet.fileName!);
            const outFilePath = path.join(outPath, changeSet.fileName!);
            IModelJsFs.copySync(filePath, outFilePath);
          }
          const retResponse: Response = {
            status: 200,
            header: undefined,
            body: undefined,
          };
          return Promise.resolve(retResponse)
          .then(() => Promise.resolve());
        }).verifiable();
      }

    // For any parameters passed, return a seedFile mock
    iModelHubClientMock.setup((f: IModelHubClient) => f.getSeedFiles(TypeMoq.It.isAny(),
                                                                          TypeMoq.It.isAnyString(),
                                                                          TypeMoq.It.isValue(true),
                                                                          TypeMoq.It.isAny()))
      .returns(() => {
        const seedFiles = new Array<SeedFile>();
        seedFiles.push(seedFileMock.object);
        return Promise.resolve(seedFiles);
      }).verifiable();
  }

  public static setupHubMultiCodes(iModelHubClientMock: TypeMoq.IMock<IModelHubClient>, assetDir: string, iModelId: string, iModelName: string, isReserved: boolean) {
    const codeInfoMap: Map<string, string> = new Map<string, string>([["0x1d", "0x1"], ["0x16", "0x10"], ["0x1e", "0x1780000000002"]]);
    for (const [codeSpecId, codeScope] of codeInfoMap) {
      iModelHubClientMock.setup((f: IModelHubClient) => f.getMultipleCodes(TypeMoq.It.isAny(),
                                                                           TypeMoq.It.is<string>((x: string) => x === iModelId),
                                                                           TypeMoq.It.is<RequestQueryOptions>((x: RequestQueryOptions) => x.$filter!.includes(codeScope)
                                                                                                                                       && x.$filter!.includes(codeSpecId))))
        .returns(() => {
          let codeType: string = "Used";
          if (isReserved)
            codeType = "Reserved";
          const sampleIModelPath = path.join(assetDir, iModelName, "codes", `${iModelName}${codeType}${codeSpecId}.json`);
          const buff = IModelJsFs.readFileSync(sampleIModelPath);
          const jsonObj = JSON.parse(buff.toString());
          return Promise.resolve(getTypedInstances<MultiCode>(MultiCode, jsonObj));
        }).verifiable();

      iModelHubClientMock.setup((f: IModelHubClient) => f.requestMultipleCodes(TypeMoq.It.isAny(),
                                                                               TypeMoq.It.is<string>((x: string) => x === iModelId),
                                                                               TypeMoq.It.is<MultiCode>((x: MultiCode) => x.codeScope === codeScope && x.codeSpecId === codeSpecId)))
        .returns(() => {
          const sampleIModelPath = path.join(assetDir, iModelName, "codes", `${iModelName}Reserved${codeSpecId}.json`);
          const buff = IModelJsFs.readFileSync(sampleIModelPath);
          const jsonObj = JSON.parse(buff.toString())[0];
          return Promise.resolve(getTypedInstance<MultiCode>(MultiCode, jsonObj));
        }).verifiable();
    }
  }
}
