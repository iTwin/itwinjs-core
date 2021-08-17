/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContextRegistry
 */
import { assert, Config } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, ECJsonTypeMap, RequestOptions, WsgClient, WsgInstance } from "@bentley/itwin-client";
import * as deepAssign from "deep-assign";
import { ITwin, ITwinAccess, ITwinQueryArg } from "./ITwinAccessProps";

/** The iTwin context. Currently supported context types are [[Project]] and [[Asset]].
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
 * @beta
 */
@ECJsonTypeMap.classToJson("wsg", "CONNECTEDContext.Asset", { schemaPropertyName: "schemaName", classPropertyName: "className" })
class Asset extends HiddenContext {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.AssetType")
  public assetType?: string;
}

/** A set of query options containing favorite and most recently used
 * @beta
 */
class HiddenQueryOptions {
  // The public Project API (at time of writing) supports $search but not $filter
  // instead the currently used API supports $filter but not $search
  public $filter?: string;
  public $top?: number;
  public $skip?: number;

  // Hidden custom query options
  public isFavorite?: boolean;
  public isMRU?: boolean;
}

/** Client API to access the context registry services.
 * @beta
 */
export class ITwinAccessClient extends WsgClient implements ITwinAccess {
  public static readonly searchKey: string = "CONNECTEDContextService.URL";
  public static readonly configRelyingPartyUri = "imjs_connected_context_service_relying_party_uri";

  public constructor() {
    super("v2.5");
    this.baseUrl = "https://api.bentley.com/contextregistry";
  }

  /** Get iTwins accessible to the user
   * @param requestContext The client request context
   * @param arg Options for paging or filtering
   * @returns Array of iTwins, may be empty
   */
  public async getAll(requestContext: AuthorizedClientRequestContext, arg?: ITwinQueryArg): Promise<ITwin[]> {
    const queryOptions: HiddenQueryOptions = {
      $top: arg?.top,
      $skip: arg?.skip,
    };
    return this.getByQuery(requestContext, queryOptions);
  }

  /** Get all iTwins with matching name
   * @param requestContext The client request context
   * @param name The name to match
   * @returns Array of matching iTwins, may be empty
   */
  public async getAllByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<ITwin[]> {
    const queryOptions: HiddenQueryOptions = {
      $filter: `name+eq+'${name}'`,
    };
    return this.getByQuery(requestContext, queryOptions);
  }

  /** Get favorited iTwins
   * @param requestContext The client request context
   * @param arg Options for paging or filtering
   * @returns Array of favorited iTwins, may be empty
  */
  public async getFavorites(requestContext: AuthorizedClientRequestContext, arg?: ITwinQueryArg): Promise<ITwin[]> {
    const queryOptions: HiddenQueryOptions = {
      $top: arg?.top,
      $skip: arg?.skip,
      isFavorite: true,
    };
    return this.getByQuery(requestContext, queryOptions);
  }

  /** Get the most recently used iTwins
   * @param requestContext The client request context
   * @param arg Options for paging or filtering
   * @returns Array of most recently used iTwins, may be empty
   */
  public async getRecentlyUsed(requestContext: AuthorizedClientRequestContext, arg?: ITwinQueryArg): Promise<ITwin[]> {
    const queryOptions: HiddenQueryOptions = {
      $top: arg?.top,
      $skip: arg?.skip,
      isMRU: true,
    };

    return this.getByQuery(requestContext, queryOptions);
  }

  /** Get an iTwin via id
   * @param requestContext The client request context
   * @param id The unique id/wsgId/ecId of the iTwin
   * @returns An iTwin with matching id
   * @throws If no matching iTwin found, or multiple matching iTwin found
   */
  public async getById(requestContext: AuthorizedClientRequestContext, id: string): Promise<ITwin> {
    const queryOptions: HiddenQueryOptions = {
      $filter: `$id+eq+'${id}'`, // At time of writing $filter is supported, this may not be the case in the future
    };
    // Only one iTwin
    const iTwins = await this.getByQuery(requestContext, queryOptions);
    if (iTwins.length === 0)
      throw new Error(`ITwin with an id ${id} was not found for the user.`);
    else if (iTwins.length > 1)
      throw new Error(`Multiple iTwins with id ${id} were found for the user.`);

    return iTwins[0];
  }

  /** Gets all iTwins (projects or assets) using the given query options
   * @param requestContext The client request context
   * @param queryOptions Use the mapped EC property names in the query strings and not the TypeScript property names.
   * @returns Array of iTwins meeting the query's requirements
   */
  private async getByQuery(requestContext: AuthorizedClientRequestContext, queryOptions?: HiddenQueryOptions): Promise<ITwin[]> {
    requestContext.enter();
    const projectITwins: ITwin[] = await this.getInstances<Project>(requestContext, Project, "/Repositories/BentleyCONNECT--Main/ConnectedContext/project/", queryOptions);
    const assetITwins: ITwin[] = await this.getInstances<Asset>(requestContext, Asset, "/Repositories/BentleyCONNECT--Main/ConnectedContext/asset/", queryOptions);

    return projectITwins.concat(assetITwins);
  }

  /** @internal */
  protected getUrlSearchKey(): string { assert(false, "Bentley cloud-specific method should be factored out of WsgClient base class"); return ""; }

  protected override async setupOptionDefaults(options: RequestOptions): Promise<void> {
    await super.setupOptionDefaults(options);
    deepAssign(options, { headers: { "content-type": "application/json" } });
  }

  /** Gets theRelyingPartyUrl for the service.
   * @returns RelyingPartyUrl for the service.
   */
  protected getRelyingPartyUrl(): string {
    if (Config.App.has(ITwinAccessClient.configRelyingPartyUri))
      return `${Config.App.get(ITwinAccessClient.configRelyingPartyUri)}/`;

    if (Config.App.getBoolean(WsgClient.configUseHostRelyingPartyUriAsFallback, true)) {
      if (Config.App.has(WsgClient.configHostRelyingPartyUri))
        return `${Config.App.get(WsgClient.configHostRelyingPartyUri)}/`;
    }

    throw new Error(`RelyingPartyUrl not set. Set it in Config.App using key ${ITwinAccessClient.configRelyingPartyUri}`);
  }
}
