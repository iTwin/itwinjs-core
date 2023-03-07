/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, compareStrings, Logger } from "@itwin/core-bentley";
import {
  IModelConnection, TileTree, TileTreeOwner, TileTreeSupplier,
} from "@itwin/core-frontend";
import { loggerCategory } from "./LoggerCategory";
import { BatchedTilesetReader } from "./BatchedTilesetReader";
import { BatchedTileTree } from "./BatchedTileTree";

export type TreeId = string;

class BatchedTileTreeSupplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: TreeId, rhs: TreeId): number {
    // Currently each iModel has exactly 1 unique tile tree for all spatial models.
    return compareStrings(lhs, rhs);
  }

  public async createTileTree(baseUrl: TreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    const url = `${baseUrl}tileset.json`;
    try {
      const response = await fetch(url);
      const json = await response.json();

      const reader = new BatchedTilesetReader(json, iModel, baseUrl);
      const params = await reader.readTileTreeParams();
      return new BatchedTileTree(params);
    } catch (err) {
      Logger.logException(loggerCategory, err);
      return undefined;
    }
  }
}

const batchedTileTreeSupplier: TileTreeSupplier = new BatchedTileTreeSupplier();

export function getBatchedTileTreeOwner(iModel: IModelConnection, baseUrl: string): TileTreeOwner {
  return iModel.tiles.getTileTreeOwner(baseUrl, batchedTileTreeSupplier);
}
