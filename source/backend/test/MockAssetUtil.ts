import * as TypeMoq from "typemoq";
import * as path from "path";
import { IModelJsFs } from "../IModelJsFs";
import { SeedFile } from "@bentley/imodeljs-clients";
import { IModelVersion } from "@bentley/imodeljs-common";
import {
  ConnectClient, Project, IModelHubClient, WsgInstance, ECJsonTypeMap,
  Response, ChangeSet, IModel as HubIModel,
} from "@bentley/imodeljs-clients";

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

export class MockAssetUtil {
  private static iModelNames = ["TestModel", "NoVersionsTest"];
  private static iModelIds = ["b74b6451-cca3-40f1-9890-42c769a28f3e", ""];
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
