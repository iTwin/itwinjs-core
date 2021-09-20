/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { RequestQueryOptions } from "@bentley/itwin-client";

/**
 * Context for holding chunked query data.
 * @internal
 */
export class ChunkedQueryContext {
  private _instancesLeft?: number;
  private _queryFinished: boolean = false;
  private _skipToken: string = "";
  private _pageSize?: number;

  /** Count of instances that are left to query. This property is only used when both PageSize and Top are defined and PageSize is smaller than Top. */
  public get instancesLeft(): number | undefined {
    return this._instancesLeft;
  }

  /** Current query skip token. */
  public get skipToken(): string {
    return this._skipToken;
  }

  public set skipToken(value: string) {
    this._skipToken = value;
  }

  /** Returns true if chunked query finished executing. */
  public get isQueryFinished(): boolean {
    return !this._skipToken || this._queryFinished;
  }

  /** Prepares for next chunked query iteration. */
  public handleIteration(queryOptions: RequestQueryOptions) {
    let pageSize = this._pageSize;
    if (this._instancesLeft) {
      // Top was greater than PageSize. Update Top if this is the last page.
      if (this._instancesLeft > pageSize!) {
        this._instancesLeft -= pageSize!;
      } else {
        pageSize = this._instancesLeft;
        this._queryFinished = true;
      }
    }

    queryOptions.$top = pageSize;
  }

  /** Creates chunked query context if it is applicable for provided query. Context is created if Top is not defined or Top is bigger than PageSize. */
  public static create(queryOptions: RequestQueryOptions): ChunkedQueryContext | undefined {
    let chunkedQueryContext;

    if (!queryOptions.$top) {
      // Top was undefined. All instances must be returned by using SkipToken.
      chunkedQueryContext = new ChunkedQueryContext();
      chunkedQueryContext._pageSize = queryOptions.$pageSize;
    } else if (queryOptions.$pageSize && queryOptions.$top > queryOptions.$pageSize) {
      // Top and PageSize are defined. If Top is less or equal to PageSize then single request should be performed.
      // Otherwise multiple request should be performed by using SkipToken.
      chunkedQueryContext = new ChunkedQueryContext();
      chunkedQueryContext._pageSize = queryOptions.$pageSize;
      chunkedQueryContext._instancesLeft = queryOptions.$top;
    }

    // Clear PageSize so that it won't be included in url.
    queryOptions.$pageSize = undefined;

    return chunkedQueryContext;
  }
}
