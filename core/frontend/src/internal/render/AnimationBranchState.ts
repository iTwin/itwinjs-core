/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { RenderClipVolume } from "../../render/RenderClipVolume.js";
import { RenderSchedule } from "@itwin/core-common";
import { IModelApp } from "../../IModelApp.js";

/** Clip/Transform for a branch that are varied over time. */
export interface AnimationBranchState {
  readonly clip?: RenderClipVolume;
  readonly omit?: boolean;
}

/** @internal */
export function formatAnimationBranchId(modelId: Id64String, branchId: number): string {
  if (branchId < 0)
    return modelId;

  return `${modelId}_Node_${branchId.toString()}`;
}

function addAnimationBranch(modelId: Id64String, timeline: RenderSchedule.Timeline, branchId: number, branches: Map<string, AnimationBranchState>, time: number): void {
  const clipVector = timeline.getClipVector(time);
  const clip = clipVector ? IModelApp.renderSystem.createClipVolume(clipVector) : undefined;
  if (clip)
    branches.set(formatAnimationBranchId(modelId, branchId), { clip });
}

/** Mapping from node/branch IDs to animation branch state */
export interface AnimationBranchStates {
  /** Maps node Id to branch state. */
  readonly branchStates: Map<string, AnimationBranchState>;
  /** Ids of nodes that apply a transform. */
  readonly transformNodeIds: ReadonlySet<number>;
}

export namespace AnimationBranchStates {
  export function fromScript(script: RenderSchedule.Script, time: number): AnimationBranchStates | undefined {
    if (!script.containsModelClipping && !script.requiresBatching)
      return undefined;

    const branches = new Map<string, AnimationBranchState>();
    for (const model of script.modelTimelines) {
      addAnimationBranch(model.modelId, model, -1, branches, time);
      for (const elem of model.elementTimelines) {
        if (elem.getVisibility(time) <= 0)
          branches.set(formatAnimationBranchId(model.modelId, elem.batchId), { omit: true });
        else
          addAnimationBranch(model.modelId, elem, elem.batchId, branches, time);
      }
    }

    return {
      branchStates: branches,
      transformNodeIds: script.transformBatchIds,
    };
  }
}
