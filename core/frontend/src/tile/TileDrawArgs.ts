/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { BeTimePoint } from "@bentley/bentleyjs-core";
import { ClipVector, Map4d, Matrix4d, Point3d, Point4d, Range1d, Range3d, Transform } from "@bentley/geometry-core";
import { FeatureAppearanceProvider, FrustumPlanes, ViewFlagOverrides } from "@bentley/imodeljs-common";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { GraphicBranch } from "../render/GraphicBranch";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderPlanarClassifier } from "../render/RenderPlanarClassifier";
import { RenderTextureDrape } from "../render/RenderSystem";
import { SceneContext } from "../ViewContext";
import { ViewingSpace } from "../ViewingSpace";
import { CoordSystem } from "../Viewport";
import { Tile, TileGraphicType, TileTree } from "./internal";

const scratchRange = new Range3d();
const scratchPoint = Point3d.create();
const scratchPoint4d = Point4d.create();
const scratchXRange = Range1d.createNull();
const scratchYRange = Range1d.createNull();
const scratchMatrix4d = Matrix4d.createIdentity();

/** Parameters used to construct [[TileDrawArgs]]
 * @beta
 */
export interface TileDrawArgParams {
  context: SceneContext;
  location: Transform;
  tree: TileTree;
  now: BeTimePoint;
  viewFlagOverrides: ViewFlagOverrides;
  clipVolume: RenderClipVolume | undefined;
  parentsAndChildrenExclusive: boolean;
  symbologyOverrides: FeatureSymbology.Overrides | undefined;
}
/**
 * Arguments used when selecting and drawing [[Tile]]s.
 * @see [[TileTree.selectTiles]]
 * @see [[TileTree.draw]]
 * @beta
 */
export class TileDrawArgs {
  /** Transform to the location in iModel coordinates at which the tiles are to be drawn. */
  public readonly location: Transform;
  /** The tile tree being drawn. */
  public readonly tree: TileTree;
  /** Optional clip volume applied to the tiles. */
  public clipVolume: RenderClipVolume | undefined;
  /** The context in which the tiles will be drawn, exposing, e.g., the [[Viewport]] and accepting [[RenderGraphic]]s to be drawn. */
  public readonly context: SceneContext;
  /** Describes the viewed volume. */
  public viewingSpace: ViewingSpace;
  /** Holds the tile graphics to be drawn. */
  public readonly graphics: GraphicBranch = new GraphicBranch();
  /** @internal */
  public readonly now: BeTimePoint;
  /** The planes of the viewing frustum, used for frustum culling. */
  protected _frustumPlanes?: FrustumPlanes;
  /** @internal */
  public planarClassifier?: RenderPlanarClassifier;
  /** @internal */
  public drape?: RenderTextureDrape;
  /** Optional clip volume applied to all tiles in the view. */
  public readonly viewClip?: ClipVector;
  /** @internal */
  public parentsAndChildrenExclusive: boolean;
  /** @internal */
  public appearanceProvider?: FeatureAppearanceProvider;
  /** Tiles that we want to draw and that are ready to draw. May not actually be selected, e.g. if sibling tiles are not yet ready. */
  public readonly readyTiles = new Set<Tile>();
  /** For perspective views, the view-Z of the near plane. */
  private readonly _nearViewZ?: number;
  /** View Flag overrides */
  public get viewFlagOverrides(): ViewFlagOverrides { return this.graphics.viewFlagOverrides; }
  /**  Symbology overrides */
  public get symbologyOverrides(): FeatureSymbology.Overrides | undefined { return this.graphics.symbologyOverrides; }

  /** Compute the size in pixels of the specified tile at the point on its bounding sphere closest to the camera. */
  public getPixelSize(tile: Tile): number {
    const sizeFromProjection = this.getPixelSizeFromProjection(tile);
    if (undefined !== sizeFromProjection)
      return sizeFromProjection;

    const radius = this.getTileRadius(tile); // use a sphere to test pixel size. We don't know the orientation of the image within the bounding box.
    const center = this.getTileCenter(tile);

    const pixelSizeAtPt = this.computePixelSizeInMetersAtClosestPoint(center, radius);
    return 0 !== pixelSizeAtPt ? this.context.adjustPixelSizeForLOD(radius / pixelSizeAtPt) : 1.0e-3;
  }

