/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, CompressedId64Set, Id64Set, Id64String } from "@itwin/core-bentley";
import { PlanProjectionSettings } from "@itwin/core-common";
import { ModelDisplayTransform, ModelDisplayTransformProvider, RenderClipVolume } from "@itwin/core-frontend";

function equalDisplayTransforms(a: ModelDisplayTransform, b: ModelDisplayTransform): boolean {
  return !!a.premultiply === !!b.premultiply && a.transform.isAlmostEqual(b.transform);
}

interface ModelGroupDisplayTransform {
  modelIds: Id64Set;
  transform: ModelDisplayTransform;
}

interface ModelGroupDisplayTransformsState {
  readonly transforms: ReadonlyArray<ModelGroupDisplayTransform>;
  readonly groups: ReadonlyArray<CompressedId64Set>;
}

const emptyState: ModelGroupDisplayTransformsState = { transforms: [], groups: [] };

export class ModelGroupDisplayTransforms {
  private _state: ModelGroupDisplayTransformsState = emptyState;
  private readonly _modelIds: Id64Set;

  public constructor(modelIds: Id64Set, provider?: ModelDisplayTransformProvider) {
    this._modelIds = modelIds;
    if (provider)
      this.update(provider);
  }

  public getDisplayTransform(modelId: Id64String): ModelDisplayTransform | undefined {
    return this._state.transforms.find((x) => x.modelIds.has(modelId))?.transform;
  }

  // Update the display transforms and the model groupings based on the transforms supplied by `provider`.
  // Return `true` if the groupings changed as a result.
  public update(provider: ModelDisplayTransformProvider | undefined): boolean {
    const prevState = this._state;
    this._state = this.computeState(provider);
    if (this._state === prevState)
      return false;

    if (this._state.groups.length !== prevState.groups.length)
      return true;

    return !this._state.groups.every((group, index) => group === prevState.groups[index]);
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

    const groups = transforms.map((x) => CompressedId64Set.compressSet(x.modelIds)).sort();
    return { transforms, groups };
  }
}

export interface ModelGroupInfo {
  displayTransform?: ModelDisplayTransform;
  clip?: RenderClipVolume;
  planProjectionSettings?: PlanProjectionSettings;
}

export interface ModelGroup extends ModelGroupInfo {
  modelIds: Id64Set;
  animationTransformNodeIds?: ReadonlySet<number>;
}

export interface ModelGroupingContext {
  modelGroupDisplayTransforms: ModelGroupDisplayTransforms;
  getModelClip(modelId: Id64String): RenderClipVolume | undefined;
  displayStyle: {
    settings: {
      getPlanProjectionSettings(modelId: Id64String): PlanProjectionSettings | undefined;
    };
  };
}

function createModelGroupInfo(context: ModelGroupingContext, modelId: Id64String): ModelGroupInfo {
  const displayTransform = context.modelGroupDisplayTransforms.getDisplayTransform(modelId);
  const clip = context.getModelClip(modelId);
  const planProjectionSettings = context.displayStyle.settings.getPlanProjectionSettings(modelId);
  return { displayTransform, clip, planProjectionSettings };
}

function equalModelGroupInfo(a: ModelGroupInfo, b: ModelGroupInfo): boolean {
  // Display transforms are obtained from ModelGroupDisplayTransforms - they are guaranteed to be the same object if they are equivalent.
  if (a.displayTransform !== b.displayTransform)
    return false;
  
  if (a.clip || b.clip) {
    // ###TODO? ClipVector lacks an `isAlmostEqual` method.
    // For two models belonging to the same clip group, we should have the same exact object.
    // But we won't currently detect two different objects that represent effectively identical clips.
    if (!a.clip || !b.clip || a.clip.clipVector !== b.clip.clipVector)
      return false;
  }

  if (a.planProjectionSettings || b.planProjectionSettings)
    if (!a.planProjectionSettings || !b.planProjectionSettings || !a.planProjectionSettings.equals(b.planProjectionSettings))
      return false;

  return true;
}

export function groupModels(context: ModelGroupingContext, modelIds: Id64Set): ModelGroup[] {
  const groups: ModelGroup[] = [];
  for (const modelId of modelIds) {
    const info = createModelGroupInfo(context, modelId);
    let group = groups.find((x) => equalModelGroupInfo(x, info));
    if (!group)
      groups.push(group = { ...info, modelIds: new Set<string>() });

    assert(!group.modelIds.has(modelId));
    group.modelIds.add(modelId);
  }

  // ###TODO populate animation node Ids, including untransformed, if a schedule script is defined.
  return groups;
}
