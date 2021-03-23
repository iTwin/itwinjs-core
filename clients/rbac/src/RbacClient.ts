/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RbacClient
 */

import { assert, Config, GuidString } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, ECJsonTypeMap, request, Response, WsgClient, WsgInstance } from "@bentley/itwin-client";

/** RBAC permission
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "RBAC.Permission", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class Permission extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Description")
  public description?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ServiceGPRId")
  public serviceGprId?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CategoryId")
  public categoryId?: number;
}

/** iModelHub Permission
 * @internal
 * @deprecated IModelHub permissions checking logic moved to @bentley/imodelhub-client package, PermissionHandler class
 */
export enum IModelHubPermission {
  None = 0,
  Create = 1 << 0,
  Read = 1 << 1,
  Modify = 1 << 2,
  Delete = 1 << 3,
  ManageResources = 1 << 4,
  ManageVersions = 1 << 5,
  View = 1 << 6,
  ConfigureIModelAccess = 1 << 7,
}

/** Client API to access the iTwin services.
 * @internal
 */
export class RbacClient extends WsgClient {
  public static readonly configRelyingPartyUri = "imjs_rbac_relying_party_uri";

  public constructor() {
    super("v2.4");
    this.baseUrl = "https://api.bentley.com/rbac";
  }

  /** @internal */
  protected getUrlSearchKey(): string { assert(false, "Bentley cloud-specific method should be factored out of WsgClient base class"); return ""; }

  /**
   * Gets theRelyingPartyUrl for the service.
   * @returns RelyingPartyUrl for the service.
   */
  protected getRelyingPartyUrl(): string {
    if (Config.App.has(RbacClient.configRelyingPartyUri))
      return `${Config.App.get(RbacClient.configRelyingPartyUri)}/`;

    if (Config.App.getBoolean(WsgClient.configUseHostRelyingPartyUriAsFallback, true)) {
      if (Config.App.has(WsgClient.configHostRelyingPartyUri))
        return `${Config.App.get(WsgClient.configHostRelyingPartyUri)}/`;
    }

    throw new Error(`RelyingPartyUrl not set. Set it in Config.App using key ${RbacClient.configRelyingPartyUri}`);
  }

  /**
   * Get the permissions of a specified project for the given service
   * @param requestContext The client request context.
   * @param projectId Id of the specified project.
   * @param serviceGPRId GPR Id of the service.
   */
  public async getPermissions(requestContext: AuthorizedClientRequestContext, projectId: string, serviceGPRId: number): Promise<Permission[]> {
    requestContext.enter();

    const userInfo = requestContext.accessToken.getUserInfo();
    if (!userInfo)
      throw new Error("Invalid access token");

    const relativeUrlPath: string = `/Repositories/BentleyCONNECT--Main/RBAC/User/${userInfo.id}/Context`;
    const url: string = await this.getUrl(requestContext) + relativeUrlPath;
    requestContext.enter();

    const filterStr = `$id+eq+'${projectId}'+and+Permission.ServiceGPRId+eq+${serviceGPRId}`;
    const options: any = {
      method: "GET",
      headers: { authorization: requestContext.accessToken.toTokenString() },
      qs: {
        $select: "Permission.*",
        $filter: filterStr,
      },
    };

    return this.executePermissionsRequest(requestContext, url, options);
  }

  /**
   * Get the permissions of the specified object
   * @param requestContext The client request context.
   * @param objectId Id of the specified object.
   * @param objectTypeId ObjectType Id of the specified object.
   */
  public async getObjectPermissions(requestContext: AuthorizedClientRequestContext, objectId: string, objectTypeId: string): Promise<Permission[]> {
    requestContext.enter();

    const userInfo = requestContext.accessToken.getUserInfo();
    if (!userInfo)
      throw new Error("Invalid access token");

    const relativeUrlPath: string = `/Repositories/BentleyCONNECT--Main/RBAC/User/${userInfo.id}/Object`;
    const url: string = await this.getUrl(requestContext) + relativeUrlPath;
    requestContext.enter();

    const filterStr = `$id+eq+'${objectId}'+and+typeid+eq+'${objectTypeId}'`;
    const options: any = {
      method: "GET",
      headers: { authorization: requestContext.accessToken.toTokenString() },
      qs: {
        $select: "Permission.*",
        $filter: filterStr,
      },
    };

    return this.executePermissionsRequest(requestContext, url, options);
  }

