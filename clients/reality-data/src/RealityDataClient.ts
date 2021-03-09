/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RealityData
 */
import { URL } from "url";
import { ClientRequestContext, Config, Guid } from "@bentley/bentleyjs-core";
import {
  AuthorizedClientRequestContext, ECJsonTypeMap, request, RequestOptions, RequestQueryOptions, WsgClient, WsgInstance,
} from "@bentley/itwin-client";

/** RealityData
 * This class implements a Reality Data stored in ProjectWise Context Share (Reality Data Service)
 * Data is accessed directly through methods of the reality data instance.
 * Access to the data required a properly entitled token though the access to the blob is controlled through
 * an Azure blob URL, the token may be required to obtain this Azure blob URL or refresh it.
 * The Azure blob URL is considered valid for an hour and is refreshed after 50 minutes.
 * In addition to the reality data properties, and Azure blob URL and internal states, a reality data also contains
 * the identification of the iTwin project to identify the context(used for access permissions resolution) and
 * may contain a RealityDataClient to obtain the WSG client specialization to communicate with ProjectWise Context Share (to obtain the Azure blob URL).
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "S3MX.RealityData", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class RealityData extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Id")
  public id?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.OrganizationId")
  public organizationId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.UltimateId")
  public ultimateId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.UltimateSite")
  public ultimateSite?: string;

  /** This is typically the iModelId */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ContainerName")
  public containerName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.DataLocationGuid")
  public dataLocationGuid?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Dataset")
  public dataSet?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Group")
  public group?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Description")
  public description?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.RootDocument")
  public rootDocument?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Size")
  public size?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.SizeUpToDate")
  public sizeUpToDate?: boolean;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Classification")
  public classification?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Streamed")
  public streamed?: boolean;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Type")
  public type?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ReferenceElevation")
  public referenceElevation?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Footprint")
  public footprint?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ApproximateFootprint")
  public approximateFootprint?: boolean;

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

  @ECJsonTypeMap.propertyToJson("wsg", "properties.DataAcquisitionDate")
  public dataAcquisitionDate?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.DataAcquisitionStartDate")
  public dataAcquisitionStartDate?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.DataAcquisitionEndDate")
  public dataAcquisitionEndDate?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.DataAcquirer")
  public dataAcquirer?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Visibility")
  public visibility?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Listable")
  public listable?: boolean;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ModifiedTimestamp")
  public modifiedTimestamp?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.LastAccessedTimestamp")
  public lastAccessedTimestamp?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedTimestamp")
  public createdTimestamp?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.OwnedBy")
  public ownedBy?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.OwnerId")
  public ownerId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatorId")
  public creatorId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Version")
  public version?: string;

  // Delegate permission is read-only and irrelevant for use so it is omitted.

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Hidden")
  public hidden?: boolean;

  // Cache parameters for reality data access. Contains the blob url, the timestamp to refresh (every 50 minutes) the url and the root document path.
  private _blobUrl: any;
  private _blobTimeStamp?: Date;
  private _blobRooDocumentPath: undefined | string; // Path relative to blob root of root document. It is slash terminated if not empty

  // Link to client to fetch the blob url
  public client: undefined | RealityDataClient;

  // project id used when using the client. If defined must contain the GUID of the iTwin
  // project or "Server" to indicate access is performed out of context (for accessing PUBLIC or ENTERPRISE data).
  // If undefined when accessing reality data tiles then it will automatically be set to "Server"
  public projectId: undefined | string;

  /**
   * Gets string url to fetch blob data from. Access is read-only.
   * @param requestContext The client request context.
   * @param name name or path of tile
   * @param nameRelativeToRootDocumentPath (optional default is false) Indicates if the given name is relative to the root document path.
   * @returns string url for blob data
   */
  public async getBlobStringUrl(requestContext: AuthorizedClientRequestContext, name: string, nameRelativeToRootDocumentPath: boolean = false): Promise<string> {
    requestContext.enter();
    const url = await this.getBlobUrl(requestContext);

    let host: string = "";
    if (nameRelativeToRootDocumentPath && this._blobRooDocumentPath && this._blobRooDocumentPath !== "")
      host = `${url.origin + url.pathname}/${this._blobRooDocumentPath}`; // _blobRootDocumentPath is always '/' terminated if not empty
    else
      host = `${url.origin + url.pathname}/`;

    const query = url.search;

    return `${host}${name}${query}`;
  }

  /**
   * Gets a tileset's tile data
   * @param requestContext The client request context.
   * @param name name or path of tile
   * @param nameRelativeToRootDocumentPath (optional default is false) Indicates if the given name is relative to the root document path.
   * @returns tile data json
   */
  public async getModelData(requestContext: AuthorizedClientRequestContext, name: string, nameRelativeToRootDocumentPath: boolean = false): Promise<any> {
    requestContext.enter();
    return this.getTileJson(requestContext, name, nameRelativeToRootDocumentPath);
  }

  /**
   * Gets a tile access url URL object
   * @param requestContext The client request context.
   * @param writeAccess Optional boolean indicating if write access is requested. Default is false for read-only access.
   * @returns app URL object for blob url
   */
  public async getBlobUrl(requestContext: AuthorizedClientRequestContext, writeAccess: boolean = false): Promise<URL> {
    requestContext.enter();
    // Normally the client is set when the reality data is extracted for the client but it could be undefined
    // if the reality data instance is created manually.
    if (!this.client)
      this.client = new RealityDataClient();

    if (!this.projectId)
      this.projectId = "Server";

    if (!this.id)
      throw new Error("id not set");

    const blobUrlRequiresRefresh = !this._blobTimeStamp || (Date.now() - this._blobTimeStamp.getTime()) > 3000000; // 3 million milliseconds or 50 minutes
    if (undefined === this._blobUrl || blobUrlRequiresRefresh) {
      const fileAccess: FileAccessKey[] = await this.client.getFileAccessKey(requestContext, this.projectId, this.id, writeAccess);
      requestContext.enter();
      if (fileAccess.length !== 1)
        throw new Error(`Could not obtain blob file access key for reality data: ${this.id}`);
      const urlString = fileAccess[0].url!;
      this._blobUrl = (typeof window !== "undefined") ? new window.URL(urlString) : new URL(urlString);
      this._blobTimeStamp = new Date(Date.now());
      if (!this._blobRooDocumentPath && this.rootDocument) {
        const urlParts = this.rootDocument.split("/");
        urlParts.pop();
        if (urlParts.length === 0)
          this._blobRooDocumentPath = "";
        else
          this._blobRooDocumentPath = `${urlParts.join("/")}/`;
      }
    }

    return this._blobUrl;
  }

  /**
   * Gets a tileset's app data json
   * @param requestContext The client request context.
   * @param name name or path of tile
   * @param nameRelativeToRootDocumentPath (optional default is false) Indicates if the given name is relative to the root document path.
   * @returns app data json object
   */
  public async getTileJson(requestContext: AuthorizedClientRequestContext, name: string, nameRelativeToRootDocumentPath: boolean = false): Promise<any> {
    requestContext.enter();
    const stringUrl = await this.getBlobStringUrl(requestContext, name, nameRelativeToRootDocumentPath);
    requestContext.enter();
    const options: RequestOptions = {
      method: "GET",
      responseType: "json",
    };
    const data = await request(requestContext, stringUrl, options);
    requestContext.enter();
    return data.body;
  }

  /**
   * Gets tile content
   * @param requestContext The client request context.
   * @param name name or path of tile
   * @param nameRelativeToRootDocumentPath (optional default is false) Indicates if the given name is relative to the root document path.
   * @returns array buffer of tile content
   */
  public async getTileContent(requestContext: AuthorizedClientRequestContext, name: string, nameRelativeToRootDocumentPath: boolean = false): Promise<any> {
    requestContext.enter();
    const stringUrl = await this.getBlobStringUrl(requestContext, name, nameRelativeToRootDocumentPath);
    requestContext.enter();
    const options: RequestOptions = {
      method: "GET",
      responseType: "arraybuffer",
    };
    const data = await request(requestContext, stringUrl, options);
    requestContext.enter();
    return data.body;
  }

  /**
   * Gets a reality data root document json
   * @param requestContext The client request context.
   * @returns tile data json
   */
  public async getRootDocumentJson(requestContext: AuthorizedClientRequestContext): Promise<any> {
    requestContext.enter();

    if (!this.rootDocument)
      throw new Error(`Root document not defined for reality data: ${this.id}`);

    const root = this.rootDocument;

    return this.getModelData(requestContext, root, false);
  }

}

