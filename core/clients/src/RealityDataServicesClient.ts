/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OtherServices */

import { ECJsonTypeMap, WsgInstance } from "./ECJsonTypeMap";
import { WsgClient } from "./WsgClient";
import { AccessToken } from "./Token";
import { URL } from "url";
import { request, RequestOptions } from "./Request";
import { Config } from "./Config";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** RealityData */
@ECJsonTypeMap.classToJson("wsg", "S3MX.RealityData", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class RealityData extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Id")
  public id?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.OrganizationId")
  public organizationId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.UltimateId")
  public ultimateId?: string;

  /** This is typically the iModelId */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ContainerName")
  public containerName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.DataLocationGuid")
  public dataLocationGuid?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.DataSet")
  public dataSet?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Group")
  public group?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Description")
  public description?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.RootDocument")
  public rootDocument?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Size")
  public size?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Classification")
  public classification?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Streamed")
  public streamed?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Type")
  public type?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Footprint")
  public footprint?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ThumbnailDocument")
  public thumbnailDocument?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.MetadataUrl")
  public metadataUrl?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Copyright")
  public copyright?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.TermsOfUse")
  public termsOfUse?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.AccuracyInMeters")
  public accuracyInMeters?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ResolutionInMeters")
  public resolutionInMeters?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Visibility")
  public visibility?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Listable")
  public listable?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ModifiedTimestamp")
  public modifiedTimestamp?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedTimestamp")
  public createdTimestamp?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.OwnedBy")
  public ownedBy?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Version")
  public version?: string;
}

/** Document */
@ECJsonTypeMap.classToJson("wsg", "FileAccess.FileAccessKey", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class FileAccessKey extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Url")
  public url?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Type")
  public type?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Permissions")
  public permissions?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.RequiresConfirmation")
  public requiresConfirmation?: string;
}

/**
 * Client wrapper to Reality Data Service
 */
export class RealityDataServicesClient extends WsgClient {
  public static readonly searchKey: string = "RealityDataServices";
  public static readonly configURL = "imjs_reality_data_service_url";
  public static readonly configRelyingPartyUri = "imjs_reality_data_service_relying_party_uri";
  public static readonly configRegion = "imjs_reality_data_service_region";
  private _blobUrl: any;
  private _blobRoot: undefined | string;

  /**
   * Creates an instance of RealityDataServicesClient.
   */
  public constructor() {
    super("v2.5");
  }

  /**
   * Potentially a model name will be of this format: {{root}}/{{name}}
   * When this occurs, the tile content requests will be made without the root portion prefixed, which results in 404's
   * As a workaround, when the root document json is fetched, we can determine if a root name exists and if so,
   * save it so we can conditionally prefix it the child tile names when they are requested
   *
   * This method is where we conditionally prefix that root into the name field
   * @param name
   */
  private updateModelName(name: string): string {
    // a compound name implies that it includes a forward slash or equivalent character
    const isCompound = name.includes("/") || name.includes("~2F");

    // if the name is already compound or the blobRoot is not set, then we do not prefix the model name as it would be redundant
    // otherwise, we return the name prefixed with that value
    return (!isCompound && !name.includes("%2F") && undefined !== this._blobRoot) ? this._blobRoot + "/" + name : name;
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return RealityDataServicesClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    if (Config.App.has(RealityDataServicesClient.configURL))
      return Config.App.get(RealityDataServicesClient.configURL);

    throw new Error(`Service URL not set. Set it in Config.App using key ${RealityDataServicesClient.configURL}`);
  }

