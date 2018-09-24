/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, DeploymentEnv, UserProfile, IModelHubClient } from "@bentley/imodeljs-clients";
import { HubIModel, Project, IModelQuery, ChangeSet, ChangeSetQuery, Briefcase as HubBriefcase, ChangesType } from "@bentley/imodeljs-clients";
import { ChangeSetApplyOption, OpenMode, ChangeSetStatus, Logger, assert, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelJsFs, ChangeSetToken, BriefcaseManager, BriefcaseId, IModelDb } from "../../backend";
import * as path from "path";
import { IModelBankFileSystemProjectOptions, IModelBankFileSystemProject } from "@bentley/imodeljs-clients/lib/IModelBank/IModelBankFileSystemProject";
import { KnownTestLocations } from "../KnownTestLocations";
import { TestConfig } from "../TestConfig";

const defaultEnv: DeploymentEnv = "QA";
const actx = new ActivityLoggingContext("");

/** Credentials for test users */
export interface UserCredentials {
  email: string;
  password: string;
}

async function doImsLogin(user: UserCredentials, imsDeploymentEnv: DeploymentEnv): Promise<AccessToken> {
  const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient(imsDeploymentEnv)).getToken(actx, user.email, user.password);
  assert(!!authToken);

  const accessToken: AccessToken = await (new ImsDelegationSecureTokenClient(imsDeploymentEnv)).getToken(actx, authToken!);
  assert(!!accessToken);

  Logger.logTrace(HubUtility.logCategory, `Logged in test user ${user.email}`);
  return accessToken;
}

/** Utility to work with the iModel Hub */
export class HubUtility {

  public static logCategory = "HubUtility";

  public static async login(user: UserCredentials, imsDeploymentEnv: DeploymentEnv = defaultEnv): Promise<AccessToken> {
    return getIModelPermissionAbstraction().authorizeUser(actx, undefined, user, imsDeploymentEnv);
  }

  private static makeDirectoryRecursive(dirPath: string) {
    if (IModelJsFs.existsSync(dirPath))
      return;
    HubUtility.makeDirectoryRecursive(path.dirname(dirPath));
    IModelJsFs.mkdirSync(dirPath);
  }

  private static deleteDirectoryRecursive(dirPath: string) {
    if (!IModelJsFs.existsSync(dirPath))
      return;
    try {
      IModelJsFs.readdirSync(dirPath).forEach((file) => {
        const curPath = dirPath + "/" + file;
        if (IModelJsFs.lstatSync(curPath)!.isDirectory) {
          HubUtility.deleteDirectoryRecursive(curPath);
        } else {
          // delete file
          IModelJsFs.unlinkSync(curPath);
        }
      });
      IModelJsFs.rmdirSync(dirPath);
    } catch (err) {
      return; // todo: This seems to fail sometimes for no reason
    }
  }

  private static async queryProjectByName(accessToken: AccessToken, projectName: string): Promise<Project | undefined> {
    const project: Project = await getIModelProjectAbstraction().queryProject(actx, accessToken, {
      $select: "*",
      $filter: "Name+eq+'" + projectName + "'",
    });
    return project;
  }

  private static async queryIModelByName(accessToken: AccessToken, projectId: string, iModelName: string): Promise<HubIModel | undefined> {
    const iModels = await getIModelProjectAbstraction().queryIModels(actx, accessToken, projectId, new IModelQuery().byName(iModelName));
    if (iModels.length === 0)
      return undefined;
    if (iModels.length > 1)
      return Promise.reject(`Too many iModels with name ${iModelName} found`);
    return iModels[0];
  }

  private static async queryIModelById(accessToken: AccessToken, projectId: string, iModelId: string): Promise<HubIModel | undefined> {
    const iModels = await getIModelProjectAbstraction().queryIModels(actx, accessToken, projectId, new IModelQuery().byId(iModelId));
    if (iModels.length === 0)
      return undefined;
    return iModels[0];
  }

  /**
   * Queries the project id by its name
   * @param accessToken AccessToken
   * @param projectName Name of project
   * @throws If the project is not found, or there is more than one project with the supplied name
   */
  public static async queryProjectIdByName(accessToken: AccessToken, projectName: string): Promise<string> {
    const project: Project | undefined = await HubUtility.queryProjectByName(accessToken, projectName);
    if (!project)
      return Promise.reject(`Project ${projectName} not found`);
    return project.wsgId;
  }

