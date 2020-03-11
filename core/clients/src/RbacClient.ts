/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iTwinServiceClients
 */
import { WsgClient } from "./WsgClient";
import { request, Response } from "./Request";
import { ECJsonTypeMap, WsgInstance } from "./ECJsonTypeMap";
import { AuthorizedClientRequestContext } from "./AuthorizedClientRequestContext";
import { Config } from "./Config";

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

/** iModel Hub Permission
 * @internal
 */
export enum IModelHubPermission {
  None = 0,
  Create = 1 << 0,
  Read = 1 << 1,
  Modify = 1 << 2,
  Delete = 1 << 3,
  ManageResources = 1 << 4,
  ManageVersions = 1 << 5,
}

/** Client API to access the connect services.
 * @internal
 */
export class RbacClient extends WsgClient {
  public static readonly searchKey: string = "RBAC.URL";
  public static readonly configRelyingPartyUri = "imjs_rbac_relying_party_uri";

  public constructor() {
    super("v2.4");
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return RbacClient.searchKey;
  }

  /**
   * Gets theRelyingPartyUrl for the service.
   * @returns RelyingPartyUrl for the service.
   */
  protected getRelyingPartyUrl(): string {
    if (Config.App.has(RbacClient.configRelyingPartyUri))
      return Config.App.get(RbacClient.configRelyingPartyUri) + "/";

    if (Config.App.getBoolean(WsgClient.configUseHostRelyingPartyUriAsFallback, true)) {
      if (Config.App.has(WsgClient.configHostRelyingPartyUri))
        return Config.App.get(WsgClient.configHostRelyingPartyUri) + "/";
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
      return Promise.reject(new Error("Invalid access token"));

    const relativeUrlPath: string = "/Repositories/BentleyCONNECT--Main/RBAC/User/" + userInfo.id + "/Project";
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

    await this.setupOptionDefaults(options);

    const res: Response = await request(requestContext, url, options);
    requestContext.enter();

    if (!res.body || !res.body.hasOwnProperty("instances"))
      return Promise.reject(new Error("Expected an array of instances to be returned"));

    const instances = res.body.instances;
    if (!instances || instances.length !== 1)
      return Promise.reject(new Error("Project with specified id was not found"));

    const permissions: Permission[] = new Array<Permission>();
    for (const relationshipInstance of instances[0].relationshipInstances) {
      const typedInstance: Permission | undefined = ECJsonTypeMap.fromJson<Permission>(Permission, "wsg", relationshipInstance.relatedInstance);
      if (typedInstance)
        permissions.push(typedInstance);
    }

    return permissions;
  }

  /**
   * Get the permissions relevant to the iModelHubService for a specified project
   * @param requestContext The client request context.
   * @param projectId Id of the specified project.
   */
  public async getIModelHubPermissions(requestContext: AuthorizedClientRequestContext, projectId: string): Promise<IModelHubPermission> {
    requestContext.enter();

    const iModelHubServiceGPRId = 2485;
    const permissionInstances: Permission[] = await this.getPermissions(requestContext, projectId, iModelHubServiceGPRId);
    requestContext.enter();

    let permissions: IModelHubPermission = IModelHubPermission.None;
    for (const permissionInstance of permissionInstances) {
      switch (permissionInstance.instanceId) {
        case "IMHS_Create_iModel":
          permissions = permissions | IModelHubPermission.Create;
          break;
        case "IMHS_Read_iModel":
          permissions = permissions | IModelHubPermission.Read;
          break;
        case "IMHS_Modify_iModel":
          permissions = permissions | IModelHubPermission.Modify;
          break;
        case "IMHS_Delete_iModel":
          permissions = permissions | IModelHubPermission.Delete;
          break;
        case "IMHS_ManageResources":
          permissions = permissions | IModelHubPermission.ManageResources;
          break;
        case "IMHS_Manage_Versions":
          permissions = permissions | IModelHubPermission.ManageVersions;
          break;
        default:
      }
    }

    return permissions;
  }

}
