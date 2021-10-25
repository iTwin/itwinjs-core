/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RealityData
 */

import { URL } from "url";
import { Angle } from "@itwin/core-geometry";
import { IModelConnection, SpatialModelState } from "@itwin/core-frontend";
import { CartographicRange, ContextRealityModelProps, OrbitGtBlobProps } from "@itwin/core-common";
import { AccessToken, Guid, GuidString } from "@itwin/core-bentley";
import { getJson, request, RequestOptions, RequestQueryOptions } from "@bentley/itwin-client";
import { ECJsonTypeMap, WsgInstance } from "./wsg/ECJsonTypeMap";
import { WsgClient } from "./wsg/WsgClient";

/** Currently supported ProjectWise ContextShare reality data types
 * @internal
 */
export enum DefaultSupportedTypes {
  RealityMesh3dTiles = "RealityMesh3DTiles", // Web Ready 3D Scalable Mesh
  OPC = "OPC", // Web Ready Orbit Point Cloud
  Terrain3dTiles = "Terrain3DTiles", // Web Ready Terrain Scalable Mesh
  OMR = "OMR", // Orbit Mapping Resource
  Cesium3dTiles = "Cesium3DTiles" // Cesium 3D Tiles
}

/** RealityData
 * This class implements a Reality Data stored in ProjectWise Context Share (Reality Data Service)
 * Data is accessed directly through methods of the reality data instance.
 * Access to the data required a properly entitled token though the access to the blob is controlled through
 * an Azure blob URL, the token may be required to obtain this Azure blob URL or refresh it.
 * The Azure blob URL is considered valid for an hour and is refreshed after 50 minutes.
 * In addition to the reality data properties, and Azure blob URL and internal states, a reality data also contains
 * the identification of the iTwin to be used for access permissions and
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
  public client: undefined | RealityDataAccessClient;

  // The GUID of the iTwin used when using the client or "Server" to indicate access is performed out of context (for accessing PUBLIC or ENTERPRISE data).
  // If undefined when accessing reality data tiles then it will automatically be set to "Server"
  public iTwinId: undefined | string;

  /**
   * Gets string url to fetch blob data from. Access is read-only.
   * @param name name or path of tile
   * @param nameRelativeToRootDocumentPath (optional default is false) Indicates if the given name is relative to the root document path.
   * @returns string url for blob data
   */
  public async getBlobStringUrl(accessToken: AccessToken, name: string, nameRelativeToRootDocumentPath: boolean = false): Promise<string> {
    const url = await this.getBlobUrl(accessToken);

    let host: string = "";
    if (nameRelativeToRootDocumentPath && this._blobRooDocumentPath && this._blobRooDocumentPath !== "")
      host = `${url.origin + url.pathname}/${this._blobRooDocumentPath}`; // _blobRootDocumentPath is always '/' terminated if not empty
    else
      host = `${url.origin + url.pathname}/`;

    const query = url.search;

    return `${host}${name}${query}`;
  }

  /**
   * Gets a tile access url URL object
   * @param writeAccess Optional boolean indicating if write access is requested. Default is false for read-only access.
   * @returns app URL object for blob url
   */
  public async getBlobUrl(accessToken: AccessToken, writeAccess: boolean = false): Promise<URL> {
    // Normally the client is set when the reality data is extracted for the client but it could be undefined
    // if the reality data instance is created manually.
    if (!this.client)
      this.client = new RealityDataAccessClient();

    if (!this.iTwinId)
      this.iTwinId = "Server";

    if (!this.id)
      throw new Error("id not set");

    const blobUrlRequiresRefresh = !this._blobTimeStamp || (Date.now() - this._blobTimeStamp.getTime()) > 3000000; // 3 million milliseconds or 50 minutes
    if (undefined === this._blobUrl || blobUrlRequiresRefresh) {
      const fileAccess: FileAccessKey[] = await this.client.getFileAccessKey(accessToken, this.iTwinId, this.id, writeAccess);
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
   * @param name name or path of tile
   * @param nameRelativeToRootDocumentPath (optional default is false) Indicates if the given name is relative to the root document path.
   * @returns app data json object
   */
  public async getTileJson(accessToken: AccessToken, name: string, nameRelativeToRootDocumentPath: boolean = false): Promise<any> {
    const stringUrl = await this.getBlobStringUrl(accessToken, name, nameRelativeToRootDocumentPath);

    const data = await getJson(stringUrl);
    return data;
  }

  /**
   * Gets tile content
   * @param name name or path of tile
   * @param nameRelativeToRootDocumentPath (optional default is false) Indicates if the given name is relative to the root document path.
   * @returns array buffer of tile content
   */
  public async getTileContent(accessToken: AccessToken, name: string, nameRelativeToRootDocumentPath: boolean = false): Promise<any> {
    const stringUrl = await this.getBlobStringUrl(accessToken, name, nameRelativeToRootDocumentPath);

    const options: RequestOptions = {
      method: "GET",
      responseType: "arraybuffer",
    };
    const data = await request(stringUrl, options);
    return data.body;
  }

  /**
   * Gets a reality data root document json
   * @returns tile data json
   */
  public async getRootDocumentJson(accessToken: AccessToken): Promise<any> {
    if (!this.rootDocument)
      throw new Error(`Root document not defined for reality data: ${this.id}`);

    const root = this.rootDocument;
    const rootJson = await this.getTileJson(accessToken, root, false);
    return rootJson;
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
 * This class is used to represent relationships with a Reality Data and iTwin
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
  /** Set to limit result to a single iTwin  */
  iTwin?: string;

  /** Set a polygon string to query for overlap */
  polygon?: string;

  /** Set an action for the Query. Either ALL, USE or ASSIGN */
  action?: string;
}

/** Criteria used to query for reality data associated with an iTwin context.
 * @see [[queryRealityData]].
 * @public
 */
export interface RealityDataQueryCriteria {
  /** The Id of the iTwin context. */
  iTwinId: GuidString;
  /** If supplied, only reality data overlapping this range will be included. */
  range?: CartographicRange;
  /** If supplied, reality data already referenced by a [[GeometricModelState]] within this iModel will be excluded. */
  filterIModel?: IModelConnection;
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
 * Most important methods enable to obtain a specific reality data, fetch all reality data associated with an iTwin and
 * all reality data of an iTwin within a provided spatial extent.
 * This class also implements extraction of the Azure blob address.
 * @internal
 */
export class RealityDataAccessClient extends WsgClient {

  /**
   * Creates an instance of RealityDataServicesClient.
   */
  public constructor() {
    super("v1");
    this.baseUrl = "https://api.bentley.com/contextshare";
  }

  /**
   * This method returns the URL to obtain the Reality Data details from PW Context Share.
   * Technically it should never be required as the RealityData object returned should have all the information to obtain the
   * data.
   * @param iTwinId id of associated iTwin
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @returns string containing the URL to reality data for indicated tile.
   */
  public async getRealityDataUrl(iTwinId: string | undefined, tilesId: string): Promise<string> {
    const serverUrl: string = await this.getUrl();

    if (!iTwinId || iTwinId === "")
      iTwinId = "Server";
    return `${serverUrl}/Repositories/S3MXECPlugin--${iTwinId}/S3MX/RealityData/${tilesId}`;
  }

  /**
   * Gets reality data with all of its properties
   * @param iTwinId id of associated iTwin
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job
   * @returns The requested reality data.
   */
  public async getRealityData(accessToken: AccessToken, iTwinId: string | undefined, tilesId: string): Promise<RealityData> {
    if (!iTwinId || iTwinId === "")
      iTwinId = "Server";

    const realityDatas: RealityData[] = await this.getInstances<RealityData>(accessToken, RealityData, `/Repositories/S3MXECPlugin--${iTwinId}/S3MX/RealityData/${tilesId}`);

    if (realityDatas.length !== 1)
      throw new Error(`Could not fetch reality data: ${tilesId}`);

    realityDatas[0].client = this;
    realityDatas[0].iTwinId = iTwinId;
    return realityDatas[0];
  }

  /** Return the filter string used to query all supported Reality Data types or only the input type if defined
  * @param type  reality data type to query or all supported type if undefined
  * @returns the filter string to use
  * @internal
  */
  private getRealityDataTypesFilter(type?: string): string {
    let filter: string = "";

    if (!type) {
      // If type not specified, add all supported known types
      let isFirst = true;
      for (const supportedType of Object.values(DefaultSupportedTypes)) {
        if (isFirst)
          isFirst = false;
        else
          filter += `+or+`;
        filter += `Type+eq+'${supportedType}'`;
      }
    } else {
      filter = `Type+eq+'${type}'`;
    }
    return filter;
  }

  /**
   * Gets all reality data associated with the iTwin. Consider using getRealityDataInITwinOverlapping() if spatial extent is known.
   * @param iTwinId id of associated iTwin
   * @param type  reality data type to query or all supported type if undefined
   * @returns an array of RealityData that are associated to the iTwin.
   */
  public async getRealityDataInITwin(accessToken: AccessToken, iTwinId: string, type?: string): Promise<RealityData[]> {
    const newQueryOptions = { iTwin: iTwinId } as RequestQueryOptions;
    newQueryOptions.$filter = this.getRealityDataTypesFilter(type);

    const realityDatas: RealityData[] = await this.getRealityDatas(accessToken, iTwinId, newQueryOptions);
    return realityDatas;
  }

  /**
   * Gets all reality data that has a footprint defined that overlaps the given area and that are associated with the iTwin. Reality Data returned must be accessible by user
   * as public, enterprise data, private or accessible through context RBAC rights attributed to user.
   * @param iTwinId id of associated iTwin
   * @param minLongDeg The minimum longitude in degrees of a 2d range to search.
   * @param maxLongDeg The maximum longitude in degrees of a 2d range to search.
   * @param minLatDeg The minimum latitude in degrees of a 2d range to search.
   * @param maxLatDeg The maximum longitude in degrees of a 2d range to search.
   * @returns an array of RealityData
   */
  public async getRealityDataInITwinOverlapping(accessToken: AccessToken, iTwinId: string, minLongDeg: number, maxLongDeg: number, minLatDeg: number, maxLatDeg: number, type?: string): Promise<RealityData[]> {
    const polygonString = `{\"points\":[[${minLongDeg},${minLatDeg}],[${maxLongDeg},${minLatDeg}],[${maxLongDeg},${maxLatDeg}],[${minLongDeg},${maxLatDeg}],[${minLongDeg},${minLatDeg}]], \"coordinate_system\":\"4326\"}`;

    const newQueryOptions = { iTwin: iTwinId, polygon: polygonString } as RequestQueryOptions;
    newQueryOptions.$filter = this.getRealityDataTypesFilter(type);

    return this.getRealityDatas(accessToken, iTwinId, newQueryOptions);
  }

  /** Query for reality data associated with an iTwin.
   * @param criteria Criteria by which to query.
   * @returns Properties of reality data associated with the context, filtered according to the criteria.
   * @public
   */
  public async queryRealityData(accessToken: AccessToken, criteria: RealityDataQueryCriteria): Promise<ContextRealityModelProps[]> {
    const iTwinId = criteria.iTwinId;
    const availableRealityModels: ContextRealityModelProps[] = [];

    if (!accessToken)
      return availableRealityModels;

    const client = new RealityDataAccessClient();

    let realityData: RealityData[];
    if (criteria.range) {
      const iModelRange = criteria.range.getLongitudeLatitudeBoundingBox();
      realityData = await client.getRealityDataInITwinOverlapping(accessToken, iTwinId, Angle.radiansToDegrees(iModelRange.low.x),
        Angle.radiansToDegrees(iModelRange.high.x),
        Angle.radiansToDegrees(iModelRange.low.y),
        Angle.radiansToDegrees(iModelRange.high.y));
    } else {
      realityData = await client.getRealityDataInITwin(accessToken, iTwinId);
    }

    // Get set of URLs that are directly attached to the model.
    const modelRealityDataIds = new Set<string>();
    if (criteria.filterIModel) {
      const query = { from: SpatialModelState.classFullName, wantPrivate: false };
      const props = await criteria.filterIModel.models.queryProps(query);
      for (const prop of props)
        if (prop.jsonProperties !== undefined && prop.jsonProperties.tilesetUrl) {
          const realityDataId = client.getRealityDataIdFromUrl(prop.jsonProperties.tilesetUrl);
          if (realityDataId)
            modelRealityDataIds.add(realityDataId);
        }
    }

    // We obtain the reality data name, and RDS URL for each RD returned.
    for (const currentRealityData of realityData) {
      let realityDataName: string = "";
      let validRd: boolean = true;
      if (currentRealityData.name && currentRealityData.name !== "") {
        realityDataName = currentRealityData.name;
      } else if (currentRealityData.rootDocument) {
        // In case root document contains a relative path we only keep the filename
        const rootDocParts = (currentRealityData.rootDocument).split("/");
        realityDataName = rootDocParts[rootDocParts.length - 1];
      } else {
        // This case would not occur normally but if it does the RD is considered invalid
        validRd = false;
      }

      // If the RealityData is valid then we add it to the list.
      if (currentRealityData.id && validRd === true) {
        const url = await client.getRealityDataUrl(iTwinId, currentRealityData.id);
        let opcConfig: OrbitGtBlobProps | undefined;

        if (currentRealityData.type && (currentRealityData.type.toUpperCase() === "OPC") && currentRealityData.rootDocument !== undefined) {
          const rootDocUrl: string = await currentRealityData.getBlobStringUrl(accessToken, currentRealityData.rootDocument);
          opcConfig = {
            rdsUrl: "",
            containerName: "",
            blobFileName: rootDocUrl,
            accountName: "",
            sasToken: "",
          };
        }

        if (!modelRealityDataIds.has(currentRealityData.id))
          availableRealityModels.push({
            tilesetUrl: url, name: realityDataName, description: (currentRealityData.description ? currentRealityData.description : ""),
            realityDataId: currentRealityData.id, orbitGtBlob: opcConfig,
          });
      }
    }

    return availableRealityModels;
  }

  /**
   * Gets reality datas with all of its properties
   * @param iTwinId id of associated iTwin.
   * @param queryOptions RealityDataServicesRequestQueryOptions of the request.
   * @returns The requested reality data.
   */
  public async getRealityDatas(accessToken: AccessToken, iTwinId: string | undefined, queryOptions: RealityDataRequestQueryOptions): Promise<RealityData[]> {
    if (!iTwinId || iTwinId === "")
      iTwinId = "Server";

    const realityDatas: RealityData[] = await this.getInstances<RealityData>(accessToken, RealityData, `/Repositories/S3MXECPlugin--${iTwinId}/S3MX/RealityData`, queryOptions);

    realityDatas.forEach((realityData) => { realityData.client = this; realityData.iTwinId = iTwinId; });
    return realityDatas;
  }

  /**
   * Creates a reality data with given properties
   * @param iTwinId id of associated iTwin
   * @param realityData The reality data to create. The Id of the reality data is usually left empty indicating for the service to assign
   * one. If set then the reality id must not exist on the server.
   * realityDataInstance id, called tilesId when returned from tile generator job
   * @returns The new reality data with all read-only properties set.
   */
  public async createRealityData(accessToken: AccessToken, iTwinId: string | undefined, realityData: RealityData): Promise<RealityData> {
    if (!iTwinId || iTwinId === "")
      iTwinId = "Server";

    const resultRealityData: RealityData = await this.postInstance<RealityData>(accessToken, RealityData, `/Repositories/S3MXECPlugin--${iTwinId}/S3MX/RealityData`, realityData);

    if (!resultRealityData)
      throw new Error(`Could not create new reality data: ${realityData.id ? realityData.id : realityData.name}`);

    resultRealityData.client = this;
    resultRealityData.iTwinId = iTwinId;
    return resultRealityData;
  }

  /**
   * Updates a reality data with given properties
   * @param iTwinId id of associated iTwin
   * @param realityData The reality data to update. The Id must contain the identifier of the reality data to update.
   * NOTE: As a probable known defect some specific read-only attributes must be undefined prior to passing the reality data.
   * These are: organizationId, sizeUpToDate, ownedBy, ownerId
   * @returns The newly modified reality data.
   */
  public async updateRealityData(accessToken: AccessToken, iTwinId: string | undefined, realityData: RealityData): Promise<RealityData> {
    if (!iTwinId || iTwinId === "")
      iTwinId = "Server";

    const resultRealityData: RealityData = await this.postInstance<RealityData>(accessToken, RealityData, `/Repositories/S3MXECPlugin--${iTwinId}/S3MX/RealityData/${realityData.id}`, realityData);

    if (!resultRealityData)
      throw new Error(`Could not update reality data: ${realityData.id ? realityData.id : realityData.name}`);

    resultRealityData.client = this;
    resultRealityData.iTwinId = iTwinId;
    return resultRealityData;
  }

  /**
   * Deletes a reality data.
   * @param iTwinId id of associated iTwin
   * @param realityDataId The identifier of the reality data to delete.
   * @returns a void Promise.
   */
  public async deleteRealityData(accessToken: AccessToken, iTwinId: string | undefined, realityDataId: string): Promise<void> {
    if (!iTwinId || iTwinId === "")
      iTwinId = "Server";

    return this.deleteInstance<RealityData>(accessToken, `/Repositories/S3MXECPlugin--${iTwinId}/S3MX/RealityData/${realityDataId}`);
  }

  /**
   * Gets all reality data relationships associated to the given reality id, not only the relationship for given iTwin.
   * @param iTwinId id of associated iTwin in which to make to call for permission reason
   * @param realityDataId realityDataInstance id to obtain the relationships for.
   * @returns All relationships associated to reality data. The requested reality data.
   */
  public async getRealityDataRelationships(accessToken: AccessToken, iTwinId: string, realityDataId: string): Promise<RealityDataRelationship[]> {
    const relationships: RealityDataRelationship[] = await this.getInstances<RealityDataRelationship>(accessToken, RealityDataRelationship, `/Repositories/S3MXECPlugin--${iTwinId}/S3MX/RealityDataRelationship?$filter=RealityDataId+eq+'${realityDataId}'`);
    return relationships;
  }

  /**
   * Gets all reality data relationships associated to the given reality id, not only the relationship for given iTwin.
   * @param iTwinId id of associated iTwin in which to make to call for permission reason
   * @param realityDataId realityDataInstance id to obtain the relationships for.
   * @returns All relationships associated to reality data. The requested reality data.
   */
  public async createRealityDataRelationship(accessToken: AccessToken, iTwinId: string, relationship: RealityDataRelationship): Promise<RealityDataRelationship> {
    const resultRealityDataRelationship: RealityDataRelationship = await this.postInstance<RealityDataRelationship>(accessToken, RealityDataRelationship, `/Repositories/S3MXECPlugin--${iTwinId}/S3MX/RealityDataRelationship`, relationship);
    if (!resultRealityDataRelationship)
      throw new Error(`Could not create new reality data relationship between reality data: ${relationship.realityDataId ? relationship.realityDataId : ""} and context: ${relationship.relatedId ? relationship.relatedId : ""}`);

    return resultRealityDataRelationship;
  }

  /**
   * Gets all reality data relationships associated to the given reality id, not only the relationship for given iTwin.
   * @param iTwinId id of associated iTwin in which to make to call for permission reason
   * @param realityDataId realityDataInstance id to obtain the relationships for.
   * @returns All relationships associated to reality data. The requested reality data.
   */
  public async deleteRealityDataRelationship(accessToken: AccessToken, iTwinId: string, relationshipId: string): Promise<void> {
    return this.deleteInstance<RealityDataRelationship>(accessToken, `/Repositories/S3MXECPlugin--${iTwinId}/S3MX/RealityDataRelationship/${relationshipId}`);
  }

  /**
   * Gets a tile file access key
   * @param iTwinId id of associated iTwin
   * @param tilesId realityDataInstance id, called tilesId when returned from tile generator job.
   * @param writeAccess Optional boolean indicating if write access is requested. Default is false for read-only access.
   * @returns a FileAccessKey object containing the Azure blob address.
   */
  public async getFileAccessKey(accessToken: AccessToken, iTwinId: string | undefined, tilesId: string, writeAccess: boolean = false): Promise<FileAccessKey[]> {
    const path = encodeURIComponent(tilesId);
    if (!iTwinId || iTwinId === "")
      iTwinId = "Server";

    if (writeAccess)
      return this.getInstances<FileAccessKey>(accessToken, FileAccessKey, `/Repositories/S3MXECPlugin--${iTwinId}/S3MX/RealityData/${path}/FileAccess.FileAccessKey?$filter=Permissions+eq+%27Write%27`);
    else
      return this.getInstances<FileAccessKey>(accessToken, FileAccessKey, `/Repositories/S3MXECPlugin--${iTwinId}/S3MX/RealityData/${path}/FileAccess.FileAccessKey?$filter=Permissions+eq+%27Read%27`);
  }

  // ###TODO temporary means of extracting the tileId and iTwinId from the given url
  // This is the method that determines if the url refers to Reality Data stored on PW Context Share. If not then undefined is returned.
  /**
   * This is the method that determines if the url refers to Reality Data stored on PW Context Share. If not then undefined is returned.
   * @param url A fully formed URL to a reality data or a reality data folder or document of the form:
   *              https://{Host}/{version}/Repositories/S3MXECPlugin--{ITwinId}/S3MX/RealityData/{RealityDataId}
   *              https://{Host}/{version}/Repositories/S3MXECPlugin--{ITwinId}/S3MX/Folder/{RealityDataId}~2F{Folder}
   *              https://{Host}/{version}/Repositories/S3MXECPlugin--{ITwinId}/S3MX/Document/{RealityDataId}~2F{Full Document Path and name}'
   *            Where {Host} represents the Reality Data Service server (ex: connect-realitydataservices.bentley.com). This value is ignored since the
   *            actual host server name depends on the environment or can be changed in the future.
   *            Where {version} is the Bentley Web Service Gateway protocol version. This value is ignored but the version must be supported by Reality Data Service.
   *            Where {Folder} and {Document} are the full folder or document path relative to the Reality Data root.
   *            {RealityDataId} is extracted after validation of the URL and returned.
   *            {ITwinId} is ignored.
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
   * @returns The requested data locations list.
   */
  public async getDataLocation(accessToken: AccessToken): Promise<DataLocation[]> {
    const dataLocation: DataLocation[] = await this.getInstances<DataLocation>(accessToken, DataLocation, `/Repositories/S3MXECPlugin--Server/S3MX/DataLocation`);
    return dataLocation;
  }
}
