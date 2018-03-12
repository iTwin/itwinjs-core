import * as TypeMoq from "typemoq";
import * as path from "path";
import { expect, assert } from "chai";
import { IModelJsFs } from "../../IModelJsFs";
import { OpenMode } from "@bentley/bentleyjs-core";
import { SeedFile, RequestQueryOptions } from "@bentley/imodeljs-clients";
import { IModelVersion } from "@bentley/imodeljs-common";
import { IModelHost } from "../../IModelHost";
import { BriefcaseManager, BriefcaseEntry } from "../../BriefcaseManager";
import {
  AccessToken, UserProfile, ConnectClient, Project, IModelHubClient, WsgInstance, ECJsonTypeMap,
  Response, ChangeSet, IModel as HubIModel, Briefcase,
} from "@bentley/imodeljs-clients";

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
    return new UserProfile ("test", "user", "testuser001@mailinator.com", "12345", "Bentley");
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

describe.only("BriefcaseManagerUnitTests", () => {
  const spoofAccessToken: MockAccessToken = new MockAccessToken();
  let testProjectId: string;
  // let testChangeSets: ChangeSet[];
  // const testVersionNames = ["FirstVersion", "SecondVersion", "ThirdVersion"];
  const testIModels: TestIModelInfo[] = [
    new TestIModelInfo("ReadOnlyTest"),
    new TestIModelInfo("TestModel"),
    new TestIModelInfo("NoVersionsTest"),
  ];
  const assetDir = "./test/assets/_mocks_";

  const iModelHubClientMock = TypeMoq.Mock.ofType(IModelHubClient);
  const iModelVersionMock = TypeMoq.Mock.ofType(IModelVersion);
  const connectClientMock = TypeMoq.Mock.ofType(ConnectClient);

  before(async () => {
    const startTime = new Date().getTime();
    const cacheDir = IModelHost.configuration!.briefcaseCacheDir;

    console.log("    Setting up mock objects..."); // tslint:disable-line:no-console

    MockAssetUtil.setupConnectClientMock(connectClientMock);
    MockAssetUtil.setupIModelHubClientMock(iModelHubClientMock);
    MockAssetUtil.setupIModelVersionMock(iModelVersionMock);

    // Get test projectId from the mocked connection client
    const project: Project = await connectClientMock.object.getProject(spoofAccessToken as any, {
      $select: "*",
      $filter: "Name+eq+'NodeJstestproject'",
    });
    connectClientMock.verify((f: ConnectClient) => f.getProject(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));
    assert(project && project.wsgId, "Unexpected projectId returned from connectionClient mock");
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
      iModelInfo.localReadonlyPath = path.join(cacheDir, iModelInfo.name, "readOnly");
      iModelInfo.localReadWritePath = path.join(cacheDir, iModelInfo.name, "readWrite");

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

  it.only("should be able to open a cached first version IModel in Readonly mode", async () => {
    // Arrange
    BriefcaseManager.hubClient = iModelHubClientMock.object;

    // Act
    const iModel: BriefcaseEntry = await BriefcaseManager.open(spoofAccessToken as any, testProjectId, testIModels[1].id, OpenMode.Readonly, iModelVersionMock.object);

    // Assert
    assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");
    assert(iModel.openMode === OpenMode.Readonly, "iModel not set to Readonly mode");

    expect(IModelJsFs.existsSync(testIModels[1].localReadonlyPath), "Local path to iModel does not exist");
    const files = IModelJsFs.readdirSync(testIModels[1].localReadonlyPath);
    expect(files.length).greaterThan(0, "iModel .bim file could not be read");

    iModelVersionMock.verify((f: IModelVersion) => f.evaluateChangeSet(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());
  });

  it("should be able to open a cached first version IModel in ReadWrite mode", async () => {
    // Arrange
    iModelHubClientMock.setup((f: IModelHubClient) => f.acquireBriefcase(TypeMoq.It.isAny(), TypeMoq.It.isValue("b74b6451-cca3-40f1-9890-42c769a28f3e")))
      .returns(() => Promise.resolve(89));
    iModelHubClientMock.setup((f: IModelHubClient) => f.getBriefcase(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyNumber(), TypeMoq.It.isValue(true)))
      .returns(() => {
        const sampleIModelPath = path.join(assetDir, "JSON", "ReadWriteBriefcase.json");
        const buff = IModelJsFs.readFileSync(sampleIModelPath);
        const jsonObj = JSON.parse(buff.toString())[0];
        return Promise.resolve(getTypedInstance<Briefcase>(Briefcase, jsonObj));
      }).verifiable();
    // iModelHubClientMock.setup((f: IModelHubClient) => f.getBriefcases(TypeMoq.It.isAny(), TypeMoq.It.isAnyString()))
    //   .returns(() => {
    //   }).verifiable();

    BriefcaseManager.hubClient = iModelHubClientMock.object;

    // Act
    const iModel: BriefcaseEntry = await BriefcaseManager.open(spoofAccessToken as any, testProjectId, testIModels[0].id, OpenMode.ReadWrite, iModelVersionMock.object); // Note: No frontend support for ReadWrite open yet
    // Assert
    assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");
    assert(iModel.openMode === OpenMode.ReadWrite, "iModel not set to ReadWrite mode");

    expect(IModelJsFs.existsSync(testIModels[0].localReadWritePath), "Local path to iModel does not exist");
    const files = IModelJsFs.readdirSync(testIModels[0].localReadWritePath);
    expect(files.length).greaterThan(0, "iModel .bim file could not be read");

    // iModel.close(accessToken);
  });

  it("should reuse open briefcases in Readonly mode", async () => {
    // Arrange
    iModelVersionMock.setup((f: IModelVersion) => f.evaluateChangeSet(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
      .returns(() => Promise.resolve(""));
    BriefcaseManager.hubClient = iModelHubClientMock.object;

    // Act
    let timer = new Timer("open briefcase first time");
    const iModel0: BriefcaseEntry = await BriefcaseManager.open(spoofAccessToken as any, testProjectId, testIModels[1].id, OpenMode.Readonly, iModelVersionMock.object);
    assert.exists(iModel0, "No iModel returned from call to BriefcaseManager.open");
    assert(iModel0.iModelId === testIModels[1].id, "Incorrect iModel ID");
    timer.end();

    const briefcases = IModelJsFs.readdirSync(testIModels[1].localReadonlyPath);
    expect(briefcases.length).greaterThan(0, "iModel .bim file could not be read");

    timer = new Timer("open briefcase 5 more times");
    const iModels = new Array<BriefcaseEntry>();
    for (let ii = 0; ii < 5; ii++) {
      const iModel: BriefcaseEntry = await BriefcaseManager.open(spoofAccessToken as any, testProjectId, testIModels[1].id, OpenMode.Readonly, iModelVersionMock.object);
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
});

class MockAssetUtil {
  // private static iModelNames = ["ReadOnlyTest", "TestModel", "NoVersionsTest"];
  // private static iModelIds = ["c3e1146f-8c81-430d-a974-ac840657b7ac", "b74b6451-cca3-40f1-9890-42c769a28f3e", "519baacf-5a34-459e-bf8c-31535e21777b"];
  private static iModelMap = new Map<string, string>([["c3e1146f-8c81-430d-a974-ac840657b7ac", "ReadOnlyTest"],
                                                        ["b74b6451-cca3-40f1-9890-42c769a28f3e", "TestModel"],
                                                        ["0aea4c09-09f4-449d-bf47-045228d259ba", "NoVersionsTest"]]); // <IModelID, IModelName>
  private static assetDir: string = "./test/assets/_mocks_";

  public static verifyIModelInfo(testIModelInfos: TestIModelInfo[]) {
    assert(testIModelInfos.length === this.iModelMap.size, "IModelInfo array has the wrong number of entries");
    assert(testIModelInfos[0].name === this.iModelMap.get("c3e1146f-8c81-430d-a974-ac840657b7ac"), "Bad information for ReadOnlyTest iModel");
    assert(testIModelInfos[1].name === this.iModelMap.get("b74b6451-cca3-40f1-9890-42c769a28f3e"), "Bad information for TestModel iModel");
    assert(testIModelInfos[2].name === this.iModelMap.get("0aea4c09-09f4-449d-bf47-045228d259ba"), "Bad information for NoVersionsTest iModel");
  }

  // TODO: setup for multiple versions...
  public static async setupIModelVersionMock(iModelVersionMock: TypeMoq.IMock<IModelVersion>) {
    iModelVersionMock.setup((f: IModelVersion) => f.evaluateChangeSet(TypeMoq.It.isAny(),
                                                                      TypeMoq.It.isAnyString(),
                                                                      TypeMoq.It.isAny()))
      .returns(() => Promise.resolve(""));
  }

  // TODO: figure out support for multiple projects (if we need it?)
  public static async setupConnectClientMock(connectClientMock: TypeMoq.IMock<ConnectClient>) {
    connectClientMock.setup((f: ConnectClient) => f.getProject(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(() => {
      const assetPath = path.join(this.assetDir, "JSON", "SampleProject.json");
      const buff = IModelJsFs.readFileSync(assetPath);
      const jsonObj = JSON.parse(buff.toString())[0];
      return Promise.resolve(getTypedInstance<Project>(Project, jsonObj));
    }).verifiable();
  }

  public static async setupIModelHubClientMock(iModelHubClientMock: TypeMoq.IMock<IModelHubClient>) {
    const seedFileMock = TypeMoq.Mock.ofType(SeedFile);
    seedFileMock.object.downloadUrl = "www.bentley.com";
    seedFileMock.object.mergedChangeSetId = "";

    for (const pair of this.iModelMap) {
      iModelHubClientMock.setup((f: IModelHubClient) => f.getIModels(TypeMoq.It.isAny(),
                                                                     TypeMoq.It.isAnyString(),
                                                                     TypeMoq.It.is<RequestQueryOptions>((x: RequestQueryOptions) => x.$filter!.includes(pair[1]))))
        .returns(() => {
          const sampleIModelPath = path.join(this.assetDir, "JSON", `${pair[1]}.json`);
          const buff = IModelJsFs.readFileSync(sampleIModelPath);
          const jsonObj = JSON.parse(buff.toString());
          return Promise.resolve(getTypedInstances<HubIModel>(HubIModel, jsonObj));
        }).verifiable();
      iModelHubClientMock.setup((f: IModelHubClient) => f.getChangeSets(TypeMoq.It.isAny(),
                                                                        TypeMoq.It.is<string>((x: string) => x.includes(pair[1])),
                                                                        TypeMoq.It.isAny()))
        .returns(() => {
          const sampleChangeSetPath = path.join(this.assetDir, "JSON", `${pair[1]}ChangeSets.json`);
          const buff = IModelJsFs.readFileSync(sampleChangeSetPath);
          const jsonObj = JSON.parse(buff.toString());
          return Promise.resolve(getTypedInstances<ChangeSet>(ChangeSet, jsonObj));
        }).verifiable();
      iModelHubClientMock.setup((f: IModelHubClient) => f.downloadFile(TypeMoq.It.isAnyString(),
                                                                       TypeMoq.It.is<string>((x: string) => x.includes(pair[1]))))
        .returns((seedUrl: string, seedPathname: string) => {
          seedUrl.italics();
          const testModelPath = path.join(this.assetDir, pair[1], `${pair[1]}.bim`);
          IModelJsFs.copySync(testModelPath, seedPathname);
          const retResponse: Response = {
            status: 200,
            header: undefined,
            body: undefined,
          };
          return Promise.resolve(retResponse)
          .then(() => Promise.resolve());
        });
      iModelHubClientMock.setup((f: IModelHubClient) => f.downloadChangeSets(TypeMoq.It.isAny(),
                                                                             TypeMoq.It.is<string>((x: string) => x.includes(pair[1]))))
        .returns((boundCsets: ChangeSet[], outPath: string) => {
          for (const changeSet of boundCsets) {
            const filePath = path.join(this.assetDir, pair[1], "csets", changeSet.fileName!);
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

    // TODO: get sample IModel JSON objs for both noversion and test imodels
      iModelHubClientMock.setup((f: IModelHubClient) => f.getIModel(TypeMoq.It.isAny(),
                                                                    TypeMoq.It.isAnyString(),
                                                                    TypeMoq.It.is<string>((x: string) => x === pair[0])))
        .returns(() => {
          const sampleIModelPath = path.join(this.assetDir, "JSON", `${pair[1]}.json`);
          const buff = IModelJsFs.readFileSync(sampleIModelPath);
          const jsonObj = JSON.parse(buff.toString())[0];
          return Promise.resolve(getTypedInstance<HubIModel>(HubIModel, jsonObj));
        }).verifiable();
      iModelHubClientMock.setup((f: IModelHubClient) => f.getSeedFiles(TypeMoq.It.isAny(),
                                                                       TypeMoq.It.is<string>((x: string) => x === pair[0]),
                                                                       TypeMoq.It.isValue(true),
                                                                       TypeMoq.It.isAny()))
        .returns(() => {
          const seedFiles = new Array<SeedFile>();
          seedFiles.push(seedFileMock.object);
          return Promise.resolve(seedFiles);
        }).verifiable();
      // iModelHubClientMock.setup((f: IModelHubClient) => f.getChangeSet(TypeMoq.It.isAny(),
      //                                                                  TypeMoq.It.is<string>((x: string) => x === pair[0]),
      //                                                                  TypeMoq.It.isAnyString()/*contained within an array of valid changesets*/,
      //                                                                  TypeMoq.It.isValue(false)))
      //   .returns(() => {
      //     const sampleChangeSetsPath = path.join(this.assetDir, "JSON", "SampleChangeSets.json");
      //     const buff = IModelJsFs.readFileSync(sampleChangeSetsPath);
      //     const jsonObj = JSON.parse(buff.toString());
      //     const sampleChangeSets = getTypedInstances<ChangeSet>(ChangeSet, jsonObj);
      //     return Promise.resolve(sampleChangeSets[0]);
      //   }).verifiable();
    }
  }
}
