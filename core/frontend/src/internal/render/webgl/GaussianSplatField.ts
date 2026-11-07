/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { RenderSchedule } from "@itwin/core-common";
import { _scheduleScriptReference } from "../../../common/internal/Symbols";
import type { IModelConnection } from "../../../IModelConnection";
import type { TileTree } from "../../../tile/internal";
import { GaussianSplatLogicalLayout, gaussianSplatLogicalLayout, GaussianSplatOccurrence, isGaussianSplatLayoutOf } from "../GaussianSplatInstances";
import { DrawCommands } from "./DrawCommand";
import { GaussianSplatGeometry } from "./GaussianSplatGeometry";
import { GaussianSplatVisibleTile } from "./GaussianSplatVisibleTiles";
import { Target } from "./Target";

/** A tile of the displayed field, kept with its native draw commands so that it can be drawn again after native command
 * generation has moved on (a pending level-of-detail replacement).
 * @internal
 */
export interface GaussianSplatCompletedTile {
  geometry: GaussianSplatGeometry;
  occurrence: GaussianSplatOccurrence;
  commands: DrawCommands;
  /** The model of the tile's batch, which a schedule script can animate. */
  modelId?: Id64String;
  /** The tile tree the tile belongs to, if the viewport draws one for its model. */
  tree?: TileTree;
  coverageComplete: boolean;
}

/** The tile tree among `trees` that draws `tile`'s model, if any. */
function gaussianSplatTreeOf(trees: readonly TileTree[], tile: { iModel?: IModelConnection, modelId?: Id64String }): TileTree | undefined {
  return trees.find((tree) => tree.iModel === tile.iModel && tree.modelId === tile.modelId);
}

function emptyLayout(): GaussianSplatLogicalLayout {
  return { tiles: [], pageCount: 0 };
}

/** The splat field one viewport displays, its sorted order, and the candidate selection that will replace it. Both are
 * identified by their logical layout: a candidate keeps the same layout object while its occurrences are unchanged. The
 * displayed field is replaced only once the candidate's own order is ready, and, while the displayed tiles' native sources are
 * still loading their coverage, only by the same occurrences: a sorted subset never replaces a complete field.
 * @internal
 */
export class GaussianSplatField implements Disposable {
  private _completed: GaussianSplatCompletedTile[] = [];
  /** The layout of the displayed field, undefined if it is not that of any candidate. */
  private _completedLayout?: GaussianSplatLogicalLayout;
  private _candidate?: GaussianSplatLogicalLayout;
  private _awaitingCoverage = false;
  private _scheduleReference?: RenderSchedule.ScriptReference;
  private _scheduleTime?: number;
  /** The displayed sorted order: one logical slot per splat, back to front. */
  private _instances = new Uint32Array(0);
  /** The logical layout `_instances` was sorted into. They are always replaced together. */
  private _instanceLayout = emptyLayout();
  private _instancesDirty = false;

  public constructor(private readonly _target: Target) { }

  public get completed(): readonly GaussianSplatCompletedTile[] { return this._completed; }
  /** The layout of the candidate's occurrences, if there is a candidate. */
  public get candidate(): GaussianSplatLogicalLayout | undefined { return this._candidate; }
  public get instances(): Uint32Array { return this._instances; }
  public get instanceLayout(): GaussianSplatLogicalLayout { return this._instanceLayout; }
  /** The displayed order changed since it was last uploaded. */
  public get instancesDirty(): boolean { return this._instancesDirty; }
  public markInstancesUploaded(): void { this._instancesDirty = false; }

  /** The displayed field's native commands, from which its tiles are gathered again. */
  public get commands(): DrawCommands { return this._completed.flatMap((tile) => tile.commands); }

  /** The tile trees this viewport draws that have content. */
  private activeTrees(): TileTree[] {
    const trees = [];
    for (const ref of this._target.screenSpaceEffectContext.viewport.getTileTreeRefs()) {
      const tree = ref.treeOwner.tileTree;
      if (tree && !tree.isDisposed && !tree.rootTile.isEmpty)
        trees.push(tree);
    }

    return trees;
  }

  /** The candidate is displayed. */
  private get _candidateDisplayed(): boolean { return this._candidate === this._completedLayout; }

  /** False if the target's latest scene selects `tree`'s tiles without covering its visible region with ready content. */
  private isCoverageComplete(tree?: TileTree): boolean {
    return !tree || false !== this._target.realityTileCoverage.get(tree)?.complete;
  }

  private releaseCompleted(): void {
    this._completed = [];
    this._completedLayout = undefined;
  }

  private clearOrder(): void {
    this._instances = new Uint32Array(0);
    this._instanceLayout = emptyLayout();
    this._instancesDirty = true;
  }

  /** Display nothing. */
  private clear(): void {
    this.releaseCompleted();
    this.clearOrder();
  }

  /** The schedule script and time the native commands of the displayed field were generated for. */
  private currentSchedule(): { reference?: RenderSchedule.ScriptReference, time?: number } {
    const viewport = this._target.screenSpaceEffectContext.viewport;
    const reference = viewport.view[_scheduleScriptReference];
    const time = reference ? viewport.timePoint ?? reference.script.duration.low : undefined;
    return { reference, time };
  }

