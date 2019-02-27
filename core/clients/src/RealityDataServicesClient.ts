/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
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
import { Angle, Range2d } from "@bentley/geometry-core";

/** RealityData
 * This class implements a Reality Data stored in ProjectWise Context Share (Reality Data Service)
 * Data is accessed directly through methods of the reality data instance.
 * Access to the data required a properly entitled token though the access to the blob is controled through
 * an Azure blob URL, the token may be required to obtain this Azure blob URL or refresh it.
 * The Azure blob URL is considered valid for an hour and is refreshed after 50 minutes.
 * In addition to the reality data properties, and Azure blob URL and internal states, a reality data also contains
 * the identification of the CONNECT project to identify the context(used for access permissions resolution) and
 * may contain a RealityDataClient to obtain the WSG client specialisation to communicate with ProjectWise Context Share (to obtain the Azure blob URL).
 */
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

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatorId")
  public creatorId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Version")
  public version?: string;

  // Cache parameters for reality data access. Contains the blob url, the timestamp to refresh (every 50 minutes) the url and the root document path.
  private _blobUrl: any;
  private _blobTimeStamp: Date;
  private _blobRooDocumentPath: undefined | string; // Path relative to blob root of root document. It is slash terminated if not empty

  // Link to client to fetch the blob url
  public client: undefined | RealityDataServicesClient;

  // project id used when using the client. If defined must contain the GUID of the CONNECT
  // project or "Server" to indicate access is performed out of context (for accessing PUBLIC or ENTERPRISE data).
  // If undefined when accessing reality data tiles then it will automatically be set to "Server"
  public projectId: undefined | string;

  /**
   * Gets string url to fetch blob data from
   * @param token Delegation token of the authorized user issued for this service.
   * @param name name or path of tile
   * @param nameRelativeToRootDocumentPath (optional default is false) Indicates if the given name is relative to the root document path.
   * @returns string url for blob data
   */
  public async getBlobStringUrl(alctx: ActivityLoggingContext, token: AccessToken, name: string, nameRelativeToRootDocumentPath: boolean = false): Promise<string> {
    const url = await this.getBlobUrl(alctx, token);

    let host: string = "";
    if (nameRelativeToRootDocumentPath && this._blobRooDocumentPath && this._blobRooDocumentPath !== "")
      host = url.origin + url.pathname + "/" + this._blobRooDocumentPath; // _blobRootDocumentPath is always '/' terminated if not empty
    else
      host = url.origin + url.pathname + "/";

    const query = url.search;

    return `${host}${name}${query}`;
  }

  /**
   * Gets a tileset's tile data
   * @param token Delegation token of the authorized user issued for this service.
   * @param name name or path of tile
   * @param nameRelativeToRootDocumentPath (optional default is false) Indicates if the given name is relative to the root document path.
   * @returns tile data json
   */
  public async getModelData(alctx: ActivityLoggingContext, token: AccessToken, name: string, nameRelativeToRootDocumentPath: boolean = false): Promise<any> {
    return this.getTileJson(alctx, token, name, nameRelativeToRootDocumentPath);
  }

  /**
   * Gets a tile access url URL object
   * @param token Delegation token of the authorized user issued for this service.
   * @returns app URL object for blob url
   */
  public async getBlobUrl(alctx: ActivityLoggingContext, token: AccessToken): Promise<URL> {
    // Normally the client is set when the reality data is extracted for the client but it could be undefined
    // if the reality data instance is created manually.
    if (!this.client)
      this.client = new RealityDataServicesClient();

    if (!this.projectId)
      this.projectId = "Server";

    if (!this.id)
      return Promise.reject(new Error("id not set"));

    if (undefined === this._blobUrl || this._blobTimeStamp.valueOf() - Date.now() > 3000000) { // 3 million milliseconds or 50 minutes
      const fileAccess: FileAccessKey[] = await this.client.getFileAccessKey(alctx, token, this.projectId as string, this.id);
      if (fileAccess.length !== 1)
        return Promise.reject(new Error("Could not obtain blob file access key for reality data: " + this.id));
      const urlString = fileAccess[0].url!;
      this._blobUrl = (typeof window !== "undefined") ? new window.URL(urlString) : new URL(urlString);
      this._blobTimeStamp = new Date(Date.now());
      if (!this._blobRooDocumentPath && this.rootDocument) {
        const urlParts = this.rootDocument.split("/");
        urlParts.pop();
        if (urlParts.length === 0)
          this._blobRooDocumentPath = "";
        else
          this._blobRooDocumentPath = urlParts.join("/") + "/";
      }
    }

    return Promise.resolve(this._blobUrl);
  }

  /**
   * Gets a tileset's app data json
   * @param token Delegation token of the authorized user issued for this service.
   * @param name name or path of tile
   * @param nameRelativeToRootDocumentPath (optional default is false) Indicates if the given name is relative to the root document path.
   * @returns app data json object
   */
  public async getTileJson(alctx: ActivityLoggingContext, token: AccessToken, name: string, nameRelativeToRootDocumentPath: boolean = false): Promise<any> {
    const stringUrl = await this.getBlobStringUrl(alctx, token, name, nameRelativeToRootDocumentPath);
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
   * @param name name or path of tile
   * @param nameRelativeToRootDocumentPath (optional default is false) Indicates if the given name is relative to the root document path.
   * @returns array buffer of tile content
   */
  public async getTileContent(alctx: ActivityLoggingContext, token: AccessToken, name: string, nameRelativeToRootDocumentPath: boolean = false): Promise<any> {
    const stringUrl = await this.getBlobStringUrl(alctx, token, name, nameRelativeToRootDocumentPath);
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
   * @returns tile data json
   */
  public async getRootDocumentJson(alctx: ActivityLoggingContext, token: AccessToken): Promise<any> {
    alctx.enter();

    if (!this.rootDocument)
      return Promise.reject(new Error("Root document not defined for reality data: " + this.id));

    const root = this.rootDocument!;

    return this.getModelData(alctx, token, root, false);
  }

}

/** File Access Key
 * This class is used by the RealityDataServicesClient to extract an Azure blob URL
 */
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
 * Client wrapper to Reality Data Service.
 * An instance of this class is used to extract reality data from the ProjectWise Context Share (Reality Data Service)
 * Most important methods enable to obtain a specific reality data, fetch all reality data associated to a project and
 * all reality data of a project within a provided spatial extent.
 * This class also implements extraction of the Azure blob address.
 */
export class RealityDataServicesClient extends WsgClient {
  public static readonly searchKey: string = "RealityDataServices";
  public static readonly configRelyingPartyUri = "imjs_reality_data_service_relying_party_uri";

  /**
   * Creates an instance of RealityDataServicesClient.
   */
  public constructor() {
    super("v2.5");
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return RealityDataServicesClient.searchKey;
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
   * This method returns the URL to obtain the Reality Data details from PW Context Share.
   * Technically it should never be required as the RealityData object returned should have all the information to obtain the
   * data.
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @returns string containing the URL to reality data for indicated tile.
   */
  public async getRealityDataUrl(alctx: ActivityLoggingContext, projectId: string, tilesId: string): Promise<string> {
    const serverUrl: string = await this.getUrl(alctx);

    return serverUrl + `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData/${tilesId}`;
  }

  /**
   * Gets reality data with all of its properties
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @returns The requested reality data.
   */
  public async getRealityData(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string): Promise<RealityData> {
    const realityDatas: RealityData[] = await this.getInstances<RealityData>(alctx, RealityData, token, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData/${tilesId}`);
    if (realityDatas.length !== 1)
      return Promise.reject(new Error("Could not fetch reality data: " + tilesId));

    realityDatas[0].client = this;
    realityDatas[0].projectId = projectId;
    return realityDatas[0];
  }

  /**
   * Gets all reality data associated to the project. Consider using getRealityDataInProjectOverlapping() if spatial extent is known.
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @returns an array of RealityData that are associated to the project.
   */
  public async getRealityDataInProject(alctx: ActivityLoggingContext, token: AccessToken, projectId: string): Promise<RealityData[]> {
    const realityDatas: RealityData[] = await this.getInstances<RealityData>(alctx, RealityData, token, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData?project=${projectId}&$filter=Type+eq+'RealityMesh3DTiles'`);
    realityDatas.forEach((realityData) => { realityData.client = this; realityData.projectId = projectId; });
    return realityDatas;
  }

  /**
   * Gets all reality data that has a footprint defined that overlaps the given area and that are associated with the project. Reality Data returned must be accessible by user
   * as public, enterprise data, private or accessible through context RBAC rights attributed to user.
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param range The range to search for given as a range 2d where X repesentents the longitude in radians and Y the latitude in radians
   * longitude can be in the range -2P to 2PI but the minimum value must be smaller numerically to the maximum.
   * Note that the longitudes are usually by convention in the range of -PI to PI except
   * for ranges that overlap the -PI/+PI frontier in which case either representation is acceptable.
   * @returns an array of RealityData
   */
  public async getRealityDataInProjectOverlapping(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, range: Range2d): Promise<RealityData[]> {
    const minLongDeg = Angle.radiansToDegrees(range.low.x);
    const maxLongDeg = Angle.radiansToDegrees(range.high.x);
    const minLatDeg = Angle.radiansToDegrees(range.low.y);
    const maxLatDeg = Angle.radiansToDegrees(range.high.y);
    const polygonString = `{\"points\":[[${minLongDeg},${minLatDeg}],[${maxLongDeg},${minLatDeg}],[${maxLongDeg},${maxLatDeg}],[${minLongDeg},${maxLatDeg}],[${minLongDeg},${minLatDeg}]], \"coordinate_system\":\"4326\"}`;

    const realityDatas: RealityData[] = await this.getInstances<RealityData>(alctx, RealityData, token, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData?project=${projectId}&polygon=${polygonString}&$filter=Type+eq+'RealityMesh3DTiles'`);
    realityDatas.forEach((realityData) => { realityData.client = this; realityData.projectId = projectId; });
    return realityDatas;
  }

  /**
   * Gets a tile file access key
   * @param token Delegation token of the authorized user issued for this service.
   * @param projectId id of associated connect project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @returns a FileAccessKey object containing the Azure blob address.
   */
  public async getFileAccessKey(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, tilesId: string): Promise<FileAccessKey[]> {
    const path = encodeURIComponent(tilesId);
    return this.getInstances<FileAccessKey>(alctx, FileAccessKey, token, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData/${path}/FileAccess.FileAccessKey?$filter=Permissions+eq+%27Read%27`);
  }

}
