/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { RequestQueryOptions } from "./../Request";
import { ArgumentCheck } from "./Errors";

/** Base class for iModel Hub Query objects. */
export class Query {
  protected _query: RequestQueryOptions = {};
  /** Method used by iModel Hub handlers to translate this query into request's QueryOptions. */
  public getQueryOptions() {
    return this._query;
  }

  /** Add a part of the filter to currently set filter. */
  protected addFilter(filter: string, operator: "and" | "or" = "and") {
    if (!this._query.$filter) {
      this._query.$filter = "";
    } else {
      this._query.$filter += `+${operator}+`;
    }
    this._query.$filter += filter;
  }

  /**
   * Set filter to the specified filter string.
   * This resets all previously set filters.
   * @param filter Filter string to set for the query.
   * @returns This query.
   */
  public filter(filter: string) {
    this._query.$filter = filter;
    return this;
  }

  /** Add a part of the select to currently set select. */
  protected addSelect(select: string) {
    if (this._query.$select) {
      this._query.$select += ",";
    }
    this._query.$select += select;
    return this;
  }

  /**
   * Set select to specified select string.
   * This resets all previously set selects.
   * @param select Select string to set for the query.
   * @returns This query.
   */
  public select(select: string) {
    this._query.$select = select;
    return this;
  }

  /**
   * Select only top entries from the query.
   * This is applied after @see skip parameter.
   * @param n Number of top entries to select.
   * @returns This query.
   */
  public top(n: number) {
    this._query.$top = n;
    return this;
  }

  /**
   * Skip first entries in the query.
   * This is applied before @see top parameter.
   * @param n Number of entries to skip.
   * @returns This query.
   */
  public skip(n: number) {
    this._query.$skip = n;
    return this;
  }

  /**
   * Set order for the query.
   * This resets any other orders set.
   * @param orderBy Order string to set.
   * @returns This query.
   */
  public orderBy(orderBy: string) {
    this._query.$orderby = orderBy;
    return this;
  }
}

/** Query for instances with string based instance ids. */
export class InstanceIdQuery extends Query {
  protected _byId?: string;

  /**
   * Query single instance by its id.
   * @param id Id of the instance to query.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if id is undefined or it is not a valid [Guid]($bentley) value.
   */
  public byId(id: string) {
    ArgumentCheck.validGuid("id", id);
    this._byId = id;
    return this;
  }

  /**
   * Used by iModel Hub handlers to get the id that is queried.
   * @hidden
   * @returns Value that was set with byId method.
   */
  public getId() {
    return this._byId;
  }
}

/**
 * Adds select for the download URL to the query.
 * @param query Query options where the select should be changed.
 * @hidden
 */
export function addSelectFileAccessKey(query: RequestQueryOptions) {
  if (!query.$select)
    query.$select = "*";

  query.$select += ",FileAccessKey-forward-AccessKey.DownloadURL";
}
