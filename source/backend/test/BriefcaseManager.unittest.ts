import * as TypeMoq from "typemoq";
import * as path from "path";
import { expect, assert } from "chai";
import { IModelJsFs } from "../IModelJsFs";
import { OpenMode } from "@bentley/bentleyjs-core";
import { SeedFile } from "@bentley/imodeljs-clients";
import { IModelVersion } from "@bentley/imodeljs-common";
import { IModelHost } from "../IModelHost";
import {
  AccessToken, UserProfile, ConnectClient, Project, IModelHubClient, WsgInstance, ECJsonTypeMap,
  Response, ChangeSet, IModel as HubIModel, Briefcase,
} from "@bentley/imodeljs-clients";
import { BriefcaseManager, BriefcaseEntry } from "../BriefcaseManager";

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

class MockAccessToken extends AccessToken {
  public constructor() { super(""); }
  public getUserProfile(): UserProfile|undefined {
    return new UserProfile ("test", "user", "testuser001@mailinator.com", "12345", "Bentley");
  }
  public toTokenString() { return ""; }
}

const getTypedInstance = <T extends WsgInstance>(typedConstructor: new () => T, jsonBody: any): T => {
  const instance: T | undefined = ECJsonTypeMap.fromJson<T>(typedConstructor, "wsg", jsonBody);
  if (!instance) { throw new Error("Unable to parse JSON into typed instance"); }
  return instance!;
};

const getTypedInstances = <T extends WsgInstance>(typedConstructor: new () => T, jsonBody: any): T[] => {
  const instances: T[] = new Array<T>();
  for (const ecJsonInstance of jsonBody) {
    const typedInstance: T | undefined = ECJsonTypeMap.fromJson<T>(typedConstructor, "wsg",  ecJsonInstance);
    if (typedInstance) { instances.push(typedInstance); }
  }
  return instances;
};

