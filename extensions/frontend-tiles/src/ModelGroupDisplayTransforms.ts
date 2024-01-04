/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CompressedId64Set, Id64Set, Id64String } from "@itwin/core-bentley";
import { ModelDisplayTransform, ModelDisplayTransformProvider } from "@itwin/core-frontend";

function equalDisplayTransforms(a: ModelDisplayTransform, b: ModelDisplayTransform): boolean {
  return !!a.premultiply === !!b.premultiply && a.transform.isAlmostEqual(b.transform);
}

/** A display transform to be applied to a set of models. */
interface ModelGroupDisplayTransform {
  modelIds: Id64Set;
  transform: ModelDisplayTransform;
}

/** A collection of model Ids grouped according to the unique transforms to be applied to each group. */
interface ModelGroupDisplayTransformsState {
  readonly transforms: ReadonlyArray<ModelGroupDisplayTransform>;
  readonly guid: string;
}

/** Optimization for the common case in which no display transforms are to be applied. */
const emptyState: ModelGroupDisplayTransformsState = { transforms: [], guid: "" };

/** Manages the display transforms to be applied to all of the models in a BatchedTileTree, enabling all models that share an equivalent transform
 * to be drawn together.
 * Call `update` whenever the transforms may have changed (e.g., after the viewport's scene is invalidated).
 * @internal
 */
export class ModelGroupDisplayTransforms {
  private _state: ModelGroupDisplayTransformsState = emptyState;
  private readonly _modelIds: Id64Set;

  /** Create a new set of groups for the specified `modelIds`. If `provider` is supplied, the grouping will be applied to those models immediately. */
  public constructor(modelIds: Id64Set, provider?: ModelDisplayTransformProvider) {
    this._modelIds = modelIds;
    if (provider)
      this.update(provider);
  }

  /** A string uniquely identifying the current grouping. */
  public get guid(): string { return this._state.guid; }

  /** Get the display transform for the specified model.
   * @note This method is guaranteed to return the same object for all models in the same group, at least between calls to `update`.
   */
  public getDisplayTransform(modelId: Id64String): ModelDisplayTransform | undefined {
    return this._state.transforms.find((x) => x.modelIds.has(modelId))?.transform;
  }

  // Update the display transforms and the model groupings based on the transforms supplied by `provider`.
  // Return `true` if the groupings changed as a result.
  public update(provider: ModelDisplayTransformProvider | undefined): boolean {
    const prevState = this._state;
    this._state = this.computeState(provider);
    return this._state.guid !== prevState.guid;
  }

  private computeState(provider: ModelDisplayTransformProvider | undefined): ModelGroupDisplayTransformsState {
    if (!provider)
      return emptyState;

    const transforms: ModelGroupDisplayTransform[] = [];
    for (const modelId of this._modelIds) {
      const transform = provider.getModelDisplayTransform(modelId);
      if (transform) {
        let entry = transforms.find((x) => equalDisplayTransforms(transform, x.transform));
        if (!entry)
          transforms.push(entry = { transform, modelIds: new Set() });

        entry.modelIds.add(modelId);
      }
    }

    if (transforms.length === 0)
      return emptyState;

    const guid = transforms.map((x) => CompressedId64Set.compressSet(x.modelIds)).sort().join("_");
    return { transforms, guid };
  }
}
