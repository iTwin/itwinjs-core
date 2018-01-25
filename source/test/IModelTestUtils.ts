/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";
import { assert } from "chai";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "@bentley/imodeljs-clients";
import { ConnectClient, Project, IModelHubClient, Briefcase, DeploymentEnv } from "@bentley/imodeljs-clients";
import { Code } from "../common/Code";
import { Gateway } from "../common/Gateway";
import { Element, InformationPartitionElement } from "../backend/Element";
import { IModelDb } from "../backend/IModelDb";
import { NodeAddonRegistry } from "../backend/NodeAddonRegistry";
import { IModelGateway } from "../gateway/IModelGateway";
import { ElementProps, GeometricElementProps } from "../common/ElementProps";
import { DefinitionModel, Model } from "../backend/Model";
import { SpatialCategory } from "../backend/Category";
import { Appearance } from "../common/SubCategoryAppearance";
import { Configuration } from "../common/Configuration";

// Initialize the gateway classes used by tests
Gateway.initialize(IModelGateway);

declare const __dirname: string;

// Initialize the Node addon used by tests
NodeAddonRegistry.loadAndRegisterStandardAddon();

export interface IModelTestUtilsOpenOptions {
  copyFilename?: string;
  enableTransactions?: boolean;
  openMode?: OpenMode;
}

export class IModelTestUtils {
  public static user = {
    email: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
  };

  private static _connectClient: ConnectClient|undefined;
  public static get connectClient(): ConnectClient {
    if (!IModelTestUtils._connectClient)
      IModelTestUtils.setIModelHubDeployConfig("QA");
    return IModelTestUtils._connectClient!;
  }

  private static _hubClient: IModelHubClient|undefined;
  public static get hubClient(): IModelHubClient {
    if (!IModelTestUtils._connectClient)
      IModelTestUtils.setIModelHubDeployConfig("QA");
    return IModelTestUtils._hubClient!;
  }

  public static setIModelHubDeployConfig(deployConfig: DeploymentEnv) {
    Configuration.iModelHubDeployConfig = deployConfig;
    IModelTestUtils._connectClient = new ConnectClient(deployConfig);
    IModelTestUtils._hubClient = new IModelHubClient(deployConfig);
  }

  public static async getTestUserAccessToken(): Promise<AccessToken> {
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient("QA")).getToken(IModelTestUtils.user.email, IModelTestUtils.user.password);
    assert(authToken);

    const accessToken = await (new ImsDelegationSecureTokenClient("QA")).getToken(authToken!);
    assert(accessToken);

    return accessToken;
  }

  public static async getTestProjectId(accessToken: AccessToken, projectName: string): Promise<string> {
    const project: Project = await IModelTestUtils.connectClient.getProject(accessToken, {
      $select: "*",
      $filter: "Name+eq+'" + projectName + "'",
    });
    assert(project && project.wsgId);
    return project.wsgId;
  }

  public static async getTestIModelId(accessToken: AccessToken, projectId: string, iModelName: string): Promise<string> {
    const iModels = await IModelTestUtils.hubClient.getIModels(accessToken, projectId, {
      $select: "*",
      $filter: "Name+eq+'" + iModelName + "'",
    });
    assert(iModels.length > 0);
    assert(iModels[0].wsgId);

    return iModels[0].wsgId;
  }

  public static async deleteAllBriefcases(accessToken: AccessToken, iModelId: string) {
    const promises = new Array<Promise<void>>();
    const briefcases = await IModelTestUtils.hubClient.getBriefcases(accessToken, iModelId);
    briefcases.forEach((briefcase: Briefcase) => {
      promises.push(IModelTestUtils.hubClient.deleteBriefcase(accessToken, iModelId, briefcase.briefcaseId));
    });
    await Promise.all(promises);
  }

  private static getStat(name: string) {
    let stat: fs.Stats | undefined;
    try {
      stat = fs.statSync(name);
    } catch (err) {
      stat = undefined;
    }
    return stat;
  }

  public static openIModel(filename: string, opts?: IModelTestUtilsOpenOptions): IModelDb {
    const destPath = __dirname + "/output";
    if (!fs.existsSync(destPath))
      fs.mkdirSync(destPath);

    if (opts === undefined)
      opts = {};

    const srcName = __dirname + "/assets/" + filename;
    const dbName = destPath + "/" + (opts.copyFilename ? opts.copyFilename! : filename);
    const srcStat = IModelTestUtils.getStat(srcName);
    const destStat = IModelTestUtils.getStat(dbName);
    if (!srcStat || !destStat || srcStat.mtime.getTime() !== destStat.mtime.getTime()) {
      fs.copySync(srcName, dbName, { preserveTimestamps: true });
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
      classFullName: "BisCore:PhysicalPartition",
      iModel: testImodel,
      parent: { id: testImodel.elements.rootSubjectId, relClassName: "BisCore:SubjectOwnsPartitionElements" },
      model: testImodel.models.repositoryModelId,
      id: new Id64(),
      code: newModelCode,
    };
    const modeledElement: Element = testImodel.elements.createElement(modeledElementProps);
    modeledElementId = testImodel.elements.insertElement(modeledElement);

    assert.isTrue(modeledElementId.isValid());

    // The model
    const newModel = testImodel.models.createModel({ id: new Id64(), modeledElement: modeledElementId, classFullName: "BisCore:PhysicalModel", isPrivate: privateModel });
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
    cat.id = cat.insert();
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
      id: new Id64(),
      code: elemCode ? elemCode : Code.createEmpty(),
    };

    return testImodel.elements.createElement(elementProps);
  }

}
