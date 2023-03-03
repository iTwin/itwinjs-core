/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import {
  IModelConnection, TileTree, TileTreeSupplier,
} from "@itwin/core-frontend";

export type TreeId = "spatial-models";

class BatchedTileTreeSupplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: TreeId, rhs: TreeId): number {
    // Currently each iModel has exactly 1 unique tile tree for all spatial models.
    assert(lhs === "spatial-models");
    assert(rhs === "spatial-models");
    return 0;
  }

  public createTileTree(id: TreeId, _iModel: IModelConnection): Promise<TileTree | undefined> {
    // ###TODO
    assert(id === "spatial-models");
    const url = "http://localhost:8080/tileset.json";
    return Promise.resolve(undefined);
  }
}

export const batchedTileTreeSupplier: TileTreeSupplier = new BatchedTileTreeSupplier();
