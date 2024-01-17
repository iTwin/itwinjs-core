/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, Id64Set, Id64String } from "@itwin/core-bentley";
import { PlanProjectionSettings, RenderSchedule, ViewFlagOverrides } from "@itwin/core-common";
import { ModelDisplayTransform, RenderClipVolume } from "@itwin/core-frontend";
import { ModelGroupDisplayTransforms } from "./ModelGroupDisplayTransforms";

/** Plan projection settings relevant to a [[ModelGroupInfo]].
 * @internal
 */
export interface PlanProjectionInfo {
  /** Z elevation, from [PlanProjectionSettings.elevation]($common) if specified, else the default elevation of the model (computed from model extents). */
  elevation: number;
  /** Transparency in [0..1] with 0 being fully opaque. */
  transparency: number;
  /** If true, the graphics are drawn as overlays with no depth test. */
  overlay: boolean;
}

/** Display settings to be applied to a group of models.
 * @internal
 */
export interface ModelGroupInfo {
  displayTransform?: ModelDisplayTransform;
  clip?: RenderClipVolume;
  planProjection?: PlanProjectionInfo;
  timeline?: RenderSchedule.ModelTimeline;
  viewFlags: ViewFlagOverrides;
}

/** Represents a group of models and the display settings to be applied to them.
 * @internal
 */
export interface ModelGroup extends ModelGroupInfo {
  /** The set of models belonging to this group. */
  modelIds: Id64Set;
}

/** Context supplied to [[groupModels]].
 * @internal
 */
export interface ModelGroupingContext {
  modelGroupDisplayTransforms: ModelGroupDisplayTransforms;
  getModelClip(modelId: Id64String): RenderClipVolume | undefined;
  getPlanProjectionSettings(modelId: Id64String): PlanProjectionSettings | undefined;
  getModelTimeline(modelId: Id64String): RenderSchedule.ModelTimeline | undefined;
  getDefaultElevation(modelId: Id64String): number;
  getViewFlagOverrides(modelId: Id64String): ViewFlagOverrides | undefined;
}

function createPlanProjectionInfo(modelId: Id64String, context: ModelGroupingContext): PlanProjectionInfo | undefined {
  const settings = context.getPlanProjectionSettings(modelId);
  if (!settings)
    return undefined;

  return {
    elevation: settings.elevation ?? context.getDefaultElevation(modelId),
    transparency: settings.transparency ?? 0,
    overlay: settings.overlay,
  };
}

function equalPlanProjections(a: PlanProjectionInfo, b: PlanProjectionInfo): boolean {
  return a.elevation === b.elevation && a.overlay === b.overlay && a.transparency === b.transparency;
}

function createModelGroupInfo(context: ModelGroupingContext, modelId: Id64String): ModelGroupInfo {
  const planProjection = createPlanProjectionInfo(modelId, context);
  const viewFlags = { ...context.getViewFlagOverrides(modelId) };
  if (planProjection) {
    // Always enable improved z-fighting mitigation for plan projections (they're planar models).
    viewFlags.forceSurfaceDiscard = true;
  }

  return {
    displayTransform: context.modelGroupDisplayTransforms.getDisplayTransform(modelId),
    clip: context.getModelClip(modelId),
    planProjection,
    viewFlags,
    timeline: context.getModelTimeline(modelId),
  };
}

function equalViewFlags(a: ViewFlagOverrides, b: ViewFlagOverrides): boolean {
  const lhs = Object.keys(a);
  const rhs = Object.keys(b);
  if (lhs.length !== rhs.length) {
    return false;
  }

  for (const propName of lhs) {
    const key = propName as keyof ViewFlagOverrides;
    if (a[key] !== b[key])
      return false;
  }

  return true;
}

function equalModelGroupInfo(a: ModelGroupInfo, b: ModelGroupInfo): boolean {
  // If a model has a timeline it cannot be grouped
  if (a.timeline !== b.timeline)
    return false;

  // Display transforms are obtained from ModelGroupDisplayTransforms - they are guaranteed to be the same object if they are equivalent.
  if (a.displayTransform !== b.displayTransform)
    return false;

  if (a.clip || b.clip) {
    // Note: ClipVector lacks an `isAlmostEqual` method.
    // For two models belonging to the same clip group, we should have the same exact object.
    // But we won't currently detect two different objects that represent effectively identical clips.
    if (!a.clip || !b.clip || a.clip.clipVector !== b.clip.clipVector)
      return false;
  }

  if (a.planProjection || b.planProjection) {
    if (!a.planProjection || !b.planProjection || !equalPlanProjections(a.planProjection, b.planProjection)) {
      return false;
    }
  }

  if (!equalViewFlags(a.viewFlags, b.viewFlags))
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

  return groups;
}
