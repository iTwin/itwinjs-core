/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ApplicationType, BriefcaseDb, BriefcaseManager, ECSqlStatement, IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { AccessToken, AuthorizedClientRequestContext, RequestGlobalOptions } from "@bentley/itwin-client";
import { IModelHubClient } from "@bentley/imodelhub-client";
import { Config, DbResult, Logger, LogLevel } from "@bentley/bentleyjs-core";

// Increase the default timeout to 4 min (default is 25 secs)
RequestGlobalOptions.timeout.deadline = 4 * 60 * 1000;

const FILEID_ECSQL = `SELECT RepositoryGuid as FileId from bis.RepositoryLink`;
const MASTER_SUBJECT_HIERARCHY_ECSQL = `SELECT
      repoLink.RepositoryGuid as FileId,
      repoLink.ECInstanceId as RepositoryLinkId,
      physicalPartition.ECInstanceId as PartitionId,
      subject.ECInstanceId as SubjectId,
      subject.Parent.Id as ParentSubjectId
  FROM bis.RepositoryLink repoLink
  JOIN bis.ElementHasLinks el ON repoLink.ECInstanceId=el.TargetECInstanceId
  JOIN bisCore.PhysicalPartition physicalPartition ON physicalPartition.ECInstanceId=el.SourceECInstanceId
  JOIN bisCore.SubjectOwnsPartitionElements subjectLink ON subjectLink.TargetECInstanceId=physicalPartition.ECInstanceId
  JOIN bisCore.Subject subject ON subject.ECInstanceId=subjectLink.SourceECInstanceId
  `;

interface IModelFileInfo {
  fileId: string;
  subjectId: string;
  parentSubjectId: string;
}

