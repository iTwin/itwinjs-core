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
import { FrustumPlanes } from "@bentley/imodeljs-common";
import { Tile, TileTree } from "./internal";
import { SceneContext } from "../ViewContext";
import { ViewingSpace } from "../ViewingSpace";
import {
  GraphicBranch,
  RenderClipVolume,
  RenderPlanarClassifier,
  RenderTextureDrape,
} from "../render/System";

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
  public viewFrustum?: ViewingSpace;
  public readonly graphics: GraphicBranch = new GraphicBranch();
  public readonly now: BeTimePoint;
  public readonly purgeOlderThan: BeTimePoint;
  private readonly _frustumPlanes?: FrustumPlanes;
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

  public get frustumPlanes(): FrustumPlanes {
    return this._frustumPlanes !== undefined ? this._frustumPlanes : this.context.frustumPlanes;
  }
  protected get worldToViewMap(): Map4d {
    return this.viewFrustum ? this.viewFrustum!.worldToViewMap : this.context.viewport.viewingSpace.worldToViewMap;
  }

  public constructor(context: SceneContext, location: Transform, root: TileTree, now: BeTimePoint, purgeOlderThan: BeTimePoint, clip?: RenderClipVolume, parentsAndChildrenExclusive = true) {
    this.location = location;
    this.root = root;
    this.clipVolume = clip;
    this.context = context;
    this.now = now;
    this.purgeOlderThan = purgeOlderThan;
    this.graphics.setViewFlagOverrides(root.viewFlagOverrides);
    this.viewFrustum = context.viewingSpace;
    if (this.viewFrustum !== undefined)
      this._frustumPlanes = new FrustumPlanes(this.viewFrustum.getFrustum());

    this.planarClassifier = context.getPlanarClassifierForModel(root.modelId);
    this.drape = context.getTextureDrapeForModel(root.modelId);

    // NB: Culling is currently feature-gated - ignore view clip if feature not enabled.
    if (context.viewFlags.clipVolume && false !== root.viewFlagOverrides.clipVolumeOverride)
      this.viewClip = context.viewport.view.getViewClip();

    this.graphics.animationId = root.modelId;
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

  public drawGraphics(): void {
    if (this.graphics.isEmpty)
      return;

    const classifierOrDrape = undefined !== this.planarClassifier ? this.planarClassifier : this.drape;
    const opts = { iModel: this.root.iModel, clipVolume: this.clipVolume, classifierOrDrape };
    const branch = this.context.createGraphicBranch(this.graphics, this.location, opts);

    this.context.outputGraphic(branch);
  }

  public insertMissing(tile: Tile): void {
    this.context.insertMissingTile(tile);
  }

  public markChildrenLoading(): void { this.context.hasMissingTiles = true; }
}