  /**
   * Queries the iModel id by its name
   * @param accessToken AccessToken
   * @param projectId Id of the project
   * @param iModelName Name of the iModel
   * @throws If the iModel is not found, or if there is more than one iModel with the supplied name
   */
  public static async queryIModelIdByName(accessToken: AccessToken, projectId: string, iModelName: string): Promise<string> {
    const iModel: HubIModel | undefined = await HubUtility.queryIModelByName(accessToken, projectId, iModelName);
    if (!iModel)
      return Promise.reject(`IModel ${iModelName} not found`);
    return iModel.wsgId;
  }

  /** Download all change sets of the specified iModel */
  private static async downloadChangeSets(accessToken: AccessToken, changeSetsPath: string, _projectId: string, iModelId: string): Promise<ChangeSet[]> {
    const query = new ChangeSetQuery();
    query.selectDownloadUrl();

    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.ChangeSets().get(actx, accessToken, iModelId, query);
    if (changeSets.length === 0)
      return new Array<ChangeSet>();

    await BriefcaseManager.imodelClient.ChangeSets().download(actx, changeSets, changeSetsPath);
    return changeSets;
  }

  public static async downloadIModelById(accessToken: AccessToken, projectId: string, iModelId: string, downloadDir: string): Promise<void> {
    // Recreate the download folder if necessary
    if (IModelJsFs.existsSync(downloadDir))
      HubUtility.deleteDirectoryRecursive(downloadDir);
    HubUtility.makeDirectoryRecursive(downloadDir);

    const iModel: HubIModel | undefined = await HubUtility.queryIModelById(accessToken, projectId, iModelId);
    if (!iModel)
      return Promise.reject(`IModel with id ${iModelId} not found`);

    // Write the JSON representing the iModel
    const iModelJsonStr = JSON.stringify(iModel, undefined, 4);
    const iModelJsonPathname = path.join(downloadDir, "imodel.json");
    IModelJsFs.writeFileSync(iModelJsonPathname, iModelJsonStr);

    // Download the seed file
    const seedPathname = path.join(downloadDir, "seed", iModel.name!.concat(".bim"));
    await BriefcaseManager.imodelClient.IModels().download(actx, accessToken, iModelId, seedPathname);

    // Download the change sets
    const changeSetDir = path.join(downloadDir, "changeSets//");
    const changeSets: ChangeSet[] = await HubUtility.downloadChangeSets(accessToken, changeSetDir, projectId, iModelId);

    const changeSetsJsonStr = JSON.stringify(changeSets, undefined, 4);
    const changeSetsJsonPathname = path.join(downloadDir, "changeSets.json");
    IModelJsFs.writeFileSync(changeSetsJsonPathname, changeSetsJsonStr);
  }

  /** Download an IModel's seed files and change sets from the Hub */
  public static async downloadIModelByName(accessToken: AccessToken, projectName: string, iModelName: string, downloadDir: string): Promise<void> {
    const projectId: string = await HubUtility.queryProjectIdByName(accessToken, projectName);

    const iModel: HubIModel | undefined = await HubUtility.queryIModelByName(accessToken, projectId, iModelName);
    if (!iModel)
      return Promise.reject(`IModel ${iModelName} not found`);
    const iModelId = iModel.wsgId;

    await HubUtility.downloadIModelById(accessToken, projectId, iModelId, downloadDir);
  }

  /** Delete an IModel from the hub
   * @hidden
   */
  public static async deleteIModel(accessToken: AccessToken, projectName: string, iModelName: string): Promise<void> {
    const projectId: string = await HubUtility.queryProjectIdByName(accessToken, projectName);
    const iModelId: string = await HubUtility.queryIModelIdByName(accessToken, projectId, iModelName);

    await BriefcaseManager.imodelClient.IModels().delete(actx, accessToken, projectId, iModelId);
  }

  public static getSeedPathname(iModelDir: string) {
    const seedFileDir = path.join(iModelDir, "seed");
    const seedFileNames = IModelJsFs.readdirSync(seedFileDir);
    if (seedFileNames.length !== 1) {
      throw new Error(`Expected to find one and only one seed file in: ${seedFileDir}`);
    }
    const seedFileName = seedFileNames[0];
    const seedPathname = path.join(seedFileDir, seedFileName);
    return seedPathname;
  }

