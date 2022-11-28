import { IModelJsNative } from "@bentley/imodeljs-native";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbBlobRequest, DbBlobResponse, DbQueryConfig, DbQueryRequest, DbQueryResponse, DbRequestKind } from "@itwin/core-common";

/** @internal */
export type OnResponse = (response: Response) => void;

/** @internal */
export class ConcurrentQuery {
  /** @internal */
  public static async executeQueryRequest(conn: IModelJsNative.ECDb | IModelJsNative.DgnDb, request: DbQueryRequest): Promise<DbQueryResponse> {
    return new Promise<DbQueryResponse>((resolve) => {
      request.kind = DbRequestKind.ECSql;
      conn.concurrentQueryExecute(request as any, (response: any) => {
        resolve(response as DbQueryResponse);
      });
    });
  }
  /** @internal */
  public static async executeBlobRequest(conn: IModelJsNative.ECDb | IModelJsNative.DgnDb, request: DbBlobRequest): Promise<DbBlobResponse> {
    return new Promise<DbBlobResponse>((resolve) => {
      request.kind = DbRequestKind.BlobIO;
      conn.concurrentQueryExecute(request as any, (response: any) => {
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