  private storeCompleted(tiles: GaussianSplatVisibleTile[]): void {
    const trees = this.activeTrees();
    this._completed = tiles.map((tile) => {
      const tree = gaussianSplatTreeOf(trees, tile);
      return { geometry: tile.geometry, occurrence: tile.occurrence, commands: tile.commands, modelId: tile.modelId, tree, coverageComplete: this.isCoverageComplete(tree) };
    });

    this._completedLayout = this._candidate;
    const schedule = this.currentSchedule();
    this._scheduleReference = schedule.reference;
    this._scheduleTime = schedule.time;
  }

  /** Whether the schedule script `reference` animates a model the displayed field draws. */
  private animatesField(reference?: RenderSchedule.ScriptReference): boolean {
    const modelIds = new Set(this._completed.map((tile) => tile.modelId));
    return reference?.script.modelTimelines.some((timeline) => modelIds.has(timeline.modelId)) ?? false;
  }

  /** Drop what the displayed field can no longer reproduce: all of it if the schedule script or time changed and the previous or
   * the current script animates one of its models, and tiles of trees no longer drawn. Returns the active trees, and whether
   * the candidate was reset (its sorts are then stale).
   */
  public prune(): { trees: TileTree[], reset: boolean } {
    const schedule = this.currentSchedule();
    const scheduleChanged = this._scheduleReference !== schedule.reference || this._scheduleTime !== schedule.time;
    const animationChanged = scheduleChanged && (this.animatesField(this._scheduleReference) || this.animatesField(schedule.reference));
    if (animationChanged) {
      // Schedule omissions and transforms were resolved during native command generation.
      // Native branch objects can be rebuilt at unchanged script/time after scene invalidation.
      this.clear();
      this._candidate = undefined;
    } else if (scheduleChanged) {
      // The displayed field's native commands are the same under the current schedule.
      this._scheduleReference = schedule.reference;
      this._scheduleTime = schedule.time;
    }

    const trees = this.activeTrees();
    const previousCount = this._completed.length;
    this._completed = this._completed.filter((tile) => !tile.tree || trees.includes(tile.tree));
    const treesRemoved = previousCount !== this._completed.length;
    if (treesRemoved) {
      this._completedLayout = undefined;
      this._candidate = undefined;
    }

    return { trees, reset: animationChanged || treesRemoved };
  }

  /** The candidate was refused (the device cannot hold its tiles): keep displaying the field. */
  public rejectCandidate(): void {
    this._candidate = undefined;
  }

  /** No tile is ready: keep the displayed tiles of active native sources and those `selected` (drawn, but hidden by
   * clipping), and reset the candidate. Returns false, displaying nothing, if none remain. */
  public retainSelected(selected: Set<number>): boolean {
    this._completed = this._completed.filter((tile) => !!tile.tree || selected.has(tile.geometry.id));
    if (!this._completed.length) {
      this.clear();
      return false;
    }

    this._completedLayout = undefined;
    this._candidate = undefined;
    return true;
  }

  /** Whether a displayed tile's native source, complete when the tile was stored, is loading coverage again. */
  public updateCoverage(): void {
    this._awaitingCoverage = this._completed.some((tile) => tile.coverageComplete && !this.isCoverageComplete(tile.tree));
  }

  /** Make this frame's `tiles` the candidate, keeping the candidate's layout if they are the same occurrences. Returns true if the
   * candidate changed (its sorts are then stale).
   */
  public propose(tiles: GaussianSplatVisibleTile[]): boolean {
    const occurrences = tiles.map((tile) => ({ occurrence: tile.occurrence, count: tile.geometry.splats.count }));
    if (this._candidate && isGaussianSplatLayoutOf(this._candidate, occurrences))
      return false;

    this._candidate = gaussianSplatLogicalLayout(occurrences);
    return true;
  }

  /** Whether the candidate of `count` splats can be displayed now, given whether its order is ready. A single splat needs no
   * order. A sorted subset cannot replace a complete field while native source coverage is still loading. Initial loading can
   * be progressive; source removal was pruned.
   */
  public canCommit(orderReady: boolean, count: number): boolean {
    const replacesDisplayed = !this._candidateDisplayed;
    const coverageAllows = !this._awaitingCoverage || !replacesDisplayed;
    const needsNoOrder = count === 1 && replacesDisplayed;
    return coverageAllows && (orderReady || needsNoOrder);
  }

  /** Display the candidate, this frame's `tiles`, with its sorted order. */
  public commit(tiles: GaussianSplatVisibleTile[], instances: Uint32Array): void {
    if (!this._candidateDisplayed)
      this.storeCompleted(tiles);

    this._instances = instances;
    this._instanceLayout = this._completedLayout ?? emptyLayout();
    this._instancesDirty = true;
  }

  /** If the displayed field is the candidate, this frame's `tiles`, refresh its native paths and feature semantics from them
   * without sorting unchanged geometry, and return true. */
  public refresh(tiles: GaussianSplatVisibleTile[], trees: readonly TileTree[]): boolean {
    if (!this._candidateDisplayed)
      return false;

    for (const [row, tile] of tiles.entries()) {
      const stored = this._completed[row];
      if (!stored)
        continue;

      stored.commands = tile.commands;
      stored.tree = gaussianSplatTreeOf(trees, tile);
      stored.coverageComplete ||= this.isCoverageComplete(stored.tree);
    }

    return true;
  }

  /** With nothing to draw, forget the candidate and the displayed order. */
  public sleep(): void {
    this._candidate = undefined;
    this._completedLayout = undefined;
    this.clearOrder();
    this._awaitingCoverage = false;
  }

  public [Symbol.dispose](): void {
    this.releaseCompleted();
    this._instances = new Uint32Array(0);
  }
}
