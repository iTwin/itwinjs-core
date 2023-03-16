/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  IModelConnection, TileTreeOwner, TileTreeReference,
} from "@itwin/core-frontend";
import { getBatchedTileTreeOwner } from "./BatchedTileTreeSupplier";

class BatchedTileTreeReference extends TileTreeReference {
  private readonly _treeOwner: TileTreeOwner;

  public constructor(treeOwner: TileTreeOwner) {
    super();
    this._treeOwner = treeOwner;
  }

  public override get treeOwner(): TileTreeOwner {
    return this._treeOwner;
  }
}

/** @internal */
export function createBatchedTileTreeReference(iModel: IModelConnection, baseUrl: URL): TileTreeReference {
  const owner = getBatchedTileTreeOwner(iModel, baseUrl);
  return new BatchedTileTreeReference(owner);
}