/** File Access Key
 * This class is used by the RealityDataServicesClient to extract an Azure blob URL
 * @internal
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

/** RealityDataRelationship
 * This class is used to represent relationships with a Reality Data and iTwin Context (Project or Asset)
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "S3MX.RealityDataRelationship", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class RealityDataRelationship extends WsgInstance {
  //  @ECJsonTypeMap.propertyToJson("wsg", "instanceId")
  //  public id?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.RealityDataId")
  public realityDataId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.RelationType")
  public relationType?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.RelatedId")
  public relatedId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ModifiedTimestamp")
  public modifiedTimestamp?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedTimestamp")
  public createdTimestamp?: string;
}

/** Query options for RealityDataServiceRequest
 * @Internal
 */
export interface RealityDataRequestQueryOptions extends RequestQueryOptions {
  /** Set to limit result to a single project  */
  project?: string;

  /** Set a polygon string to query for overlap */
  polygon?: string;

  /** Set an action for the Query. Either ALL, USE or ASSIGN */
  action?: string;
}

/** DataLocation
 * This class is used to represent a data location
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "S3MX.DataLocation", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class DataLocation extends WsgInstance {

  @ECJsonTypeMap.propertyToJson("wsg", "instanceId")
  public id?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Provider")
  public provider?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Location")
  public location?: string;
}

/**
 * Client wrapper to Reality Data Service.
 * An instance of this class is used to extract reality data from the ProjectWise Context Share (Reality Data Service)
 * Most important methods enable to obtain a specific reality data, fetch all reality data associated to a project and
 * all reality data of a project within a provided spatial extent.
 * This class also implements extraction of the Azure blob address.
 * @internal
 */
