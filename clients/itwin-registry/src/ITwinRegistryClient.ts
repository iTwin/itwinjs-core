/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ITwinRegistry
 */
import * as deepAssign from "deep-assign";
import { AccessToken } from "@itwin/core-bentley";
import { RequestOptions, RequestQueryOptions } from "@bentley/itwin-client";
import { ECJsonTypeMap, WsgInstance } from "./wsg/ECJsonTypeMap";
import { WsgClient } from "./wsg/WsgClient";
import { ITwin, ITwinAccess, ITwinQueryArg } from "./ITwinAccessProps";

/** The iTwin object, for general properties covering Projects, Assets, and custom contexts
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

/** A deprecated implementation of a Project type iTwin. Represents time-constrained work done on an Asset.
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

/** A deprecated implementation of an Asset type iTwin. Assets represent a large scale item that is owned and/or operated by organization, such as buildings, highways and so on.
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
  public constructor() {
    super("v2.5");
    this.baseUrl = "https://api.bentley.com/contextregistry";
  }

  /** Get iTwins accessible to the user
   * @param accessToken The client request context
   * @param arg Options for paging and/or searching
   * @returns Array of iTwins, may be empty
   */
  public async getAll(accessToken: AccessToken, arg?: ITwinQueryArg): Promise<ITwin[]> {
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

    return this.getByQuery(accessToken, queryOptions);
  }

  /** Gets all iTwins using the given query options
   * @param accessToken The client request context
   * @param queryOptions Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Array of iTwins meeting the query's requirements
   */
  private async getByQuery(accessToken: AccessToken, queryOptions?: RequestQueryOptions): Promise<ITwin[]> {
    // Spread operator possible since there are no nested properties
    const innerQuery = { ...queryOptions };

    // Alter to get all items including those asked to skip
    innerQuery.$top = innerQuery.$top ? innerQuery.$top + (innerQuery.$skip ?? 0) : undefined;
    innerQuery.$skip = undefined;

    const projectITwins: ITwin[] = await this.getInstances<Project>(accessToken, Project, "/Repositories/BentleyCONNECT--Main/ConnectedContext/project/", innerQuery);
    const assetITwins: ITwin[] = await this.getInstances<Asset>(accessToken, Asset, "/Repositories/BentleyCONNECT--Main/ConnectedContext/asset/", innerQuery);

    // Default range is whole list
    const projectRange = {
      skip: 0,
      top: projectITwins.length,
    };
    const assetRange = {
      skip: 0,
      top: assetITwins.length,
    };

    // If a top value is given
    if (innerQuery?.$top) {
      // Either take half the elements, or more than half if the other list is too short
      projectRange.top = Math.max(
        Math.ceil(innerQuery.$top / 2), // Ceil to add an extra Project if top is Odd
        innerQuery.$top - assetITwins.length
      );

      assetRange.top = Math.max(
        Math.floor(innerQuery.$top / 2),
        innerQuery.$top - projectITwins.length
      );
    }

    // If a skip value is given
    if (queryOptions?.$skip) {
      // Either skip half the elements, or skip more if the other list is too short
      projectRange.skip = Math.max(
        Math.ceil(queryOptions.$skip / 2), // Ceil to skip project on Odd skips
        queryOptions.$skip - assetITwins.length
      );

      assetRange.skip = Math.max(
        Math.floor(queryOptions.$skip / 2), // Floor to skip asset on Even skips
        queryOptions.$skip - projectITwins.length
      );
    }

    return projectITwins
      // if slice end > array.length, it returns the full array no error
      .slice(projectRange.skip, projectRange.top)
      .concat(assetITwins
        .slice(assetRange.skip, assetRange.top)
      );
  }

  protected override async setupOptionDefaults(options: RequestOptions): Promise<void> {
    await super.setupOptionDefaults(options);
    deepAssign(options, { headers: { "content-type": "application/json" } });
  }
}
