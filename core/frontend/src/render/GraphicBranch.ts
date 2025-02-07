/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { disposeArray, Id64String } from "@itwin/core-bentley";
import {
  FeatureAppearanceProvider, HiddenLine, RealityModelDisplaySettings, ViewFlagOverrides, ViewFlags,
} from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";
import { FeatureSymbology } from "./FeatureSymbology";
import { RenderClipVolume } from "./RenderClipVolume";
import { RenderGraphic } from "./RenderGraphic";
import { RenderMemory } from "./RenderMemory";
import { RenderPlanarClassifier } from "../internal/render/RenderPlanarClassifier";
import { RenderTextureDrape } from "../internal/render/RenderTextureDrape";
import { Range3d, Transform } from "@itwin/core-geometry";
import { AnimationNodeId } from "../common/internal/render/AnimationNodeId";
import { GraphicBranchFrustum } from "../internal/render/GraphicBranchFrustum";

/**
 * A node in a scene graph. The branch itself is not renderable. Instead it contains a list of RenderGraphics,
 * and a transform, symbology overrides, and clip volume which are to be applied when rendering them.
 * Branches can be nested to build an arbitrarily-complex scene graph.
 * @see [[RenderSystem.createBranch]]
 * @public
 * @extensions
 */
export class GraphicBranch implements Disposable /* , RenderMemory.Consumer */ {
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

  /** Identifies the "group" to which this branch belongs.
   * Groups represent cross-cutting subsets of a tile tree's contents.
   * For example, if a tile tree contains geometry from multiple models, each model (or smaller groups of multiple models) could be considered a group.
   * The top-level branches containing graphics from multiple tiles will each specify the group they represent, and the child branches within each
   * tile will likewise specify the group to which they belong.
   * When drawing, only the graphics within a tile that correlate with the current group will be drawn.
   * Groups cannot nest.
   * @internal
   */
  public groupNodeId?: number;

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
  public [Symbol.dispose]() {
    this.clear();
  }

  /** @deprecated in 5.0 Use [Symbol.dispose] instead. */
  public dispose() {
    this[Symbol.dispose]();
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
  /** An optional transform from the coordinate system of [[iModel]] to those of a different [[IModelConnection]].
   * This is used by [[AccuSnap]] when displaying one iModel in the context of another iModel (i.e., the iModel associated
   * with the [[Viewport]]).
   */
  transformFromIModel?: Transform;
  /** @internal */
  frustum?: GraphicBranchFrustum;
  /** Supplements the view's [[FeatureSymbology.Overrides]] for graphics in the branch. */
  appearanceProvider?: FeatureAppearanceProvider;
  /** @internal Secondary planar classifiers (map layers) */
  secondaryClassifiers?: Map<number, RenderPlanarClassifier>;
  /** The Id of the [ViewAttachment]($backend) from which this branch's graphics originated.
   * @internal
   */
  viewAttachmentId?: Id64String;
  /** @internal */
  inSectionDrawingAttachment?: boolean;
  /** If true, the view's [DisplayStyleSettings.clipStyle]($common) will be disabled for this branch.
   * No [ClipStyle.insideColor]($common), [ClipStyle.outsideColor]($common), or [ClipStyle.intersectionStyle]($common) will be applied.
   */
  disableClipStyle?: true;
}
