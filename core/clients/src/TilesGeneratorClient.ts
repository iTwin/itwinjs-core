/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OtherServices */

import { ECJsonTypeMap, WsgInstance } from "./ECJsonTypeMap";
import { WsgClient } from "./WsgClient";
import { AccessToken } from "./Token";
import { IModelWebNavigatorClient } from "./IModelWebNavigatorClient";
import { RequestQueryOptions } from "./Request";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { Config } from "./Config";

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
  public static readonly configURL = "imjs_3dtile_generator_url";
  public static readonly configRelyingPartyUri = "imjs_3dtile_generator_relying_party_uri";
  public static readonly configRegion = "imjs_3dtile_generator_region";
  /**
   * Creates an instance of TilesGeneratorClient.
   */
  public constructor() {
    super("v2.5");
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
    if (Config.App.has(TilesGeneratorClient.configURL))
      return Config.App.get(TilesGeneratorClient.configURL);

    throw new Error(`Service URL not set. Set it in Config.App using key ${TilesGeneratorClient.configURL}`);
  }

  /**
   * Override default region for this service
   * @returns region id or undefined
   */
  protected getRegion(): number | undefined {
    if (Config.App.has(TilesGeneratorClient.configRegion))
      return Config.App.get(TilesGeneratorClient.configRegion);

    return undefined;
  }

  /**
   * Gets theRelyingPartyUrl for the service.
   * @returns RelyingPartyUrl for the service.
   */
  protected getRelyingPartyUrl(): string {
    if (Config.App.has(TilesGeneratorClient.configRelyingPartyUri))
      return Config.App.get(TilesGeneratorClient.configRelyingPartyUri) + "/";

    if (Config.App.getBoolean(WsgClient.configUseHostRelyingPartyUriAsFallback, true)) {
      if (Config.App.has(WsgClient.configHostRelyingPartyUri))
        return Config.App.get(WsgClient.configHostRelyingPartyUri) + "/";
    }

    throw new Error(`RelyingPartyUrl not set. Set it in Config.App using key ${TilesGeneratorClient.configRelyingPartyUri}`);
  }
  /**
   * Queries for tile generator jobs
   * @param token Delegation token of the authorized user issued for this service.
   * @param queryOptions Query options. Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Resolves to array of jobs.
   */
  public async getJobs(alctx: ActivityLoggingContext, token: AccessToken, queryOptions?: RequestQueryOptions): Promise<Job[]> {
    return this.getInstances<Job>(alctx, Job, token, "/Repositories/BentleyCONNECT--Main/TilePublisher/Job", queryOptions);
  }

  /**
   * Gets a tile gnerator job
   * @param token Delegation token of the authorized user issued for this service.
   * @param queryOptions Query options. Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Resolves to the found job. Rejects if no jobs, or more than one job is found.
   */
  public async getJob(alctx: ActivityLoggingContext, token: AccessToken, queryOptions?: RequestQueryOptions): Promise<Job> {
    return this.getJobs(alctx, token, queryOptions)
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
  public async buildWebNavigatorUrl(alctx: ActivityLoggingContext, accessToken: AccessToken, projectId: string, iModelId: string, versionId: string): Promise<string> {
    // The service can be queried ONLY by single instance ID filter.
    const instanceId: string = `${projectId}--${iModelId}--${versionId}`;
    const queryOptions: RequestQueryOptions = {
      $select: "*",
      $filter: `$id+eq+'${instanceId}'`,
    };

    const job: Job = await this.getJob(alctx, accessToken, queryOptions);

    const webNavigatorClient = new IModelWebNavigatorClient();
    const webNavigatorUrl: string = await webNavigatorClient.getUrl(alctx);

    return `${webNavigatorUrl}/?id=${job.tilesId}&projectId=${job.contextId}&dataId=${job.dataId}`;
  }
}
