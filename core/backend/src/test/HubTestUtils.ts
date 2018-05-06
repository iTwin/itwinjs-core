/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import {
  ConnectClient, IModelHubClient, IModel as HubIModel, AccessToken, Project, IModelQuery, AzureFileHandler,
  ChangeSet, ChangeSetQuery, Briefcase as HubBriefcase,
} from "@bentley/imodeljs-clients";
import { IModelHost } from "../IModelHost";
import { IModelJsFs } from "../IModelJsFs";
import { ChangeSetToken, BriefcaseManager, BriefcaseId } from "../BriefcaseManager";
import { IModelDb } from "../IModelDb";
import { ChangeSetApplyOption, OpenMode, ChangeSetStatus } from "@bentley/bentleyjs-core";

import * as path from "path";

export class HubTestUtils {
  public static hubClient?: IModelHubClient;
  public static connectClient?: ConnectClient;

  private static initialize() {
    if (HubTestUtils.hubClient && HubTestUtils.connectClient)
      return;
    if (!IModelHost.configuration)
      throw new Error("IModelHost.startup() should be called before any backend operations");
    HubTestUtils.connectClient = new ConnectClient(IModelHost.configuration.iModelHubDeployConfig);
    HubTestUtils.hubClient = new IModelHubClient(IModelHost.configuration.iModelHubDeployConfig, new AzureFileHandler());
  }

  private static makeDirectoryRecursive(dirPath: string) {
    if (IModelJsFs.existsSync(dirPath))
      return;
    HubTestUtils.makeDirectoryRecursive(path.dirname(dirPath));
    IModelJsFs.mkdirSync(dirPath);
  }

  private static async queryProjectByName(accessToken: AccessToken, projectName: string): Promise<Project | undefined> {
    const project: Project = await HubTestUtils.connectClient!.getProject(accessToken, {
      $select: "*",
      $filter: "Name+eq+'" + projectName + "'",
    });
    return project;
  }

  private static async queryIModelByName(accessToken: AccessToken, projectId: string, iModelName: string): Promise<HubIModel | undefined> {
    const iModels = await HubTestUtils.hubClient!.IModels().get(accessToken, projectId, new IModelQuery().byName(iModelName));
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
    HubTestUtils.initialize();
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
    HubTestUtils.initialize();
    const iModel: HubIModel | undefined = await HubTestUtils.queryIModelByName(accessToken, projectId, iModelName);
    if (!iModel)
      return Promise.reject(`IModel ${iModelName} not found`);
    return iModel.wsgId;
  }

  /** Download all change sets of the specified iModel */
  private static async downloadChangeSets(accessToken: AccessToken, changeSetsPath: string, iModelId: string): Promise<ChangeSet[]> {
    const query = new ChangeSetQuery();
    query.selectDownloadUrl();

    const changeSets: ChangeSet[] = await HubTestUtils.hubClient!.ChangeSets().get(accessToken, iModelId, query);
    if (changeSets.length === 0)
      return new Array<ChangeSet>();

    await HubTestUtils.hubClient!.ChangeSets().download(changeSets, changeSetsPath);
    return changeSets;
  }

  /** Download an IModel's seed files and change sets from the Hub */
  public static async downloadIModel(accessToken: AccessToken, projectName: string, iModelName: string, downloadDir: string): Promise<void> {
    HubTestUtils.initialize();

    const projectId: string = await HubTestUtils.queryProjectIdByName(accessToken, projectName);

    const iModel: HubIModel | undefined = await HubTestUtils.queryIModelByName(accessToken, projectId, iModelName);
    if (!iModel)
      return Promise.reject(`IModel ${iModelName} not found`);
    const iModelId = iModel.wsgId;

    // Recreate the download folder if necessary
    if (IModelJsFs.existsSync(downloadDir))
      IModelJsFs.unlinkSync(downloadDir);
    HubTestUtils.makeDirectoryRecursive(downloadDir);

    // Write the JSON representing the iModel
    const iModelJsonStr = JSON.stringify(iModel, undefined, 4);
    const iModelJsonPathname = path.join(downloadDir, "imodel.json");
    IModelJsFs.writeFileSync(iModelJsonPathname, iModelJsonStr);

    // Download the seed file
    const seedPathname = path.join(downloadDir, "seed", iModel.name!.concat(".bim"));
    await HubTestUtils.hubClient!.IModels().download(accessToken, iModelId, seedPathname);

    // Download the change sets
    const changeSetDir = path.join(downloadDir, "changeSets//");
    const changeSets: ChangeSet[] = await HubTestUtils.downloadChangeSets(accessToken, changeSetDir, iModelId);

    const changeSetsJsonStr = JSON.stringify(changeSets, undefined, 4);
    const changeSetsJsonPathname = path.join(downloadDir, "changeSets.json");
    IModelJsFs.writeFileSync(changeSetsJsonPathname, changeSetsJsonStr);
  }

