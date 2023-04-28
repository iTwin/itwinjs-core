/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { compareStrings, Logger } from "@itwin/core-bentley";
import {
  IModelConnection,
  TileTree,
  TileTreeOwner,
  TileTreeSupplier,
} from "@itwin/core-frontend";
import { loggerCategory } from "./LoggerCategory";
import { BatchedTilesetReader } from "./BatchedTilesetReader";
import { BatchedTileTree } from "./BatchedTileTree";

/** @internal */
export type TreeId = URL;

class BatchedTileTreeSupplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: TreeId, rhs: TreeId): number {
    // Currently each iModel has exactly 1 unique tile tree for all spatial models.
    return compareStrings(lhs.toString(), rhs.toString());
  }

  public async createTileTree(
    baseUrl: TreeId,
    iModel: IModelConnection
  ): Promise<TileTree | undefined> {
    const url = new URL("tileset.json", baseUrl);
    url.search = baseUrl.search;
    try {
      const response = await fetch(url.toString());
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

/** @internal */
export function getBatchedTileTreeOwner(
  iModel: IModelConnection,
  baseUrl: URL
): TileTreeOwner {
  return iModel.tiles.getTileTreeOwner(baseUrl, batchedTileTreeSupplier);
}
