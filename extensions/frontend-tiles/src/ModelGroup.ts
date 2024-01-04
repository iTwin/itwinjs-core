/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, Id64Set, Id64String } from "@itwin/core-bentley";
import { PlanProjectionSettings } from "@itwin/core-common";
import { ModelDisplayTransform, RenderClipVolume } from "@itwin/core-frontend";
import { ModelGroupDisplayTransforms } from "./ModelGroupDisplayTransforms";

/** Display settings to be applied to a group of models.
 * @internal
 */
export interface ModelGroupInfo {
  displayTransform?: ModelDisplayTransform;
  clip?: RenderClipVolume;
  planProjectionSettings?: PlanProjectionSettings;
}

/** Represents a group of models and the display settings to be applied to them.
 * @internal
 */
export interface ModelGroup extends ModelGroupInfo {
  modelIds: Id64Set;
  animationTransformNodeIds?: ReadonlySet<number>;
}

/** Context supplied to [[groupModels]].
 * @internal
 */
export interface ModelGroupingContext {
  modelGroupDisplayTransforms: ModelGroupDisplayTransforms;
  getModelClip(modelId: Id64String): RenderClipVolume | undefined;
  getPlanProjectionSettings(modelId: Id64String): PlanProjectionSettings | undefined;
}

function createModelGroupInfo(context: ModelGroupingContext, modelId: Id64String): ModelGroupInfo {
  const displayTransform = context.modelGroupDisplayTransforms.getDisplayTransform(modelId);
  const clip = context.getModelClip(modelId);
  const planProjectionSettings = context.getPlanProjectionSettings(modelId);
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

/** Group the supplied `modelIds` such that all models that are to be drawn with equivalent display settings are grouped together.
 * @internal
 */
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
