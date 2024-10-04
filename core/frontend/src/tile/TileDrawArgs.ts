/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { BeTimePoint } from "@itwin/core-bentley";
import { ClipVector, Geometry, Map4d, Matrix4d, Point3d, Point4d, Range1d, Range3d, Transform, Vector3d } from "@itwin/core-geometry";
import { FeatureAppearanceProvider, FrustumPlanes, HiddenLine, ViewFlagOverrides } from "@itwin/core-common";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { GraphicBranch, GraphicBranchOptions } from "../render/GraphicBranch";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderPlanarClassifier } from "../render/RenderPlanarClassifier";
import { RenderTextureDrape } from "../render/RenderSystem";
import { SceneContext } from "../ViewContext";
import { ViewingSpace } from "../ViewingSpace";
import { CoordSystem } from "../CoordSystem";
import { Tile, TileGraphicType, TileTree } from "./internal";

const scratchRange = new Range3d();
const scratchPoint = Point3d.create();
const scratchPoint4d = Point4d.create();
const scratchXRange = Range1d.createNull();
const scratchYRange = Range1d.createNull();
const scratchMatrix4d = Matrix4d.createIdentity();

/** Parameters used to construct [[TileDrawArgs]].
 * @public
 * @extensions
 */
export interface TileDrawArgParams {
  /** Context for the scene into which the tiles are to be rendered. */
  context: SceneContext;
  /** Transform to be applied when drawing the tiles. */
  location: Transform;
  /** The tile tree from which to obtain tiles. */
  tree: TileTree;
  /** The time at which these args were created. */
  now: BeTimePoint;
  /** Overrides to apply to the view's [ViewFlags]($common) when drawing the tiles. */
  viewFlagOverrides: ViewFlagOverrides;
  /** Clip volume used to clip the tiles. */
  clipVolume?: RenderClipVolume;
  /** True if a tile and its child tiles should not be drawn simultaneously. */
  parentsAndChildrenExclusive: boolean;
  /** Symbology overrides to apply to the tiles. */
  symbologyOverrides: FeatureSymbology.Overrides | undefined;
  /** Optionally customizes the view's symbology overrides for the tiles. */
  appearanceProvider?: FeatureAppearanceProvider;
  /** Optionally overrides the view's hidden line settings. */
  hiddenLineSettings?: HiddenLine.Settings;
  /** If defined, tiles should be culled if they do not intersect this clip. */
  intersectionClip?: ClipVector;
  /** If defined, the Id of a node in the scene's [RenderSchedule.Script]($common) that applies a transform to the graphics;
   * or "0xffffffff" for any node that does *not* apply a transform.
   * @internal
   */
  animationTransformNodeId?: number;
  /** See [[GraphicBranch.groupNodeId]].
   * @internal
   */
  groupNodeId?: number;
  /** If defined, a bounding range in tile tree coordinates outside of which tiles should not be selected. */
  boundingRange?: Range3d;
  /** @alpha */
  maximumScreenSpaceError?: number;
  /** @alpha */
  transformFromIModel?: Transform;
}

