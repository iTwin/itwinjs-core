/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import {
  AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, IModelHubClient,
  HubIModel, Project, IModelQuery, ChangeSet, ChangeSetQuery, Briefcase as HubBriefcase, ChangesType, Version,
  AuthorizedClientRequestContext, ImsUserCredentials, VersionQuery, BriefcaseQuery,
} from "@bentley/imodeljs-clients";
import { ChangeSetApplyOption, OpenMode, ChangeSetStatus, Logger, assert, GuidString, PerfLogger, ClientRequestContext } from "@bentley/bentleyjs-core";
import { IModelJsFs, ChangeSetToken, BriefcaseManager, BriefcaseId, IModelDb, BackendRequestContext } from "../../imodeljs-backend";
import * as path from "path";

/** Utility to work with the iModel Hub */
export class HubUtility {

  public static logCategory = "HubUtility";

  public static async login(user: ImsUserCredentials): Promise<AccessToken> {
    return getIModelPermissionAbstraction().authorizeUser(new BackendRequestContext(), user);
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

  private static async queryProjectByName(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<Project | undefined> {
    const project: Project = await getIModelProjectAbstraction().queryProject(requestContext, {
      $select: "*",
      $filter: "Name+eq+'" + projectName + "'",
    });
    return project;
  }

  private static async queryIModelByName(requestContext: AuthorizedClientRequestContext, projectId: string, iModelName: string): Promise<HubIModel | undefined> {
    const iModels = await getIModelProjectAbstraction().queryIModels(requestContext, projectId, new IModelQuery().byName(iModelName));
    if (iModels.length === 0)
      return undefined;
    if (iModels.length > 1)
      return Promise.reject(`Too many iModels with name ${iModelName} found`);
    return iModels[0];
  }

  private static async queryIModelById(requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString): Promise<HubIModel | undefined> {
    const iModels = await getIModelProjectAbstraction().queryIModels(requestContext, projectId, new IModelQuery().byId(iModelId));
    if (iModels.length === 0)
      return undefined;
    return iModels[0];
  }

  /**
   * Queries the project id by its name
   * @param requestContext The client request context
   * @param projectName Name of project
   * @throws If the project is not found, or there is more than one project with the supplied name
   */
  public static async queryProjectIdByName(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<string> {
    const project: Project | undefined = await HubUtility.queryProjectByName(requestContext, projectName);
    if (!project)
      return Promise.reject(`Project ${projectName} not found`);
    return project.wsgId;
  }

  /**
   * Queries the iModel id by its name
   * @param requestContext The client request context
   * @param projectId Id of the project
   * @param iModelName Name of the iModel
   * @throws If the iModel is not found, or if there is more than one iModel with the supplied name
   */
  public static async queryIModelIdByName(requestContext: AuthorizedClientRequestContext, projectId: string, iModelName: string): Promise<GuidString> {
    const iModel: HubIModel | undefined = await HubUtility.queryIModelByName(requestContext, projectId, iModelName);
    if (!iModel || !iModel.id)
      return Promise.reject(`IModel ${iModelName} not found`);
    return iModel.id!;
  }

  /** Query the latest change set (id) of the specified iModel */
  public static async queryLatestChangeSetId(requestContext: AuthorizedClientRequestContext, iModelId: GuidString): Promise<GuidString> {
    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.changeSets.get(requestContext, iModelId, new ChangeSetQuery().top(1).latest());
    return (changeSets.length === 0) ? "" : changeSets[changeSets.length - 1].wsgId;
  }

  /** Download all change sets of the specified iModel */
  private static async downloadChangeSets(requestContext: AuthorizedClientRequestContext, changeSetsPath: string, _projectId: string, iModelId: GuidString): Promise<ChangeSet[]> {
    const query = new ChangeSetQuery();
    query.selectDownloadUrl();

    let perfLogger = new PerfLogger("HubUtility.downloadChangeSets -> Get ChangeSet Infos");
    const changeSets: ChangeSet[] = await BriefcaseManager.imodelClient.changeSets.get(requestContext, iModelId, query);
    perfLogger.dispose();
    if (changeSets.length === 0)
      return new Array<ChangeSet>();

    perfLogger = new PerfLogger("HubUtility.downloadChangeSets -> Download ChangeSets");
    await BriefcaseManager.imodelClient.changeSets.download(requestContext, changeSets, changeSetsPath);
    perfLogger.dispose();
    return changeSets;
  }

  /** Download all named versions of the specified iModel */
  private static async downloadNamedVersions(requestContext: AuthorizedClientRequestContext, _projectId: string, iModelId: GuidString): Promise<Version[]> {
    const query = new VersionQuery();
    query.orderBy("createdDate");

    const perfLogger = new PerfLogger("HubUtility.downloadNamedVersions -> Get Version Infos");
    const versions: Version[] = await BriefcaseManager.imodelClient.versions.get(requestContext, iModelId, query);
    perfLogger.dispose();
    if (versions.length === 0)
      return new Array<ChangeSet>();
    return versions;
  }

  /** Download an IModel's seed files and change sets from the Hub.
   *  A standard hierarchy of folders is created below the supplied downloadDir
   */
  public static async downloadIModelById(requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString, downloadDir: string): Promise<void> {
    // Recreate the download folder if necessary
    if (IModelJsFs.existsSync(downloadDir))
      HubUtility.deleteDirectoryRecursive(downloadDir);
    HubUtility.makeDirectoryRecursive(downloadDir);

    const iModel: HubIModel | undefined = await HubUtility.queryIModelById(requestContext, projectId, iModelId);
    if (!iModel)
      return Promise.reject(`IModel with id ${iModelId} not found`);

    // Write the JSON representing the iModel
    const iModelJsonStr = JSON.stringify(iModel, undefined, 4);
    const iModelJsonPathname = path.join(downloadDir, "imodel.json");
    IModelJsFs.writeFileSync(iModelJsonPathname, iModelJsonStr);

    // Download the seed file
    const seedPathname = path.join(downloadDir, "seed", iModel.name!.concat(".bim"));
    const perfLogger = new PerfLogger("HubUtility.downloadIModelById -> Download Seed File");
    await BriefcaseManager.imodelClient.iModels.download(requestContext, iModelId, seedPathname);
    perfLogger.dispose();

    // Download the change sets
    const changeSetDir = path.join(downloadDir, "changeSets//");
    const changeSets: ChangeSet[] = await HubUtility.downloadChangeSets(requestContext, changeSetDir, projectId, iModelId);

    const changeSetsJsonStr = JSON.stringify(changeSets, undefined, 4);
    const changeSetsJsonPathname = path.join(downloadDir, "changeSets.json");
    IModelJsFs.writeFileSync(changeSetsJsonPathname, changeSetsJsonStr);

    // Download the version information
    const namedVersions: Version[] = await HubUtility.downloadNamedVersions(requestContext, projectId, iModelId);
    const namedVersionsJsonStr = JSON.stringify(namedVersions, undefined, 4);
    const namedVersionsJsonPathname = path.join(downloadDir, "namedVersions.json");
    IModelJsFs.writeFileSync(namedVersionsJsonPathname, namedVersionsJsonStr);
  }

  /** Download an IModel's seed files and change sets from the Hub.
   *  A standard hierarchy of folders is created below the supplied downloadDir
   */
  public static async downloadIModelByName(requestContext: AuthorizedClientRequestContext, projectName: string, iModelName: string, downloadDir: string): Promise<void> {
    const projectId: string = await HubUtility.queryProjectIdByName(requestContext, projectName);

    const iModel: HubIModel | undefined = await HubUtility.queryIModelByName(requestContext, projectId, iModelName);
    if (!iModel)
      return Promise.reject(`IModel ${iModelName} not found`);
    const iModelId = iModel.id!;

    await HubUtility.downloadIModelById(requestContext, projectId, iModelId, downloadDir);
  }

  /** Delete an IModel from the hub
   * @internal
   */
  public static async deleteIModel(requestContext: AuthorizedClientRequestContext, projectName: string, iModelName: string): Promise<void> {
    const projectId: string = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const iModelId: GuidString = await HubUtility.queryIModelIdByName(requestContext, projectId, iModelName);

    await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, iModelId);
  }

  public static dumpChangeSetFile(iModel: IModelDb, dir: string, whichCs: string): void {
    const changeSets: ChangeSetToken[] = HubUtility.readChangeSets(dir);

    changeSets.forEach((changeSet) => {
      if (changeSet.id === whichCs) {
        BriefcaseManager.dumpChangeSet(iModel.briefcase, changeSet);
        return;
      }
    });

    throw new Error(whichCs + " - .cs file not found in directory " + dir);
  }

  /** Get the pathname of the briefcasein the supplied directory - assumes a standard layout of the supplied directory */
  public static getBriefcasePathname(iModelDir: string): string {
    const seedPathname = HubUtility.getSeedPathname(iModelDir);
    return path.join(iModelDir, path.basename(seedPathname));
  }

  /** Validate all change set operations on an iModel on disk - the supplied directory contains a sub folder
   * with the seed files, change sets, etc. in a standard format. This tests merging the change sets, reversing them,
   * and finally reinstating them. The method also logs the necessary performance
   * metrics with these operations.
   */
  public static validateAllChangeSetOperationsOnDisk(iModelDir: string) {
    const briefcasePathname = HubUtility.getBriefcasePathname(iModelDir);

    Logger.logInfo(HubUtility.logCategory, "Creating standalone iModel");
    HubUtility.createStandaloneIModel(briefcasePathname, iModelDir);
    const iModel: IModelDb = IModelDb.openStandalone(briefcasePathname, OpenMode.ReadWrite);

    const changeSets: ChangeSetToken[] = HubUtility.readChangeSets(iModelDir);

    let status: ChangeSetStatus;

    // Logger.logInfo(HubUtility.logCategory, "Dumping all available change sets");
    // HubUtility.dumpStandaloneChangeSets(iModel, changeSets);

    Logger.logInfo(HubUtility.logCategory, "Merging all available change sets");
    status = HubUtility.applyStandaloneChangeSets(iModel, changeSets, ChangeSetApplyOption.Merge);

    if (status === ChangeSetStatus.Success) {
      Logger.logInfo(HubUtility.logCategory, "Reversing all available change sets");
      changeSets.reverse();
      status = HubUtility.applyStandaloneChangeSets(iModel, changeSets, ChangeSetApplyOption.Reverse);
    }

    if (status === ChangeSetStatus.Success) {
      Logger.logInfo(HubUtility.logCategory, "Reinstating all available change sets");
      changeSets.reverse();
      status = HubUtility.applyStandaloneChangeSets(iModel, changeSets, ChangeSetApplyOption.Reinstate);
    }

    iModel.closeStandalone();
    assert(status === ChangeSetStatus.Success, "Error applying change sets");
  }

  /** Validate all change set operations by downloading seed files & change sets, creating a standalone iModel,
   * merging the change sets, reversing them, and finally reinstating them. The method also logs the necessary performance
   * metrics with these operations.
   */
  public static async validateAllChangeSetOperations(requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString, iModelDir: string) {
    Logger.logInfo(HubUtility.logCategory, "Downloading seed file and all available change sets");
    await HubUtility.downloadIModelById(requestContext, projectId, iModelId, iModelDir);

    this.validateAllChangeSetOperationsOnDisk(iModelDir);
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
  public static async pushIModel(requestContext: AuthorizedClientRequestContext, projectId: string, pathname: string): Promise<GuidString> {
    // Delete any existing iModels with the same name as the required iModel
    const iModelName = path.basename(pathname, ".bim");
    let iModel: HubIModel | undefined = await HubUtility.queryIModelByName(requestContext, projectId, iModelName);
    if (iModel) {
      await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, iModel.id!);
    }

    // Upload a new iModel
    iModel = await BriefcaseManager.imodelClient.iModels.create(requestContext, projectId, iModelName, pathname, "", undefined, 10 * 60 * 1000);
    return iModel.id!;
  }

  /** Upload an IModel's seed files and change sets to the hub
   * It's assumed that the uploadDir contains a standard hierarchy of seed files and change sets.
   */
  public static async pushIModelAndChangeSets(requestContext: AuthorizedClientRequestContext, projectName: string, uploadDir: string): Promise<GuidString> {
    const projectId: string = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const seedPathname = HubUtility.getSeedPathname(uploadDir);
    const iModelId = await HubUtility.pushIModel(requestContext, projectId, seedPathname);

    const briefcase: HubBriefcase = await BriefcaseManager.imodelClient.briefcases.create(requestContext, iModelId);
    if (!briefcase) {
      return Promise.reject(`Could not acquire a briefcase for the iModel ${iModelId}`);
    }
    briefcase.iModelId = iModelId;

    await HubUtility.pushChangeSets(requestContext, briefcase, uploadDir);
    await HubUtility.pushNamedVersions(requestContext, briefcase, uploadDir);
    return iModelId;
  }

  private static async pushChangeSets(requestContext: AuthorizedClientRequestContext, briefcase: HubBriefcase, uploadDir: string): Promise<void> {
    const changeSetJsonPathname = path.join(uploadDir, "changeSets.json");
    if (!IModelJsFs.existsSync(changeSetJsonPathname))
      return;

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
      changeSet.changesType = changeSetJson.changesType;
      changeSet.seedFileId = briefcase.fileId;
      changeSet.briefcaseId = briefcase.briefcaseId;

      await BriefcaseManager.imodelClient.changeSets.create(requestContext, briefcase.iModelId!, changeSet, changeSetPathname);
    }
  }

  private static async pushNamedVersions(requestContext: AuthorizedClientRequestContext, briefcase: HubBriefcase, uploadDir: string): Promise<void> {
    const namedVersionsJsonPathname = path.join(uploadDir, "namedVersions.json");
    if (!IModelJsFs.existsSync(namedVersionsJsonPathname))
      return;

    const jsonStr = IModelJsFs.readFileSync(namedVersionsJsonPathname) as string;
    const namedVersionsJson = JSON.parse(jsonStr);

    for (const namedVersionJson of namedVersionsJson) {
      await BriefcaseManager.imodelClient.versions.create(requestContext, briefcase.iModelId!, namedVersionJson.changeSetId, namedVersionJson.name, namedVersionJson.description);
    }
  }

  /**
   * Purges all acquired briefcases for the specified iModel (and user), if the specified threshold of acquired briefcases is exceeded
   */
  public static async purgeAcquiredBriefcases(requestContext: AuthorizedClientRequestContext, projectName: string, iModelName: string, acquireThreshold: number = 16): Promise<void> {
    const projectId: string = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const iModelId: GuidString = await HubUtility.queryIModelIdByName(requestContext, projectId, iModelName);

    const briefcases: HubBriefcase[] = await BriefcaseManager.imodelClient.briefcases.get(requestContext, iModelId, new BriefcaseQuery().ownedByMe());
    if (briefcases.length > acquireThreshold) {
      Logger.logInfo(HubUtility.logCategory, `Reached limit of maximum number of briefcases for ${projectName}:${iModelName}. Purging all briefcases.`);

      const promises = new Array<Promise<void>>();
      briefcases.forEach((briefcase: HubBriefcase) => {
        promises.push(BriefcaseManager.imodelClient.briefcases.delete(requestContext, iModelId, briefcase.briefcaseId!));
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
      tokens.push(new ChangeSetToken(changeSetJson.id, changeSetJson.parentId, +changeSetJson.index, changeSetPathname, changeSetJson.changesType === ChangesType.Schema));
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
    const perfLogger = new PerfLogger(`Applying change sets for operation ${ChangeSetApplyOption[applyOption]}`);

    // Apply change sets one by one to debug any issues
    for (const changeSet of changeSets) {
      const tempChangeSets = [changeSet];
      const status: ChangeSetStatus = BriefcaseManager.applyStandaloneChangeSets(iModel.briefcase, tempChangeSets, applyOption);
      if (status === ChangeSetStatus.Success) {
        Logger.logInfo(HubUtility.logCategory, "Successfully applied ChangeSet", () => ({ ...changeSet, status, applyOption }));
      } else {
        Logger.logError(HubUtility.logCategory, "Error applying ChangeSet", () => ({ ...changeSet, status, applyOption }));
      }
      if (status !== ChangeSetStatus.Success)
        return status;
    }

    perfLogger.dispose();
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
  public async authorizeUser(requestContext: ClientRequestContext, userCredentials: ImsUserCredentials): Promise<AccessToken> {
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient()).getToken(requestContext, userCredentials);
    assert(!!authToken);

    const accessToken: AccessToken = await (new ImsDelegationSecureTokenClient()).getToken(requestContext, authToken!);
    assert(!!accessToken);

    Logger.logTrace(HubUtility.logCategory, `Logged in test user ${userCredentials.email}`);
    return accessToken;
  }
}

/** An implementation of IModelProjectAbstraction backed by a iModelHub/Connect project */
class TestIModelHubProject {
  public get isIModelHub(): boolean { return true; }
  public terminate(): void { }

  public get iModelHubClient(): IModelHubClient {
    return BriefcaseManager.imodelClient as IModelHubClient;
  }

  public async queryProject(requestContext: AuthorizedClientRequestContext, query: any | undefined): Promise<Project> {
    const client = BriefcaseManager.connectClient;
    return client.getProject(requestContext, query);
  }
  public async createIModel(requestContext: AuthorizedClientRequestContext, projectId: string, params: any): Promise<HubIModel> {
    const client = this.iModelHubClient;
    return client.iModels.create(requestContext, projectId, params.name, params.seedFile, params.description, params.tracker);
  }
  public async deleteIModel(requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString): Promise<void> {
    const client = this.iModelHubClient;
    return client.iModels.delete(requestContext, projectId, iModelId);
  }
  public async queryIModels(requestContext: AuthorizedClientRequestContext, projectId: string, query: IModelQuery | undefined): Promise<HubIModel[]> {
    const client = this.iModelHubClient;
    return client.iModels.get(requestContext, projectId, query);
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

  throw new Error("WIP");
}
