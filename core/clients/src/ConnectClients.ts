/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ConnectServices */
import { WsgClient } from "./WsgClient";
import { RequestQueryOptions, RequestOptions } from "./Request";
import { ECJsonTypeMap, WsgInstance } from "./ECJsonTypeMap";
import { AuthorizedClientRequestContext } from "./AuthorizedClientRequestContext";
import { Config } from "./Config";
import * as deepAssign from "deep-assign";

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

/** RBAC user */
@ECJsonTypeMap.classToJson("wsg", "RBAC.User", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class RbacUser extends WsgInstance {
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

/** Client API to access the connect services. */
export class ConnectClient extends WsgClient {
  public static readonly searchKey: string = "CONNECTEDContextService.URL";
  public static readonly configRelyingPartyUri = "imjs_connected_context_service_relying_party_uri";

  public constructor() {
    super("sv1.0");
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return ConnectClient.searchKey;
  }

  protected async setupOptionDefaults(options: RequestOptions): Promise<void> {
    await super.setupOptionDefaults(options);
    deepAssign(options, { headers: { "content-type": "application/json" } });
  }

  /**
   * Gets theRelyingPartyUrl for the service.
   * @returns RelyingPartyUrl for the service.
   */
  protected getRelyingPartyUrl(): string {
    if (Config.App.has(ConnectClient.configRelyingPartyUri))
      return Config.App.get(ConnectClient.configRelyingPartyUri) + "/";

    if (Config.App.getBoolean(WsgClient.configUseHostRelyingPartyUriAsFallback, true)) {
      if (Config.App.has(WsgClient.configHostRelyingPartyUri))
        return Config.App.get(WsgClient.configHostRelyingPartyUri) + "/";
    }

    throw new Error(`RelyingPartyUrl not set. Set it in Config.App using key ${ConnectClient.configRelyingPartyUri}`);
  }

  /**
   * Gets connect projects accessible to the authorized user.
   * @param requestContext The client request context
   * @param queryOptions Query options. Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Resolves to an array of projects.
   */
  public async getProjects(requestContext: AuthorizedClientRequestContext, queryOptions?: ConnectRequestQueryOptions): Promise<Project[]> {
    return this.getInstances<Project>(requestContext, Project, "/Repositories/BentleyCONNECT--Main/ConnectedContext/Project", queryOptions);
  }

  /**
   * Gets a connect project.
   * @param requestContext The client request context
   * @param queryOptions Query options. Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Resolves to the found project. Rejects if no projects, or more than one project is found.
   */
  public async getProject(requestContext: AuthorizedClientRequestContext, queryOptions?: ConnectRequestQueryOptions): Promise<Project> {
    const projects: Project[] = await this.getProjects(requestContext, queryOptions);
    if (projects.length === 0)
      throw new Error("Could not find a project with the specified criteria that the user has access to");
    else if (projects.length > 1)
      throw new Error("More than one project found with the specified criteria");

    return projects[0];
  }

  /** Get the projects the user has been "invited" to.
   * @param token Delegation token of the authorized user.
   * @param queryOptions Query options. Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Resolves to an array of invited projects.
   */
  public async getInvitedProjects(requestContext: AuthorizedClientRequestContext, queryOptions?: ConnectRequestQueryOptions): Promise<Project[]> {
    return this.getInstances<Project>(requestContext, Project, "/Repositories/BentleyCONNECT--Main/ConnectedContext/Project?rbaconly=true", queryOptions);
  }

}
