import { IModelJsNative } from "@bentley/imodeljs-native";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbBlobRequest, DbBlobResponse, DbQueryConfig, DbQueryRequest, DbQueryResponse, DbRequestKind } from "@itwin/core-common";
import { deserialize } from "node:v8";

type SerializedQueryResponse = Omit<DbQueryResponse, "data"> & { dataEncoding: "v8"; data: Uint8Array };

/** @internal */
export type OnResponse = (response: Response) => void;

/** @internal */
export class ConcurrentQuery {
  /** @internal */
  public static async executeQueryRequest(conn: IModelJsNative.ECDb | IModelJsNative.DgnDb, request: DbQueryRequest): Promise<DbQueryResponse> {
    return new Promise<DbQueryResponse>((resolve, reject) => {
      request.kind = DbRequestKind.ECSql;
      conn.concurrentQueryExecute(request, (response) => {
        try {
          const result = response as DbQueryResponse | SerializedQueryResponse;
          if ("dataEncoding" in result) {
            const { dataEncoding, ...decoded } = result;
            if (dataEncoding !== "v8" || !(decoded.data instanceof Uint8Array))
              throw new Error("Invalid native query response encoding or payload");
            const rows: unknown = deserialize(decoded.data);
            if (!Array.isArray(rows) || rows.length !== decoded.rowCount)
              throw new Error("Invalid V8 query response: expected an array matching rowCount");
            resolve({ ...decoded, data: rows });
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(error instanceof Error ? error : new Error(`Failed to decode native query response: ${String(error)}`));
        }
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
    const result: DbQueryConfig = conn.concurrentQueryResetConfig(config);
    if (config?.useV8Serialization === true && result.useV8Serialization !== true)
      throw new Error("The native addon does not support useV8Serialization; rebuild or update it before enabling this transport");
    return result;
  }
  public static shutdown(conn: IModelJsNative.ECDb | IModelJsNative.DgnDb) {
    conn.concurrentQueryShutdown();
  }
}
