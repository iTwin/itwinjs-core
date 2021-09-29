/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BlobRequest, BlobResponse, QueryRequest, QueryResponse } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";

/** @internal */
export type OnResponse = (response: Response) => void;

/** @internal */
export class ConcurrentQuery {
  /** @internal */
  public static async executeQueryRequest(conn: IModelJsNative.ECDb | IModelJsNative.DgnDb, request: QueryRequest): Promise<QueryResponse> {
    return new Promise<QueryResponse>((resolve) => {
      conn.concurrentQueryExecute(request as any, (response: any) => {
        resolve(response as QueryResponse);
      });
    });
  }
  /** @internal */
  public static async executeBlobRequest(conn: IModelJsNative.ECDb | IModelJsNative.DgnDb, request: BlobRequest): Promise<BlobResponse> {
    return new Promise<BlobResponse>((resolve) => {
      conn.concurrentQueryExecute(request as any, (response: any) => {
        resolve(response as BlobResponse);
      });
    });
  }
}
