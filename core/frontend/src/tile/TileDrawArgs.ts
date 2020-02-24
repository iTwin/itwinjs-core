/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  BeTimePoint,
} from "@bentley/bentleyjs-core";
import {
  ClipVector,
  Map4d,
  Point3d,
  Range3d,
  Transform,
} from "@bentley/geometry-core";
import {
  FrustumPlanes,
  ViewFlag,
} from "@bentley/imodeljs-common";
import { Tile, TileGraphicType, TileTree } from "./internal";
import { SceneContext } from "../ViewContext";
import { ViewingSpace } from "../ViewingSpace";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { RenderGraphic } from "../render/RenderGraphic";
import { GraphicBranch } from "../render/GraphicBranch";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { RenderPlanarClassifier } from "../render/RenderPlanarClassifier";
import { RenderTextureDrape } from "../render/RenderSystem";

const scratchRange = new Range3d();

/**
 * Arguments used when selecting and drawing tiles
 * @internal
 */
export class TileDrawArgs {
  public readonly location: Transform;
  public readonly root: TileTree;
  public clipVolume?: RenderClipVolume;
  public readonly context: SceneContext;
  public viewingSpace: ViewingSpace;
  public readonly graphics: GraphicBranch = new GraphicBranch();
  public readonly now: BeTimePoint;
  public readonly purgeOlderThan: BeTimePoint;
  protected _frustumPlanes?: FrustumPlanes;
  public planarClassifier?: RenderPlanarClassifier;
  public drape?: RenderTextureDrape;
  public readonly viewClip?: ClipVector;
  public parentsAndChildrenExclusive: boolean;

  public getPixelSize(tile: Tile): number {
    const radius = this.getTileRadius(tile); // use a sphere to test pixel size. We don't know the orientation of the image within the bounding box.
    const center = this.getTileCenter(tile);

    const viewPt = this.worldToViewMap.transform0.multiplyPoint3dQuietNormalize(center);
    const viewPt2 = new Point3d(viewPt.x + 1.0, viewPt.y, viewPt.z);
    const pixelSizeAtPt = this.worldToViewMap.transform1.multiplyPoint3dQuietNormalize(viewPt).distance(this.worldToViewMap.transform1.multiplyPoint3dQuietNormalize(viewPt2));
    return 0 !== pixelSizeAtPt ? radius / pixelSizeAtPt : 1.0e-3;
  }

  public getTileGraphics(tile: Tile) {
    return tile.graphics;
  }

  public get frustumPlanes(): FrustumPlanes {
    return this._frustumPlanes !== undefined ? this._frustumPlanes : this.context.frustumPlanes;
  }
  public get worldToViewMap(): Map4d {
    return this.viewingSpace.worldToViewMap;
  }

  public static fromTileTree(context: SceneContext, location: Transform, root: TileTree, viewFlagOverrides: ViewFlag.Overrides, clip?: RenderClipVolume, parentsAndChildrenExclusive = false, symbologyOverrides?: FeatureSymbology.Overrides) {
    const now = BeTimePoint.now();
    const purgeOlderThan = now.minus(root.expirationTime);
    return new TileDrawArgs(context, location, root, now, purgeOlderThan, viewFlagOverrides, clip, parentsAndChildrenExclusive, symbologyOverrides);
  }

  public constructor(context: SceneContext, location: Transform, root: TileTree, now: BeTimePoint, purgeOlderThan: BeTimePoint, viewFlagOverrides: ViewFlag.Overrides, clip?: RenderClipVolume, parentsAndChildrenExclusive = true, symbologyOverrides?: FeatureSymbology.Overrides) {
    this.location = location;
    this.root = root;
    this.clipVolume = clip;
    this.context = context;

    this.now = now;
    this.purgeOlderThan = purgeOlderThan;

    this.graphics.setViewFlagOverrides(viewFlagOverrides);
    this.graphics.symbologyOverrides = symbologyOverrides;
    this.graphics.animationId = root.modelId;

    this.viewingSpace = context.viewingSpace;
    this._frustumPlanes = new FrustumPlanes(this.viewingSpace.getFrustum());

    this.planarClassifier = context.getPlanarClassifierForModel(root.modelId);
    this.drape = context.getTextureDrapeForModel(root.modelId);

    // NB: Culling is currently feature-gated - ignore view clip if feature not enabled.
    if (context.viewFlags.clipVolume && false !== root.viewFlagOverrides.clipVolumeOverride)
      this.viewClip = context.viewport.view.getViewClip();

    this.parentsAndChildrenExclusive = parentsAndChildrenExclusive;
  }

  /** A multiplier applied to a [[Tile]]'s `maximumSize` property to adjust level of detail.
   * @see [[Viewport.tileSizeModifier]].
   */
  public get tileSizeModifier(): number { return this.context.viewport.tileSizeModifier; }

  public getTileCenter(tile: Tile): Point3d { return this.location.multiplyPoint3d(tile.center); }

  public getTileRadius(tile: Tile): number {
    let range: Range3d = tile.range.clone(scratchRange);
    range = this.location.multiplyRange(range, range);
    return 0.5 * (tile.root.is3d ? range.low.distance(range.high) : range.low.distanceXY(range.high));
  }

  public get clip(): ClipVector | undefined { return undefined !== this.clipVolume ? this.clipVolume.clipVector : undefined; }

  public produceGraphics(): RenderGraphic | undefined { return this._produceGraphicBranch(this.graphics); }

  private _produceGraphicBranch(graphics: GraphicBranch): RenderGraphic | undefined {
    if (graphics.isEmpty)
      return undefined;

    const classifierOrDrape = undefined !== this.planarClassifier ? this.planarClassifier : this.drape;
    const opts = { iModel: this.root.iModel, clipVolume: this.clipVolume, classifierOrDrape };
    return this.context.createGraphicBranch(graphics, this.location, opts);
  }

  public drawGraphics(): void {
    const graphics = this.produceGraphics();
    if (undefined !== graphics)
      this.context.outputGraphic(graphics);
  }

  public drawGraphicsWithType(graphicType: TileGraphicType, graphics: GraphicBranch): void {
    const branch = this._produceGraphicBranch(graphics);
    if (undefined !== branch)
      this.context.withGraphicType(graphicType, () => this.context.outputGraphic(branch));
  }

  public insertMissing(tile: Tile): void {
    this.context.insertMissingTile(tile);
  }

  public markChildrenLoading(): void { this.context.hasMissingTiles = true; }
}