  /** Push an iModel to the Hub */
  public static async pushIModel(accessToken: AccessToken, projectId: string, pathname: string): Promise<string> {
    // Delete any existing iModels with the same name as the required iModel
    const iModelName = path.basename(pathname, ".bim");
    let iModel: HubIModel | undefined = await HubUtility.queryIModelByName(accessToken, projectId, iModelName);
    if (iModel) {
      await BriefcaseManager.imodelClient.IModels().delete(actx, accessToken, projectId, iModel.wsgId);
    }

    // Upload a new iModel
    iModel = await BriefcaseManager.imodelClient.IModels().create(actx, accessToken, projectId, iModelName, pathname, "", undefined, 2 * 60 * 1000);
    return iModel.wsgId;
  }

  /** Upload an IModel's seed files and change sets to the hub
   *  @hidden
   */
  public static async pushIModelAndChangeSets(accessToken: AccessToken, projectName: string, uploadDir: string): Promise<string> {
    const projectId: string = await HubUtility.queryProjectIdByName(accessToken, projectName);
    const seedPathname = HubUtility.getSeedPathname(uploadDir);
    const iModelId = await HubUtility.pushIModel(accessToken, projectId, seedPathname);

    const briefcase: HubBriefcase = await BriefcaseManager.imodelClient.Briefcases().create(actx, accessToken, iModelId);
    if (!briefcase) {
      return Promise.reject(`Could not acquire a briefcase for the iModel ${iModelId}`);
    }

    const changeSetJsonPathname = path.join(uploadDir, "changeSets.json");
    if (!IModelJsFs.existsSync(changeSetJsonPathname))
      return iModelId;

    const jsonStr = IModelJsFs.readFileSync(changeSetJsonPathname) as string;
    const changeSetsJson = JSON.parse(jsonStr);

    // Upload change sets
    for (const changeSetJson of changeSetsJson) {
      const changeSetPathname = path.join(uploadDir, "changeSets", changeSetJson.fileName);
      if (!IModelJsFs.existsSync(changeSetPathname)) {
        throw new Error("Cannot find the ChangeSet file: " + changeSetPathname);
      }

      const changeSet = new ChangeSet();
      changeSet.id = changeSetJson.id;
      changeSet.parentId = changeSetJson.parentId;
      changeSet.fileSize = changeSetJson.fileSize;
      changeSet.seedFileId = briefcase.fileId;
      changeSet.briefcaseId = briefcase.briefcaseId;

      await BriefcaseManager.imodelClient.ChangeSets().create(actx, accessToken, iModelId, changeSet, changeSetPathname);
    }

    return iModelId;
  }

  /**
   * Purges all acquired briefcases for the specified iModel (and user), if the specified threshold of acquired briefcases is exceeded
   */
  public static async purgeAcquiredBriefcases(accessToken: AccessToken, projectName: string, iModelName: string, acquireThreshold: number = 16): Promise<void> {
    const projectId: string = await HubUtility.queryProjectIdByName(accessToken, projectName);
    const iModelId: string = await HubUtility.queryIModelIdByName(accessToken, projectId, iModelName);

    const briefcases: HubBriefcase[] = await BriefcaseManager.imodelClient.Briefcases().get(actx, accessToken, iModelId);
    if (briefcases.length > acquireThreshold) {
      Logger.logInfo(HubUtility.logCategory, `Reached limit of maximum number of briefcases for ${projectName}:${iModelName}. Purging all briefcases.`);

      const promises = new Array<Promise<void>>();
      briefcases.forEach((briefcase: HubBriefcase) => {
        promises.push(BriefcaseManager.imodelClient.Briefcases().delete(actx, accessToken, iModelId, briefcase.briefcaseId!));
      });
      await Promise.all(promises);
    }
  }

  /** Reads change sets from disk and expects a standard structure of how the folder is organized */
  public static readChangeSets(iModelDir: string): ChangeSetToken[] {
    const tokens = new Array<ChangeSetToken>();

    const changeSetJsonPathname = path.join(iModelDir, "changeSets.json");
    if (!IModelJsFs.existsSync(changeSetJsonPathname))
      return tokens;

    const jsonStr = IModelJsFs.readFileSync(changeSetJsonPathname) as string;
    const changeSetsJson = JSON.parse(jsonStr);

    for (const changeSetJson of changeSetsJson) {
      const changeSetPathname = path.join(iModelDir, "changeSets", changeSetJson.fileName);
      if (!IModelJsFs.existsSync(changeSetPathname)) {
        throw new Error("Cannot find the ChangeSet file: " + changeSetPathname);
      }
      tokens.push(new ChangeSetToken(changeSetJson.id, changeSetJson.parentId, changeSetJson.index, changeSetPathname, changeSetJson.changesType === ChangesType.Schema));
    }

    return tokens;
  }

