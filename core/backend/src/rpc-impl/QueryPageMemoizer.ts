/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, BeDuration, ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { Config } from "@bentley/imodeljs-clients";
import { IModelToken, PageOptions, RpcPendingResponse } from "@bentley/imodeljs-common";
import { IModelDb } from "../IModelDb";
import { LoggerCategory } from "../LoggerCategory";
import { PromiseMemoizer, QueryablePromise } from "../PromiseMemoizer";

const loggerCategory: string = LoggerCategory.IModelDb;
const kDefaultQueryPageTimeout = 2 * 1000; // 2 seconds
const kQueryPageTimeOutKey = "imjs_query_page_timeout";

/** Represent args for query page
 * @internal
 */
interface QueryPageArgs {
  requestContext: ClientRequestContext;
  iModelToken: IModelToken;
  ecsql: string;
  bindings?: any[] | object;
  options?: PageOptions;
}
/** Key generator for memoizer
 * @internal
 */
function generateQueryPageRequestKey(args: QueryPageArgs) {
  let key = args.ecsql;
  if (args.bindings)
    key += ":" + JSON.stringify(args.bindings);
  if (args.options) {
    if (args.options.size)
      key += ":" + args.options.size;
    if (args.options.start)
      key += ":" + args.options.start;
  }
  return key;
}
/** Calls into queryPage to get result in case we did not found it in Cache.
 * @internal
 */
async function queryPage(args: QueryPageArgs): Promise<any[]> {
  const iModelDb: IModelDb = IModelDb.find(args.iModelToken);
  const rows = iModelDb.queryPage(args.ecsql, args.bindings, args.options);
  const ecsql = args.ecsql;
  Logger.logTrace(loggerCategory, "IModelDbRemoting.queryPage", () => ({ ecsql }));
  return rows;
}
/** Utility to cache and retrieve results of long running queryPagerequests
 * The cache is keyed on the input arguments passed to open
 * @internal
 */
export class QueryPageMemoizer extends PromiseMemoizer<any[]> {
  private static _instance: QueryPageMemoizer;
  private constructor(private _timeout: number) {
    super(queryPage, generateQueryPageRequestKey);
  }

  private _superMemoize = this.memoize;
  public memoize = (args: QueryPageArgs): QueryablePromise<any[]> => {
    return this._superMemoize(args);
  }

  private _superDeleteMemoized = this.deleteMemoized;
  public deleteMemoized = (args: QueryPageArgs) => {
    this._superDeleteMemoized(args);
  }

  private async perform(args: QueryPageArgs): Promise<any[]> {
    args.requestContext.enter();
    const pageQP = this.memoize(args);
    const waitPromise = BeDuration.wait(this._timeout);
    await Promise.race([pageQP.promise, waitPromise]);

    args.requestContext.enter();

    if (pageQP.isPending) {
      throw new RpcPendingResponse();
    }

    this.deleteMemoized(args);

    if (pageQP.isFulfilled) {
      return pageQP.result!;
    }

    assert(pageQP.isRejected);
    throw pageQP.error!;
  }

  public static async perform(props: QueryPageArgs): Promise<any[]> {
    if (undefined === this._instance) {
      const timeOut = Config.App.has(kQueryPageTimeOutKey) ? Config.App.getNumber(kQueryPageTimeOutKey) : kDefaultQueryPageTimeout;
      this._instance = new QueryPageMemoizer(timeOut);
    }

    return this._instance.perform(props);
  }
}
