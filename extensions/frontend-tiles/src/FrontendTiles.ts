/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { TransformProps } from "@itwin/core-geometry";
import { RealityModelDisplaySettings } from "@itwin/core-common";
import {
  createRealityTileTreeReference, RealityDataSource, SpatialTileTreeReferences, SpatialViewState, TileTreeReference,
} from "@itwin/core-frontend";

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
  const modelId = view.iModel.transientIds.getNext();
  const url = "http://localhost:8080/tileset.json";
  // const tilesetToDbTransform = Transform.createTranslation(view.iModel.projectExtents.center).toJSON();
  let tilesetToDbTransform: TransformProps | undefined;
  if (view.iModel.ecefLocation)
    tilesetToDbTransform = view.iModel.ecefLocation.getTransform().toJSON();

  const treeRef = createRealityTileTreeReference({
    rdSourceKey: RealityDataSource.createKeyFromUrl(url),
    url,
    iModel: view.iModel,
    source: view,
    modelId,
    tilesetToDbTransform,
    getDisplaySettings: () => RealityModelDisplaySettings.defaults,
  });

  return new TreeRefs(treeRef);
}