  /** Internal debug utility to delete an IModel from the hub
   * @hidden
   */
  public static async deleteIModel(accessToken: AccessToken, projectName: string, iModelName: string): Promise<void> {
    HubTestUtils.initialize();

    const projectId: string = await HubTestUtils.queryProjectIdByName(accessToken, projectName);
    const iModelId: string = await HubTestUtils.queryIModelIdByName(accessToken, projectId, iModelName);

    await HubTestUtils.hubClient!.IModels().delete(accessToken, projectId, iModelId);
  }

  private static getSeedPathname(iModelDir: string) {
    const seedFileDir = path.join(iModelDir, "seed");
    const seedFileNames = IModelJsFs.readdirSync(seedFileDir);
    if (seedFileNames.length !== 1) {
      throw new Error(`Expected to find one and only one seed file in: ${seedFileDir}`);
    }
    const seedFileName = seedFileNames[0];
    const seedPathname = path.join(seedFileDir, seedFileName);
    return seedPathname;
  }

  /** Internal debug utility to upload an IModel's seed files and change sets to the hub
   *  @hidden
   */
  public static async uploadIModel(accessToken: AccessToken, projectName: string, uploadDir: string): Promise<string> {
    HubTestUtils.initialize();

    const projectId: string = await HubTestUtils.queryProjectIdByName(accessToken, projectName);

    const seedPathname = HubTestUtils.getSeedPathname(uploadDir);

    // Delete any existing iModels with the same name as the required iModel
    const iModelName = path.basename(seedPathname, ".bim");
    let iModel: HubIModel | undefined = await HubTestUtils.queryIModelByName(accessToken, projectId, iModelName);
    if (iModel)
      await HubTestUtils.hubClient!.IModels().delete(accessToken, projectId, iModel.wsgId);

    // Upload a new iModel
    iModel = await HubTestUtils.hubClient!.IModels().create(accessToken, projectId, iModelName, seedPathname, "", 2 * 60 * 1000);
    const iModelId = iModel!.wsgId;

    const briefcase: HubBriefcase = await HubTestUtils.hubClient!.Briefcases().create(accessToken, iModelId);
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

      await HubTestUtils.hubClient!.ChangeSets().create(accessToken, iModelId, changeSet, changeSetPathname);
    }

    return iModelId;
  }

  /**
   * Purges all acquired briefcases for the specified iModel (and user), if the specified threshold of acquired briefcases is exceeded
   */
  public static async purgeAcquiredBriefcases(accessToken: AccessToken, projectName: string, iModelName: string, acquireThreshold: number = 16): Promise<void> {
    const projectId: string = await HubTestUtils.queryProjectIdByName(accessToken, projectName);
    const iModelId: string = await HubTestUtils.queryIModelIdByName(accessToken, projectId, iModelName);

    const briefcases: HubBriefcase[] = await HubTestUtils.hubClient!.Briefcases().get(accessToken, iModelId);
    if (briefcases.length > acquireThreshold) {
      console.log(`Reached limit of maximum number of briefcases for ${projectName}:${iModelName}. Purging all briefcases.`); // tslint:disable-line

      const promises = new Array<Promise<void>>();
      briefcases.forEach((briefcase: HubBriefcase) => {
        promises.push(HubTestUtils.hubClient!.Briefcases().delete(accessToken, iModelId, briefcase.briefcaseId!));
      });
      await Promise.all(promises);
    }
  }

  /** Internal debug utility to upload an IModel's seed files and change sets to the hub
   *  @hidden
   */
  public static mergeIModel(iModelDir: string) {
    HubTestUtils.initialize();

    const seedPathname = HubTestUtils.getSeedPathname(iModelDir);
    const seedFileName = path.basename(seedPathname);
    const briefcasePathname = path.join(iModelDir, seedFileName);
    IModelJsFs.copySync(seedPathname, briefcasePathname);

    const changeSetJsonPathname = path.join(iModelDir, "changeSets.json");
    if (!IModelJsFs.existsSync(changeSetJsonPathname))
      return;

    const jsonStr = IModelJsFs.readFileSync(changeSetJsonPathname) as string;
    const changeSetsJson = JSON.parse(jsonStr);

    const iModel = IModelDb.openStandalone(briefcasePathname, OpenMode.ReadWrite);
    iModel.briefcase.nativeDb.setBriefcaseId(BriefcaseId.Standalone);
    iModel.briefcase.briefcaseId = BriefcaseId.Standalone;

    for (const changeSetJson of changeSetsJson) {
      const changeSetPathname = path.join(iModelDir, "changeSets", changeSetJson.fileName);
      if (!IModelJsFs.existsSync(changeSetPathname)) {
        throw new Error("Cannot find the ChangeSet file: " + changeSetPathname);
      }

      const changeSetTokens = [new ChangeSetToken(changeSetJson.id, changeSetJson.parentId, changeSetJson.index, changeSetPathname, changeSetJson.containsSchemaChanges)];
      const status: ChangeSetStatus = BriefcaseManager.applyStandaloneChangeSet(iModel.briefcase, changeSetTokens, ChangeSetApplyOption.Merge, !!changeSetJson.containsSchemaChanges);
      if (status !== ChangeSetStatus.Success)
        throw new Error(`Error merging change set ${changeSetJson.id}`);
      else
        console.log(`Successfully merged change set ${changeSetJson.id}`); // tslint:disable-line:no-console
    }
  }

}
