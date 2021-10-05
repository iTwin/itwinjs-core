/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ITwinRegistry
 */
import { AccessToken } from "@itwin/core-bentley";
import { Client, request, RequestOptions } from "@bentley/itwin-client";
import { ITwin, ITwinAccess, ITwinQueryArg } from "./ITwinAccessProps";

/** Client API to access the iTwin registry services.
 * @beta
 */
export class ITwinAccessClient extends Client implements ITwinAccess {
  public constructor() {
    super();
    this.baseUrl = "https://api.bentley.com/projects";
  }

  /** Get iTwins accessible to the user
   * @param accessToken The client request context
   * @param arg Options for paging and/or searching
   * @returns Array of iTwins, may be empty
   */
  public async getAll(accessToken: AccessToken, arg?: ITwinQueryArg): Promise<ITwin[]> {
    return this.getByQuery(accessToken, arg);
  }

  /** Gets all iTwins using the given query options
   * @param accessToken The client request context
   * @param queryArg Optional object containing queryable properties
   * @returns Array of iTwins meeting the query's requirements
   */
  private async getByQuery(accessToken: AccessToken, queryArg?: ITwinQueryArg): Promise<ITwin[]> {
    const requestOptions: RequestOptions = this.getRequestOptions(accessToken);
    let url = await this.getUrl();
    if (queryArg)
      url = url + this.getQueryString(queryArg);

    const iTwins: ITwin[] = [];

    try {
      const response = await request(url, requestOptions);

      if (!response.body.projects) {
        new Error("Expected array of iTwins not found in API response.");
      }

      response.body.projects.forEach((iTwin: any) => {
        iTwins.push({
          id: iTwin.id,
          name: iTwin.displayName,
          code: iTwin.projectNumber,
        });
      });
    } catch (errorResponse: any) {
      throw Error(`API request error: ${JSON.stringify(errorResponse)}`);
    }

    return iTwins;
  }

  /**
   * Build the request methods, headers, and other options
   * @param accessTokenString A user's access token as a string
   */
  private getRequestOptions(accessTokenString: string): RequestOptions {
    return {
      method: "GET",
      headers: {
        "authorization": accessTokenString,
        "content-type": "application/json",
      },
    };
  }

  /**
   * Build a query to be appended to a URL
   * @param queryArg Object container queryable properties
   * @returns String beginning with '?' to be appended to a URL, or it may be empty
   */
  private getQueryString(queryArg: ITwinQueryArg): string {
    let queryBuilder = "";

    // Handle searches
    if (queryArg.search) {
      if (queryArg.search.exactMatch)
        queryBuilder = `${queryBuilder}${queryArg.search.propertyName}=${queryArg.search.searchString}&`;

      // Currently the API only allows substring searching across both name and code at the same time
      else
        queryBuilder = `${queryBuilder}$search=${queryArg.search.searchString}&`;
    }

    // Handle pagination
    if (queryArg.pagination) {
      if (queryArg.pagination.skip)
        queryBuilder = `${queryBuilder}$skip=${queryArg.pagination.skip}&`;
      if (queryArg.pagination.top)
        queryBuilder = `${queryBuilder}$top=${queryArg.pagination.top}&`;
    }

    // No query
    if ("" === queryBuilder)
      return queryBuilder;

    // slice off last '&'
    return `?${queryBuilder.slice(0,-1)}`;
  }
}
