/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelJsNative } from "@bentley/imodeljs-native";
import { GuidString, LRUMap } from "@itwin/core-bentley";

export class ECSqlRowReaderCache {
  private _cache: LRUMap<GuidString, IModelJsNative.ECSqlRowReader>;

  public constructor(maxCount = 40) {
    this._cache = new LRUMap<GuidString, IModelJsNative.ECSqlRowReader>(maxCount);
  }

  public get size() { return this._cache.size; }
  public addAndDispose(reader: IModelJsNative.ECSqlRowReader, id: GuidString): IModelJsNative.ECSqlRowReader {

    const existing = this._cache.get(id);
    if (existing !== undefined) {
      reader.dispose(); // we already have a reader with this id, we can't save another one so just dispose it
      return existing;
    }
    if (this._cache.size >= this._cache.limit) {
      const oldest = this._cache.shift()!;
      oldest[1].dispose();
    }
    this._cache.set(id, reader);
    return reader;
  }

  public get(id: GuidString): IModelJsNative.ECSqlRowReader | undefined {
    return this._cache.get(id);
  }

  public findAndRemove(id: GuidString): IModelJsNative.ECSqlRowReader | undefined {
    return this._cache.delete(id);
  }

  public clear() {
    this._cache.forEach((reader) => reader.dispose());
    this._cache.clear();
  }
}