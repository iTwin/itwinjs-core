/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import {
  ConnectClient, IModelHubClient, IModel as HubIModel, AccessToken, Project, IModelQuery, AzureFileHandler,
  ChangeSet, ChangeSetQuery, Briefcase as HubBriefcase,
} from "@bentley/imodeljs-clients";
import { IModelHost } from "../../IModelHost";
import { IModelJsFs } from "../../IModelJsFs";
import { ChangeSetToken, BriefcaseManager, BriefcaseId } from "../../BriefcaseManager";
import { IModelDb } from "../../IModelDb";
import { ChangeSetApplyOption, OpenMode, ChangeSetStatus } from "@bentley/bentleyjs-core";
import { Logger } from "@bentley/bentleyjs-core";

import * as path from "path";

export class HubTestUtils {

  private static _hubClient?: IModelHubClient;
  public static get hubClient(): IModelHubClient {
    if (!HubTestUtils._hubClient) {
      if (!IModelHost.configuration)
        throw new Error("IModelHost.startup() should be called before any backend operations");
      HubTestUtils._hubClient = new IModelHubClient(IModelHost.configuration.iModelHubDeployConfig, new AzureFileHandler());
    }
    return HubTestUtils._hubClient;
  }

  private static _connectClient?: ConnectClient;
  public static get connectClient(): ConnectClient {
    if (!HubTestUtils._connectClient) {
      if (!IModelHost.configuration)
        throw new Error("IModelHost.startup() should be called before any backend operations");
      HubTestUtils._connectClient = new ConnectClient(IModelHost.configuration.iModelHubDeployConfig);
    }
    return HubTestUtils._connectClient;
  }

  public static logCategory = "HubTest";

  private static makeDirectoryRecursive(dirPath: string) {
    if (IModelJsFs.existsSync(dirPath))
      return;
    HubTestUtils.makeDirectoryRecursive(path.dirname(dirPath));
    IModelJsFs.mkdirSync(dirPath);
  }

