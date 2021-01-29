/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { assert, CompressedId64Set, Id64Set } from "@bentley/bentleyjs-core";
import { PlanarClipMaskSettings } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { createMaskTreeReference, TileTreeReference, TileTreeSet } from "./tile/internal";


export class PlanarClipMaskState {
  public readonly settings: PlanarClipMaskSettings;
  private _modelIds?: Id64Set;
  private _tileTreeRefs?: TileTreeReference[];
  private _allLoaded = false;

  private constructor(settings: PlanarClipMaskSettings, modelIds?: Id64Set) {
    this.settings = settings;
    this._modelIds = modelIds;
  }
  public getTileTrees(iModel: IModelConnection): TileTreeReference[] | undefined {
    if (!this._tileTreeRefs) {
      this._tileTreeRefs = new Array<TileTreeReference>();
      if (this._modelIds) {
        for (const modelId of this._modelIds) {
          const model = iModel.models.getLoaded(modelId);
          assert(model !== undefined);   // Models should be loaded by RealitModelTileTree
          if (model?.asGeometricModel)
            this._tileTreeRefs.push(createMaskTreeReference(model.asGeometricModel));
        }
      }
    }
    if (!this._allLoaded)
      this._allLoaded = this._tileTreeRefs.every((treeRef) => treeRef.treeOwner.load() !== undefined);

    return this._allLoaded ? this._tileTreeRefs : undefined;
  }

  public static create(settings: PlanarClipMaskSettings): PlanarClipMaskState {
    return new PlanarClipMaskState(settings, settings.modelIds ? CompressedId64Set.decompressSet(settings.modelIds) : undefined);
  }
  public discloseTileTrees(trees: TileTreeSet): void {
    if (this._tileTreeRefs)
      this._tileTreeRefs.forEach((treeRef) => treeRef.discloseTileTrees(trees));
  }
}