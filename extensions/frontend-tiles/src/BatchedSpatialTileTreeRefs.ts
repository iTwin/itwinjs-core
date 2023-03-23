/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  AttachToViewportArgs, IModelConnection, SpatialTileTreeReferences, SpatialViewState, TileTreeReference,
} from "@itwin/core-frontend";
import { BatchedTileTreeReference } from "./BatchedTileTreeReference";

class TreeRefs implements SpatialTileTreeReferences {
  private readonly _treeRef: BatchedTileTreeReference;

  public constructor(treeRef: BatchedTileTreeReference) {
    this._treeRef = treeRef;
  }

  public *[Symbol.iterator](): Iterator<TileTreeReference> {
    yield this._treeRef;
  }

  public update(): void {
    this._treeRef.updateViewedModels();
  }

  public attachToViewport(args: AttachToViewportArgs): void {
    this._treeRef.attachToViewport(args);
  }

  public detachFromViewport(): void {
    this._treeRef.detachFromViewport();
  }

  public setDeactivated(): void {
    // This exists chiefly for debugging. Unimplemented here.
  }
}

/** @internal */
export function createBatchedSpatialTileTreeReferences(view: SpatialViewState, computeBaseUrl: (iModel: IModelConnection) => URL): SpatialTileTreeReferences {
  const treeRef = BatchedTileTreeReference.create(view, computeBaseUrl(view.iModel));
  return new TreeRefs(treeRef);
}