  /** If the tile provides corners (from an OBB) then this produces most accurate representation of the tile size */
  private getPixelSizeFromProjection(tile: Tile): number | undefined {
    const sizeProjectionCorners = tile.getSizeProjectionCorners();
    if (!sizeProjectionCorners)
      return undefined;

    /* For maps or global reality models we use the projected screen rectangle rather than sphere to calculate pixel size to avoid excessive tiles at horizon.  */
    const tileToView = this.worldToViewMap.transform0.multiplyMatrixMatrix(Matrix4d.createTransform(this.location, scratchMatrix4d), scratchMatrix4d);
    scratchXRange.setNull();
    scratchYRange.setNull();

    let behindEye = false;
    for (const corner of sizeProjectionCorners) {
      const viewCorner = tileToView.multiplyPoint3d(corner, 1, scratchPoint4d);
      if (viewCorner.w < 0.0) {
        behindEye = true;
        break;
      }

      scratchXRange.extendX(viewCorner.x / viewCorner.w);
      scratchYRange.extendX(viewCorner.y / viewCorner.w);
    }
    if (behindEye)
      return undefined;

    return scratchXRange.isNull ? 1.0E-3 : this.context.adjustPixelSizeForLOD(Math.sqrt(scratchXRange.length() * scratchYRange.length()));
  }

  /** Compute the size in meters of one pixel at the point on the tile's bounding sphere closest to the camera. */
  public getPixelSizeInMetersAtClosestPoint(tile: Tile): number {
    const radius = this.getTileRadius(tile); // use a sphere to test pixel size. We don't know the orientation of the image within the bounding box.
    const center = this.getTileCenter(tile);

    const pixelSizeAtPt = this.computePixelSizeInMetersAtClosestPoint(center, radius);
    return 0 !== pixelSizeAtPt ? this.context.adjustPixelSizeForLOD(pixelSizeAtPt) : 1.0e-3;
  }

  /** Compute the size in meters of one pixel at the point on a sphere closest to the camera.
   * Device scaling is not applied.
   */
  protected computePixelSizeInMetersAtClosestPoint(center: Point3d, radius: number): number {
    if (this.context.viewport.view.isCameraEnabled()) {
      // Find point on sphere closest to eye.
      const toEye = center.unitVectorTo(this.context.viewport.view.camera.eye);
      if (toEye) {
        toEye.scaleInPlace(radius);
        center.addInPlace(toEye);
      }
    }

    const viewPt = this.worldToViewMap.transform0.multiplyPoint3dQuietNormalize(center);
    if (undefined !== this._nearViewZ && viewPt.z > this._nearViewZ) {
      // Limit closest point on sphere to the near plane.
      viewPt.z = this._nearViewZ;
    }

    const viewPt2 = new Point3d(viewPt.x + 1.0, viewPt.y, viewPt.z);
    return this.worldToViewMap.transform1.multiplyPoint3dQuietNormalize(viewPt).distance(this.worldToViewMap.transform1.multiplyPoint3dQuietNormalize(viewPt2));
  }

  /** Compute this size of a sphere on screen in pixels */
  public getRangePixelSize(range: Range3d): number {
    const transformedRange = this.location.multiplyRange(range, scratchRange);
    const center = transformedRange.localXYZToWorld(.5, .5, .5, scratchPoint)!;
    const radius = transformedRange.diagonal().magnitude();

    const viewPt = this.worldToViewMap.transform0.multiplyPoint3dQuietNormalize(center);
    const viewPt2 = new Point3d(viewPt.x + 1.0, viewPt.y, viewPt.z);
    const pixelSizeAtPt = this.worldToViewMap.transform1.multiplyPoint3dQuietNormalize(viewPt).distance(this.worldToViewMap.transform1.multiplyPoint3dQuietNormalize(viewPt2));
    return 0 !== pixelSizeAtPt ? radius / pixelSizeAtPt : 1.0e-3;
  }

  /** @internal */
  public getTileGraphics(tile: Tile) {
    return tile.produceGraphics();
  }

  /** The planes of the viewing frustum, used for frustum culling. */
  public get frustumPlanes(): FrustumPlanes {
    return this._frustumPlanes !== undefined ? this._frustumPlanes : this.context.frustumPlanes;
  }

  /** @internal */
  public get worldToViewMap(): Map4d {
    return this.viewingSpace.worldToViewMap;
  }

