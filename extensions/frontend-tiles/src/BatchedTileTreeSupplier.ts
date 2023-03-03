/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, Logger } from "@itwin/core-bentley";
import {
  IModelConnection, TileTree, TileTreeSupplier,
} from "@itwin/core-frontend";
import { loggerCategory } from "./FrontendTiles";
import { BatchedTilesetReader } from "./BatchedTilesetReader";

export type TreeId = "spatial-models";

class BatchedTileTreeSupplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: TreeId, rhs: TreeId): number {
    // Currently each iModel has exactly 1 unique tile tree for all spatial models.
    assert(lhs === "spatial-models");
    assert(rhs === "spatial-models");
    return 0;
  }

  public async createTileTree(id: TreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    assert(id === "spatial-models");
    const url = "http://localhost:8080/tileset.json";
    try {
      const response = await fetch(url);
      const json = await response.json();

      const reader = new BatchedTilesetReader(json, iModel);
      throw new Error("###TODO");
    } catch (err) {
      Logger.logException(loggerCategory, err);
      return undefined;
    }
  }
}

export const batchedTileTreeSupplier: TileTreeSupplier = new BatchedTileTreeSupplier();