/**
 * Provides context used when selecting and drawing [[Tile]]s.
 * @see [[TileTree.selectTiles]]
 * @see [[TileTree.draw]]
 * @public
 * @extensions
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
  /** True if a tile and its child tiles should not be drawn simultaneously. */
  public parentsAndChildrenExclusive: boolean;
  /** @internal */
  private _appearanceProvider?: FeatureAppearanceProvider;
  /** Optional overrides for the view's hidden line settings. */
  public hiddenLineSettings?: HiddenLine.Settings;
  /** Tiles that we want to draw and that are ready to draw. May not actually be selected, e.g. if sibling tiles are not yet ready. */
  public readonly readyTiles = new Set<Tile>();
  /** Tiles whose contents should be kept in memory regardless of whether or not they are selected for display.
   * @internal
   */
  public readonly touchedTiles = new Set<Tile>();
  /** For perspective views, the view-Z of the near plane. */
  private readonly _nearFrontCenter?: Point3d;
  /** Overrides applied to the view's [ViewFlags]($common) when drawing the tiles. */
  public get viewFlagOverrides(): ViewFlagOverrides { return this.graphics.viewFlagOverrides; }
  /** If defined, replaces the view's own symbology overrides when drawing the tiles. */
  public get symbologyOverrides(): FeatureSymbology.Overrides | undefined { return this.graphics.symbologyOverrides; }
  /** If defined, tiles will be culled if they do not intersect this clip. */
  public intersectionClip?: ClipVector;
  /** If defined, a bounding range in tile tree coordinates outside of which tiles should not be selected. */
  public boundingRange?: Range3d;
  /** @internal */
  public readonly pixelSizeScaleFactor;
  /** @internal */
  public readonly animationTransformNodeId?: number;
  /** @internal */
  public readonly groupNodeId?: number;
  /** @alpha */
  public maximumScreenSpaceError;
  /** @alpha */
  public transformFromIModel?: Transform;

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
  public computePixelSizeInMetersAtClosestPoint(center: Point3d, radius: number): number {
    if (this.context.viewport.view.is3d() && this.context.viewport.isCameraOn && this._nearFrontCenter) {
      const toFront = Vector3d.createStartEnd(center, this._nearFrontCenter);
      const viewZ = this.context.viewport.rotation.rowZ();
      // If the sphere overlaps the near front plane just use near front point.  This also handles behind eye conditions.
      if (viewZ.dotProduct(toFront) < radius) {
        center = this._nearFrontCenter;
      } else {
      // Find point on sphere closest to eye.
        const toEye = center.unitVectorTo(this.context.viewport.view.camera.eye);

        if (toEye) {  // Only if tile is not already behind the eye.
          toEye.scaleInPlace(radius);
          center.addInPlace(toEye);
        }
      }
    }

    const viewPt = this.worldToViewMap.transform0.multiplyPoint3dQuietNormalize(center);
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

  /** Provides conversions between [[CoordSystem.World]] and [[CoordSystem.View]]. */
  public get worldToViewMap(): Map4d {
    return this.viewingSpace.worldToViewMap;
  }

  private computePixelSizeScaleFactor(): number {
    // Check to see if a model display transform with non-uniform scaling is being used.
    const mat = this.context.viewport.view.modelDisplayTransformProvider?.getModelDisplayTransform(this.tree.modelId)?.transform.matrix;
    if (!mat)
      return 1;

    const scale = [0, 1, 2].map((x) => mat.getColumn(x).magnitude());
    if (Math.abs(scale[0] - scale[1]) <= Geometry.smallMetricDistance && Math.abs(scale[0] - scale[2]) <= Geometry.smallMetricDistance)
      return 1;

    // If the component with the largest scale is not the same as the component with the largest tile range use it to adjust the pixel size.
    const rangeDiag = this.tree.range.diagonal();
    let maxS = 0;
    let maxR = 0;
    if (scale[0] > scale[1])
      maxS = (scale[0] > scale[2] ? 0 : 2);
    else
      maxS = (scale[1] > scale[2] ? 1 : 2);

    if (rangeDiag.x > rangeDiag.y)
      maxR = (rangeDiag.x > rangeDiag.z ? 0 : 2);
    else
      maxR = (rangeDiag.y > rangeDiag.z ? 1 : 2);

    return maxS !== maxR ? scale[maxS] : 1;
  }

  /** Constructor */
  public constructor(params: TileDrawArgParams) {
    const { location, tree, context, now, viewFlagOverrides, clipVolume, parentsAndChildrenExclusive, symbologyOverrides } = params;
    this.location = location;
    this.tree = tree;
    this.context = context;
    this.now = now;
    this._appearanceProvider = params.appearanceProvider;
    this.hiddenLineSettings = params.hiddenLineSettings;
    this.animationTransformNodeId = params.animationTransformNodeId;
    this.groupNodeId = params.groupNodeId;
    this.boundingRange = params.boundingRange;
    this.maximumScreenSpaceError = params.maximumScreenSpaceError ?? 16; // 16 is Cesium's default.
    this.transformFromIModel = params.transformFromIModel;

    // Do not cull tiles based on clip volume if tiles outside clip are supposed to be drawn but in a different color.
    if (undefined !== clipVolume && !context.viewport.view.displayStyle.settings.clipStyle.outsideColor)
      this.clipVolume = clipVolume;

    this.graphics.setViewFlagOverrides(viewFlagOverrides);
    this.graphics.symbologyOverrides = symbologyOverrides;
    this.graphics.animationId = tree.modelId;

    this.viewingSpace = context.viewingSpace;
    this._frustumPlanes = FrustumPlanes.fromFrustum(this.viewingSpace.getFrustum());

    this.planarClassifier = context.getPlanarClassifierForModel(tree.modelId);
    this.drape = context.getTextureDrapeForModel(tree.modelId);

    // NB: If the tile tree has its own clip, do not also apply the view's clip.
    if (context.viewFlags.clipVolume && false !== viewFlagOverrides.clipVolume && undefined === clipVolume) {
      const outsideClipColor = context.viewport.displayStyle.settings.clipStyle.outsideColor;
      this.viewClip = undefined === outsideClipColor ? context.viewport.view.getViewClip() : undefined;
    }

    this.parentsAndChildrenExclusive = parentsAndChildrenExclusive;
    if (context.viewport.isCameraOn)
      this._nearFrontCenter = context.viewport.getFrustum(CoordSystem.World).frontCenter;

    this.pixelSizeScaleFactor = this.computePixelSizeScaleFactor();
  }

  /** A multiplier applied to a [[Tile]]'s `maximumSize` property to adjust level of detail.
   * @see [[Viewport.tileSizeModifier]].
   * @public
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

  /** Add a provider to supplement or override the symbology overrides for the view.
   * @note If a provider already exists, the new provider will be chained such that it sees the base overrides
   * after they have potentially been modified by the existing provider.
   * @public
   */
  public addAppearanceProvider(provider: FeatureAppearanceProvider): void {
    this._appearanceProvider = this._appearanceProvider ? FeatureAppearanceProvider.chain(this._appearanceProvider, provider) : provider;
  }

  /** Optionally customizes aspects of the view's [[FeatureSymbology.Overrides]]. */
  public get appearanceProvider(): FeatureAppearanceProvider | undefined {
    return this._appearanceProvider;
  }

  /** @internal */
  public produceGraphics(): RenderGraphic | undefined {
    return this._produceGraphicBranch(this.graphics);
  }
  /** @internal */
  public get secondaryClassifiers(): Map<number, RenderPlanarClassifier>| undefined {
    return undefined;
  }

  /** @internal */
  private _produceGraphicBranch(graphics: GraphicBranch): RenderGraphic | undefined {
    if (graphics.isEmpty)
      return undefined;

    const opts: GraphicBranchOptions = {
      iModel: this.tree.iModel,
      transformFromIModel: this.transformFromIModel,
      clipVolume: this.clipVolume,
      classifierOrDrape: this.planarClassifier ?? this.drape,
      appearanceProvider: this.appearanceProvider,
      hline: this.hiddenLineSettings,
      secondaryClassifiers: this.secondaryClassifiers,
    };

    let graphic = this.context.createGraphicBranch(graphics, this.location, opts);
    if (undefined !== this.animationTransformNodeId)
      graphic = this.context.renderSystem.createAnimationTransformNode(graphic, this.animationTransformNodeId);

    if (undefined !== this.groupNodeId) {
      const branch = new GraphicBranch();
      branch.add(graphic);
      branch.groupNodeId = this.groupNodeId;
      graphic = this.context.createGraphicBranch(branch, Transform.identity);
    }

    return graphic;
  }

  /** Output graphics for all accumulated tiles. */
  public drawGraphics(): void {
    const graphics = this.produceGraphics();
    if (undefined !== graphics)
      this.context.outputGraphic(graphics);
  }

  /** Output graphics of the specified type for all accumulated tiles. */
  public drawGraphicsWithType(graphicType: TileGraphicType, graphics: GraphicBranch): void {
    const branch = this._produceGraphicBranch(graphics);
    if (undefined !== branch)
      this.context.withGraphicType(graphicType, () => this.context.outputGraphic(branch));
  }

  /** Indicate that graphics for the specified tile are desired but not yet available. Subsequently a request will be enqueued to load the tile's graphics. */
  public insertMissing(tile: Tile): void {
    this.context.insertMissingTile(tile);
  }

  /** Indicate that some requested child tiles are not yet loaded. */
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