describe("BriefcaseManagerUnitTests", () => {
  const spoofAccessToken: MockAccessToken = new MockAccessToken();
  let testProjectId: string;
  let testIModelId: string;
  let testChangeSets: ChangeSet[];
  // const testVersionNames = ["FirstVersion", "SecondVersion", "ThirdVersion"];
  // const iModelNames = ["TestModel", "NoVersionsTest"];
  // const testElementCounts = [80, 81, 82];
  let iModelLocalReadonlyPath: string;
  let iModelLocalReadWritePath: string;
  const assetDir = "./test/assets/_mocks_";

  const iModelHubClientMock = TypeMoq.Mock.ofType(IModelHubClient);
  const iModelVersionMock = TypeMoq.Mock.ofType(IModelVersion);
  const connectClientMock = TypeMoq.Mock.ofType(ConnectClient);

  before(async () => {
    const startTime = new Date().getTime();

    console.log("    Started monitoring briefcase manager performance..."); // tslint:disable-line:no-console

    MockAssetUtil.setupConnectClientMock(connectClientMock);
    MockAssetUtil.setupIModelHubClientMock(iModelHubClientMock);
    MockAssetUtil.setupIModelVersionMock(iModelVersionMock);

    // getTestProjectId()
    const project: Project = await connectClientMock.object.getProject(spoofAccessToken as any, {
      $select: "*",
      $filter: "Name+eq+'NodeJstestproject'",
    });
    connectClientMock.verify((f: ConnectClient) => f.getProject(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));
    assert(project && project.wsgId);
    testProjectId = project.wsgId;

    // getTestModelId
    const iModels = await iModelHubClientMock.object.getIModels(spoofAccessToken as any, testProjectId, {
      $select: "*",
      $filter: "Name+eq+'TestModel'",
    });
    iModelHubClientMock.verify((f: IModelHubClient) => f.getIModels(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));
    assert(iModels.length > 0);
    assert(iModels[0].wsgId);
    testIModelId = iModels[0].wsgId;

    // getChangeSets
    testChangeSets = await iModelHubClientMock.object.getChangeSets(spoofAccessToken as any, testIModelId, false);
    iModelHubClientMock.verify((f: IModelHubClient) => f.getChangeSets(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));
    expect(testChangeSets.length).greaterThan(2);

    // downloadChangeSets (Not needed if we assume cache is in initialized state)
    const cacheDir = IModelHost.configuration!.briefcaseCacheDir;
    // const csetDir = path.join(cacheDir, testIModelId, "csets");
    // await iModelHubClientMock.object.downloadChangeSets(testChangeSets, csetDir);

    console.log(`    ...getting information on Project+IModel+ChangeSets for test case from mock data: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console

    iModelLocalReadonlyPath = path.join(cacheDir, testIModelId, "readOnly");
    iModelLocalReadWritePath = path.join(cacheDir, testIModelId, "readWrite");
  });

  it.skip("should be able to open a cached first version IModel in Readonly mode", async () => {
    // Arrange
    BriefcaseManager.hubClient = iModelHubClientMock.object;

    // Act
    const iModel: BriefcaseEntry = await BriefcaseManager.open(spoofAccessToken as any, testProjectId, testIModelId, OpenMode.Readonly, iModelVersionMock.object);

    // Assert
    assert.exists(iModel);
    assert(iModel.openMode === OpenMode.Readonly);

    expect(IModelJsFs.existsSync(iModelLocalReadonlyPath));
    const files = IModelJsFs.readdirSync(iModelLocalReadonlyPath);
    expect(files.length).greaterThan(0);

    iModelVersionMock.verify((f: IModelVersion) => f.evaluateChangeSet(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());
  });

  it.skip("should be able to open a cached first version IModel in ReadWrite mode", async () => {
    // Arrange
    iModelHubClientMock.setup((f: IModelHubClient) => f.acquireBriefcase(TypeMoq.It.isAny(), TypeMoq.It.isAnyString()))
      .returns(() => Promise.resolve(1));
    iModelHubClientMock.setup((f: IModelHubClient) => f.getBriefcase(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyNumber(), TypeMoq.It.isValue(true)))
      .returns(() => {
        const sampleIModelPath = path.join(assetDir, "JSON", "SampleBriefcase.json");
        const buff = IModelJsFs.readFileSync(sampleIModelPath);
        const jsonObj = JSON.parse(buff.toString())[0];
        return Promise.resolve(getTypedInstance<Briefcase>(Briefcase, jsonObj));
      }).verifiable();
    // iModelHubClientMock.setup((f: IModelHubClient) => f.getBriefcases(TypeMoq.It.isAny(), TypeMoq.It.isAnyString()))
    //   .returns(() => {
    //   }).verifiable();

    BriefcaseManager.hubClient = iModelHubClientMock.object;

    const iModel: BriefcaseEntry = await BriefcaseManager.open(spoofAccessToken as any, testProjectId, testIModelId, OpenMode.ReadWrite, iModelVersionMock.object); // Note: No frontend support for ReadWrite open yet
    assert.exists(iModel);
    // assert(iModel.iModelToken.openMode === OpenMode.ReadWrite);

    expect(IModelJsFs.existsSync(iModelLocalReadWritePath));
    const files = IModelJsFs.readdirSync(iModelLocalReadWritePath);
    expect(files.length).greaterThan(0);

    // iModel.close(accessToken);
  });

  it.skip("should reuse open briefcases in Readonly mode", async () => {
    // Arrange
    iModelVersionMock.setup((f: IModelVersion) => f.evaluateChangeSet(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
      .returns(() => Promise.resolve(""));
    BriefcaseManager.hubClient = iModelHubClientMock.object;

    // Act
    let timer = new Timer("open briefcase first time");
    const iModel0: BriefcaseEntry = await BriefcaseManager.open(spoofAccessToken as any, testProjectId, testIModelId, OpenMode.Readonly, iModelVersionMock.object);
    assert.exists(iModel0);
    assert(iModel0.iModelId === testIModelId);
    timer.end();

    const briefcases = IModelJsFs.readdirSync(iModelLocalReadonlyPath);
    expect(briefcases.length).greaterThan(0);

    timer = new Timer("open briefcase 5 more times");
    const iModels = new Array<BriefcaseEntry>();
    for (let ii = 0; ii < 5; ii++) {
      const iModel: BriefcaseEntry = await BriefcaseManager.open(spoofAccessToken as any, testProjectId, testIModelId, OpenMode.Readonly, iModelVersionMock.object);
      assert.exists(iModel);
      iModels.push(iModel);
    }
    timer.end();

    // Assert
    const briefcases2 = IModelJsFs.readdirSync(iModelLocalReadonlyPath);
    expect(briefcases2.length).equals(briefcases.length);
    const diff = briefcases2.filter((item) => briefcases.indexOf(item) < 0);
    expect(diff.length).equals(0);
  });
});

export class MockAssetUtil {
  private static iModelNames = ["TestModel", "NoVersionsTest"];
  private static iModelIds = ["b74b6451-cca3-40f1-9890-42c769a28f3e", ""]; // TODO: Grab second ID
  private static assetDir: string = "./test/assets/_mocks_";

  // TODO: setup for multiple versions...
  public static async setupIModelVersionMock(iModelVersionMock: TypeMoq.IMock<IModelVersion>) {
    iModelVersionMock.setup((f: IModelVersion) => f.evaluateChangeSet(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
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
    iModelHubClientMock.setup((f: IModelHubClient) => f.getIModels(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
      .returns(() => {
        const sampleIModelPath = path.join(this.assetDir, "JSON", "SampleIModel.json");
        const buff = IModelJsFs.readFileSync(sampleIModelPath);
        const jsonObj = JSON.parse(buff.toString());
        return Promise.resolve(getTypedInstances<HubIModel>(HubIModel, jsonObj));
      }).verifiable();
    iModelHubClientMock.setup((f: IModelHubClient) => f.getChangeSets(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
      .returns(() => {
        const sampleChangeSetPath = path.join(this.assetDir, "JSON", "SampleChangeSets.json");
        const buff = IModelJsFs.readFileSync(sampleChangeSetPath);
        const jsonObj = JSON.parse(buff.toString());
        return Promise.resolve(getTypedInstances<ChangeSet>(ChangeSet, jsonObj));
      }).verifiable();

    for (const name of this.iModelNames) {
      iModelHubClientMock.setup((f: IModelHubClient) => f.downloadFile(TypeMoq.It.isAnyString(),
                                                                       TypeMoq.It.is<string>((x: string) => x.includes(name))))
        .returns((seedUrl: string, seedPathname: string) => {
          seedUrl.italics();
          const testModelPath = path.join(this.assetDir, name, `${name}.bim`);
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
                                                                             TypeMoq.It.is<string>((x: string) => x.includes(name))))
        .returns((boundCsets: ChangeSet[], outPath: string) => {
          for (const changeSet of boundCsets) {
            const filePath = path.join(this.assetDir, name, "csets", changeSet.fileName!);
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
    // TODO: get sample IModel JSON objs for both noversion and test imodels
    for (const id of this.iModelIds) {
      iModelHubClientMock.setup((f: IModelHubClient) => f.getIModel(TypeMoq.It.isAny(),
                                                                    TypeMoq.It.isAnyString(),
                                                                    TypeMoq.It.is<string>((x: string) => x === id)))
        .returns(() => {
          const sampleIModelPath = path.join(this.assetDir, "JSON", "SampleIModel.json");
          const buff = IModelJsFs.readFileSync(sampleIModelPath);
          const jsonObj = JSON.parse(buff.toString())[0];
          return Promise.resolve(getTypedInstance<HubIModel>(HubIModel, jsonObj));
        }).verifiable();
      iModelHubClientMock.setup((f: IModelHubClient) => f.getSeedFiles(TypeMoq.It.isAny(),
                                                                       TypeMoq.It.is<string>((x: string) => x === id),
                                                                       TypeMoq.It.isValue(true),
                                                                       TypeMoq.It.isAny()))
        .returns(() => {
          const seedFiles = new Array<SeedFile>();
          seedFiles.push(seedFileMock.object);
          return Promise.resolve(seedFiles);
        }).verifiable();
      iModelHubClientMock.setup((f: IModelHubClient) => f.getChangeSet(TypeMoq.It.isAny(),
                                                                       TypeMoq.It.is<string>((x: string) => x === id),
                                                                       TypeMoq.It.isAnyString()/*contained within an array of valid changesets*/,
                                                                       TypeMoq.It.isValue(false)))
        .returns(() => {
          const sampleChangeSetsPath = path.join(this.assetDir, "JSON", "SampleChangeSets.json");
          const buff = IModelJsFs.readFileSync(sampleChangeSetsPath);
          const jsonObj = JSON.parse(buff.toString());
          const sampleChangeSets = getTypedInstances<ChangeSet>(ChangeSet, jsonObj);
          return Promise.resolve(sampleChangeSets[0]);
        }).verifiable();
    }
  }
}