export class IModelApi {
  private static isInitialized = false;
  private static async makeSureInitialized(buddiCode: string, cacheDirectory: string) {
    Config.App.set("imjs_buddi_resolve_url_using_region", buddiCode);
    Logger.logInfo("iModelHubManager", `Using BUDDI region code ${  buddiCode}`);

    if (this.isInitialized || !!IModelHost.configuration) {
      Logger.logInfo("iModelHubManager", "iModelJs is initialized");
      return;
    }
    this.isInitialized = true;
    Logger.logInfo("iModelHubManager", "Initializing iModelJs");

    try {
      Logger.logInfo("iModelHubManager", "Logger initialize");
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Warning);

      const cacheDir = cacheDirectory;
      const imHostConfig = new IModelHostConfiguration();

      Logger.logInfo("iModelHubManager", `Cache dir is: ${cacheDir}`);
      imHostConfig.cacheDir = cacheDir;
      imHostConfig.applicationType = ApplicationType.WebAgent;

      Logger.logInfo("iModelHubManager", "iModelHost startup");
      await IModelHost.startup(imHostConfig);
    } catch (e) {
      Logger.logInfo("iModelHubManager", "iModel startup failed");
      Logger.logError("iModelHubManager", e);
      throw e;
    }
  }

  public static async createBriefcase(buddiCode: string, cacheDirectory: string, token: string, iModelId: string) {
    await this.makeSureInitialized(buddiCode, cacheDirectory);

    const accessToken = AccessToken.fromTokenString(token);

    const requestContext = new AuthorizedClientRequestContext(accessToken); // TODO: pass activity ID so we log with it?

    const client = new IModelHubClient();

    const newBriefcase = await client.briefcases.create(requestContext, iModelId);

    return newBriefcase;
  }

  public static async getBriefcase(
    buddiCode: string,
    cacheDirectory: string,
    token: string,
    projectId: string,
    imodelId: string
  ): Promise<BriefcaseDb> {
    await this.makeSureInitialized(buddiCode, cacheDirectory);
    Logger.logInfo("iModelHubManager", "Starting getBriefcase");

    Logger.logInfo("iModelHubManager", "Forming request context");
    const accessToken = AccessToken.fromTokenString(token);
    const requestContext = new AuthorizedClientRequestContext(accessToken); // TODO: pass activity ID so we log with it?

    Logger.logInfo("iModelHubManager", `${new Date().toISOString()} Downloading Briefcase Manager Project:${projectId} iModelId:${imodelId}`);
    const briefcaseProps = await BriefcaseManager.downloadBriefcase(requestContext, {
      contextId: projectId,
      iModelId: imodelId,
    });

    Logger.logInfo("iModelHubManager", `${new Date().toISOString()} Opening briefcase`);
    return BriefcaseDb.open(requestContext, {
      fileName: briefcaseProps.fileName,
    });
  }

  public static getIModelRepositoryLinkIds(briefcaseDb: BriefcaseDb) {
    Logger.logInfo("iModelHubManager", `${new Date().toISOString()} Querying briefcase for all file ids`);
    const allFilesIds: string[] = [];
    briefcaseDb.withPreparedStatement(FILEID_ECSQL, (stmt: ECSqlStatement) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const row: IModelFileInfo = stmt.getRow();

        if (row && row.fileId) {
          allFilesIds.push(row.fileId);
        }
      }
    });
    return allFilesIds;
  }

  public static getIModelMasterAndReferenceFileIds(briefcaseDb: BriefcaseDb) {
    Logger.logInfo("iModelHubManager", `${new Date().toISOString()} Querying briefcase for master and reference file ids`);
    const allFilesIds: string[] = [];
    briefcaseDb.withPreparedStatement(MASTER_SUBJECT_HIERARCHY_ECSQL, (stmt: ECSqlStatement) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const row: IModelFileInfo = stmt.getRow();

        if (row && row.fileId) {
          allFilesIds.push(row.fileId);
        }
      }
    });
    return allFilesIds;
  }

  public static getIModelMasterToReferenceIdsMap(briefcaseDb: BriefcaseDb): { [fileId: string]: string[] } {
    Logger.logInfo("iModelHubManager", `${new Date().toISOString()} Querying briefcase for master to reference file ids map`);
    const allFiles: IModelFileInfo[] = [];
    briefcaseDb.withPreparedStatement(MASTER_SUBJECT_HIERARCHY_ECSQL, (stmt: ECSqlStatement) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const row: IModelFileInfo = stmt.getRow();

        if (row && row.fileId) {
          allFiles.push(row);
        }
      }
    });

    const masterFiles = allFiles.filter((potentialMaster) => allFiles.every((potentialParent) => !isReference(potentialMaster, potentialParent)));
    const mergedHierarchies: { [fileId: string]: string[] } = {};
    for (const masterFile of masterFiles) {
      const hierarchyIds = getMasterFileHierarchyFiles(masterFile, allFiles).map((file) => file.fileId);
      // In case the same file is the root of two distinct hierarchies, we merge them
      const previousFiles = mergedHierarchies[masterFile.fileId] ?? [];
      const newRelatedFiles = [...new Set([...previousFiles, ...hierarchyIds])];
      mergedHierarchies[masterFile.fileId] = newRelatedFiles;
    }

    return mergedHierarchies;
  }
}

const isReference = (potentialReference: IModelFileInfo, potentialMaster: IModelFileInfo) => {
  return potentialMaster.subjectId === potentialReference.parentSubjectId;
};

const getMasterFileHierarchyFiles = (master: IModelFileInfo, allFiles: IModelFileInfo[]) => {
  // infinite loop protection
  const recursionLimit = 10000;
  let recursionCounter = 0;

  const relatedFilesAccumulator: IModelFileInfo[] = [master];
  let currentLayerFiles: IModelFileInfo[] = [master];
  while (currentLayerFiles.length) {
    const currentLayerFileSubjectIds = currentLayerFiles.map((file) => file.subjectId);
    const nextLayerFiles = allFiles.filter((file) => currentLayerFileSubjectIds.includes(file.parentSubjectId));

    relatedFilesAccumulator.push(...nextLayerFiles);
    currentLayerFiles = [...nextLayerFiles];

    recursionCounter++;
    if (recursionCounter > recursionLimit) {
      throw new Error("iModel subject hierarchy recursion limit reached");
    }
  }

  return relatedFilesAccumulator;
};