export class RealityDataClient extends WsgClient {
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
    return RealityDataClient.searchKey;
  }

  /**
   * Gets theRelyingPartyUrl for the service.
   * @returns RelyingPartyUrl for the service.
   */
  protected getRelyingPartyUrl(): string {
    if (Config.App.has(RealityDataClient.configRelyingPartyUri))
      return `${Config.App.get(RealityDataClient.configRelyingPartyUri)}/`;

    if (Config.App.getBoolean(WsgClient.configUseHostRelyingPartyUriAsFallback, true)) {
      if (Config.App.has(WsgClient.configHostRelyingPartyUri))
        return `${Config.App.get(WsgClient.configHostRelyingPartyUri)}/`;
    }

    throw new Error(`RelyingPartyUrl not set. Set it in Config.App using key ${RealityDataClient.configRelyingPartyUri}`);
  }

  /**
   * This method returns the URL to obtain the Reality Data details from PW Context Share.
   * Technically it should never be required as the RealityData object returned should have all the information to obtain the
   * data.
   * @param requestContext The client request context.
   * @param projectId id of associated iTwin project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @returns string containing the URL to reality data for indicated tile.
   */
  public async getRealityDataUrl(requestContext: ClientRequestContext, projectId: string | undefined, tilesId: string): Promise<string> {
    requestContext.enter();
    const serverUrl: string = await this.getUrl(requestContext);
    requestContext.enter();

    if (!projectId || projectId === "")
      projectId = "Server";
    return `${serverUrl}/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData/${tilesId}`;
  }

  /**
   * Gets reality data with all of its properties
   * @param requestContext The client request context.
   * @param projectId id of associated iTwin project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @returns The requested reality data.
   */
  public async getRealityData(requestContext: AuthorizedClientRequestContext, projectId: string | undefined, tilesId: string): Promise<RealityData> {
    requestContext.enter();
    if (!projectId || projectId === "")
      projectId = "Server";

    const realityDatas: RealityData[] = await this.getInstances<RealityData>(requestContext, RealityData, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData/${tilesId}`);
    requestContext.enter();

    if (realityDatas.length !== 1)
      throw new Error(`Could not fetch reality data: ${tilesId}`);

    realityDatas[0].client = this;
    realityDatas[0].projectId = projectId;
    return realityDatas[0];
  }

  /**
   * Gets all reality data associated to the project. Consider using getRealityDataInProjectOverlapping() if spatial extent is known.
   * @param requestContext The client request context.
   * @param projectId id of associated iTwin project
   * @returns an array of RealityData that are associated to the project.
   */
  public async getRealityDataInProject(requestContext: AuthorizedClientRequestContext, projectId: string, type?: string): Promise<RealityData[]> {
    requestContext.enter();

    const newQueryOptions = { project: projectId } as RequestQueryOptions;
    if (!type)
      newQueryOptions.$filter = `Type+eq+'RealityMesh3DTiles'+or+Type+eq+'OPC'`;
    else
      newQueryOptions.$filter = `Type+eq+'${type}'`;

    const realityDatas: RealityData[] = await this.getRealityDatas(requestContext, projectId, newQueryOptions);
    requestContext.enter();
    return realityDatas;
  }

  /**
   * Gets all reality data that has a footprint defined that overlaps the given area and that are associated with the project. Reality Data returned must be accessible by user
   * as public, enterprise data, private or accessible through context RBAC rights attributed to user.
   * @param requestContext The client request context.
   * @param projectId id of associated iTwin project
   * @param minLongDeg The minimum longitude in degrees of a 2d range to search.
   * @param maxLongDeg The maximum longitude in degrees of a 2d range to search.
   * @param minLatDeg The minimum latitude in degrees of a 2d range to search.
   * @param maxLatDeg The maximum longitude in degrees of a 2d range to search.
   * @returns an array of RealityData
   */
  public async getRealityDataInProjectOverlapping(requestContext: AuthorizedClientRequestContext, projectId: string, minLongDeg: number, maxLongDeg: number, minLatDeg: number, maxLatDeg: number, type?: string): Promise<RealityData[]> {
    requestContext.enter();
    const polygonString = `{\"points\":[[${minLongDeg},${minLatDeg}],[${maxLongDeg},${minLatDeg}],[${maxLongDeg},${maxLatDeg}],[${minLongDeg},${maxLatDeg}],[${minLongDeg},${minLatDeg}]], \"coordinate_system\":\"4326\"}`;

    const newQueryOptions = { project: projectId, polygon: polygonString } as RequestQueryOptions;
    if (!type)
      newQueryOptions.$filter = `Type+eq+'RealityMesh3DTiles'+or+Type+eq+'OPC'`;
    else
      newQueryOptions.$filter = `Type+eq+'${type}'`;
    return this.getRealityDatas(requestContext, projectId, newQueryOptions);
  }

  /**
   * Gets reality datas with all of its properties
   * @param requestContext The client request context.
   * @param projectId id of associated iTwin project.
   * @param queryOptions RealityDataServicesRequestQueryOptions of the request.
   * @returns The requested reality data.
   */
  public async getRealityDatas(requestContext: AuthorizedClientRequestContext, projectId: string | undefined, queryOptions: RealityDataRequestQueryOptions): Promise<RealityData[]> {
    requestContext.enter();
    if (!projectId || projectId === "")
      projectId = "Server";

    const realityDatas: RealityData[] = await this.getInstances<RealityData>(requestContext, RealityData, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData`, queryOptions);
    requestContext.enter();

    realityDatas.forEach((realityData) => { realityData.client = this; realityData.projectId = projectId; });
    return realityDatas;
  }

  /**
   * Creates a reality data with given properties
   * @param requestContext The client request context.
   * @param projectId id of associated iTwin project
   * @param realityData The reality data to create. The Id of the reality data is usually left empty indicating for the service to assign
   * one. If set then the reality id must not exist on the server.
   * realityDataInstance id, called tilesId when returned from tile generator job
   * @returns The new reality data with all read-only properties set.
   */
  public async createRealityData(requestContext: AuthorizedClientRequestContext, projectId: string | undefined, realityData: RealityData): Promise<RealityData> {
    requestContext.enter();
    if (!projectId || projectId === "")
      projectId = "Server";

    const resultRealityData: RealityData = await this.postInstance<RealityData>(requestContext, RealityData, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData`, realityData);
    requestContext.enter();

    if (!resultRealityData)
      throw new Error(`Could not create new reality data: ${realityData.id ? realityData.id : realityData.name}`);

    resultRealityData.client = this;
    resultRealityData.projectId = projectId;
    return resultRealityData;
  }

  /**
   * Updates a reality data with given properties
   * @param requestContext The client request context.
   * @param projectId id of associated iTwin project
   * @param realityData The reality data to update. The Id must contain the identifier of the reality data to update.
   * NOTE: As a probable known defect some specific read-only attributes must be undefined prior to passing the reality data.
   * These are: organizationId, sizeUpToDate, ownedBy, ownerId
   * @returns The newly modified reality data.
   */
  public async updateRealityData(requestContext: AuthorizedClientRequestContext, projectId: string | undefined, realityData: RealityData): Promise<RealityData> {
    requestContext.enter();
    if (!projectId || projectId === "")
      projectId = "Server";

    const resultRealityData: RealityData = await this.postInstance<RealityData>(requestContext, RealityData, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData/${realityData.id}`, realityData);
    requestContext.enter();

    if (!resultRealityData)
      throw new Error(`Could not update reality data: ${realityData.id ? realityData.id : realityData.name}`);

    resultRealityData.client = this;
    resultRealityData.projectId = projectId;
    return resultRealityData;
  }

  /**
   * Deletes a reality data.
   * @param requestContext The client request context.
   * @param projectId id of associated iTwin project
   * @param realityDataId The identifier of the reality data to delete.
   * @returns a void Promise.
   */
  public async deleteRealityData(requestContext: AuthorizedClientRequestContext, projectId: string | undefined, realityDataId: string): Promise<void> {
    requestContext.enter();
    if (!projectId || projectId === "")
      projectId = "Server";

    return this.deleteInstance<RealityData>(requestContext, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData/${realityDataId}`);
  }

  /**
   * Gets all reality data relationships associated to the given reality id, not only the relationship for given project.
   * @param requestContext The client request context.
   * @param projectId id of associated iTwin project in which to make to call for permission reason
   * @param realityDataId realityDataInstance id to obtain the relationships for.
   * @returns All relationships associated to reality data. The requested reality data.
   */
  public async getRealityDataRelationships(requestContext: AuthorizedClientRequestContext, projectId: string, realityDataId: string): Promise<RealityDataRelationship[]> {
    requestContext.enter();
    const relationships: RealityDataRelationship[] = await this.getInstances<RealityDataRelationship>(requestContext, RealityDataRelationship, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityDataRelationship?$filter=RealityDataId+eq+'${realityDataId}'`);
    return relationships;
  }

  /**
   * Gets all reality data relationships associated to the given reality id, not only the relationship for given project.
   * @param requestContext The client request context.
   * @param projectId id of associated iTwin project in which to make to call for permission reason
   * @param realityDataId realityDataInstance id to obtain the relationships for.
   * @returns All relationships associated to reality data. The requested reality data.
   */
  public async createRealityDataRelationship(requestContext: AuthorizedClientRequestContext, projectId: string, relationship: RealityDataRelationship): Promise<RealityDataRelationship> {
    requestContext.enter();
    const resultRealityDataRelationship: RealityDataRelationship = await this.postInstance<RealityDataRelationship>(requestContext, RealityDataRelationship, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityDataRelationship`, relationship);
    if (!resultRealityDataRelationship)
      throw new Error(`Could not create new reality data relationship between reality data: ${relationship.realityDataId ? relationship.realityDataId : ""} and context: ${relationship.relatedId ? relationship.relatedId : ""}`);

    return resultRealityDataRelationship;
  }

  /**
   * Gets all reality data relationships associated to the given reality id, not only the relationship for given project.
   * @param requestContext The client request context.
   * @param projectId id of associated iTwin project in which to make to call for permission reason
   * @param realityDataId realityDataInstance id to obtain the relationships for.
   * @returns All relationships associated to reality data. The requested reality data.
   */
  public async deleteRealityDataRelationship(requestContext: AuthorizedClientRequestContext, projectId: string, relationshipId: string): Promise<void> {
    requestContext.enter();
    return this.deleteInstance<RealityDataRelationship>(requestContext, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityDataRelationship/${relationshipId}`);
  }

  /**
   * Gets a tile file access key
   * @param requestContext The client request context.
   * @param projectId id of associated iTwin project
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job.
   * @param writeAccess Optional boolean indicating if write access is requested. Default is false for read-only access.
   * @returns a FileAccessKey object containing the Azure blob address.
   */
  public async getFileAccessKey(requestContext: AuthorizedClientRequestContext, projectId: string | undefined, tilesId: string, writeAccess: boolean = false): Promise<FileAccessKey[]> {
    requestContext.enter();
    const path = encodeURIComponent(tilesId);
    if (!projectId || projectId === "")
      projectId = "Server";

    if (writeAccess)
      return this.getInstances<FileAccessKey>(requestContext, FileAccessKey, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData/${path}/FileAccess.FileAccessKey?$filter=Permissions+eq+%27Write%27`);
    else
      return this.getInstances<FileAccessKey>(requestContext, FileAccessKey, `/Repositories/S3MXECPlugin--${projectId}/S3MX/RealityData/${path}/FileAccess.FileAccessKey?$filter=Permissions+eq+%27Read%27`);
  }

  // ###TODO temporary means of extracting the tileId and projectId from the given url
  // This is the method that determines if the url refers to Reality Data stored on PW Context Share. If not then undefined is returned.
  /**
   * This is the method that determines if the url refers to Reality Data stored on PW Context Share. If not then undefined is returned.
   * @param url A fully formed URL to a reality data or a reality data folder or document of the form:
   *              https://{Host}/{version}/Repositories/S3MXECPlugin--{ProjectId}/S3MX/RealityData/{RealityDataId}
   *              https://{Host}/{version}/Repositories/S3MXECPlugin--{ProjectId}/S3MX/Folder/{RealityDataId}~2F{Folder}
   *              https://{Host}/{version}/Repositories/S3MXECPlugin--{ProjectId}/S3MX/Document/{RealityDataId}~2F{Full Document Path and name}'
   *            Where {Host} represents the Reality Data Service server (ex: connect-realitydataservices.bentley.com). This value is ignored since the
   *            actual host server name depends on the environment or can be changed in the future.
   *            Where {version} is the Bentley Web Service Gateway protocol version. This value is ignored but the version must be supported by Reality Data Service.
   *            Where {Folder} and {Document} are the full folder or document path relative to the Reality Data root.
   *            {RealityDataId} is extracted after validation of the URL and returned.
   *            {ProjectId} is ignored.
   * @returns A string containing the Reality Data Identifier (otherwise named tile id). If the URL is not a reality data service URL then undefined is returned.
   */
  public getRealityDataIdFromUrl(url: string): string | undefined {
    let realityDataId: string | undefined;

    const formattedUrl = url.replace(/~2F/g, "/").replace(/\\/g, "/");
    const urlParts = formattedUrl.split("/").map((entry: string) => entry.replace(/%2D/g, "-"));

    const partOffset: number = ((urlParts[1] === "") ? 4 : 3);
    if ((urlParts[partOffset] === "Repositories") && urlParts[partOffset + 1].match("S3MXECPlugin--*") && (urlParts[partOffset + 2] === "S3MX")) {
      // URL appears tpo be a correctly formed URL to Reality Data Service ... obtain the first GUID
      realityDataId = urlParts.find(Guid.isGuid);
    }
    return realityDataId;
  }

  /**
   * Gets the list of all data locations supported by PW Context Share.
   * @param requestContext The client request context.
   * @returns The requested data locations list.
   */
  public async getDataLocation(requestContext: AuthorizedClientRequestContext): Promise<DataLocation[]> {
    requestContext.enter();
    const dataLocation: DataLocation[] = await this.getInstances<DataLocation>(requestContext, DataLocation, `/Repositories/S3MXECPlugin--Server/S3MX/DataLocation`);
    return dataLocation;
  }
}
