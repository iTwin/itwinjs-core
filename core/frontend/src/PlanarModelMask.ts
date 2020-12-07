/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SpatialClassification
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { PlanarModelMaskProps } from "@bentley/imodeljs-common";
import { IsClassified } from "./render/webgl/TechniqueFlags";
import { TileTree, TileTreeReference } from "./tile/internal";
import { SceneContext } from "./ViewContext";
import { ViewState } from "./ViewState";

export class PlanarModelMask {
  private _maskAllHigherPriorityModels?: boolean;

  private constructor(maskAllHigherPriorityModels?: boolean) {
    this._maskAllHigherPriorityModels = maskAllHigherPriorityModels;
  }

  static fromJSON(props: PlanarModelMaskProps) {
    return new PlanarModelMask(props.maskAllHigherPriorityModels);

  }
  public getTileTrees(trees: TileTreeReference[], view: ViewState, classifiedModelId: Id64String): void {
    view.forEachTileTreeRef((ref) => {
      const tree = ref.treeOwner.load();
      if (tree && tree.modelId !== classifiedModelId && !tree.isContentUnbounded)
        trees.push(ref);
    });
  }
}
