/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ConnectServices */
import { DeploymentEnv, UrlDescriptor } from "./Client";
import { WsgClient } from "./WsgClient";
import { AccessToken } from "./Token";
import { request, RequestQueryOptions, Response } from "./Request";
import { ECJsonTypeMap, WsgInstance } from "./ECJsonTypeMap";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** Connect project */
@ECJsonTypeMap.classToJson("wsg", "CONNECTEDContext.Project", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class Project extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Number")
  public number?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.UltimateRefId")
  public ultimateRefId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.AssetId")
  public assetId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.DataLocationId")
  public dataLocationId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Industry")
  public industry?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Type")
  public type?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Location")
  public location?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Latitude")
  public latitude?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Longitude")
  public longitude?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CountryCode")
  public countryCode?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.TimeZoneLocation")
  public timeZoneLocation?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Status")
  public status?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.RegisteredDate")
  public registeredDate?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.LastModifiedDate")
  public lastModifiedDate?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsRbacEnabled")
  public isRbacEnabled?: boolean;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.AllowExternalTeamMembers")
  public allowExternalTeamMembers?: boolean;
}

/** RBAC project */
@ECJsonTypeMap.classToJson("wsg", "RBAC.Project", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class RbacProject extends WsgInstance {
  // Empty!
}

/** RBAC permission */
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

/** Options to request connect projects */
export interface ConnectRequestQueryOptions extends RequestQueryOptions {
  /** Set to true to request the most recently used projects */
  isMRU?: boolean;

  /** Set to true to request the favorite projects */
  isFavorite?: boolean;
}

export interface RbacRequestQueryOptions extends RequestQueryOptions {
  rbacOnly?: boolean;
}

export enum IModelHubPermissions {
  None = 0,
  CreateIModel = 1 << 0,
  ReadIModel = 1 << 1,
  ModifyIModel = 1 << 2,
  ManageResources = 1 << 3,
  ManageVersions = 1 << 4,
}

/** Client API to access the connect services. */
export class RbacClient extends WsgClient {
  public static readonly searchKey: string = "RBAC.URL";

  private static readonly _defaultUrlDescriptor: UrlDescriptor = {
    DEV: "https://dev-rbac-eus.cloudapp.net",
    QA: "https://qa-connect-rbac.bentley.com",
    PROD: "https://connect-rbac.bentley.com",
    PERF: "https://perf-rbac-eus.cloudapp.net",
  };

  public constructor(public deploymentEnv: DeploymentEnv) {
    super(deploymentEnv, "v2.4", "https://connect-wsg20.bentley.com");
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return RbacClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    return RbacClient._defaultUrlDescriptor[this.deploymentEnv];
  }

  /**
   * Gets connect projects accessible to the authorized user.
   * @param token Delegation token of the authorized user.
   * @param queryOptions Query options. Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Resolves to an array of projects.
   */
  public async getProjects(alctx: ActivityLoggingContext, token: AccessToken, queryOptions?: RbacRequestQueryOptions): Promise<RbacProject[]> {
    const userProfile = token.getUserProfile();
    if (!userProfile)
      return Promise.reject(new Error("Invalid access token"));

    const url: string = "/Repositories/BentleyCONNECT--Main/RBAC/User/" + userProfile.userId + "/Project";
    return this.getInstances<RbacProject>(alctx, RbacProject, token, url, queryOptions);
  }

  /**
   * Get the permissions relevant to the iModelHubService for a specified project
   * @param token Delegation token of the authorized user.
   * @param projectId Id of the specified project.
   */
  public async getIModelHubPermissions(alctx: ActivityLoggingContext, token: AccessToken, projectId: string): Promise<IModelHubPermissions> {
    alctx.enter();
    const userProfile = token.getUserProfile();
    if (!userProfile)
      return Promise.reject(new Error("Invalid access token"));

    const relativeUrlPath: string = "/Repositories/BentleyCONNECT--Main/RBAC/User/" + userProfile.userId + "/Project";
    const url: string = await this.getUrl(alctx) + relativeUrlPath;
    alctx.enter();

    const iModelHubServiceGPRId = 2485;
    const filterStr = `$id+eq+'${projectId}'+and+Permission.ServiceGPRId+eq+${iModelHubServiceGPRId}`;
    const options: any = {
      method: "GET",
      headers: { authorization: token.toTokenString() },
      qs: {
        $select: "Permission.$id",
        $filter: filterStr,
      },
    };

    await this.setupOptionDefaults(options);

    const res: Response = await request(alctx, url, options);
    alctx.enter();

    if (!res.body || !res.body.hasOwnProperty("instances"))
      return Promise.reject(new Error("Expected an array of instances to be returned"));

    const instances = res.body.instances;
    if (!instances || instances.length !== 1)
      return Promise.reject(new Error("Project with specified id was not found"));

    let permissions: IModelHubPermissions = IModelHubPermissions.None;
    for (const relationshipInstance of instances[0].relationshipInstances) {
      switch (relationshipInstance.relatedInstance.instanceId) {
        case "IMHS_Create_iModel":
          permissions = permissions | IModelHubPermissions.CreateIModel;
          break;
        case "IMHS_Read_iModel":
          permissions = permissions | IModelHubPermissions.ReadIModel;
          break;
        case "IMHS_Modify_iModel":
          permissions = permissions | IModelHubPermissions.ModifyIModel;
          break;
        case "IMHS_ManageResources":
          permissions = permissions | IModelHubPermissions.ManageResources;
          break;
        case "IMHS_Manage_Versions":
          permissions = permissions | IModelHubPermissions.ManageVersions;
          break;
        default:
      }
    }

    return permissions;
  }

}

/** Client API to access the connect services. */
export class ConnectClient extends WsgClient {
  public static readonly searchKey: string = "CONNECTEDContextService.URL";
  private readonly _rbacClient: RbacClient = new RbacClient(this.deploymentEnv);

  private static readonly _defaultUrlDescriptor: UrlDescriptor = {
    DEV: "https://dev-connect-contextregistry.bentley.com",
    QA: "https://qa-connect-contextregistry.bentley.com",
    PROD: "https://connect-wsg20.bentley.com",
    PERF: "https://perf-connect-contextregistry.bentley.com",
  };

  public constructor(public deploymentEnv: DeploymentEnv) {
    super(deploymentEnv, "sv1.0", "https://connect-wsg20.bentley.com");
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return ConnectClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    return ConnectClient._defaultUrlDescriptor[this.deploymentEnv];
  }

  /**
   * Gets connect projects accessible to the authorized user.
   * @param token Delegation token of the authorized user.
   * @param queryOptions Query options. Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Resolves to an array of projects.
   */
  public async getProjects(alctx: ActivityLoggingContext, token: AccessToken, queryOptions?: ConnectRequestQueryOptions): Promise<Project[]> {
    return this.getInstances<Project>(alctx, Project, token, "/Repositories/BentleyCONNECT--Main/ConnectedContext/Project", queryOptions);
  }

  /**
   * Gets a connect project.
   * @param token Delegation token of the authorized user.
   * @param queryOptions Query options. Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Resolves to the found project. Rejects if no projects, or more than one project is found.
   */
  public async getProject(alctx: ActivityLoggingContext, token: AccessToken, queryOptions?: ConnectRequestQueryOptions): Promise<Project> {
    return this.getProjects(alctx, token, queryOptions)
      .then((projects: Project[]) => {
        if (projects.length === 0) {
          return Promise.reject(new Error("Could not find a project with the specified criteria"));
        } else if (projects.length > 1) {
          return Promise.reject(new Error("More than one project found with the specified criteria"));
        }
        return Promise.resolve(projects[0]);
      });
  }

  /** Get the projects the user has been "invited" to. Note that this involves querying the RBAC and ConnectedContext services.
   * @param token Delegation token of the authorized user.
   * @param queryOptions Query options. Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Resolves to an array of invited projects.
   */
  public async getInvitedProjects(alctx: ActivityLoggingContext, token: AccessToken, queryOptions?: ConnectRequestQueryOptions): Promise<Project[]> {
    const rbacQueryOptions: RbacRequestQueryOptions = {
      $top: queryOptions ? queryOptions.$top : undefined,
      $skip: queryOptions ? queryOptions.$skip : undefined,
      $filter: "rbaconly+eq+true",
    };

    const invitedProjectIds: string[] = await this._rbacClient.getProjects(alctx, token, rbacQueryOptions)
      .then((invitedProjects: RbacProject[]) => invitedProjects.map((val: RbacProject) => val.wsgId));

    const filterStr = "$id+in+[" + invitedProjectIds.reduce((sum: string, value: string) => {
      const quotedValue = "'" + value + "'";
      return sum ? sum + "," + quotedValue : quotedValue;
    }, "") + "]";

    const newQueryOptions: ConnectRequestQueryOptions = queryOptions || {};
    newQueryOptions.$filter = (queryOptions && queryOptions.$filter) ? queryOptions.$filter + "+and+" + filterStr : filterStr;
    return this.getProjects(alctx, token, newQueryOptions);
  }

}
