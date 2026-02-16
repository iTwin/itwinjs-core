/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbQueryRequest, DbQueryResponse, DbRequestExecutor } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { _nativeDb } from "./internal/Symbols";
import { IModelNative } from "./internal/NativePlatform";

export class ECSqlRowReader implements DbRequestExecutor<DbQueryRequest, DbQueryResponse> {
  private _reader: IModelJsNative.ECSqlRowReader;
  public constructor(db: IModelJsNative.AnyECDb) {
    this._reader = new IModelNative.platform.ECSqlRowReader();
    this._reader.initialize(db);
  }

  public async execute(request: DbQueryRequest): Promise<DbQueryResponse> {
    return new Promise<DbQueryResponse>((resolve) => {
      return resolve(this._reader.step(request) as DbQueryResponse);
    });
  }
}