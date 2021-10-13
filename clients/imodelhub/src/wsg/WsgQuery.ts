/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { RequestQueryOptions } from "@bentley/itwin-client";

/** Base class for Query objects. Query objects are used to modify the results when getting instances.
 * @internal
 */
export class WsgQuery {
  protected _query: RequestQueryOptions = {};
  /**
   * Translate this object into QueryOptions.
   * @internal
   */
  public getQueryOptions() {
    return this._query;
  }

  /**
   * Reset QueryOptions.
   * @internal
   */
  public resetQueryOptions() {
    this._query = {};
  }

  /**
   * Append a part of the filter.
   * @internal
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
   * @internal
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

  /**
   * Select all entries from the query by pages.
   * @param n Maximum number of entries in a single response.
   * @returns This query.
   */
  public pageSize(n: number) {
    this._query.$pageSize = n;
    return this;
  }
}
