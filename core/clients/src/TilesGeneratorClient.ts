/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OtherServices */

import { ECJsonTypeMap, WsgInstance } from "./ECJsonTypeMap";
import { DeploymentEnv, UrlDescriptor } from "./Client";
import { WsgClient } from "./WsgClient";
import { AccessToken } from "./Token";
import { IModelWebNavigatorClient } from "./IModelWebNavigatorClient";
import { RequestQueryOptions } from "./Request";

/** Job */
@ECJsonTypeMap.classToJson("wsg", "TilePublisher.Job", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class Job extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ContextId")
  public contextId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Data")
  public data?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.DataId")
  public dataId?: string;

  /** This is typically the imodelid */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.DocumentId")
  public documentId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Failure")
  public failure?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.File")
  public file?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.OwnedBy")
  public ownedBy?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Status")
  public status?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Tiles")
  public tiles?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.TilesId")
  public tilesId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.VersionId")
  public versionId?: string;
}

/**
 * Client API to query for Tile Jobs.
 */
export class TilesGeneratorClient extends WsgClient {
  public static readonly searchKey: string = "3dTilesGenerator.URL";

  private static readonly _defaultUrlDescriptor: UrlDescriptor = {
    DEV: "https://dev-3dtilesgenerator.bentley.com",
    QA: "https://qa-3dtilesgenerator.bentley.com",
    PROD: "https://3dtilesgenerator.bentley.com",
    PERF: "https://perf-3dtilesgenerator.bentley.com",
  };

  /**
   * Creates an instance of TilesGeneratorClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(public deploymentEnv: DeploymentEnv) {
    super(deploymentEnv, "v2.5", TilesGeneratorClient._defaultUrlDescriptor[deploymentEnv] + "/");
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return TilesGeneratorClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    return TilesGeneratorClient._defaultUrlDescriptor[this.deploymentEnv];
  }

  /**
   * Queries for tile generator jobs
   * @param token Delegation token of the authorized user issued for this service.
   * @param queryOptions Query options. Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Resolves to array of jobs.
   */
  public async getJobs(token: AccessToken, queryOptions?: RequestQueryOptions): Promise<Job[]> {
    return this.getInstances<Job>(Job, token, "/Repositories/BentleyCONNECT--Main/TilePublisher/Job", queryOptions);
  }

  /**
   * Gets a tile gnerator job
   * @param token Delegation token of the authorized user issued for this service.
   * @param queryOptions Query options. Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Resolves to the found job. Rejects if no jobs, or more than one job is found.
   */
  public async getJob(token: AccessToken, queryOptions?: RequestQueryOptions): Promise<Job> {
    return this.getJobs(token, queryOptions)
      .then((jobs: Job[]) => {
        if (jobs.length !== 1) {
          return Promise.reject(new Error("Expected a single version to be returned by query"));
        }
        return Promise.resolve(jobs[0]);
      });
  }

  /**
   * Builds the URL to navigate/browse a iModel on the Web
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId Id of the connect project containing the iModel to be navigated.
   * @param iModelId Id of the iModel to be navigated.
   * @param versionId Id of the named version to be navigated.
   */
  public async buildWebNavigatorUrl(accessToken: AccessToken, projectId: string, iModelId: string, versionId: string): Promise<string> {
    // The service can be queried ONLY by single instance ID filter.
    const instanceId: string = `${projectId}--${iModelId}--${versionId}`;
    const queryOptions: RequestQueryOptions = {
      $select: "*",
      $filter: `$id+eq+'${instanceId}'`,
    };

    const job: Job = await this.getJob(accessToken, queryOptions);

    const webNavigatorClient = new IModelWebNavigatorClient(this.deploymentEnv);
    const webNavigatorUrl: string = await webNavigatorClient.getUrl();

    return `${webNavigatorUrl}/?id=${job.tilesId}&projectId=${job.contextId}&dataId=${job.dataId}`;
  }
}