  private static deleteDirectoryRecursive(dirPath: string) {
    if (!IModelJsFs.existsSync(dirPath))
      return;
    try {
      IModelJsFs.readdirSync(dirPath).forEach((file) => {
        const curPath = dirPath + "/" + file;
        if (IModelJsFs.lstatSync(curPath)!.isDirectory) {
          HubTestUtils.deleteDirectoryRecursive(curPath);
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
    const project: Project = await HubTestUtils.connectClient.getProject(accessToken, {
      $select: "*",
      $filter: "Name+eq+'" + projectName + "'",
    });
    return project;
  }

  private static async queryIModelByName(accessToken: AccessToken, projectId: string, iModelName: string): Promise<HubIModel | undefined> {
    const iModels = await HubTestUtils.hubClient.IModels().get(accessToken, projectId, new IModelQuery().byName(iModelName));
    if (iModels.length === 0)
      return undefined;
    if (iModels.length > 1)
      return Promise.reject(`Too many iModels with name ${iModelName} found`);
    return iModels[0];
  }

  /**
   * Queries the project id by it's name
   * @param accessToken AccessToken
   * @param projectName Name of project
   * @throws If the project is not found, or there is more than one project with the supplied name
   */
  public static async queryProjectIdByName(accessToken: AccessToken, projectName: string): Promise<string> {
    const project: Project | undefined = await HubTestUtils.queryProjectByName(accessToken, projectName);
    if (!project)
      return Promise.reject(`Project ${projectName} not found`);
    return project.wsgId;
  }

  /**
   * Queries the iModel id by it's name
   * @param accessToken AccessToken
   * @param projectId Id of the project
   * @param iModelName Name of the iModel
   * @throws If the iModel is not found, or if there is more than one iModel with the supplied name
   */
  public static async queryIModelIdByName(accessToken: AccessToken, projectId: string, iModelName: string): Promise<string> {
    const iModel: HubIModel | undefined = await HubTestUtils.queryIModelByName(accessToken, projectId, iModelName);
    if (!iModel)
      return Promise.reject(`IModel ${iModelName} not found`);
    return iModel.wsgId;
  }

  /** Download all change sets of the specified iModel */
  private static async downloadChangeSets(accessToken: AccessToken, changeSetsPath: string, iModelId: string): Promise<ChangeSet[]> {
    const query = new ChangeSetQuery();
    query.selectDownloadUrl();

    const changeSets: ChangeSet[] = await HubTestUtils.hubClient.ChangeSets().get(accessToken, iModelId, query);
    if (changeSets.length === 0)
      return new Array<ChangeSet>();

    await HubTestUtils.hubClient.ChangeSets().download(changeSets, changeSetsPath);
    return changeSets;
  }

  /** Download an IModel's seed files and change sets from the Hub */
  public static async downloadIModel(accessToken: AccessToken, projectName: string, iModelName: string, downloadDir: string): Promise<void> {
    const projectId: string = await HubTestUtils.queryProjectIdByName(accessToken, projectName);

    const iModel: HubIModel | undefined = await HubTestUtils.queryIModelByName(accessToken, projectId, iModelName);
    if (!iModel)
      return Promise.reject(`IModel ${iModelName} not found`);
    const iModelId = iModel.wsgId;

    // Recreate the download folder if necessary
    if (IModelJsFs.existsSync(downloadDir))
      HubTestUtils.deleteDirectoryRecursive(downloadDir);
    HubTestUtils.makeDirectoryRecursive(downloadDir);

    // Write the JSON representing the iModel
    const iModelJsonStr = JSON.stringify(iModel, undefined, 4);
    const iModelJsonPathname = path.join(downloadDir, "imodel.json");
    IModelJsFs.writeFileSync(iModelJsonPathname, iModelJsonStr);

    // Download the seed file
    const seedPathname = path.join(downloadDir, "seed", iModel.name!.concat(".bim"));
    await HubTestUtils.hubClient.IModels().download(accessToken, iModelId, seedPathname);

    // Download the change sets
    const changeSetDir = path.join(downloadDir, "changeSets//");
    const changeSets: ChangeSet[] = await HubTestUtils.downloadChangeSets(accessToken, changeSetDir, iModelId);

    const changeSetsJsonStr = JSON.stringify(changeSets, undefined, 4);
    const changeSetsJsonPathname = path.join(downloadDir, "changeSets.json");
    IModelJsFs.writeFileSync(changeSetsJsonPathname, changeSetsJsonStr);
  }

  /** Delete an IModel from the hub
   * @hidden
   */
  public static async deleteIModel(accessToken: AccessToken, projectName: string, iModelName: string): Promise<void> {
    const projectId: string = await HubTestUtils.queryProjectIdByName(accessToken, projectName);
    const iModelId: string = await HubTestUtils.queryIModelIdByName(accessToken, projectId, iModelName);

    await HubTestUtils.hubClient.IModels().delete(accessToken, projectId, iModelId);
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

  /** Upload an IModel's seed files and change sets to the hub
   *  @hidden
   */
  public static async uploadIModel(accessToken: AccessToken, projectName: string, uploadDir: string): Promise<string> {
    const projectId: string = await HubTestUtils.queryProjectIdByName(accessToken, projectName);

    const seedPathname = HubTestUtils.getSeedPathname(uploadDir);

    // Delete any existing iModels with the same name as the required iModel
    const iModelName = path.basename(seedPathname, ".bim");
    let iModel: HubIModel | undefined = await HubTestUtils.queryIModelByName(accessToken, projectId, iModelName);
    if (iModel)
      await HubTestUtils.hubClient.IModels().delete(accessToken, projectId, iModel.wsgId);

    // Upload a new iModel
    iModel = await HubTestUtils.hubClient.IModels().create(accessToken, projectId, iModelName, seedPathname, "", 2 * 60 * 1000);
    const iModelId = iModel!.wsgId;

    const briefcase: HubBriefcase = await HubTestUtils.hubClient.Briefcases().create(accessToken, iModelId);
    if (!briefcase) {
      return Promise.reject(`Could not acquire a briefcase for the iModel ${iModelName}`);
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

      await HubTestUtils.hubClient.ChangeSets().create(accessToken, iModelId, changeSet, changeSetPathname);
    }

    return iModelId;
  }

  /**
   * Purges all acquired briefcases for the specified iModel (and user), if the specified threshold of acquired briefcases is exceeded
   */
  public static async purgeAcquiredBriefcases(accessToken: AccessToken, projectName: string, iModelName: string, acquireThreshold: number = 16): Promise<void> {
    const projectId: string = await HubTestUtils.queryProjectIdByName(accessToken, projectName);
    const iModelId: string = await HubTestUtils.queryIModelIdByName(accessToken, projectId, iModelName);

    const briefcases: HubBriefcase[] = await HubTestUtils.hubClient.Briefcases().get(accessToken, iModelId);
    if (briefcases.length > acquireThreshold) {
      Logger.logInfo(HubTestUtils.logCategory, `Reached limit of maximum number of briefcases for ${projectName}:${iModelName}. Purging all briefcases.`);

      const promises = new Array<Promise<void>>();
      briefcases.forEach((briefcase: HubBriefcase) => {
        promises.push(HubTestUtils.hubClient.Briefcases().delete(accessToken, iModelId, briefcase.briefcaseId!));
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
      tokens.push(new ChangeSetToken(changeSetJson.id, changeSetJson.parentId, changeSetJson.index, changeSetPathname, changeSetJson.containsSchemaChanges));
    }

    return tokens;
  }

  /** Creates a standalone iModel from the seed file (version 0) */
  public static createStandaloneIModel(iModelPathname: string, iModelDir: string) {
    const seedPathname = HubTestUtils.getSeedPathname(iModelDir);

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

      const status: ChangeSetStatus = BriefcaseManager.applyStandaloneChangeSets(iModel.briefcase, tempChangeSets, applyOption, !!changeSet.containsSchemaChanges);

      let msg: string = `Applying change set ${changeSet.index}:${changeSet.id}: `;
      msg = (status === ChangeSetStatus.Success) ? msg.concat("Success") : msg.concat("ERROR!!");
      Logger.logInfo(HubTestUtils.logCategory, msg);

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
