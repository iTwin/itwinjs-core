/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Logger, OpenMode, Id64 } from "@bentley/bentleyjs-core";
import { AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "@bentley/imodeljs-clients";
import { Appearance, Code, CreateIModelProps, ElementProps, RpcManager, GeometricElementProps, IModel, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import {
  IModelHostConfiguration, IModelHost, BriefcaseManager, IModelDb, DefinitionModel, Model, Element,
  InformationPartitionElement, SpatialCategory, IModelJsFs, IModelJsFsStats, PhysicalPartition, PhysicalModel,
} from "../backend";
import { KnownTestLocations } from "./KnownTestLocations";
import { TestIModelInfo } from "./MockAssetUtil";
import { HubTestUtils } from "./integration/HubTestUtils";
import { TestConfig } from "./TestConfig";
import * as path from "path";
import { NativePlatformRegistry } from "../NativePlatformRegistry";

/** Class for simple test timing */
export class Timer {
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

Logger.initializeToConsole();
if (process.env.imodeljs_test_logging_config === undefined) {
  // tslint:disable-next-line:no-console
  console.log("FYI You can set the environment variable imodeljs_test_logging_config to point to a logging configuration json file.");
}

const loggingConfigFile: string = process.env.imodeljs_test_logging_config || path.join(__dirname, "logging.config.json");
if (IModelJsFs.existsSync(loggingConfigFile)) {
  // tslint:disable-next-line:no-var-requires
  Logger.configureLevels(require(loggingConfigFile));
}

let nativePlatformForTestsDir = __dirname;
while (!IModelJsFs.existsSync(path.join(nativePlatformForTestsDir, "nativePlatformForTests")))
  nativePlatformForTestsDir = path.join(nativePlatformForTestsDir, "..");
const nativePlatformDir = path.join(path.join(nativePlatformForTestsDir, "nativePlatformForTests"), "node_modules");
NativePlatformRegistry.loadAndRegisterStandardNativePlatform(nativePlatformDir);

// Initialize the RPC interface classes used by tests
RpcManager.initializeInterface(IModelReadRpcInterface);

export interface IModelTestUtilsOpenOptions {
  copyFilename?: string;
  enableTransactions?: boolean;
  openMode?: OpenMode;
}

/** Credentials for test users */
export interface UserCredentials {
  email: string;
  password: string;
}

/** Test users with various permissions */
export class TestUsers {
  /** User with the typical permissions of the regular/average user - Co-Admin: No, Connect-Services-Admin: No */
  public static readonly regular: UserCredentials = {
    email: "Regular.IModelJsTestUser@mailinator.com",
    password: "Regular@iMJs",
  };

  /** User with typical permissions of the project administrator - Co-Admin: Yes, Connect-Services-Admin: No */
  public static readonly manager: UserCredentials = {
    email: "Manager.IModelJsTestUser@mailinator.com",
    password: "Manager@iMJs",
  };

  /** User with the typical permissions of the connected services administrator - Co-Admin: No, Connect-Services-Admin: Yes */
  public static readonly super: UserCredentials = {
    email: "Super.IModelJsTestUser@mailinator.com",
    password: "Super@iMJs",
  };

  /** User with the typical permissions of the connected services administrator - Co-Admin: Yes, Connect-Services-Admin: Yes */
  public static readonly superManager: UserCredentials = {
    email: "SuperManager.IModelJsTestUser@mailinator.com",
    password: "SuperManager@iMJs",
  };

  /** Just another user */
  public static readonly user1: UserCredentials = {
    email: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
  };

  /** Just another user */
  public static readonly user2: UserCredentials = {
    email: "bentleyvilnius@gmail.com",
    password: "Q!w2e3r4t5",
  };

}

export class IModelTestUtils {

  public static async setupIntegratedFixture(testIModels: TestIModelInfo[]): Promise<any> {
    const accessToken = await IModelTestUtils.getTestUserAccessToken();
    const testProjectId = await HubTestUtils.queryProjectIdByName(accessToken, TestConfig.projectName);
    const cacheDir = IModelHost.configuration!.briefcaseCacheDir;

    for (const iModelInfo of testIModels) {
      iModelInfo.id = await HubTestUtils.queryIModelIdByName(accessToken, testProjectId, iModelInfo.name);
      iModelInfo.localReadonlyPath = path.join(cacheDir, iModelInfo.id, "readOnly");
      iModelInfo.localReadWritePath = path.join(cacheDir, iModelInfo.id, "readWrite");

      iModelInfo.changeSets = await BriefcaseManager.hubClient.ChangeSets().get(accessToken, iModelInfo.id);
      iModelInfo.changeSets.shift(); // The first change set is a schema change that was not named

      iModelInfo.localReadonlyPath = path.join(cacheDir, iModelInfo.id, "readOnly");
      iModelInfo.localReadWritePath = path.join(cacheDir, iModelInfo.id, "readWrite");

      // Purge briefcases that are close to reaching the acquire limit
      await HubTestUtils.purgeAcquiredBriefcases(accessToken, TestConfig.projectName, iModelInfo.name);
    }

    return [accessToken, testProjectId, cacheDir];
  }

  public static async getTestUserAccessToken(userCredentials?: any): Promise<AccessToken> {
    if (userCredentials === undefined)
      userCredentials = TestUsers.regular;
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient("QA")).getToken(userCredentials.email, userCredentials.password);
    assert(authToken);

    const accessToken = await (new ImsDelegationSecureTokenClient("QA")).getToken(authToken!);
    assert(accessToken);

    return accessToken;
  }

  private static getStat(name: string) {
    let stat: IModelJsFsStats | undefined;
    try {
      stat = IModelJsFs.lstatSync(name);
    } catch (err) {
      stat = undefined;
    }
    return stat;
  }

  public static createStandaloneIModel(fileName: string, args: CreateIModelProps): IModelDb {
    const destPath = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(destPath))
      IModelJsFs.mkdirSync(destPath);

    const pathname = path.join(destPath, fileName);
    if (IModelJsFs.existsSync(pathname))
      IModelJsFs.unlinkSync(pathname);

    const iModel: IModelDb = IModelDb.createStandalone(pathname, args);

    assert.isNotNull(iModel);
    assert.isTrue(IModelJsFs.existsSync(pathname));
    return iModel!;
  }

  public static openIModel(filename: string, opts?: IModelTestUtilsOpenOptions): IModelDb {
    const destPath = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(destPath))
      IModelJsFs.mkdirSync(destPath);

    if (opts === undefined)
      opts = {};

    const srcName = path.join(KnownTestLocations.assetsDir, filename);
    const dbName = path.join(destPath, (opts.copyFilename ? opts.copyFilename! : filename));
    const srcStat = IModelTestUtils.getStat(srcName);
    const destStat = IModelTestUtils.getStat(dbName);
    if (!srcStat || !destStat || srcStat.mtimeMs !== destStat.mtimeMs) {
      IModelJsFs.copySync(srcName, dbName, { preserveTimestamps: true });
    }

    const iModel: IModelDb = IModelDb.openStandalone(dbName, opts.openMode, opts.enableTransactions); // could throw Error
    assert.exists(iModel);
    return iModel!;
  }

  public static openIModelFromOut(filename: string, opts?: IModelTestUtilsOpenOptions): IModelDb {
    const destPath = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(destPath))
      IModelJsFs.mkdirSync(destPath);

    if (opts === undefined)
      opts = {};

    const srcName = path.join(KnownTestLocations.outputDir, filename);
    const dbName = path.join(destPath, (opts.copyFilename ? opts.copyFilename! : filename));
    const srcStat = IModelTestUtils.getStat(srcName);
    const destStat = IModelTestUtils.getStat(dbName);
    if (!srcStat || !destStat || srcStat.mtimeMs !== destStat.mtimeMs) {
      IModelJsFs.copySync(srcName, dbName, { preserveTimestamps: true });
    }

    const iModel: IModelDb = IModelDb.openStandalone(dbName, opts.openMode, opts.enableTransactions); // could throw Error
    assert.exists(iModel);
    return iModel!;
  }

  public static closeIModel(iModel: IModelDb) {
    iModel.closeStandalone();
  }

  public static getUniqueModelCode(testIModel: IModelDb, newModelCodeBase: string): Code {
    let newModelCode: string = newModelCodeBase;
    let iter: number = 0;
    while (true) {
      const modelCode = InformationPartitionElement.createCode(testIModel.elements.getRootSubject(), newModelCode);
      if (testIModel.elements.queryElementIdByCode(modelCode) === undefined)
        return modelCode;

      newModelCode = newModelCodeBase + iter;
      ++iter;
    }
  }

  //
  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  //
  public static createAndInsertPhysicalModel(testImodel: IModelDb, newModelCode: Code, privateModel: boolean = false): Id64[] {
    let modeledElementId: Id64;
    let newModelId: Id64;

    //  The modeled element
    const modeledElementProps: ElementProps = {
      classFullName: PhysicalPartition.classFullName,
      iModel: testImodel,
      parent: { id: IModel.rootSubjectId, relClassName: "BisCore:SubjectOwnsPartitionElements" },
      model: IModel.repositoryModelId,
      code: newModelCode,
    };
    const modeledElement: Element = testImodel.elements.createElement(modeledElementProps);
    modeledElementId = testImodel.elements.insertElement(modeledElement);

    assert.isTrue(modeledElementId.isValid());

    // The model
    const newModel = testImodel.models.createModel({ modeledElement: modeledElementId, classFullName: PhysicalModel.classFullName, isPrivate: privateModel });
    newModelId = testImodel.models.insertModel(newModel);

    assert.isTrue(newModelId.isValid());
    assert.isTrue(newModel.id.isValid());
    assert.deepEqual(newModelId, newModel.id);

    return [modeledElementId, newModelId];
  }

  public static getUniqueSpatialCategoryCode(scopeModel: Model, newCodeBaseValue: string): Code {
    let newCodeValue: string = newCodeBaseValue;
    let iter: number = 0;
    while (true) {
      if (SpatialCategory.queryCategoryIdByName(scopeModel, newCodeValue) === undefined)
        return SpatialCategory.createCode(scopeModel, newCodeValue);

      newCodeValue = newCodeBaseValue + iter;
      ++iter;
    }
  }

  // Create a SpatialCategory, insert it, and set its default appearance
  public static createAndInsertSpatialCategory(definitionModel: DefinitionModel, categoryName: string, appearance: Appearance): Id64 {
    const cat: SpatialCategory = SpatialCategory.create(definitionModel, categoryName);
    cat.id = definitionModel.iModel.elements.insertElement(cat);
    cat.setDefaultAppearance(appearance);
    return cat.id;
  }

  // Create a PhysicalObject. (Does not insert it.)
  public static createPhysicalObject(testImodel: IModelDb, modelId: Id64, categoryId: Id64, elemCode?: Code): Element {
    const elementProps: GeometricElementProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: testImodel,
      model: modelId,
      category: categoryId,
      code: elemCode ? elemCode : Code.createEmpty(),
    };
    return testImodel.elements.createElement(elementProps);
  }

  public static startBackend() {
    const config = new IModelHostConfiguration();
    config.iModelHubDeployConfig = "QA";
    IModelHost.startup(config);
  }
}

// Start the backend
IModelTestUtils.startBackend();
