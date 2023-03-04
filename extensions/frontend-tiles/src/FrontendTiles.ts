/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
   SpatialTileTreeReferences, SpatialViewState, TileTreeReference,
} from "@itwin/core-frontend";
import { createBatchedTileTreeReference } from "./BatchedTileTreeReference";

export const loggerCategory = "frontend-tiles";

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

export function createSpatialTileTreeReferences(view: SpatialViewState): SpatialTileTreeReferences {
  const treeRef = createBatchedTileTreeReference(view.iModel);
  return new TreeRefs(treeRef);
}