  /** Constructor */
  public constructor(params: TileDrawArgParams) {
    const { location, tree, context, now, viewFlagOverrides, clipVolume, parentsAndChildrenExclusive, symbologyOverrides } = params;
    this.location = location;
    this.tree = tree;
    this.context = context;
    this.now = now;

    if (undefined !== clipVolume && !clipVolume.hasOutsideClipColor)
      this.clipVolume = clipVolume;

    this.graphics.setViewFlagOverrides(viewFlagOverrides);
    this.graphics.symbologyOverrides = symbologyOverrides;
    this.graphics.animationId = tree.modelId;

    this.viewingSpace = context.viewingSpace;
    this._frustumPlanes = new FrustumPlanes(this.viewingSpace.getFrustum());

    this.planarClassifier = context.getPlanarClassifierForModel(tree.modelId);
    this.drape = context.getTextureDrapeForModel(tree.modelId);

    // NB: If the tile tree has its own clip, do not also apply the view's clip.
    if (context.viewFlags.clipVolume && false !== viewFlagOverrides.clipVolumeOverride && undefined === clipVolume)
      this.viewClip = undefined === context.viewport.outsideClipColor ? context.viewport.view.getViewClip() : undefined;

    this.parentsAndChildrenExclusive = parentsAndChildrenExclusive;
    if (context.viewport.view.isCameraEnabled())
      this._nearViewZ = context.viewport.getFrustum(CoordSystem.View).frontCenter.z;
  }

  /** A multiplier applied to a [[Tile]]'s `maximumSize` property to adjust level of detail.
   * @see [[Viewport.tileSizeModifier]].
   * @alpha
   */
  public get tileSizeModifier(): number { return this.context.viewport.tileSizeModifier; }

  /** @internal */
  public getTileCenter(tile: Tile): Point3d { return this.location.multiplyPoint3d(tile.center); }

  /** @internal */
  public getTileRadius(tile: Tile): number {
    let range: Range3d = tile.range.clone(scratchRange);
    if (tile.tree.is2d) {
      // 2d tiles have a fixed Z range of [-1, 1]. Sometimes (e.g., hypermodeling) we draw them within a 3d view. Prevent Z from artificially expanding the radius.
      range.low.z = range.high.z = 0;
    }

    range = this.location.multiplyRange(range, range);
    return 0.5 * range.low.distance(range.high);
  }

  /** @internal */
  public get clip(): ClipVector | undefined {
    return undefined !== this.clipVolume ? this.clipVolume.clipVector : undefined;
  }

  /** @internal */
  public produceGraphics(): RenderGraphic | undefined {
    return this._produceGraphicBranch(this.graphics);
  }

  /** @internal */
  private _produceGraphicBranch(graphics: GraphicBranch): RenderGraphic | undefined {
    if (graphics.isEmpty)
      return undefined;

    const classifierOrDrape = undefined !== this.planarClassifier ? this.planarClassifier : this.drape;
    const appearanceProvider = this.appearanceProvider;
    const opts = { iModel: this.tree.iModel, clipVolume: this.clipVolume, classifierOrDrape, appearanceProvider };
    return this.context.createGraphicBranch(graphics, this.location, opts);
  }

  /** @internal */
  public drawGraphics(): void {
    const graphics = this.produceGraphics();
    if (undefined !== graphics)
      this.context.outputGraphic(graphics);
  }

  /** @internal */
  public drawGraphicsWithType(graphicType: TileGraphicType, graphics: GraphicBranch): void {
    const branch = this._produceGraphicBranch(graphics);
    if (undefined !== branch)
      this.context.withGraphicType(graphicType, () => this.context.outputGraphic(branch));
  }

  /** Indicate that graphics for the specified tile are desired but not yet available. Subsequently a request will be enqueued to load the tile's graphics. */
  public insertMissing(tile: Tile): void {
    this.context.insertMissingTile(tile);
  }

  /** @internal */
  public markChildrenLoading(): void {
    this.context.markChildrenLoading();
  }

  /** Indicate that the specified tile is being used for some purpose by the [[SceneContext]]'s [[Viewport]]. Typically "used" means "displayed", but the exact meaning is up to the [[TileTree]] - for example, "used" might also mean that the tile's children are being used. A tile that is "in use" by any [[Viewport]] will not be discarded. */
  public markUsed(tile: Tile): void {
    tile.usageMarker.mark(this.context.viewport, this.now);
  }

  /** Indicate that the specified tile should be displayed and that its graphics are ready to be displayed. The number of "ready" tiles is used in conjunction with the number of "missing" tiles to convey to the user how complete the current view is.
   * @see [[insertMissing]]
   */
  public markReady(tile: Tile): void {
    this.readyTiles.add(tile);
  }

  /** Invoked by [[TileTree.selectTiles]]. This exists chiefly for [[SolarShadowMap]].
   * @internal
   */
  public processSelectedTiles(_tiles: Tile[]): void { }

  /* @internal */
  public get maxRealityTreeSelectionCount(): number | undefined { return undefined; }
}
