/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { BeTimePoint } from "@bentley/bentleyjs-core";
import {
  Matrix4d,
  Range1d,
  Range3d,
  Transform,
} from "@bentley/geometry-core";
import {
  ElementAlignedBox3d,
  FrustumPlanes,
  ViewFlag,
} from "@bentley/imodeljs-common";
import { HitDetail } from "../HitDetail";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { RenderMemory } from "../render/RenderMemory";
import { FeatureSymbology } from "../render/FeatureSymbology";
import {
  TileDrawArgs,
  TileTree,
  TileTreeOwner,
  TileTreeSet,
} from "./internal";
import {
  DecorateContext,
  SceneContext,
} from "../ViewContext";

/** Describes the type of graphics produced by a [[TileTreeReference]].
 * @internal
 */
export enum TileGraphicType {
  /** Rendered behind all other geometry without depth. */
  BackgroundMap = 0,
  /** Rendered with normal scene graphics. */
  Scene = 1,
  /** Renders overlaid on all other geometry. */
  Overlay = 2,
}

/** A reference to a [[TileTree]] suitable for drawing within a [[Viewport]]. Does not *own* its TileTree - the tree is owned by a [[TileTreeOwner]].
 * The specific [[TileTree]] referenced by this object may change based on the current state of the Viewport in which it is drawn - for example,
 * as a result of changing the RenderMode, or animation settings, or classification settings, etc.
 * A reference to a TileTree is typically associated with a ViewState, a DisplayStyleState, or a ViewState.
 * Multiple references can refer to the same TileTree with different parameters and logic - for example, the same background map tiles can be displayed in two viewports with
 * differing levels of transparency.
 * @internal
 */
export abstract class TileTreeReference implements RenderMemory.Consumer {
  /** The owner of the currently-referenced [[TileTree]]. Do not store a direct reference to it, because it may change or become disposed. */
  public abstract get treeOwner(): TileTreeOwner;

  /** Disclose *all* TileTrees use by this reference. This may include things like map tiles used for draping on terrain.
   * Override this and call super if you have such auxiliary trees.
   * @note Any tree *NOT* disclosed becomes a candidate for *purging* (being unloaded from memory along with all of its tiles and graphics).
   */
  public discloseTileTrees(trees: TileTreeSet): void {
    const tree = this.treeOwner.tileTree;
    if (undefined !== tree)
      trees.add(tree);
  }

  /** Adds this reference's graphics to the scene. By default this invokes [[TileTree.drawScene]] on the referenced TileTree, if it is loaded. */
  public addToScene(context: SceneContext): void {
    const args = this.createDrawArgs(context);
    if (undefined !== args)
      this.draw(args);
  }

  public draw(args: TileDrawArgs): void {
    args.tree.draw(args);
  }

  /** Optionally return a tooltip describing the hit. */
  public getToolTip(_hit: HitDetail): HTMLElement | string | undefined { return undefined; }

  /** Optionally add any decorations specific to this reference. For example, map tile trees may add a logo image and/or copyright attributions.
   * @note This is only invoked for background maps and TiledGraphicsProviders - others have no decorations, but if they did implement this it would not be called.
   */
  public decorate(_context: DecorateContext): void { }

  /** Unions this reference's range with the supplied range to help compute a volume in world space for fitting a viewport to its contents.
   * Override this function if a reference's range should not be included in the fit range, or a range different from its tile tree's range should be used.
   */
  public unionFitRange(union: Range3d): void {
    const contentRange = this.computeWorldContentRange();
    if (!contentRange.isNull)
      union.extendRange(contentRange);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    const tree = this.treeOwner.tileTree;
    if (undefined !== tree)
      tree.collectStatistics(stats);
  }

  /** Create context for drawing the tile tree, if it is ready for drawing.
   * TileTreeReferences can override individual portions of the context, e.g. apply their own transform.
   */
  public createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
    const tree = this.treeOwner.load();
    if (undefined === tree)
      return undefined;

    const now = BeTimePoint.now();
    const transform = this.computeTransform(tree);
    const clipVolume = this.getClipVolume(tree);
    const viewFlagOverrides = this.getViewFlagOverrides(tree);

    return new TileDrawArgs(context, transform, tree, now, viewFlagOverrides, clipVolume, tree.parentsAndChildrenExclusive, this.getSymbologyOverrides(tree));
  }

  /** Supply transform from this tile tree reference's location to iModel coordinate space.
   * @returns undefined if the TileTree is not yet loaded.
   */
  public getLocation(): Transform | undefined {
    const tree = this.treeOwner.load();
    return undefined !== tree ? this.computeTransform(tree) : undefined;
  }

  protected computeTransform(tree: TileTree): Transform {
    return tree.iModelTransform.clone();
  }

  /** Compute the range of this tile tree's contents in world coordinates.
   * @returns a null range if the tile tree is not loaded or has no content range.
   */
  public computeWorldContentRange(): ElementAlignedBox3d {
    const range = new Range3d();
    const tree = this.treeOwner.tileTree;
    if (undefined !== tree && !tree.rootTile.contentRange.isNull)
      this.computeTransform(tree).multiplyRange(tree.rootTile.contentRange, range);

    return range;
  }

  protected getClipVolume(tree: TileTree): RenderClipVolume | undefined {
    return tree.clipVolume;
  }

  protected getViewFlagOverrides(tree: TileTree): ViewFlag.Overrides {
    return tree.viewFlagOverrides;
  }

  /** Return overrides that *replace* any defined for the view. */
  protected getSymbologyOverrides(_tree: TileTree): FeatureSymbology.Overrides | undefined {
    return undefined;
  }

  /* Extend range to include transformed range of this tile tree */
  public accumulateTransformedRange(range: Range3d, matrix: Matrix4d, frustumPlanes?: FrustumPlanes) {
    const tree = this.treeOwner.tileTree;
    if (undefined === tree)
      return;

    const location = this.computeTransform(tree);
    tree.accumulateTransformedRange(range, matrix, location, frustumPlanes);
  }

  public getTerrainHeight(_terrainHeights: Range1d): void { }

  public abstract get castsShadows(): boolean;
}
