import * as TypeMoq from "typemoq";
import * as path from "path";
import { assert } from "chai";
import { IModelJsFs } from "../IModelJsFs";
import { BriefcaseManager, IModelHost } from "../backend";
import {
  AccessToken, ConnectClient, Project, IModelHubClient, WsgInstance, ECJsonTypeMap,
  Response, ChangeSet, IModelRepository, Briefcase, SeedFile, SeedFileInitState,
  UserProfile, Version, IModelQuery, ChangeSetQuery, IModelHandler, BriefcaseHandler,
  ChangeSetHandler, VersionHandler, VersionQuery, UserInfoHandler, UserInfoQuery, UserInfo,
  ConnectRequestQueryOptions,
} from "@bentley/imodeljs-clients";
import { KnownLocations } from "../Platform";

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
    const typedInstance: T | undefined = ECJsonTypeMap.fromJson<T>(typedConstructor, "wsg", ecJsonInstance);
    if (typedInstance) { instances.push(typedInstance); }
  }
  return instances;
};

/** Class to allow mocking of accessToken needed for various client operations */
export class MockAccessToken extends AccessToken {
  public constructor() { super(""); }
  public getUserProfile(): UserProfile | undefined {
    return new UserProfile("test", "user", "testuser001@mailinator.com", "596c0d8b-eac2-46a0-aa4a-b590c3314e7c", "Bentley");
  }
  public toTokenString() { return ""; }
}

export class TestIModelInfo {
  private _name: string;
  private _id: string;
  private _localReadonlyPath: string;
  private _localReadWritePath: string;
  private _changeSets: ChangeSet[];

  constructor(name: string) {
    this._name = name;
    this._id = "";
    this._localReadonlyPath = "";
    this._localReadWritePath = "";
    this._changeSets = [];
  }

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
  private static projectMap = new Map<string, string>(); // <ProjectID, ProjectName>
  private static iModelMap = new Map<string, string>(); // <IModelID, IModelName>

  private static versionNames = ["FirstVersion", "SecondVersion", "ThirdVersion"];

  public static verifyIModelInfo(testIModelInfos: TestIModelInfo[]) {
    assert(testIModelInfos.length === this.iModelMap.size, "IModelInfo array has the wrong number of entries");
    for (const iModelInfo of testIModelInfos) {
      assert(iModelInfo.name === this.iModelMap.get(iModelInfo.id), `Bad information for ${iModelInfo.name} iModel`);
    }
  }

  // Read the contents of the provided assets directory to populate the projectMap and iModelMap.
  // We assume that there exists a single folder for project .json files, and that all other files
  // contain iModel assets
  public static async setupMockAssets(assetDir: string) {
    const assets = IModelJsFs.readdirSync(assetDir);
    const iModelAssetFolders = assets.filter((x: string) => x !== "Projects");
    const projectAssetsFolder = assets.filter((x: string) => x === "Projects");

    // Read the name and wsg ID of each project.json file in the Projects folder
    for (const projectAssetFolder of projectAssetsFolder) {
      const projectFolderPath = path.join(assetDir, projectAssetFolder);
      const projectAssets = IModelJsFs.readdirSync(projectFolderPath);
      for (const projectAsset of projectAssets) {
        const buff = IModelJsFs.readFileSync(path.join(projectFolderPath, projectAsset));
        const jsonObj = JSON.parse(buff.toString())[0];
        const projectObj = getTypedInstance<Project>(Project, jsonObj);
        this.projectMap.set(projectObj.wsgId.toString(), projectObj.name!);
      }
    }

    // Read the name and wsg ID of each iModel.json file in each iModel assets folder.
    // We ignore all other contents of each iModel assets folder at this time.
    for (const iModelAssetFolder of iModelAssetFolders) {
      const iModelFolderPath = path.join(assetDir, iModelAssetFolder);
      const iModelAssets = IModelJsFs.readdirSync(iModelFolderPath);
      let iModelName: string;
      for (const iModelAsset of iModelAssets) {
        // Find the .json asset file
        if (iModelAsset.substring(0, iModelAsset.indexOf(".")) === iModelAssetFolder && iModelAsset.substring(iModelAsset.indexOf(".")) === ".json") {
          const buff = IModelJsFs.readFileSync(path.join(iModelFolderPath, iModelAsset));
          const jsonObj = JSON.parse(buff.toString())[0];
          const iModelObj = getTypedInstance<IModelRepository>(IModelRepository, jsonObj);
          iModelName = iModelAsset.substring(0, iModelAsset.indexOf("."));
          this.iModelMap.set(iModelObj.wsgId.toString(), iModelName);
        }
      }
    }
  }

