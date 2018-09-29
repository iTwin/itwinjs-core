/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OtherServices */

import { ECJsonTypeMap, WsgInstance } from "./ECJsonTypeMap";
import { DeploymentEnv, UrlDescriptor } from "./Client";
import { WsgClient } from "./WsgClient";
import { AccessToken } from "./Token";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** RealityData */
@ECJsonTypeMap.classToJson("wsg", "TileDataAccess.InstanceData", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class InstanceData extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Content")
  public content?: string;
}

/**
 * Client wrapper to Tile Data Access Service
 */
export class TileDataAccessClient extends WsgClient {
  public static readonly searchKey: string = "tilesdataaccess";
  private static readonly _defaultUrlDescriptor: UrlDescriptor = {
    DEV: "https://dev-connect-tilesdataaccess.bentley.com",
    QA: "https://qa-connect-tilesdataaccess.bentley.com",
    PROD: "https://connect-tilesdataaccess.bentley.com",
    PERF: "https://perf-connect-tilesdataaccess.bentley.com",
  };

  /**
   * Creates an instance of TileDataAccessClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(public deploymentEnv: DeploymentEnv) {
    super(deploymentEnv, "v2.5", TileDataAccessClient._defaultUrlDescriptor[deploymentEnv] + "/");
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return TileDataAccessClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    return TileDataAccessClient._defaultUrlDescriptor[this.deploymentEnv];
  }

  /**
   * Gets reality data properties
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @returns an array of RealityData
   */
  public async getPropertyData(alctx: ActivityLoggingContext, token: AccessToken, dataId: string, elemId: string): Promise<InstanceData[]> {
    return this.getInstances<InstanceData>(alctx, InstanceData, token, `/Repositories/BentleyCONNECT--${dataId}/TileDataAccess/InstanceData/${elemId}`);
  }

}
