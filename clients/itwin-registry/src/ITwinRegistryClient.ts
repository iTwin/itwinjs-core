/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ITwinRegistry
 */
import * as deepAssign from "deep-assign";
import { assert } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, ECJsonTypeMap, RequestOptions, RequestQueryOptions, WsgClient, WsgInstance } from "@bentley/itwin-client";
import { ITwin, ITwinAccess, ITwinQueryArg } from "./ITwinAccessProps";

/** The iTwin context such as Projects and Assets.
 * @beta
 */
@ECJsonTypeMap.classToJson("wsg", "CONNECTEDContext.Context", { schemaPropertyName: "schemaName", classPropertyName: "className" })
class Context extends WsgInstance implements ITwin {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "instanceId")
  @ECJsonTypeMap.propertyToJson("ecdb", "wsgId")
  private _id: string = "";
  public get id(): string {
    if (!this._id) {
      throw new Error("Missing the required id");
    }
    return this._id;
  }
  public set id(value: string) {
    this._id = value;
  }

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Number")
  public code?: string;
}

/** Set of the original properties in the Project and Asset classes that are now deprecated
 * @beta
 */
abstract class HiddenContext extends Context {

  @ECJsonTypeMap.propertyToJson("wsg", "properties.UltimateRefId")
  public ultimateRefId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.DataLocationId")
  public dataLocationId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.TeamId")
  public teamId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Status")
  public status?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.AllowExternalTeamMembers")
  public allowExternalTeamMembers?: boolean;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.CountryCode")
  public countryCode?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.RegisteredDate")
  public registeredDate?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.LastModifiedDate")
  public lastModifiedDate?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.RegisteredBy")
  public registeredBy?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.LastModifiedBy")
  public lastModifiedBy?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Industry")
  public industry?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Image")
  public image?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Location")
  public location?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Latitude")
  public latitude?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Longitude")
  public longitude?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.TimeZoneLocation")
  public timeZoneLocation?: string;
}

/** An iTwin context of type project. Represents time-constrained work done on an [[Asset]].
 * Deprecated
 * @beta
 */
@ECJsonTypeMap.classToJson("wsg", "CONNECTEDContext.Project", { schemaPropertyName: "schemaName", classPropertyName: "className" })
class Project extends HiddenContext {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.AssetId")
  public assetId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Type")
  public type?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsRbacEnabled")
  public isRbacEnabled?: boolean;
}

/** An iTwin context of type asset. Assets represent a large scale item that is owned and/or operated by organization, such as buildings, highways and so on.
 * Deprecated
 * @beta
 */
@ECJsonTypeMap.classToJson("wsg", "CONNECTEDContext.Asset", { schemaPropertyName: "schemaName", classPropertyName: "className" })
class Asset extends HiddenContext {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.AssetType")
  public assetType?: string;
}

/** Client API to access the iTwin registry services.
 * @beta
 */
export class ITwinAccessClient extends WsgClient implements ITwinAccess {
  public static readonly searchKey: string = "CONNECTEDContextService.URL";

  public constructor() {
    super("v2.5");
    this.baseUrl = "https://api.bentley.com/contextregistry";
  }

  /** Get iTwins accessible to the user
   * @param requestContext The client request context
   * @param arg Options for paging and/or searching
   * @returns Array of iTwins, may be empty
   */
  public async getAll(requestContext: AuthorizedClientRequestContext, arg?: ITwinQueryArg): Promise<ITwin[]> {
    const queryOptions: RequestQueryOptions = {
      $top: arg?.pagination?.top,
      $skip: arg?.pagination?.skip,
    };

    if (arg?.search) {
      if (arg.search.exactMatch)
        queryOptions.$filter = `${arg.search.propertyName}+eq+'${arg.search.searchString}'`;
      else
        queryOptions.$filter = `${arg.search.propertyName}+like+'${arg.search.searchString}'`;
    }

    return this.getByQuery(requestContext, queryOptions);
  }

  /** Gets all iTwins (projects or assets) using the given query options
   * @param requestContext The client request context
   * @param queryOptions Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Array of iTwins meeting the query's requirements
   */
  private async getByQuery(requestContext: AuthorizedClientRequestContext, queryOptions?: RequestQueryOptions): Promise<ITwin[]> {
    requestContext.enter();
    // Spread operator possible since there are no nested properties
    const projectQuery = {...queryOptions};
    const assetQuery = {...queryOptions};

    if (queryOptions?.$skip && (projectQuery && assetQuery)) {
      // Ceiling to skip a project object on Odd skips
      projectQuery.$skip = queryOptions?.$skip ? Math.ceil(queryOptions.$skip / 2) : undefined;

      // Floor to skip an asset object on Even skips
      assetQuery.$skip = queryOptions?.$skip ? Math.floor(queryOptions.$skip / 2) : undefined;
    }

    const projectITwins: ITwin[] = await this.getInstances<Project>(requestContext, Project, "/Repositories/BentleyCONNECT--Main/ConnectedContext/project/", projectQuery);
    const assetITwins: ITwin[] = await this.getInstances<Asset>(requestContext, Asset, "/Repositories/BentleyCONNECT--Main/ConnectedContext/asset/", assetQuery);

    if (!queryOptions?.$top) {
      return projectITwins.concat(assetITwins);
    }

    return projectITwins
      // Fill half if there are enough assets, or fill where there are not enough assets
      // if slice end > array.length, it returns the full array no error
      .slice(0,
        Math.max(
          (queryOptions.$top / 2) + (queryOptions.$top % 2), // Add an extra project if top is Odd
          queryOptions.$top - assetITwins.length
        )
      ).concat(assetITwins
        // Fill half if there are enough projects, or fill where there are not enough projects
        .slice(0,
          Math.max(
            queryOptions.$top / 2,
            queryOptions.$top - projectITwins.length
          )
        )
      );
  }

  /** @internal */
  protected getUrlSearchKey(): string { assert(false, "Bentley cloud-specific method should be factored out of WsgClient base class"); return ""; }

  protected override async setupOptionDefaults(options: RequestOptions): Promise<void> {
    await super.setupOptionDefaults(options);
    deepAssign(options, { headers: { "content-type": "application/json" } });
  }
}
