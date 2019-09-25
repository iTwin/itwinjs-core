/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OtherServices */
import { GuidString, BentleyError, BentleyStatus, Logger } from "@bentley/bentleyjs-core";
import { ECJsonTypeMap, WsgInstance } from "../ECJsonTypeMap";
import { WsgClient } from "../WsgClient";
import { Config } from "../Config";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";
import { RequestOptions, request } from "../Request";
import { ClientsLoggerCategory } from "../ClientsLoggerCategory";
import { WsgQuery } from "../WsgQuery";

const loggerCategory = ClientsLoggerCategory.Clients;

/** Folder
 * @alpha
 */
@ECJsonTypeMap.classToJson("wsg", "ProjectShare.Folder", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class ProjectShareFolder extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ContentType")
  public contentType?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedBy")
  public createdBy?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Path")
  public path?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedTimeStamp")
  public createdTimeStamp?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ModifiedBy")
  public modifiedBy?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ModifiedTimeStamp")
  public modifiedTimeStamp?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ParentFolderId")
  public parentFolderId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Size")
  public size?: number;
}

/** File
 * @alpha
 */
@ECJsonTypeMap.classToJson("wsg", "ProjectShare.File", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class ProjectShareFile extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "InstanceId")
  public instanceId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ContentType")
  public contentType?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedBy")
  public createdBy?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Path")
  public path?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedTimeStamp")
  public createdTimeStamp?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ModifiedBy")
  public modifiedBy?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ModifiedTimeStamp")
  public modifiedTimeStamp?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ParentFolderId")
  public parentFolderWsgId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Size")
  public size?: number;

  /**
   * @note The accessUrl is only valid for one hour after it has been initialized by the server.
   */
  @ECJsonTypeMap.propertyToJson("wsg", "properties.AccessUrl")
  public accessUrl?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CustomProperties")
  public customProperties?: any;
}

/** Query object for getting SeedFiles. You can use this to modify the query.
 * @alpha
 */
export class ProjectShareQuery extends WsgQuery {
  /**
   * Query for children inside of the specified path
   * @param contextId Context Id (e.g., projectId or assetId)
   * @param path Path specified relative to the root folder. Note: Root folder is named by the contextId
   * @note
   * <ul>
   * <li> The path is really as seen in the connect project share portal, and should not include the contextId at the root.
   * <li> This cannot be combined with other queries.
   * <li> The method currently only works for folders and NOT files!!!
   * <ul>
   */
  public inPath(contextId: GuidString, path: string) {
    // TBD: Get this method to work for files also!!
    const correctedPath = path.endsWith("/") ? path : path + "/";
    this.filter(`Path eq '${contextId}/${correctedPath}'`);
    return this;
  }

  /**
   * Query for children inside the specified folder
   * @param folderId Id of the folder
   * @note This cannot be combined with other queries.
   */
  public inFolder(folderId: GuidString) {
    this.filter(`FolderHasContent-backward-Folder.$id+eq+'${folderId}'`);
    return this;
  }

  /**
   * Query for children inside the specified folder
   * @param contextId Context Id (e.g., projectId or assetId)
   * @note This cannot be combined with other queries.
   */
  public inRootFolder(contextId: GuidString) {
    this.filter(`FolderHasContent-backward-Folder.$id+eq+'${contextId}'`);
    return this;
  }

  /**
   * Query for folders or files by ids
   * @param ids (Array of) folder or file ids
   */
  public byWsgIds(...ids: GuidString[]) {
    const stringOfIds = ids.reduce((prev: GuidString, curr: GuidString) => (!prev ? `'${curr}'` : prev + `,'${curr}'`), "");
    this.filter(`$id in [${stringOfIds}]`);
    this._query.$pageSize = undefined;
    return this;
  }
}

/**
 * Client wrapper to ProjectShare Service
 * @note
 * <ul>
 * <li> Authorization supplied through the [[AuthorizedClientRequestContext]] and can contain SAML or OIDC (JWT) tokens. The client
 * creating OIDC tokens must include the scope *projectwise-share*.
 * <li> Use this [link](http://bsw-wiki.bentley.com/bin/view.pl/Main/ProjectShareApiV2Documentation) for comprehensive documentation of
 * the underlying REST API.
 * <li> The user accessing Project Share must be provided the required permissions in the connect role management portal.
 * i.e., from the main connect project portal, follow the link to "Project Team Management > Project Role Management > Service Access and Permissions > Share"
 * and ensure it includes the relevant Project Share permissions for Read, Write, Delete, etc.
 * </ul>
 * @alpha
 */
export class ProjectShareClient extends WsgClient {
  public static readonly searchKey: string = "ProjectShare.Url";
  public static readonly configURL = "imjs_project_share_client_url";
  public static readonly configRelyingPartyUri = "imjs_project_share_client_relying_party_uri";
  public static readonly configRegion = "imjs_project_share_client_region";