  public static async setupOfflineFixture(accessToken: AccessToken,
    iModelHubClientMock: TypeMoq.IMock<IModelHubClient>,
    connectClientMock: TypeMoq.IMock<ConnectClient>,
    assetDir: string, cacheDir: string,
    testIModels: TestIModelInfo[]): Promise<string> {

    cacheDir = path.normalize(path.join(KnownLocations.tmpdir, "Bentley/IModelJs/offlineCache/"));
    IModelHost.configuration!.briefcaseCacheDir = cacheDir;

    MockAssetUtil.setupConnectClientMock(connectClientMock, assetDir);
    MockAssetUtil.setupIModelHubClientMock(iModelHubClientMock, assetDir);

    (BriefcaseManager as any)._defaultHubClient = iModelHubClientMock.object;

    // Get test projectId from the mocked connection client
    const project: Project = await connectClientMock.object.getProject(accessToken as any, {
      $select: "*",
      $filter: "Name+eq+'NodeJstestproject'",
    });
    assert(project && project.wsgId, "No projectId returned from connectionClient mock");
    const testProjectId = project.wsgId.toString();

    // Get test iModelIds from the mocked iModelHub client
    for (const iModelInfo of testIModels) {
      const iModels = await iModelHubClientMock.object.IModels().get(accessToken as any, testProjectId, new IModelQuery().byName(iModelInfo.name));
      assert(iModels.length > 0, `No IModels returned from iModelHubClient mock for ${iModelInfo.name} iModel`);
      assert(iModels[0].wsgId, `No IModelId returned for ${iModelInfo.name} iModel`);
      iModelInfo.id = iModels[0].wsgId;
      iModelInfo.localReadonlyPath = path.join(cacheDir, iModelInfo.id, "readOnly");
      iModelInfo.localReadWritePath = path.join(cacheDir, iModelInfo.id, "readWrite");

      // getChangeSets
      iModelInfo.changeSets = await iModelHubClientMock.object.ChangeSets().get(accessToken as any, iModelInfo.id);
      iModelInfo.changeSets.shift(); // The first change set is a schema change that was not named
      assert.exists(iModelInfo.changeSets);

      // downloadChangeSets
      // const csetDir = path.join(cacheDir, iModelInfo.id, "csets");
      // await iModelHubClientMock.object.ChangeSets().download(iModelInfo.changeSets, csetDir);
    }
    MockAssetUtil.verifyIModelInfo(testIModels);
    return testProjectId;
  }

  public static tearDownOfflineFixture() {
    (BriefcaseManager as any)._imodelClient = undefined;
  }

