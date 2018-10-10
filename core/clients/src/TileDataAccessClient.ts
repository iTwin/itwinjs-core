/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OtherServices */

import { ECJsonTypeMap, WsgInstance } from "./ECJsonTypeMap";
import { WsgClient } from "./WsgClient";
import { AccessToken } from "./Token";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { Config } from "./Config";

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
  public static readonly configURL = "imjs_titles_data_service_url";
  public static readonly configRelyingPartyUri = "imjs_titles_data_service_relying_party_uri";
  public static readonly configRegion = "imjs_titles_data_service_region";
  /**
   * Creates an instance of TileDataAccessClient.
   */
  public constructor() {
    super("v2.5");
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
    if (Config.App.has(TileDataAccessClient.configURL))
      return Config.App.get(TileDataAccessClient.configURL);

    throw new Error(`Service URL not set. Set it in Config.App using key ${TileDataAccessClient.configURL}`);
  }

  /**
   * Override default region for this service
   * @returns region id or undefined
   */
  protected getRegion(): number | undefined {
    if (Config.App.has(TileDataAccessClient.configRegion))
      return Config.App.get(TileDataAccessClient.configRegion);

    return undefined;
  }

  /**
   * Gets theRelyingPartyUrl for the service.
   * @returns RelyingPartyUrl for the service.
   */
  protected getRelyingPartyUrl(): string {
    if (Config.App.has(TileDataAccessClient.configRelyingPartyUri))
      return Config.App.get(TileDataAccessClient.configRelyingPartyUri) + "/";

    if (Config.App.getBoolean(WsgClient.configUseHostRelyingPartyUriAsFallback, true)) {
      if (Config.App.has(WsgClient.configHostRelyingPartyUri))
        return Config.App.get(WsgClient.configHostRelyingPartyUri) + "/";
    }

    throw new Error(`RelyingPartyUrl not set. Set it in Config.App using key ${TileDataAccessClient.configRelyingPartyUri}`);
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
