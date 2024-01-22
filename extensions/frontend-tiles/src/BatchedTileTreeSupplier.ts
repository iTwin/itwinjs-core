/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { comparePossiblyUndefined, compareStrings, CompressedId64Set, Logger } from "@itwin/core-bentley";
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
  /** A stringified representation of the [[ModelGroup]]s by which to structure the contents of the tiles.
   * Every unique combination of model groups has a corresponding unique string representation.
   * @see [[BatchedModelGroups.guid]].
   */
  modelGroups: string;
}

class BatchedTileTreeSupplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: BatchedTileTreeId, rhs: BatchedTileTreeId): number {
    return compareStrings(lhs.spec.baseUrl.toString(), rhs.spec.baseUrl.toString())
      || compareStrings(lhs.modelGroups, rhs.modelGroups)
      || comparePossiblyUndefined((x, y) => x.compareTo(y), lhs.script, rhs.script);
  }

  public async createTileTree(treeId: BatchedTileTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    const spec = treeId.spec;
    try {
      const modelGroups = treeId.modelGroups ? treeId.modelGroups.split("_").map((x) => CompressedId64Set.decompressSet(x)) : undefined;
      const reader = new BatchedTilesetReader(spec, iModel, modelGroups);
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
