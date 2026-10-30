import { IModelJsNative } from "@bentley/imodeljs-native";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbBlobRequest, DbBlobResponse, DbQueryConfig, DbQueryRequest, DbQueryResponse, DbRequestKind, DbResponse, DbResponseKind } from "@itwin/core-common";

function isQueryResponse(response: DbResponse): response is DbQueryResponse {
  return "meta" in response && Array.isArray(response.meta) &&
    "data" in response && Array.isArray(response.data) &&
    "rowCount" in response && typeof response.rowCount === "number";
}

/** @internal */
export type OnResponse = (response: Response) => void;

/** @internal */
export class ConcurrentQuery {
  /** Executes a primary-connection request whose native callback completes on the caller's thread.
   * @internal
   */
  public static executePrimaryQueryRequest(conn: IModelJsNative.ECDb | IModelJsNative.DgnDb, request: DbQueryRequest): DbQueryResponse {
    if (request.usePrimaryConn !== true)
      throw new Error("A synchronous concurrent query request must use the primary connection");
    request.kind = DbRequestKind.ECSql;
    let response: DbResponse | undefined;
    conn.concurrentQueryExecute(request, (value) => {
      response = value;
    });
    if (response === undefined)
      throw new Error("Primary-connection query did not complete synchronously");
    if (response.kind === DbResponseKind.NoResult)
      return { ...response, meta: [], data: [], rowCount: 0 };
    if (!isQueryResponse(response))
      throw new Error("Primary-connection query returned an invalid response");
    return response;
  }

  /** @internal */
  public static async executeQueryRequest(conn: IModelJsNative.ECDb | IModelJsNative.DgnDb, request: DbQueryRequest): Promise<DbQueryResponse> {
    return new Promise<DbQueryResponse>((resolve) => {
      request.kind = DbRequestKind.ECSql;
      conn.concurrentQueryExecute(request, (response: any) => {
        resolve(response as DbQueryResponse);
      });
    });
  }
  /** @internal */
  public static async executeBlobRequest(conn: IModelJsNative.ECDb | IModelJsNative.DgnDb, request: DbBlobRequest): Promise<DbBlobResponse> {
    return new Promise<DbBlobResponse>((resolve) => {
      request.kind = DbRequestKind.BlobIO;
      conn.concurrentQueryExecute(request, (response: any) => {
        resolve(response as DbBlobResponse);
      });
    });
  }
  public static resetConfig(conn: IModelJsNative.ECDb | IModelJsNative.DgnDb, config?: DbQueryConfig): DbQueryConfig {
    return conn.concurrentQueryResetConfig(config);
  }
  public static shutdown(conn: IModelJsNative.ECDb | IModelJsNative.DgnDb) {
    conn.concurrentQueryShutdown();
  }
}
