/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { RequestQueryOptions } from "./../Request";
import { ArgumentCheck } from "./Errors";
import { Guid } from "../../node_modules/@bentley/bentleyjs-core/lib/Id";

/** Base class for iModelHub Query objects. Query objects are used to modify the results when getting instances from iModelHub. */
export class Query {
  protected _query: RequestQueryOptions = {};
  /**
   * Translate this object into QueryOptions.
   * @hidden
   */
  public getQueryOptions() {
    return this._query;
  }

  /**
   * Append a part of the filter.
   * @hidden
   */
  protected addFilter(filter: string, operator: "and" | "or" = "and") {
    if (!this._query.$filter) {
      this._query.$filter = "";
    } else {
      this._query.$filter += `+${operator}+`;
    }
    this._query.$filter += filter;
  }

  /**
   * Set filter to the specified filter string. This resets all previously set filters.
   * @param filter Filter string to set for the query.
   * @returns This query.
   */
  public filter(filter: string) {
    this._query.$filter = filter;
    return this;
  }

  /**
   * Append a part of the select.
   * @hidden
   */
  protected addSelect(select: string) {
    if (this._query.$select) {
      this._query.$select += ",";
    }
    this._query.$select += select;
    return this;
  }

  /**
   * Set select to specified select string. This resets all previously set selects.
   * @param select Select string to set for the query.
   * @returns This query.
   */
  public select(select: string) {
    this._query.$select = select;
    return this;
  }

  /**
   * Select only top entries from the query. This is applied after [[Query.skip]].
   * @param n Number of top entries to select.
   * @returns This query.
   */
  public top(n: number) {
    this._query.$top = n;
    return this;
  }

  /**
   * Skip first entries in the query. This is applied before [[Query.top]].
   * @param n Number of entries to skip.
   * @returns This query.
   */
  public skip(n: number) {
    this._query.$skip = n;
    return this;
  }

  /**
   * Set order for the query. This resets any other orders set.
   * @param orderBy Order string to set.
   * @returns This query.
   */
  public orderBy(orderBy: string) {
    this._query.$orderby = orderBy;
    return this;
  }
}

/** Query for instances with string based instance ids. */
export class StringIdQuery extends Query {
  /** @hidden */
  protected _byId?: string;

  /**
   * Query single instance by its id.
   * @param id Id of the instance to query.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if id is undefined or it is not a valid [Guid]($bentley) value.
   */
  public byId(id: string) {
    this.checkValue(id);
    this._byId = id;
    return this;
  }

  /** @hidden */
  protected checkValue(id: string) {
    ArgumentCheck.valid("id", id);
  }

  /**
   * Used by iModelHub handlers to get the id that is queried.
   * @hidden
   */
  public getId() {
    return this._byId;
  }
}

/** Query for instances with Guid based instance ids. */
export class InstanceIdQuery extends Query {
  /** @hidden */
  protected _byId?: Guid;

  /**
   * Query single instance by its id.
   * @param id Id of the instance to query.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if id is undefined or it is not a valid [Guid]($bentley) value.
   */
  public byId(id: Guid) {
    ArgumentCheck.validGuid("id", id);
    this._byId = id;
    return this;
  }

  /**
   * Used by iModelHub handlers to get the id that is queried.
   * @hidden
   */
  public getId() {
    return this._byId;
  }
}

/**
 * Add select for the download URL to the query.
 * @hidden
 */
export function addSelectFileAccessKey(query: RequestQueryOptions) {
  if (!query.$select)
    query.$select = "*";

  query.$select += ",FileAccessKey-forward-AccessKey.DownloadURL";
}
