/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, BeTimePoint } from "@itwin/core-bentley";
import { Matrix4d, Range1d, Range3d, Transform } from "@itwin/core-geometry";
import { ElementAlignedBox3d, FeatureAppearanceProvider, FrustumPlanes, HiddenLine, PlanarClipMaskPriority, ViewFlagOverrides } from "@itwin/core-common";
import { HitDetail } from "../HitDetail";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { RenderMemory } from "../render/RenderMemory";
import { DecorateContext, SceneContext } from "../ViewContext";
import { ScreenViewport } from "../Viewport";
import {
  DisclosedTileTreeSet, GeometryTileTreeReference, MapFeatureInfoOptions, MapLayerFeatureInfo, TileDrawArgs, TileGeometryCollector, TileTree, TileTreeLoadStatus, TileTreeOwner,
} from "./internal";

/** Describes the type of graphics produced by a [[TileTreeReference]].
 * @public
 * @extensions
 */
export enum TileGraphicType {
  /** Rendered behind all other geometry without depth. */
  BackgroundMap = 0,
  /** Rendered with normal scene graphics. */
  Scene = 1,
  /** Rendered in front of all other geometry. */
  Overlay = 2,
}

/** A reference to a [[TileTree]] suitable for drawing within a [[Viewport]]. The reference does not *own* its tile tree - it merely refers to it by
 * way of the tree's [[TileTreeOwner]].
 * The specific [[TileTree]] referenced by this object may change based on the current state of the Viewport in which it is drawn - for example,
 * as a result of changing the RenderMode, or animation settings, or classification settings, etc.
 * A reference to a TileTree is typically associated with a [[ViewState]], a [[DisplayStyleState]], or a [[Viewport]].
 * Multiple TileTreeReferences can refer to the same TileTree with different parameters and logic - for example, the same background map tiles can be displayed in two viewports with
 * differing levels of transparency.
 * @see [[TiledGraphicsProvider]] to supply custom [[TileTreeReference]]s to be drawn within a [[Viewport]].
 * @public
 * @extensions
 */
export abstract class TileTreeReference /* implements RenderMemory.Consumer */ {
  /** The owner of the currently-referenced [[TileTree]]. Do not store a direct reference to it, because it may change or become disposed at any time. */
  public abstract get treeOwner(): TileTreeOwner;

  /** Force a new tree owner / tile tree to be created for the current tile tree reference
   * @internal
   */
  public resetTreeOwner() {}

  /** Disclose *all* TileTrees use by this reference. This may include things like map tiles used for draping on terrain.
   * Override this and call super if you have such auxiliary trees.
   * @note Any tree *NOT* disclosed becomes a candidate for *purging* (being unloaded from memory along with all of its tiles and graphics).
   */
  public discloseTileTrees(trees: DisclosedTileTreeSet): void {
    const tree = this.treeOwner.tileTree;
    if (undefined !== tree)
      trees.add(tree);
  }

  /** Adds this reference's graphics to the scene. By default this invokes [[draw]]. */
  public addToScene(context: SceneContext): void {
    const args = this.createDrawArgs(context);
    if (undefined !== args)
      this.draw(args);
  }

  /** Adds this reference's graphics to the scene. By default this invokes [[TileTree.draw]] on the referenced TileTree, if it is loaded. */
  public draw(args: TileDrawArgs): void {
    args.tree.draw(args);
  }

  /** Optionally return a tooltip describing the hit. */
  public async getToolTip(_hit: HitDetail): Promise<HTMLElement | string | undefined> { return undefined; }

  /** Optionally return a MapLayerFeatureInfo object describing the hit.].
   * @alpha
   */
  public async getMapFeatureInfo(_hit: HitDetail, _options?: MapFeatureInfoOptions): Promise<MapLayerFeatureInfo[] | undefined>  { return undefined; }

  /** Optionally add any decorations specific to this reference. For example, map tile trees may add a logo image and/or copyright attributions.
   * @note This is currently only invoked for background maps and TiledGraphicsProviders - others have no decorations, but if they did implement this it would not be called.
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

  /** Record graphics memory consumed by this tile tree reference. */
  public collectStatistics(stats: RenderMemory.Statistics): void {
    const tree = this.treeOwner.tileTree;
    if (undefined !== tree)
      tree.collectStatistics(stats);
  }

  /** Return true if the tile tree is fully loaded and ready to draw.
   * The default implementation returns true if the tile tree loading process completed (whether it resulted in success or failure).
   * @note Do *not* override this property - override [[_isLoadingComplete]] instead..
   * @public
   */
  public get isLoadingComplete(): boolean {
    switch (this.treeOwner.loadStatus) {
      case TileTreeLoadStatus.NotLoaded:
      case TileTreeLoadStatus.Loading:
        return false;
      case TileTreeLoadStatus.NotFound:
        return true; // we tried, and failed, to load.
      case TileTreeLoadStatus.Loaded:
        return this._isLoadingComplete;
    }
  }

  /** Override if additional asynchronous loading is required after the tile tree is successfully loaded, to indicate when that loading has completed.
   * @public
   */
  protected get _isLoadingComplete(): boolean {
    return true;
  }

  /** Create context for drawing the tile tree, if it is ready for drawing.
   * TileTreeReferences can override individual portions of the context, e.g. apply their own transform.
   * Returns undefined if, e.g., the tile tree is not yet loaded.
   */
  public createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
    const tree = this.treeOwner.load();
    if (undefined === tree)
      return undefined;

