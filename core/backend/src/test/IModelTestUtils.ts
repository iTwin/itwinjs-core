/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Logger, OpenMode, Id64, IDisposable, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { AccessToken, DeploymentEnv } from "@bentley/imodeljs-clients";
import { SubCategoryAppearance, Code, CreateIModelProps, ElementProps, RpcManager, GeometricElementProps, IModel, IModelReadRpcInterface, RelatedElement, RpcConfiguration } from "@bentley/imodeljs-common";
import {
  IModelHostConfiguration, IModelHost, BriefcaseManager, IModelDb, DefinitionModel, Model, Element,
  InformationPartitionElement, SpatialCategory, IModelJsFs, IModelJsFsStats, PhysicalPartition, PhysicalModel, NativePlatformRegistry,
} from "../backend";
import { DisableNativeAssertions as NativeDisableNativeAssertions } from "../imodeljs-native-platform-api";
import { KnownTestLocations } from "./KnownTestLocations";
import { TestIModelInfo } from "./MockAssetUtil";
import { HubUtility, UserCredentials } from "./integration/HubUtility";
import { TestConfig } from "./TestConfig";
import * as path from "path";

const actx = new ActivityLoggingContext("");

/** Class for simple test timing */
export class Timer {
  private _label: string;
  constructor(label: string) {
    // tslint:disable-next-line:no-console
    console.time(this._label = "\t" + label);
  }

  public end() {
    // tslint:disable-next-line:no-console
    console.timeEnd(this._label);
  }
}

RpcConfiguration.developmentMode = true;

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

// Initialize the RPC interface classes used by tests
RpcManager.initializeInterface(IModelReadRpcInterface);

export interface IModelTestUtilsOpenOptions {
  copyFilename?: string;
  enableTransactions?: boolean;
  openMode?: OpenMode;
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
}

/**
 * Disables native code assertions from firing. This can be used by tests that intentionally
 * test failing operations. If those failing operations raise assertions in native code, the test
 * would fail unexpectedly in a debug build. In that case the native code assertions can be disabled with
 * this class.
 */
export class DisableNativeAssertions implements IDisposable {
  private _native: NativeDisableNativeAssertions | undefined;

  constructor() {
    this._native = new (NativePlatformRegistry.getNativePlatform()).DisableNativeAssertions();
  }

  public dispose(): void {
    if (!this._native)
      return;

    this._native!.dispose();
    this._native = undefined;
  }
}

export class IModelTestUtils {

  // public static async createIModel(accessToken: AccessToken, projectId: string, name: string, seedFile: string) {
  //   try {
  //     const existingid = await HubUtility.queryIModelIdByName(accessToken, projectId, name);
  //     BriefcaseManager.imodelClient.IModels().delete(actx, accessToken, projectId, existingid);
  //   } catch (_err) {
  //   }
  //   return BriefcaseManager.imodelClient.IModels().create(actx, accessToken, projectId, name, seedFile);
  // }

  public static async setupIntegratedFixture(testIModels: TestIModelInfo[]): Promise<any> {
    const accessToken = await IModelTestUtils.getTestUserAccessToken();
    const testProjectId = await HubUtility.queryProjectIdByName(accessToken, TestConfig.projectName);
    const cacheDir = IModelHost.configuration!.briefcaseCacheDir;

    for (const iModelInfo of testIModels) {
      // TODO: must set BriefcaseManager's imodelClient to the right bank before calling the following function:
      iModelInfo.id = await HubUtility.queryIModelIdByName(accessToken, testProjectId, iModelInfo.name);
      iModelInfo.localReadonlyPath = path.join(cacheDir, iModelInfo.id, "readOnly");
      iModelInfo.localReadWritePath = path.join(cacheDir, iModelInfo.id, "readWrite");

      BriefcaseManager.setClientFromIModelTokenContext(testProjectId, iModelInfo.id);
      iModelInfo.changeSets = await BriefcaseManager.imodelClient.ChangeSets().get(actx, accessToken, iModelInfo.id);
      iModelInfo.changeSets.shift(); // The first change set is a schema change that was not named

      iModelInfo.localReadonlyPath = path.join(cacheDir, iModelInfo.id, "readOnly");
      iModelInfo.localReadWritePath = path.join(cacheDir, iModelInfo.id, "readWrite");

      // Purge briefcases that are close to reaching the acquire limit
      await HubUtility.purgeAcquiredBriefcases(accessToken, TestConfig.projectName, iModelInfo.name);
    }

    return [accessToken, testProjectId, cacheDir];
  }

  public static async getTestUserAccessToken(userCredentials: any = TestUsers.regular, deploymentEnv: DeploymentEnv = "QA"): Promise<AccessToken> {
    return HubUtility.login(userCredentials, deploymentEnv);
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
      const modelCode = InformationPartitionElement.createCode(testIModel, IModel.rootSubjectId, newModelCode);
      if (testIModel.elements.queryElementIdByCode(modelCode) === undefined)
        return modelCode;

      newModelCode = newModelCodeBase + iter;
      ++iter;
    }
  }

  //
  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  //
  public static createAndInsertPhysicalPartition(testImodel: IModelDb, newModelCode: Code): Id64 {
    const modeledElementProps: ElementProps = {
      classFullName: PhysicalPartition.classFullName,
      iModel: testImodel,
      parent: { id: IModel.rootSubjectId, relClassName: "BisCore:SubjectOwnsPartitionElements" },
      model: IModel.repositoryModelId,
      code: newModelCode,
    };
    const modeledElement: Element = testImodel.elements.createElement(modeledElementProps);
    return testImodel.elements.insertElement(modeledElement);
  }

  //
  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  //
  public static createAndInsertPhysicalModel(testImodel: IModelDb, modeledElementRef: RelatedElement, privateModel: boolean = false): Id64 {

    const newModel = testImodel.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: privateModel });
    const newModelId = testImodel.models.insertModel(newModel);

    assert.isTrue(newModelId.isValid);
    assert.isTrue(newModel.id.isValid);
    assert.deepEqual(newModelId, newModel.id);

    return newModelId;
  }

  //
  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  // @return [modeledElementId, modelId]
  //
  public static createAndInsertPhysicalPartitionAndModel(testImodel: IModelDb, newModelCode: Code, privateModel: boolean = false): Id64[] {
    const eid = IModelTestUtils.createAndInsertPhysicalPartition(testImodel, newModelCode);
    const modeledElementRef = new RelatedElement({ id: eid });
    const mid = IModelTestUtils.createAndInsertPhysicalModel(testImodel, modeledElementRef, privateModel);
    return [eid, mid];
  }

  public static getUniqueSpatialCategoryCode(scopeModel: Model, newCodeBaseValue: string): Code {
    let newCodeValue: string = newCodeBaseValue;
    let iter: number = 0;
    while (true) {
      if (SpatialCategory.queryCategoryIdByName(scopeModel.iModel, scopeModel.id, newCodeValue) === undefined)
        return SpatialCategory.createCode(scopeModel.iModel, scopeModel.id, newCodeValue);

      newCodeValue = newCodeBaseValue + iter;
      ++iter;
    }
  }

  // Create a SpatialCategory, insert it, and set its default appearance
  public static createAndInsertSpatialCategory(definitionModel: DefinitionModel, categoryName: string, appearance: SubCategoryAppearance): Id64 {
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
    config.hubDeploymentEnv = "QA";
    IModelHost.startup(config);
  }
}

// Start the backend
IModelTestUtils.startBackend();