  /** Setup functions for the ConnectClient mock */
  public static async setupConnectClientMock(connectClientMock: TypeMoq.IMock<ConnectClient>, assetDir: string) {
    // For any parameters passed, grab the Sample Project json file from the assets folder and parse it into an instance
    connectClientMock.setup((f: ConnectClient) => f.getProject(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns((_tok: AccessToken, query: ConnectRequestQueryOptions) => {
        for (const project of this.projectMap) {
          if (query.$filter!.toLocaleLowerCase().includes(project[1].toLocaleLowerCase())) {
            const assetPath = path.join(assetDir, "Projects", `${project[1]}.json`);
            const buff = IModelJsFs.readFileSync(assetPath);
            const jsonObj = JSON.parse(buff.toString())[0];
            return Promise.resolve(getTypedInstance<Project>(Project, jsonObj));
          }
        }
        return Promise.reject(`No matching asset(s) found for Project against query: ${query}`);
      });
  }

  /** Setup functions for the iModelHubClient mock */
  public static async setupIModelHubClientMock(iModelHubClientMock: TypeMoq.IMock<IModelHubClient>, assetDir: string) {
    const uploadSeedFileMock = TypeMoq.Mock.ofType(SeedFile);
    uploadSeedFileMock.object.downloadUrl = "www.bentley.com";
    uploadSeedFileMock.object.mergedChangeSetId = "";
    uploadSeedFileMock.object.initializationState = SeedFileInitState.Successful;

    const iModelHandlerMock = TypeMoq.Mock.ofType(IModelHandler);
    const briefcaseHandlerMock = TypeMoq.Mock.ofType(BriefcaseHandler);
    const changeSetHandlerMock = TypeMoq.Mock.ofType(ChangeSetHandler);
    const versionHandlerMock = TypeMoq.Mock.ofType(VersionHandler);
    const userInfoHandlerMock = TypeMoq.Mock.ofType(UserInfoHandler);

    // For any call with the specified iModel name, grab that iModel's json file and parse it into an instance
    iModelHandlerMock.setup((f: IModelHandler) => f.create(TypeMoq.It.isAny(),
      TypeMoq.It.isAnyString(),
      TypeMoq.It.isAnyString(),
      TypeMoq.It.isAnyString(),
      TypeMoq.It.isAny(),
      TypeMoq.It.isAny(),
      TypeMoq.It.isAnyNumber()))
      .returns((_tok: AccessToken, _projId: string, hubName: string, _path: string, _desc: string,
        _callback: ((progress: any) => void) | undefined, _timeOut: number) => {
        setTimeout(() => { }, 100);
        for (const pair of this.iModelMap) {
          if (hubName === pair[1]) {
            const sampleIModelPath = path.join(assetDir, pair[1], `${pair[1]}.json`);
            const buff = IModelJsFs.readFileSync(sampleIModelPath);
            const jsonObj = JSON.parse(buff.toString())[0];
            return Promise.resolve(getTypedInstance<IModelRepository>(IModelRepository, jsonObj));
          }
        }
        return Promise.reject(`No matching asset found for iModel with name: ${hubName}`);
      });

    // For any call with request parameters contianing the iModel name, grab that iModel's json file
    // and parse it into an instance
    iModelHandlerMock.setup((f: IModelHandler) => f.get(TypeMoq.It.isAny(),
      TypeMoq.It.isAnyString(),
      TypeMoq.It.isAny()))
      .returns((_tok: AccessToken, _projId: string, query: IModelQuery) => {
        let iModelPath: string = "";
        if (query.getId()) {
          const testCaseName = this.iModelMap.get(query.getId()!);
          if (testCaseName) {
            iModelPath = path.join(assetDir, testCaseName, `${testCaseName}.json`);
          }
        } else {
          for (const pair of this.iModelMap) {
            if (query.getQueryOptions().$filter!.includes(pair[1])) {
              iModelPath = path.join(assetDir, pair[1], `${pair[1]}.json`);
              break;
            }
          }
        }

        if (iModelPath !== "") {
          const buff = IModelJsFs.readFileSync(iModelPath);
          const jsonObj = JSON.parse(buff.toString());
          return Promise.resolve(getTypedInstances<IModelRepository>(IModelRepository, jsonObj));
        }
        return Promise.reject(`No matching asset found for iModel with id: ${query.getId()}`);
      });

    // For any call with a specified iModelId, remove the specified iModel from the cache if it currently
    // resides there
    iModelHandlerMock.setup((f: IModelHandler) => f.delete(TypeMoq.It.isAny(),
      TypeMoq.It.isAnyString(),
      TypeMoq.It.isAnyString()))
      .returns((_tok: AccessToken, _projId: string, iModelId: string) => {
        const testCaseName = this.iModelMap.get(iModelId);
        if (testCaseName) {
          const iModelCacheDir = path.join(IModelHost.configuration!.briefcaseCacheDir, iModelId);
          if (IModelJsFs.existsSync(iModelCacheDir))
            IModelJsFs.removeSync(iModelCacheDir);
          return Promise.resolve();
        }
        return Promise.reject(`No matching asset found for iModel with id: ${iModelId}`);
      });

    // For any call with a path containing a specified iModel name, grab the correct .bim asset and copy it
    // into the provided cache location
    iModelHandlerMock.setup((f: IModelHandler) => f.download(TypeMoq.It.isAny(),
      TypeMoq.It.isAnyString(),
      TypeMoq.It.isAnyString()))
      .returns((_tok: AccessToken, iModelId: string, seedPathname: string) => {
        const iModelName = this.iModelMap.get(iModelId);
        if (iModelName) {
          const testModelPath = path.join(assetDir, iModelName, `${iModelName}.bim`);
          IModelJsFs.copySync(testModelPath, seedPathname);
          const retResponse: Response = {
            status: 200,
            header: undefined,
            body: undefined,
          };
          return Promise.resolve(retResponse)
            .then(() => Promise.resolve());
        }
        return Promise.reject(`No matching asset found for iModel with id: ${iModelId}`);
      });

    briefcaseHandlerMock.setup((f: BriefcaseHandler) => f.create(TypeMoq.It.isAny(),
      TypeMoq.It.isAnyString()))
      .returns((_tok: AccessToken, iModelId: string) => {
        const iModelName = this.iModelMap.get(iModelId);
        if (iModelName) {
          const sampleBriefcasePath = path.join(assetDir, iModelName, `${iModelName}Briefcase.json`);
          const buff = IModelJsFs.readFileSync(sampleBriefcasePath);
          const jsonObj = JSON.parse(buff.toString())[0];
          return Promise.resolve(getTypedInstance<Briefcase>(Briefcase, jsonObj));
        }
        return Promise.reject(`No matching asset found for iModel with id: ${iModelId}`);
      });

    briefcaseHandlerMock.setup((f: BriefcaseHandler) => f.get(TypeMoq.It.isAny(),
      TypeMoq.It.isAnyString()))
      .returns((_tok: AccessToken, iModelId: string) => {
        const iModelName = this.iModelMap.get(iModelId);
        if (iModelName) {
          const sampleBriefcasePath = path.join(assetDir, iModelName, `${iModelName}Briefcase.json`);
          const buff = IModelJsFs.readFileSync(sampleBriefcasePath);
          const jsonObj = JSON.parse(buff.toString());
          return Promise.resolve(getTypedInstances<Briefcase>(Briefcase, jsonObj));
        }
        return Promise.reject(`No matching asset found for iModel with id: ${iModelId}`);
      });

    // For any call with a specified iModelId, return a dummy briefcaseId. If future test cases demand so, we may
    // need to change this to return specific briefcaseIds
    briefcaseHandlerMock.setup((f: BriefcaseHandler) => f.download(TypeMoq.It.isAny(),
      TypeMoq.It.isAnyString()))
      .returns((briefcase: Briefcase, outPath: string) => {
        const briefcaseName = briefcase.fileName!.slice(0, briefcase.fileName!.lastIndexOf(".bim"));
        let iModelName = "";
        for (const pair of this.iModelMap) {
          if (briefcaseName === pair[1]) {
            iModelName = pair[1];
            break;
          }
        }
        if (iModelName !== "") {
          const sampleIModelPath = path.join(assetDir, iModelName, briefcase.briefcaseId!.toString(), `${iModelName}.bim`);
          IModelJsFs.copySync(sampleIModelPath, outPath);
          return Promise.resolve();
        }
        return Promise.reject(`No matching asset found for iModel with id: ${briefcase.iModelId!}`);
      });

    // Since the Hub is being mocked away, no action is necessary when deleting a briefacse
    briefcaseHandlerMock.setup((f: BriefcaseHandler) => f.delete(TypeMoq.It.isAny(),
      TypeMoq.It.isAnyString(),
      TypeMoq.It.isAnyNumber()))
      .returns((_tok: AccessToken, _iModelId: string, _briefcaseId: number) => {
        return Promise.resolve();
      });

    // For any call with a specified iModelId, grab the asset file with the associated changeset json objs
    // and parse them into instances
    changeSetHandlerMock.setup((f: ChangeSetHandler) => f.get(TypeMoq.It.isAny(),
      TypeMoq.It.isAnyString(),
      TypeMoq.It.isAny()))
      .returns((_tok: AccessToken, iModelId: string, query: ChangeSetQuery) => {
        const iModelName = this.iModelMap.get(iModelId);
        if (iModelName) {
          const csetPath = path.join(assetDir, iModelName, `${iModelName}ChangeSets.json`);
          const buff = IModelJsFs.readFileSync(csetPath);
          const jsonObj = JSON.parse(buff.toString());
          let csets = getTypedInstances<ChangeSet>(ChangeSet, jsonObj);
          if (query && query.getQueryOptions().$top) {
            const top = query.getQueryOptions().$top!.valueOf();
            csets = csets.slice((csets.length) - top, csets.length);
          } else if (query && query.getId()) {
            csets = csets.filter((x: ChangeSet) => x.wsgId === query.getId());
          } else if (query && query.getQueryOptions().$filter && query.getQueryOptions().$filter!.includes("backward")) {
            const filter = query.getQueryOptions().$filter;
            const targetCsetId = filter!.substring((filter!.indexOf("\'") + 1), filter!.lastIndexOf("\'"));
            const targetCset = csets.find((x: ChangeSet) => x.id === targetCsetId);
            const targetCsetIndex = targetCset!.index!;
            csets = csets.filter((x: ChangeSet) => x.index! > targetCsetIndex);
          }
          if (csets) {
            for (const cset of csets) {
              cset.uploadUrl = path.join(assetDir, iModelName, "csets", cset.fileName!);
            }
            return Promise.resolve(csets);
          }
          return Promise.reject(`No matching asset found for ChangeSet with id: ${query.getId()}`);
        }
        return Promise.reject(`No matching asset found for iModel with id: ${iModelId}`);
      });

    // For any call with a path containing a specified iModel name, grab the associated change set files and copy them
    // into the provided cache location
    changeSetHandlerMock.setup((f: ChangeSetHandler) => f.download(TypeMoq.It.isAny(),
      TypeMoq.It.isAnyString()))
      .returns((csets: ChangeSet[], outPath: string) => {
        for (const cset of csets) {
          const csetPath = path.join(outPath, cset.fileName!);
          if (!IModelJsFs.existsSync(csetPath))
            IModelJsFs.copySync(cset.uploadUrl!, csetPath);
        }
        const retResponse: Response = {
          status: 200,
          header: undefined,
          body: undefined,
        };
        return Promise.resolve(retResponse)
          .then(() => Promise.resolve());
      });

    versionHandlerMock.setup((f: VersionHandler) => f.get(TypeMoq.It.isAny(),
      TypeMoq.It.isAnyString(),
      TypeMoq.It.isAny()))
      .returns((_tok: AccessToken, iModelId: string, query: VersionQuery) => {
        const iModelName = this.iModelMap.get(iModelId);
        if (iModelName) {
          for (const versionName of this.versionNames) {
            if (query.getQueryOptions().$filter!.includes(versionName)) {
              const versionPath = path.join(assetDir, iModelName, "versions", `${iModelName}${versionName}.json`);
              const buff = IModelJsFs.readFileSync(versionPath);
              const jsonObj = JSON.parse(buff.toString());
              return Promise.resolve(getTypedInstances<Version>(Version, jsonObj));
            }
          }
          return Promise.reject(`No matching version found for name ${query.getQueryOptions.name} for iModel ${iModelId}`);
        }
        return Promise.reject(`No matching asset found for iModel with id: ${iModelId}`);
      });

    userInfoHandlerMock.setup((f: UserInfoHandler) => f.get(TypeMoq.It.isAny(),
      TypeMoq.It.isAnyString(),
      TypeMoq.It.isAny()))
      .returns((_tok: AccessToken, _iModelId: string, _query: UserInfoQuery) => {
        const user = new UserInfo();
        user.firstName = "test";
        user.lastName = "user";
        user.email = "testuser001@mailinator.com";
        user.wsgId = "596c0d8b-eac2-46a0-aa4a-b590c3314e7c";
        return Promise.resolve([user]);
      });

    iModelHubClientMock.setup((f: IModelHubClient) => f.IModels()).returns(() => iModelHandlerMock.object);
    iModelHubClientMock.setup((f: IModelHubClient) => f.Briefcases()).returns(() => briefcaseHandlerMock.object);
    iModelHubClientMock.setup((f: IModelHubClient) => f.ChangeSets()).returns(() => changeSetHandlerMock.object);
    iModelHubClientMock.setup((f: IModelHubClient) => f.Versions()).returns(() => versionHandlerMock.object);
    iModelHubClientMock.setup((f: IModelHubClient) => f.Users()).returns(() => userInfoHandlerMock.object);
    const temp = IModelHost.configuration!.hubDeploymentEnv;
    iModelHubClientMock.setup((f: IModelHubClient) => f.deploymentEnv).returns(() => temp);
  }
}