    return new TileDrawArgs({
      context,
      tree,
      now: BeTimePoint.now(),
      location: this.computeTransform(tree),
      viewFlagOverrides: this.getViewFlagOverrides(tree),
      clipVolume: this.getClipVolume(tree),
      parentsAndChildrenExclusive: tree.parentsAndChildrenExclusive,
      symbologyOverrides: this.getSymbologyOverrides(tree),
      appearanceProvider: this.getAppearanceProvider(tree),
      hiddenLineSettings: this.getHiddenLineSettings(tree),
      animationTransformNodeId: this.getAnimationTransformNodeId(tree),
      groupNodeId: this.getGroupNodeId(tree),
    });
  }

  /** @internal */
  protected getAnimationTransformNodeId(_tree: TileTree): number | undefined {
    return undefined;
  }
  /** @internal */
  protected getGroupNodeId(_tree: TileTree): number | undefined {
    return undefined;
  }

  /** Supply transform from this tile tree reference's location to iModel coordinate space.
   * @returns undefined if the TileTree is not yet loaded.
   */
  public getLocation(): Transform | undefined {
    const tree = this.treeOwner.load();
    return undefined !== tree ? this.computeTransform(tree) : undefined;
  }

  /** Compute a transform from this tile tree reference's coordinate space to the [[IModelConnection]]'s coordinate space. */
  protected computeTransform(tree: TileTree): Transform {
    return tree.iModelTransform.clone();
  }

  /** Compute the range of this tile tree's contents in world coordinates.
   * @returns The content range in world coodinates, or a null range if the tile tree is not loaded or has a null content range.
   */
  public computeWorldContentRange(): ElementAlignedBox3d {
    const range = new Range3d();
    const tree = this.treeOwner.tileTree;
    if (undefined !== tree && !tree.rootTile.contentRange.isNull)
      this.computeTransform(tree).multiplyRange(tree.rootTile.contentRange, range);

    return range;
  }

  /** Return the clip volume applied to this reference's tile tree, if any. */
  protected getClipVolume(tree: TileTree): RenderClipVolume | undefined {
    return tree.clipVolume;
  }

  /** Supply overrides that should be applied to the [[ViewState]]'s [ViewFlags]($common) when drawing this tile tree reference. */
  protected getViewFlagOverrides(tree: TileTree): ViewFlagOverrides {
    return tree.viewFlagOverrides;
  }

  /** Return overrides that *replace* any defined for the view. */
  protected getSymbologyOverrides(_tree: TileTree): FeatureSymbology.Overrides | undefined {
    return undefined;
  }

  /** Return a provider that can supplement the view's symbology overrides. */
  protected getAppearanceProvider(_tree: TileTree): FeatureAppearanceProvider | undefined {
    return undefined;
  }

  /** Return hidden line settings to replace those defined for the view. */
  protected getHiddenLineSettings(_tree: TileTree): HiddenLine.Settings | undefined {
    return undefined;
  }

  /* Extend range to include transformed range of this tile tree.
   * @internal
   */
  public accumulateTransformedRange(range: Range3d, matrix: Matrix4d, frustumPlanes?: FrustumPlanes) {
    const tree = this.treeOwner.tileTree;
    if (undefined === tree)
      return;

    const location = this.computeTransform(tree);
    tree.accumulateTransformedRange(range, matrix, location, frustumPlanes);
  }

  /** @internal */
  public getTerrainHeight(_terrainHeights: Range1d): void { }

  /** Return whether the geometry exposed by this tile tree reference should cast shadows on other geometry. */
  public get castsShadows(): boolean {
    return true;
  }

  /** Return whether this reference has global coverage.  Mapping data is global and some non-primary models such as the OSM building layer have global coverage */
  public get isGlobal(): boolean { return false; }

  /**  Return the clip mask priority for this model - models will be clipped by any other viewed model with a higher proirity.
   * BIM models have highest prioirty and are never clipped.
   * @alpha
   */
  public get planarclipMaskPriority(): number { return PlanarClipMaskPriority.DesignModel; }

  /** Add attribution logo cards for the tile tree source logo cards to the viewport's logo div. */
  public addLogoCards(_cards: HTMLTableElement, _vp: ScreenViewport): void { }

  /** Create a tile tree reference equivalent to this one that also supplies an implementation of [[GeometryTileTreeReference.collectTileGeometry]].
   * Return `undefined` if geometry collection is not supported.
   * @see [[createGeometryTreeReference]].
   * @beta
   */
  protected _createGeometryTreeReference(): GeometryTileTreeReference | undefined {
    return undefined;
  }

  /** If defined, supplies the implementation of [[GeometryTileTreeReference.collectTileGeometry]].
   * @beta
   */
  public collectTileGeometry?: (collector: TileGeometryCollector) => void;

  /** A function that can be assigned to [[collectTileGeometry]] to enable geometry collection for references to tile trees that support geometry collection.
   * @beta
   */
  protected _collectTileGeometry(collector: TileGeometryCollector): void {
    const tree = this.treeOwner.load();
    switch (this.treeOwner.loadStatus) {
      case TileTreeLoadStatus.Loaded:
        assert(undefined !== tree);
        tree.collectTileGeometry(collector);
        break;
      case TileTreeLoadStatus.Loading:
        collector.markLoading();
        break;
    }
  }

  /** Obtain a tile tree reference equivalent to this one that also supplies an implementation of [[GeometryTileTreeReference.collectTileGeometry]], or
   * undefined if geometry collection is not supported.
   * Currently, only terrain and reality model tiles support geometry collection.
   * @note Do not override this method - override [[_createGeometryTreeReference]] instead.
   * @beta
   */
  public createGeometryTreeReference(): GeometryTileTreeReference | undefined {
    if (this.collectTileGeometry) {
      // Unclear why compiler doesn't detect that `this` satisfies the GeometryTileTreeReference interface...it must be looking only at the types, not this particular instance.
      return this as GeometryTileTreeReference;
    }

    return this._createGeometryTreeReference();
  }
}
