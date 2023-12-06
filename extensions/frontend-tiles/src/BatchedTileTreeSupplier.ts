/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { comparePossiblyUndefined, compareStrings, Logger } from "@itwin/core-bentley";
import { RenderSchedule } from "@itwin/core-common";
import {
  IModelConnection, TileTree, TileTreeOwner, TileTreeSupplier,
} from "@itwin/core-frontend";
import { loggerCategory } from "./LoggerCategory";
import { BatchedTilesetReader, BatchedTilesetSpec } from "./BatchedTilesetReader";
import { BatchedTileTree } from "./BatchedTileTree";

/** @internal */
export interface BatchedTileTreeId {
  spec: BatchedTilesetSpec;
  script?: RenderSchedule.Script;
}

class BatchedTileTreeSupplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: BatchedTileTreeId, rhs: BatchedTileTreeId): number {
    return compareStrings(lhs.toString(), rhs.toString())
      || comparePossiblyUndefined((x, y) => x.compareTo(y), lhs.script, rhs.script);
  }

  public async createTileTree(treeId: BatchedTileTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    const spec = treeId.spec;
    try {
      const reader = new BatchedTilesetReader(spec, iModel);
      const params = await reader.readTileTreeParams();

      params.script = treeId.script;
      return new BatchedTileTree(params);
    } catch (err) {
      Logger.logException(loggerCategory, err);
      return undefined;
    }
  }
}

const batchedTileTreeSupplier: TileTreeSupplier = new BatchedTileTreeSupplier();

/** @internal */
export function getBatchedTileTreeOwner(iModel: IModelConnection, treeId: BatchedTileTreeId): TileTreeOwner {
  return iModel.tiles.getTileTreeOwner(treeId, batchedTileTreeSupplier);
}