  /**
   * Gets theRelyingPartyUrl for the service.
   * @returns RelyingPartyUrl for the service.
   */
  protected getRelyingPartyUrl(): string {
    if (Config.App.has(RealityDataServicesClient.configRelyingPartyUri))
      return Config.App.get(RealityDataServicesClient.configRelyingPartyUri) + "/";

    if (Config.App.getBoolean(WsgClient.configUseHostRelyingPartyUriAsFallback, true)) {
      if (Config.App.has(WsgClient.configHostRelyingPartyUri))
        return Config.App.get(WsgClient.configHostRelyingPartyUri) + "/";
    }

    throw new Error(`RelyingPartyUrl not set. Set it in Config.App using key ${RealityDataServicesClient.configRelyingPartyUri}`);
  }
  /**
   * Override default region for this service
   * @returns region id or undefined
   */
  protected getRegion(): number | undefined {
    if (Config.App.has(RealityDataServicesClient.configRegion))
      return Config.App.get(RealityDataServicesClient.configRegion);

    return undefined;
  }

  /**
   * Gets reality data properties
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @returns an array of RealityData
   */
  public async getRealityData(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string): Promise<RealityData[]> {
    return this.getInstances<RealityData>(alctx, RealityData, token, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData/${tilesId}`);
  }

  /**
   * Gets a tileset's app data json file access key
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @returns an array of FileAccessKey
   */
  public async getAppDataFileAccessKey(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string): Promise<FileAccessKey[]> {
    return this.getFileAccessKey(alctx, token, projectId, tilesId, "Bim_AppData.json");
  }

  /**
   * Gets a tile file access key
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @param name name or path of tile
   * @returns a string url
   */
  public async getFileAccessKey(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string, name: string): Promise<FileAccessKey[]> {
    const path = encodeURIComponent(tilesId + "/" + this.updateModelName(name)).split("%").join("~");
    return this.getInstances<FileAccessKey>(alctx, FileAccessKey, token, `/Repositories/S3MXECPlugin--${projectId}/S3MX/Document/${path}/FileAccess.FileAccessKey?$filter=Permissions+eq+%27Read%27`);
  }

  /**
   * Gets a tileset's tile data blob key url
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @param name name or path of tile
   * @returns a string url
   */
  public async getTileDataBlobUrl(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string, name: string): Promise<string> {
    const keys: FileAccessKey[] = await this.getFileAccessKey(alctx, token, projectId, tilesId, name);
    return keys[0].url!;
  }

  /**
   * Gets a tileset's app data json blob url
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @param name name or path of tile
   * @returns a string url
   */
  public async getAppDataBlobUrl(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string): Promise<string> {
    const keys: FileAccessKey[] = await this.getFileAccessKey(alctx, token, projectId, tilesId, "Bim_AppData.json");
    return keys[0].url!;
  }

  /**
   * Gets a tileset's app data json
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @param name name or path of tile
   * @returns app data json object
   */
  public async getAppData(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string): Promise<any> {
    return this.getTileJson(alctx, token, projectId, tilesId, "Bim_AppData.json");
  }

  /**
   * trims off the TileSets segment from a url
   * @param url string url to cleanup
   * @returns clean url string
   */
  public cleanTilesetUrl(url: string): string {
    const path = url.split("//").filter((v) => v !== "TileSets" && v !== "Bim").join("/");
    return path.includes("?") ? path.slice(0, path.indexOf("?")) : path;
  }

  /**
   * Gets a tileset's tile data
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @param name name or path of tile
   * @returns tile data json
   */
  public async getModelData(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string, name: string): Promise<any> {
    return this.getTileJson(alctx, token, projectId, tilesId, this.cleanTilesetUrl(name));
  }

  /**
   * Gets a tile access url URL object
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @param name name or path of tile
   * @returns app URL object for blob url
   */
  public async getBlobUrl(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string, name: string): Promise<URL> {
    const urlString = await this.getTileDataBlobUrl(alctx, token, projectId, tilesId, name);
    if (typeof this._blobUrl === "undefined")
      this._blobUrl = (typeof window !== "undefined") ? new window.URL(urlString) : new URL(urlString);
    return Promise.resolve(this._blobUrl);
  }

  /**
   * Gets string url to fetch blob data from
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @param name name or path of tile
   * @returns string url for blob data
   */
  public async getBlobStringUrl(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string, name: string): Promise<string> {
    const url = undefined === this._blobUrl ? await this.getBlobUrl(alctx, token, projectId, tilesId, name) : this._blobUrl;
    const host = url.origin + url.pathname;
    const query = url.search;
    return `${host}/${this.updateModelName(name)}${query}`;
  }

  /**
   * Gets a tileset's app data json
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @param name name or path of tile
   * @returns app data json object
   */
  public async getTileJson(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string, name: string): Promise<any> {
    const stringUrl = await this.getBlobStringUrl(alctx, token, projectId, tilesId, name);
    const options: RequestOptions = {
      method: "GET",
      responseType: "json",
    };
    const data = await request(alctx, stringUrl, options);
    return data.body;
  }

  /**
   * Gets tile content
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @param name name or path of tile
   * @returns array buffer of tile content
   */
  public async getTileContent(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string, name: string): Promise<any> {
    const stringUrl = await this.getBlobStringUrl(alctx, token, projectId, tilesId, this.cleanTilesetUrl(name));
    const options: RequestOptions = {
      method: "GET",
      responseType: "arraybuffer",
    };
    const data = await request(alctx, stringUrl, options);
    return data.body;
  }

  /**
   * Gets a reality data root document json
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @returns tile data json
   */
  public async getRootDocumentJson(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string): Promise<any> {
    const realityData: RealityData[] = await this.getRealityData(alctx, token, projectId, tilesId);
    alctx.enter();
    let root = realityData[0].rootDocument!;

    // reset the blob url when a root document is requested to ensure the previous blob storage key isn't reused
    this._blobUrl = undefined;

    // if the RootDocument is ClarkSimple/RootTile.json, then only use RootTile.json,
    // so we need to only use the last part of the RootDocument path
    if (root.includes("/"))
      root = root.split("/")[root.split("/").length - 1];

    return (await this.getModelData(alctx, token, projectId, tilesId, root));
  }

  /**
   * Gets reality data corresponding to given url
   * @param token Delegation token of the authorized user issued for this service.
   * @param url expected to be similar to this: https://...realitydataservices.bentley.com/<ver>/Repositories/S3MXECPlugin--<project-id-guid>/S3MX/RealityData/<tile-id-guid>/<model-name>.json
   * @param tileRequest method to fetch tile data from (either getTileJson or getTileContent)
   * @returns tile data json
   */
  private async getTileDataFromUrl(token: AccessToken, url: string, tileRequest: (token: AccessToken, projectId: string, tilesId: string, name: string) => Promise<any>): Promise<any> {
    try {
      const urlParts = url.split("/");
      const projectId = urlParts.find((val: string) => val.includes("--"))!.split("--")[1];
      const tilesId = urlParts.find((val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));
      const modelName = url.split(tilesId + "/")[1];

      return tileRequest(token, projectId, tilesId!, modelName);
    } catch (ex) {
      throw new Error(ex);
    }
  }

  /**
   * Gets a reality data tile json corresponding to given url
   * @param token Delegation token of the authorized user issued for this service.
   * @param url expected to be similar to this: https://...realitydataservices.bentley.com/<ver>/Repositories/S3MXECPlugin--<project-id-guid>/S3MX/RealityData/<tile-id-guid>/<model-name>.json
   * @returns tile data json
   */
  public async getTileJsonFromUrl(token: AccessToken, url: string): Promise<any> {
    return this.getTileDataFromUrl(token, url, this.getTileJson.bind(this));
  }

  /**
   * Gets a reality data tile content corresponding to given url
   * @param token Delegation token of the authorized user issued for this service.
   * @param url expected to be similar to this: https://...realitydataservices.bentley.com/<ver>/Repositories/S3MXECPlugin--<project-id-guid>/S3MX/RealityData/<tile-id-guid>/<model-name>.json
   * @returns tile data content
   */
  public async getTileContentFromUrl(token: AccessToken, url: string): Promise<any> {
    return this.getTileDataFromUrl(token, url, this.getTileContent.bind(this));
  }
}
