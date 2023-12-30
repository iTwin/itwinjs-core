/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, Id64Set, Id64String } from "@itwin/core-bentley";
import { PlanProjectionSettings } from "@itwin/core-common";
import { ModelDisplayTransform, RenderClipVolume, SpatialViewState } from "@itwin/core-frontend";

export interface ModelGroupInfo {
  displayTransform?: ModelDisplayTransform;
  clip?: RenderClipVolume;
  planProjectionSettings?: PlanProjectionSettings;
}

export interface ModelGroup extends ModelGroupInfo {
  modelIds: Id64Set;
  animationTransformNodeIds?: ReadonlySet<number>;
}

function createModelGroupInfo(view: SpatialViewState, modelId: Id64String): ModelGroupInfo {
  const displayTransform = view.modelDisplayTransformProvider?.getModelDisplayTransform(modelId);
  const clip = view.getModelClip(modelId);
  const planProjectionSettings = view.displayStyle.settings.getPlanProjectionSettings(modelId);
  return { displayTransform, clip, planProjectionSettings };
}

function equalModelGroupInfo(a: ModelGroupInfo, b: ModelGroupInfo): boolean {
  if (a.clip || b.clip) {
    // ###TODO ClipVector lacks an `isAlmostEqual` method.
    // For two models belonging to the same clip group, we should have the same exact object.
    // But we won't currently detect two different objects that represent effectively identical clips.
    if (!a.clip || !b.clip || a.clip.clipVector !== b.clip.clipVector)
      return false;
  }
  
  if (a.planProjectionSettings || b.planProjectionSettings)
    if (!a.planProjectionSettings || !b.planProjectionSettings || !a.planProjectionSettings.equals(b.planProjectionSettings))
      return false;

  if (a.displayTransform || b.displayTransform) {
    if (!a.displayTransform || !b.displayTransform)
      return false;

    if (!!a.displayTransform.premultiply !== !!b.displayTransform.premultiply)
      return false;
  
    if (!a.displayTransform.transform.isAlmostEqual(b.displayTransform.transform))
      return false;
  }

  return true;
}

export function groupModels(view: SpatialViewState, modelIds: Id64Set): ModelGroup[] {
  const groups: ModelGroup[] = [];
  for (const modelId of modelIds) {
    const info = createModelGroupInfo(view, modelId);
    let group = groups.find((x) => equalModelGroupInfo(x, info));
    if (!group)
      groups.push(group = { ...info, modelIds: new Set<string>() });

    assert(!group.modelIds.has(modelId));
    group.modelIds.add(modelId);
  }

  // ###TODO populate animation node Ids, including untransformed, if a schedule script is defined.
  return groups;
}