  /**
   * Get the ObjectType Id for the given service
   * @param requestContext The client request context.
   * @param objectTypeName ObjectType name.
   * @param serviceGPRId GPR Id of the service.
   */
  public async getObjectTypeId(requestContext: AuthorizedClientRequestContext, objectTypeName: string, serviceGPRId: number): Promise<string> {
    requestContext.enter();

    const userInfo = requestContext.accessToken.getUserInfo();
    if (!userInfo)
      throw new Error("Invalid access token");

    const relativeUrlPath: string = "/Repositories/BentleyCONNECT--Main/RBAC/ObjectType";
    const url: string = await this.getUrl(requestContext) + relativeUrlPath;
    requestContext.enter();

    const filterStr = `Name+eq+'${objectTypeName}'+and+ServiceGPRId+eq+${serviceGPRId}`;
    const options: any = {
      method: "GET",
      headers: { authorization: requestContext.accessToken.toTokenString() },
      qs: {
        $filter: filterStr,
      },
    };

    const instances = await this.executeRequest(requestContext, url, options);
    requestContext.enter();

    return instances[0].instanceId;
  }

  /**
   * Execute request to RBAC expecting exactly one result instance.
   */
  private async executeRequest(requestContext: AuthorizedClientRequestContext, url: string, options: any): Promise<any> {
    requestContext.enter();
    await this.setupOptionDefaults(options);

    const res: Response = await request(requestContext, url, options);
    requestContext.enter();

    if (!res.body || !res.body.hasOwnProperty("instances"))
      throw new Error("Expected an array of instances to be returned");

    const instances = res.body.instances;
    if (!instances)
      throw new Error("Instances array is empty");
    if (instances.length !== 1)
      throw new Error("Instances array must have exactly 1 result");

    return instances;
  }

  /**
   * Execute request to RBAC and parse Permissions.
   */
  private async executePermissionsRequest(requestContext: AuthorizedClientRequestContext, url: string, options: any): Promise<Permission[]> {
    requestContext.enter();

    const instances = await this.executeRequest(requestContext, url, options);
    requestContext.enter();

    const permissions: Permission[] = new Array<Permission>();
    for (const relationshipInstance of instances[0].relationshipInstances) {
      const typedInstance: Permission | undefined = ECJsonTypeMap.fromJson<Permission>(Permission, "wsg", relationshipInstance.relatedInstance);
      if (typedInstance)
        permissions.push(typedInstance);
    }

    return permissions;
  }

  /**
   * Get the permissions relevant to iModelHub for a specified project
   * @param requestContext The client request context.
   * @param projectId Id of the specified project.
   * @deprecated This method does not accommodate new permissions per iModel logic. Use [[IModelHubClient.permissions]] methods to get context or iModel permissions.
   */
  // eslint-disable-next-line deprecation/deprecation
  public async getIModelHubPermissions(requestContext: AuthorizedClientRequestContext, projectId: GuidString): Promise<IModelHubPermission> {
    requestContext.enter();

    const iModelHubServiceGPRId = 2485;
    const permissionInstances: Permission[] = await this.getPermissions(requestContext, projectId, iModelHubServiceGPRId);
    requestContext.enter();

    /* eslint-disable deprecation/deprecation */
    let permissions: IModelHubPermission = IModelHubPermission.None;
    for (const permissionInstance of permissionInstances) {
      switch (permissionInstance.instanceId) {
        case "IMHS_Create_iModel":
          permissions = permissions | IModelHubPermission.Create | IModelHubPermission.View | IModelHubPermission.Read | IModelHubPermission.Modify;
          break;
        case "IMHS_Read_iModel":
          permissions = permissions | IModelHubPermission.Read | IModelHubPermission.View;
          break;
        case "IMHS_Modify_iModel":
          permissions = permissions | IModelHubPermission.Modify | IModelHubPermission.View | IModelHubPermission.Read;
          break;
        case "IMHS_Delete_iModel":
          permissions = permissions | IModelHubPermission.Delete | IModelHubPermission.View | IModelHubPermission.Read;
          break;
        case "IMHS_ManageResources":
          permissions = permissions | IModelHubPermission.ManageResources | IModelHubPermission.View | IModelHubPermission.Read | IModelHubPermission.Modify;
          break;
        case "IMHS_Manage_Versions":
          permissions = permissions | IModelHubPermission.ManageVersions | IModelHubPermission.View | IModelHubPermission.Read | IModelHubPermission.Modify;
          break;
        case "IMHS_Web_View":
          permissions = permissions | IModelHubPermission.View;
          break;
        case "IMHS_iModel_Perm":
          permissions = permissions | IModelHubPermission.ConfigureIModelAccess;
          break;
        default:
      }
    }
    /* eslint-enable deprecation/deprecation */

    return permissions;
  }
}