  /**
   * Creates an instance of ProjectShareClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor() {
    super("v2.4");
  }

  protected getRelyingPartyUrl(): string {
    if (Config.App.has(ProjectShareClient.configRelyingPartyUri))
      return Config.App.get(ProjectShareClient.configRelyingPartyUri) + "/";

    if (Config.App.getBoolean(WsgClient.configUseHostRelyingPartyUriAsFallback, true)) {
      if (Config.App.has(WsgClient.configHostRelyingPartyUri))
        return Config.App.get(WsgClient.configHostRelyingPartyUri) + "/";
    }

    throw new Error(`RelyingPartyUrl not set. Set it in Config.App using key ${ProjectShareClient.configRelyingPartyUri}`);
  }

  protected getRegion(): number | undefined {
    if (Config.App.has(ProjectShareClient.configRegion))
      return Config.App.get(ProjectShareClient.configRegion);

    return undefined;
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return ProjectShareClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    if (Config.App.has(ProjectShareClient.configURL))
      return Config.App.get(ProjectShareClient.configURL);

    throw new Error(`Service URL not set. Set it in Config.App using key ${ProjectShareClient.configURL}`);
  }

  /**
   * Gets the URL of the service.
   * Attempts to discover and cache the URL from the URL Discovery Service. If not
   * found uses the default URL provided by client implementations. Note that for consistency
   * sake, the URL is stripped of any trailing "/"
   * @param excludeApiVersion Pass true to optionally exclude the API version from the URL.
   * @returns URL for the service
   */
  public async getUrl(requestContext: AuthorizedClientRequestContext, excludeApiVersion?: boolean): Promise<string> {
    if (this._url) {
      return Promise.resolve(this._url);
    }

    return super.getUrl(requestContext, excludeApiVersion)
      .then(async (url: string): Promise<string> => {
        this._url = url;
        // Handle proxy in UN
        // if (window.location.href.includes("localhost"))
        //  this._url = "http://localhost:3001/" + this._url;
        return Promise.resolve(this._url); // TODO: On the server this really needs a lifetime!!
      });
  }

  /**
   * Get folders that meet the specified query
   * @param requestContext The client request context
   * @param contextId Context Id (e.g., projectId or assetId)
   * @param query ProjectShareQuery
   */
  public async getFolders(requestContext: AuthorizedClientRequestContext, contextId: GuidString, query: ProjectShareQuery): Promise<ProjectShareFolder[]> {
    const url = `/repositories/BentleyCONNECT.ProjectShareV2--${contextId}/ProjectShare/Folder`;
    return this.getInstances<ProjectShareFolder>(requestContext, ProjectShareFolder, url, query.getQueryOptions());
  }

  /**
   * Get files as specified by the query
   * @param requestContext The client request context
   * @param contextId Context Id (e.g., projectId or assetId)
   * @param query ProjectShareQuery
   * @note The accessUrl in a ProjectShareFile is only valid for one hour after it has been initialized by the server.
   */
  public async getFiles(requestContext: AuthorizedClientRequestContext, contextId: GuidString, query: ProjectShareQuery): Promise<ProjectShareFile[]> {
    const url = `/repositories/BentleyCONNECT.ProjectShareV2--${contextId}/ProjectShare/File/`;
    return this.getInstances<ProjectShareFile>(requestContext, ProjectShareFile, url, query.getQueryOptions());
  }

  /**
   * Downloads a file given the access url
   * @param requestContext The client request context
   * @param file ProjectShare file (should include the accessUrl property pointing to the download URL)
   */
  public async downloadFile(requestContext: AuthorizedClientRequestContext, file: ProjectShareFile): Promise<Uint8Array> {
    requestContext.enter();
    if (!file.accessUrl)
      throw new BentleyError(BentleyStatus.ERROR, "Supplied file must have an accessUrl", Logger.logError, loggerCategory, () => ({ ...file }));

    const options: RequestOptions = {
      method: "GET",
      responseType: "arraybuffer",
    };

    const response = await request(requestContext, file.accessUrl, options);
    requestContext.enter();

    const byteArray = new Uint8Array(response.body);
    if (!byteArray || byteArray.length === 0) {
      throw new BentleyError(BentleyStatus.ERROR, "Expected an image to be returned from the query", Logger.logError, loggerCategory);
    }

    return byteArray;
  }

  /**
   * Create, update or delete custom properties in a file, and return the new state of the file.
   * @param requestContext The client request context
   * @param file ProjectShareFile
   * @param customProperties Array of Name-Value pairs describing creates and updates to custom properties.
   * deletes as shown below.
   * <pre><code>
   * e.g.,
   * [{
   *      "Name": "Reviewer",
   *      "Value": "Bob"
   *  },
   *  {
   *      "Name": "Version",
   *      "Value": "2.0"
   *  }]
   * </code></pre>
   * @param Array of custom property names to delete
   */
  public async updateCustomProperties(requestContext: AuthorizedClientRequestContext, contextId: GuidString, file: ProjectShareFile, customProperties: Array<{ Name: string, Value: string }>): Promise<ProjectShareFile> {
    const updateInstance = new ProjectShareFile();
    updateInstance.wsgId = file.wsgId;
    updateInstance.changeState = "modified"; // TBD: Not sure why we need this to be setup.
    updateInstance.customProperties = customProperties;

    const projectShareRequestOptions = {
      CustomOptions: {
        EnableAdHocChangeSet: true,
      },
    };

    const relativeUrl = `/repositories/BentleyCONNECT.ProjectShareV2--${contextId}/ProjectShare/File/${file.wsgId}`;
    return this.postInstance<ProjectShareFile>(requestContext, ProjectShareFile, relativeUrl, updateInstance, projectShareRequestOptions);
  }
}
