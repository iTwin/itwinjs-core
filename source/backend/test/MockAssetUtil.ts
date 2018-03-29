import * as TypeMoq from "typemoq";
import * as path from "path";
import { assert } from "chai";
import { IModelJsFs } from "../IModelJsFs";
import { IModelVersion } from "@bentley/imodeljs-common";
import { IModelHost } from "../backend";
import {
  AccessToken, ConnectClient, Project, IModelHubClient, WsgInstance, ECJsonTypeMap,
  Response, ChangeSet, IModel as HubIModel, Briefcase, MultiCode, Version,
  SeedFile, SeedFileInitState, RequestQueryOptions,
} from "@bentley/imodeljs-clients";

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

export class TestIModelInfo {
  private _name: string;
  private _id: string;
  private _localReadonlyPath: string;
  private _localReadWritePath: string;
  private _changeSets: ChangeSet[];

  constructor(name: string) { this._name = name; }

  get name(): string { return this._name; }
  set name(name: string) { this._name = name; }
  get id(): string { return this._id; }
  set id(id: string) { this._id = id; }
  get localReadonlyPath(): string { return this._localReadonlyPath; }
  set localReadonlyPath(localReadonlyPath: string) { this._localReadonlyPath = localReadonlyPath; }
  get localReadWritePath(): string { return this._localReadWritePath; }
  set localReadWritePath(localReadWritePath: string) { this._localReadWritePath = localReadWritePath; }
  get changeSets(): ChangeSet[] { return this._changeSets; }
  set changeSets(changeSets: ChangeSet[]) { this._changeSets = changeSets; }
}

/** Provides utility functions for working with mock objects */
export class MockAssetUtil {
  private static iModelMap = new Map<string, string>([["c3e1146f-8c81-430d-a974-ac840657b7ac", "ReadOnlyTest"],
                                                      ["b74b6451-cca3-40f1-9890-42c769a28f3e", "ReadWriteTest"],
                                                      ["0aea4c09-09f4-449d-bf47-045228d259ba", "NoVersionsTest"]]); // <IModelID, IModelName>

  private static versionMap = new Map<string, string[]>([["c3e1146f-8c81-430d-a974-ac840657b7ac", ["0", "1", "2", "3"]],
                                                         ["b74b6451-cca3-40f1-9890-42c769a28f3e", ["0"]],
                                                         ["0aea4c09-09f4-449d-bf47-045228d259ba", ["0"]]]);
  private static versionNames = ["FirstVersion", "SecondVersion", "ThirdVersion"];

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
          pair.toString();
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

      // For any call with a specified iModelId, remove the specified iModel from the cache if it currently
      // resides there
      iModelHubClientMock.setup((f: IModelHubClient) => f.deleteIModel(TypeMoq.It.isAny(),
                                                                    TypeMoq.It.isAnyString(),
                                                                    TypeMoq.It.is<string>((x: string) => x === pair[0])))
        .returns(() => {
          const iModelCacheDir = path.join(IModelHost.configuration!.briefcaseCacheDir, pair[0]);
          if (IModelJsFs.existsSync(iModelCacheDir))
            IModelJsFs.removeSync(iModelCacheDir);
          return Promise.resolve();
        }).verifiable();

      // For any call with a path containing a specified iModel name, grab the correct .bim asset and copy it
      // into the provided cache location
      for (const version of this.versionMap.get(pair[0])!) {
        iModelHubClientMock.setup((f: IModelHubClient) => f.downloadFile(TypeMoq.It.isAnyString(),
                                                                         TypeMoq.It.is<string>((x: string) => x.includes(pair[1]))))
          .returns((seedUrl: string, seedPathname: string) => {
            seedUrl.toString();
            const testModelPath = path.join(assetDir, pair[1], version, `${pair[1]}.bim`);
            IModelJsFs.copySync(testModelPath, seedPathname);
            const retResponse: Response = {
              status: 200,
              header: undefined,
              body: undefined,
            };
            return Promise.resolve(retResponse)
            .then(() => Promise.resolve());
          });
      }

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

      // iModelHubClientMock.setup((f: IModelHubClient) => f.getChangeSets(TypeMoq.It.isAny(),
      //                                                                   TypeMoq.It.isAny(),
      //                                                                   TypeMoq.It.isAny()))
      //   .returns((accessToken: AccessToken, ID: string, flag: boolean) => {
      //     accessToken.toTokenString();
      //     ID.toString();
      //     flag.valueOf();
      //     const sampleChangeSetPath = path.join(assetDir, pair[1], `${pair[1]}ChangeSets.json`);
      //     const buff = IModelJsFs.readFileSync(sampleChangeSetPath);
      //     const jsonObj = JSON.parse(buff.toString());
      //     return Promise.resolve(getTypedInstances<ChangeSet>(ChangeSet, jsonObj));
      //   });

      // For any call with a specified iModelId, grab the asset file with the associated changeset json objs
      // and parse them into instances
      iModelHubClientMock.setup((f: IModelHubClient) => f.getChangeSets(TypeMoq.It.isAny(),
                                                                          TypeMoq.It.is<string>((x: string) => x === pair[0]),
                                                                          TypeMoq.It.isAny(),
                                                                          TypeMoq.It.isAny()))
        .returns((accessToken: AccessToken, ID: string, flag: boolean) => {
          accessToken.toTokenString();
          ID.toString();
          flag.valueOf();
          const sampleChangeSetsPath = path.join(assetDir, pair[1], `${pair[1]}ChangeSets.json`);
          const buff = IModelJsFs.readFileSync(sampleChangeSetsPath);
          const jsonObj = JSON.parse(buff.toString());
          const sampleChangeSets = getTypedInstances<ChangeSet>(ChangeSet, jsonObj);
          return Promise.resolve(sampleChangeSets);
          });

      // For any call with a specified iModelId, grab the asset file with the associated changeset json objs
      // and parse them into instances
      iModelHubClientMock.setup((f: IModelHubClient) => f.getChangeSet(TypeMoq.It.isAny(),
                                                                        TypeMoq.It.is<string>((x: string) => x === pair[0]),
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

    for (const name of this.versionNames) {
      iModelHubClientMock.setup((f: IModelHubClient) => f.getVersions(TypeMoq.It.isAny(),
                                                                      TypeMoq.It.is<string>((x: string) => x === "c3e1146f-8c81-430d-a974-ac840657b7ac"),
                                                                      TypeMoq.It.is<RequestQueryOptions>((x: RequestQueryOptions) => x.$filter!.includes(name))))
        .returns(() => {
          const versionPath = path.join(assetDir, "ReadOnlyTest", "versions", `ReadOnlyTest${name}.json`);
          const buff = IModelJsFs.readFileSync(versionPath);
          const jsonObj = JSON.parse(buff.toString());
          return Promise.resolve(getTypedInstances<Version>(Version, jsonObj));
        });
    }
  }

  public static setupHubMultiCodes(iModelHubClientMock: TypeMoq.IMock<IModelHubClient>, assetDir: string, iModelId: string, iModelName: string, isReserved: boolean) {
    const codeInfoMap: Map<string, string> = new Map<string, string>([["0x1d", "0x1"], ["0x16", "0x10"], ["0x1e", "0x20000000002"]]);
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
