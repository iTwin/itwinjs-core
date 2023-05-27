/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { disposeArray, Id64String, IDisposable } from "@itwin/core-bentley";
import {
  FeatureAppearanceProvider, HiddenLine, RealityModelDisplaySettings, RenderSchedule, ViewFlagOverrides, ViewFlags,
} from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { FeatureSymbology } from "./FeatureSymbology";
import { RenderClipVolume } from "./RenderClipVolume";
import { RenderGraphic } from "./RenderGraphic";
import { RenderMemory } from "./RenderMemory";
import { RenderPlanarClassifier } from "./RenderPlanarClassifier";
import { RenderTextureDrape } from "./RenderSystem";
import { Range3d } from "@itwin/core-geometry";
import { AnimationNodeId } from "../common/render/AnimationNodeId";

/** Carries information in a GraphicBranchOptions about a GraphicBranch produced by drawing one view into the context of another.
 * @internal
 */
export interface GraphicBranchFrustum {
  is3d: boolean;
  scale: {
    x: number;
    y: number;
  };
}

/**
 * A node in a scene graph. The branch itself is not renderable. Instead it contains a list of RenderGraphics,
 * and a transform, symbology overrides, and clip volume which are to be applied when rendering them.
 * Branches can be nested to build an arbitrarily-complex scene graph.
 * @see [[RenderSystem.createBranch]]
 * @public
 * @extensions
 */
export class GraphicBranch implements IDisposable /* , RenderMemory.Consumer */ {
  /** The child nodes of this branch */
  public readonly entries: RenderGraphic[] = [];
  /** If true, when the branch is disposed of, the RenderGraphics in its entries array will also be disposed */
  public readonly ownsEntries: boolean;
  /** Selectively overrides the view's [ViewFlags]($common) while drawing graphics within this branch. The default overrides nothing.
   * @see [[setViewFlagOverrides]].
   */
  public viewFlagOverrides: ViewFlagOverrides = {};
  /** Controls how reality models are displayed within this branch.
   * @beta
   */
  public realityModelDisplaySettings?: RealityModelDisplaySettings;
  /** @internal */
  public realityModelRange?: Range3d;
  /** Optional symbology overrides to be applied to all graphics in this branch */
  public symbologyOverrides?: FeatureSymbology.Overrides;
  /** Optional animation branch Id that incorporates the model Id and, for element timelines, the batch Id.
   * @internal
   */
  public animationId?: string;
  /** Identifies the node in the [RenderSchedule.Script]($backend) with which this branch is associated.
   * @internal
   */
  public animationNodeId?: AnimationNodeId | number;

  /** Constructor
   * @param ownsEntries If true, when this branch is [[dispose]]d, all of the [[RenderGraphic]]s it contains will also be disposed.
   */
  public constructor(ownsEntries: boolean = false) {
    this.ownsEntries = ownsEntries;
  }

  /** Add a graphic to this branch. */
  public add(graphic: RenderGraphic): void {
    this.entries.push(graphic);
  }

  /** Compute the view flags that result from applying this branch's [[viewFlagOverrides]] to the input flags.
   * @param flags The input view flags, e.g., from the view's [[DisplayStyleState]].
   * @returns The result of applying [[viewFlagOverrides]] to `flags`.
   */
  public getViewFlags(flags: ViewFlags): ViewFlags {
    return flags.override(this.viewFlagOverrides);
  }

  /** Set [[viewFlagOverrides]] to override **all** ViewFlags as specified by `flags`. */
  public setViewFlags(flags: ViewFlags): void {
    this.viewFlagOverrides = { ...flags };
  }

  /** Change [[viewFlagOverrides]]. */
  public setViewFlagOverrides(ovr: ViewFlagOverrides): void {
    this.viewFlagOverrides = { ...ovr };
  }

  /** Disposes of all graphics in this branch, if and only if [[ownsEntries]] is true. */
  public dispose() {
    this.clear();
  }

  /** Returns true if this branch contains no graphics. */
  public get isEmpty(): boolean {
    return 0 === this.entries.length;
  }

  /** Empties the list of [[RenderGraphic]]s contained in this branch, and if the [[ownsEntries]] flag is set, also disposes of them. */
  public clear(): void {
    if (this.ownsEntries)
      disposeArray(this.entries);
    else
      this.entries.length = 0;
  }

  /** @internal */
  public collectStatistics(stats: RenderMemory.Statistics): void {
    for (const entry of this.entries)
      entry.collectStatistics(stats);
  }
}

/** Options passed to [[RenderSystem.createGraphicBranch]].
 * @public
 * @extensions
 */
export interface GraphicBranchOptions {
  /** Clip applied to the graphics in the branch. */
  clipVolume?: RenderClipVolume;
  /** @internal */
  classifierOrDrape?: RenderPlanarClassifier | RenderTextureDrape;
  /** Optionally replaces the view's hidden line settings when drawing the branch. */
  hline?: HiddenLine.Settings;
  /** The iModel from which the graphics originate, if different than that associated with the view. */
  iModel?: IModelConnection;
  /** @internal */
  frustum?: GraphicBranchFrustum;
  /** Supplements the view's [[FeatureSymbology.Overrides]] for graphics in the branch. */
  appearanceProvider?: FeatureAppearanceProvider;
  /** @internal Secondary planar classifiers (map layers) */
  secondaryClassifiers?: Map<number, RenderPlanarClassifier>;
}

/** Clip/Transform for a branch that are varied over time.
 * @internal
 */
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

/** Mapping from node/branch IDs to animation branch state
 * @internal
 */
export interface AnimationBranchStates {
  /** Maps node Id to branch state. */
  readonly branchStates: Map<string, AnimationBranchState>;
  /** Ids of nodes that apply a transform. */
  readonly transformNodeIds: ReadonlySet<number>;
}

/** @internal */
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