  /** Creates a standalone iModel from the seed file (version 0) */
  public static createStandaloneIModel(iModelPathname: string, iModelDir: string) {
    const seedPathname = HubUtility.getSeedPathname(iModelDir);

    if (IModelJsFs.existsSync(iModelPathname))
      IModelJsFs.unlinkSync(iModelPathname);
    IModelJsFs.copySync(seedPathname, iModelPathname);

    const iModel = IModelDb.openStandalone(iModelPathname, OpenMode.ReadWrite);
    iModel.briefcase.nativeDb.setBriefcaseId(BriefcaseId.Standalone);
    iModel.briefcase.briefcaseId = BriefcaseId.Standalone;
    iModel.closeStandalone();

    return iModelPathname;
  }

  /** Applies change sets one by one (for debugging) */
  public static applyStandaloneChangeSets(iModel: IModelDb, changeSets: ChangeSetToken[], applyOption: ChangeSetApplyOption): ChangeSetStatus {
    // Apply change sets one by one to debug any issues
    for (const changeSet of changeSets) {
      const tempChangeSets = [changeSet];

      const status: ChangeSetStatus = BriefcaseManager.applyStandaloneChangeSets(iModel.briefcase, tempChangeSets, applyOption);

      let msg: string = `Applying change set ${changeSet.index}:${changeSet.id}: `;
      msg = (status === ChangeSetStatus.Success) ? msg.concat("Success") : msg.concat("ERROR!!");
      Logger.logInfo(HubUtility.logCategory, msg);

      if (status !== ChangeSetStatus.Success)
        return status;
    }

    return ChangeSetStatus.Success;
  }

  /** Dumps change sets */
  public static dumpStandaloneChangeSets(iModel: IModelDb, changeSets: ChangeSetToken[]) {
    changeSets.forEach((changeSet) => {
      BriefcaseManager.dumpChangeSet(iModel.briefcase, changeSet);
    });
  }

}

class ImsUserMgr {
  public async authorizeUser(_actx: ActivityLoggingContext, _userProfile: UserProfile | undefined, userCredentials: any, env: DeploymentEnv): Promise<AccessToken> {
    return await doImsLogin(userCredentials, env);
  }
}

/** An implementation of IModelProjectAbstraction backed by a iModelHub/Connect project */
class TestIModelHubProject {
  public get isIModelHub(): boolean { return true; }
  public terminate(): void { }

  public get iModelHubClient(): IModelHubClient {
    return BriefcaseManager.imodelClient as IModelHubClient;
  }

  public async queryProject(_actx: ActivityLoggingContext, accessToken: AccessToken, query: any | undefined): Promise<Project> {
    const client = BriefcaseManager.connectClient;
    return client.getProject(actx, accessToken, query);
  }
  public async createIModel(_actx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, params: any): Promise<HubIModel> {
    const client = this.iModelHubClient;
    return client.IModels().create(actx, accessToken, projectId, params.name, params.seedFile, params.description, params.tracker);
  }
  public deleteIModel(_actx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, iModelId: string): Promise<void> {
    const client = this.iModelHubClient;
    return client.IModels().delete(actx, accessToken, projectId, iModelId);
  }
  public async queryIModels(_actx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, query: IModelQuery | undefined): Promise<HubIModel[]> {
    const client = this.iModelHubClient;
    return client.IModels().get(actx, accessToken, projectId, query);
  }
}

let projectAbstraction: any;
let authorizationAbstraction: any;
const usingMocks = false;

export function getIModelPermissionAbstraction(): any {
  if (authorizationAbstraction !== undefined)
    return authorizationAbstraction;

  if ((process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK === undefined) || usingMocks) {
    return authorizationAbstraction = new ImsUserMgr();
  }

  throw new Error("WIP");
}

export function getIModelProjectAbstraction(): any {
  if (projectAbstraction !== undefined)
    return projectAbstraction;

  if ((process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK === undefined) || usingMocks) {
    return projectAbstraction = new TestIModelHubProject();
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

  const options: IModelBankFileSystemProjectOptions = {
    rootDir: path.join(KnownTestLocations.outputDir, "imodel-bank"),
    name: TestConfig.projectName,
    env: defaultEnv,
    deleteIfExists: true,
    createIfNotExist: true,
  };
  projectAbstraction = new IModelBankFileSystemProject(options);
  return projectAbstraction;
}
