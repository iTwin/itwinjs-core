/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  IModelConnection, SpatialTileTreeReferences, TileTreeReference,
} from "@itwin/core-frontend";
import { createBatchedTileTreeReference } from "./BatchedTileTreeReference";

class TreeRefs implements SpatialTileTreeReferences {
  private readonly _treeRef: TileTreeReference;

  public constructor(treeRef: TileTreeReference) {
    this._treeRef = treeRef;
  }

  public *[Symbol.iterator](): Iterator<TileTreeReference> {
    yield this._treeRef;
  }

  public update(): void {
  }

  public setDeactivated(): void {
    // This exists chiefly for debugging. Unimplemented here.
  }
}

export function createBatchedSpatialTileTreeReferences(iModel: IModelConnection, computeBaseUrl: (iModel: IModelConnection) => URL): SpatialTileTreeReferences {
  const treeRef = createBatchedTileTreeReference(iModel, computeBaseUrl(iModel));
  return new TreeRefs(treeRef);
}
