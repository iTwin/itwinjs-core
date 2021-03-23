/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, Id64String } from "@bentley/bentleyjs-core";
import {
  ClipPlane, ClipUtilities, ConvexClipPlaneSet, Geometry, GrowableXYZArray, LineString3d, Loop, Matrix3d, Plane3dByOriginAndUnitNormal, Point2d,
  Point3d, Range1d, Range3d, Segment1d, Transform, Vector2d, Vector3d, ViewGraphicsOps, ViewportGraphicsGridLineIdentifier, ViewportGraphicsGridSpacingOptions, XAndY} from "@bentley/geometry-core";
import { ColorDef, Frustum, FrustumPlanes, LinePixels, SpatialClassificationProps, ViewFlags } from "@bentley/imodeljs-common";
import { IModelApp } from "./IModelApp";
import { PlanarClipMaskState } from "./PlanarClipMaskState";
import { CanvasDecoration } from "./render/CanvasDecoration";
import { Decorations } from "./render/Decorations";
import { GraphicBranch, GraphicBranchOptions } from "./render/GraphicBranch";
import { GraphicBuilder, GraphicType } from "./render/GraphicBuilder";
import { GraphicList, RenderGraphic } from "./render/RenderGraphic";
import { RenderPlanarClassifier } from "./render/RenderPlanarClassifier";
import { RenderTextureDrape } from "./render/RenderSystem";
import { RenderTarget } from "./render/RenderTarget";
import { Scene } from "./render/Scene";
import { SpatialClassifierTileTreeReference, Tile, TileGraphicType, TileLoadStatus, TileTreeReference } from "./tile/internal";
import { ViewingSpace } from "./ViewingSpace";
import { ELEMENT_MARKED_FOR_REMOVAL, ScreenViewport, Viewport, ViewportDecorator } from "./Viewport";
import { CachedDecoration, DecorationsCache } from "./DecorationsCache";

/** @internal */
export class GridDisplaySettings {
  /** Grid plane fill transparency */
  public static planeTransparency = 225;
  /** Grid reference line transparency */
  public static refTransparency = 150;
  /** Grid line transparency */
  public static lineTransparency = 220;
  /** Distance between grid lines in pixels to use for culling/clipping when grid is unaffected by perspective */
  public static minSeparation = 10.0;
  /** Distance between grid lines in pixels to use for culling/clipping when grid is affected by perspective */
  public static minPerspectiveSeparation = 3.0;
  /** Distance between grid lines in pixels to use for fading lines before they are culled */
  public static minFadeSeparation = 20.0;
  /** Culling option based on distance to neighbor when camera is off. 0 for none, 1 for previous neighbor, 2 for previous displayed neighbor */
  public static cullingOption: 0 | 1 | 2 = 2;
  /** Culling option based on distance to neighbor when camera is on. 0 for none, 1 for previous neighbor, 2 for previous displayed neighbor */
  public static cullingPerspectiveOption: 0 | 1 | 2 = 1;
  /** Clipping option based on distance to neighbor. 0 for none */
  public static clippingOption: 0 | 1 = 1;
}

/** Provides context for producing [[RenderGraphic]]s for drawing within a [[Viewport]].
 * @public
 */
export class RenderContext {
  /** ViewFlags extracted from the context's [[Viewport]]. */
  public readonly viewFlags: ViewFlags;
  private readonly _viewport: Viewport;
  /** Frustum extracted from the context's [[Viewport]]. */
  public readonly frustum: Frustum;
  /** Frustum planes extracted from the context's [[Viewport]]. */
  public readonly frustumPlanes: FrustumPlanes;

  constructor(vp: Viewport, frustum?: Frustum) {
    this._viewport = vp;
    this.viewFlags = vp.viewFlags.clone(); // viewFlags can diverge from viewport after attachment
    this.frustum = frustum ? frustum : vp.getFrustum();
    this.frustumPlanes = new FrustumPlanes(this.frustum);
  }

  /** Given a point in world coordinates, determine approximately how many pixels it occupies on screen based on this context's frustum. */
  public getPixelSizeAtPoint(inPoint?: Point3d): number {
    return this.viewport.viewingSpace.getPixelSizeAtPoint(inPoint);
  }

  /** The [[Viewport]] associated with this context. */
  public get viewport(): Viewport {
    return this._viewport;
  }

  /** @internal */
  public get target(): RenderTarget { return this.viewport.target; }

  /** @internal */
  protected _createGraphicBuilder(type: GraphicType, transform?: Transform, id?: Id64String): GraphicBuilder {
    return this.target.createGraphicBuilder(type, this.viewport, transform, id);
  }

  /** Create a builder for creating a [[GraphicType.Scene]] [[RenderGraphic]] for rendering within this context's [[Viewport]].
   * @param transform the local-to-world transform in which the builder's geometry is to be defined.
   * @returns A builder for creating a [[GraphicType.Scene]] [[RenderGraphic]] for rendering within this context's [[Viewport]].
   */
  public createSceneGraphicBuilder(transform?: Transform): GraphicBuilder {
    return this._createGraphicBuilder(GraphicType.Scene, transform);
  }

  /** @internal */
  public createGraphicBranch(branch: GraphicBranch, location: Transform, opts?: GraphicBranchOptions): RenderGraphic {
    return this.target.renderSystem.createGraphicBranch(branch, location, opts);
  }

  /** Create a [[RenderGraphic]] which groups a set of graphics into a node in a scene graph, applying to each a transform and optional clip volume and symbology overrides.
   * @param branch Contains the group of graphics and the symbology overrides.
   * @param location the local-to-world transform applied to the grouped graphics.
   * @returns A RenderGraphic suitable for drawing the scene graph node within this context's [[Viewport]].
   * @see [[RenderSystem.createBranch]]
   */
  public createBranch(branch: GraphicBranch, location: Transform): RenderGraphic { return this.createGraphicBranch(branch, location); }

  /** Given the size of a logical pixel in meters, convert it to the size of a physical pixel in meters, if [[RenderSystem.dpiAwareLOD]] is `true`.
   * Used when computing LOD for graphics.
   * @internal
   */
  public adjustPixelSizeForLOD(cssPixelSize: number): number {
    return this.viewport.target.adjustPixelSizeForLOD(cssPixelSize);
  }
}

/** Provides context for an [[InteractiveTool]] to display decorations representing its current state.
 * @see [[InteractiveTool.onDynamicFrame]]
 * @public
 */
export class DynamicsContext extends RenderContext {
  private _dynamics?: GraphicList;

  /** Add a graphic to the list of dynamic graphics to be drawn in this context's [[Viewport]]. */
  public addGraphic(graphic: RenderGraphic) {
    if (undefined === this._dynamics)
      this._dynamics = [];
    this._dynamics.push(graphic);
  }

  /** @internal */
  public changeDynamics(): void {
    this.viewport.changeDynamics(this._dynamics);
  }
}

/** Provides context for a [[ViewportDecorator]] to add [[Decorations]] to be rendered within a [[Viewport]].
 * @public
 */
export class DecorateContext extends RenderContext {
  private readonly _decorations: Decorations;
  private readonly _cache: DecorationsCache;
  private _curCacheableDecorator?: ViewportDecorator;

  /** The [[ScreenViewport]] in which this context's [[Decorations]] will be drawn.
   * @deprecated use [[DecorateContext.viewport]].
   */
  public get screenViewport(): ScreenViewport { return this.viewport; }

  /** The [[ScreenViewport]] in which this context's [[Decorations]] will be drawn. */
  public get viewport(): ScreenViewport {
    return super.viewport as ScreenViewport;
  }

  /** @internal */
  constructor(vp: ScreenViewport, decorations: Decorations, cache: DecorationsCache) {
    super(vp);
    this._decorations = decorations;
    this._cache = cache;
  }

  /** Create a builder for creating a [[RenderGraphic]] of the specified type appropriate for rendering within this context's [[Viewport]].
   * @param type The type of builder to create.
   * @param transform the local-to-world transform in which the builder's geometry is to be defined.
   * @param id If the decoration is to be pickable, a unique identifier to associate with the resultant [[RenderGraphic]].
   * @returns A builder for creating a [[RenderGraphic]] of the specified type appropriate for rendering within this context's [[Viewport]].
   * @see [[IModelConnection.transientIds]] for obtaining an ID for a pickable decoration.
   */
  public createGraphicBuilder(type: GraphicType, transform?: Transform, id?: Id64String): GraphicBuilder {
    return this._createGraphicBuilder(type, transform, id);
  }

  /** @internal */
  public addFromDecorator(decorator: ViewportDecorator): void {
    assert(undefined === this._curCacheableDecorator);
    try {
      if (decorator.useCachedDecorations) {
        const cached = this._cache.get(decorator);
        if (cached) {
          this.restoreCache(cached);
          return;
        }

        this._curCacheableDecorator = decorator;
      }

      decorator.decorate(this);
    } finally {
      this._curCacheableDecorator = undefined;
    }
  }

  /** Restores decorations onto this context from the specified array of cached decorations. */
  private restoreCache(cachedDecorations: CachedDecoration[]) {
    cachedDecorations.forEach((cachedDecoration) => {
      switch (cachedDecoration.type) {
        case "graphic":
          this.addDecoration(cachedDecoration.graphicType, cachedDecoration.graphicOwner);
          break;
        case "canvas":
          this.addCanvasDecoration(cachedDecoration.canvasDecoration, cachedDecoration.atFront);
          break;
        case "html":
          this.addHtmlDecoration(cachedDecoration.htmlElement);
          break;
      }
    });
  }

  private _appendToCache(decoration: CachedDecoration) {
    assert(undefined !== this._curCacheableDecorator);
    this._cache.add(this._curCacheableDecorator, decoration);
  }

  /** Calls [[GraphicBuilder.finish]] on the supplied builder to obtain a [[RenderGraphic]], then adds the graphic to the appropriate list of
   * [[Decorations]].
   * @param builder The builder from which to extract the graphic.
   * @note The builder should not be used after calling this method.
   */
  public addDecorationFromBuilder(builder: GraphicBuilder) {
    this.addDecoration(builder.type, builder.finish());
  }

  /** Adds a graphic to the set of [[Decorations]] to be drawn in this context's [[ScreenViewport]].
   * @param The type of the graphic, which determines to which list of decorations it is added.
   * @param decoration The decoration graphic to add.
   * @note The type must match the type with which the [[RenderGraphic]]'s [[GraphicBuilder]] was constructed.
   * @see [[DecorateContext.addDecorationFromBuilder]] for a more convenient API.
   */
  public addDecoration(type: GraphicType, decoration: RenderGraphic) {
    if (this._curCacheableDecorator) {
      const graphicOwner = this.target.renderSystem.createGraphicOwner(decoration);
      this._appendToCache({ type: "graphic", graphicOwner, graphicType: type });
      decoration = graphicOwner;
    }

    switch (type) {
      case GraphicType.Scene:
        if (undefined === this._decorations.normal)
          this._decorations.normal = [];
        this._decorations.normal.push(decoration);
        break;

      case GraphicType.WorldDecoration:
        if (!this._decorations.world)
          this._decorations.world = [];
        this._decorations.world.push(decoration);
        break;

      case GraphicType.WorldOverlay:
        if (!this._decorations.worldOverlay)
          this._decorations.worldOverlay = [];
        this._decorations.worldOverlay.push(decoration);
        break;

      case GraphicType.ViewOverlay:
        if (!this._decorations.viewOverlay)
          this._decorations.viewOverlay = [];
        this._decorations.viewOverlay.push(decoration);
        break;

      case GraphicType.ViewBackground:
        this.setViewBackground(decoration);
        break;
    }
  }

  /** Add a [[CanvasDecoration]] to be drawn in this context's [[ScreenViewport]]. */
  public addCanvasDecoration(decoration: CanvasDecoration, atFront = false) {
    if (this._curCacheableDecorator)
      this._appendToCache({ type: "canvas", canvasDecoration: decoration, atFront });

    if (undefined === this._decorations.canvasDecorations)
      this._decorations.canvasDecorations = [];

    const list = this._decorations.canvasDecorations;
    if (0 === list.length || true === atFront)
      list.push(decoration);
    else
      list.unshift(decoration);
  }

  /** Add an HTMLElement to be drawn as a decoration in this context's [[ScreenViewport]]. */
  public addHtmlDecoration(decoration: HTMLElement) {
    if (this._curCacheableDecorator)
      this._appendToCache({ type: "html", htmlElement: decoration });

    // an element decoration being added might already be on the decorationDiv, just marked for removal
    if (decoration[ELEMENT_MARKED_FOR_REMOVAL]) {
      decoration[ELEMENT_MARKED_FOR_REMOVAL] = false;
    // SEE: decorationDiv doc comment
    // eslint-disable-next-line deprecation/deprecation
    } else if (decoration.parentElement !== this.screenViewport.decorationDiv) {
    // eslint-disable-next-line deprecation/deprecation
      this.screenViewport.decorationDiv.appendChild(decoration);
    }
  }

  private getClippedGridPlanePoints(vp: Viewport, plane: Plane3dByOriginAndUnitNormal, loopPt: Point3d): Point3d[] | undefined {
    const frust = vp.getFrustum();
    const geom = ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(ConvexClipPlaneSet.createPlanes([ClipPlane.createPlane(plane)]), frust.toRange(), true, false, true);
    if (undefined === geom || 1 !== geom.length)
      return undefined;
    const loop = geom[0];
    if (!(loop instanceof Loop) || 1 !== loop.children.length)
      return undefined;
    const child = loop.getChild(0);
    if (!(child instanceof LineString3d))
      return undefined;

    const work = new GrowableXYZArray();
    const finalPoints = new GrowableXYZArray();
    const convexSet = frust.getRangePlanes(false, false, 0);
    convexSet.polygonClip(child.points, finalPoints, work);
    if (finalPoints.length < 4)
      return undefined;

    const shapePoints = finalPoints.getPoint3dArray();
    let closeIndex = 0;
    if (vp.isCameraOn) {
      let lastZ = 0.0;
      for (let i = 0; i < shapePoints.length; ++i) {
        vp.worldToView(shapePoints[i], loopPt);
        if (i === 0 || loopPt.z > lastZ) {
          lastZ = loopPt.z;
          closeIndex = i;
        }
      }
    }
    loopPt.setFrom(shapePoints[closeIndex]);
    return shapePoints;
  }

  /** @internal */
  public drawStandardGrid(gridOrigin: Point3d, rMatrix: Matrix3d, spacing: XAndY, gridsPerRef: number, _isoGrid: boolean = false, _fixedRepetitions?: Point2d): void {
    const vp = this.viewport;
    if (vp.viewingGlobe)
      return;
    const eyePoint = vp.worldToViewMap.transform1.columnZ();
    const eyeDir = Vector3d.createFrom(eyePoint);
    const aa = Geometry.conditionalDivideFraction(1, eyePoint.w);
    if (aa !== undefined) {
      const xyzEye = eyeDir.scale(aa);
      eyeDir.setFrom(gridOrigin.vectorTo(xyzEye));
    }
    const normResult = eyeDir.normalize(eyeDir);
    if (!normResult)
      return;
    const zVec = rMatrix.rowZ();
    const eyeDot = eyeDir.dotProduct(zVec);
    if (!vp.isCameraOn && Math.abs(eyeDot) < 0.005)
      return;

    const plane = Plane3dByOriginAndUnitNormal.create(gridOrigin, zVec);
    if (undefined === plane)
      return;

    const loopPt = Point3d.createZero();
    const shapePoints = this.getClippedGridPlanePoints(vp, plane, loopPt);
    if (undefined === shapePoints)
      return;

    const meterPerPixel = vp.getPixelSizeAtPoint(loopPt);
    const refScale = (0 === gridsPerRef) ? 1.0 : gridsPerRef;
    const refSpacing = Vector2d.create(spacing.x, spacing.y).scale(refScale);

    const viewZ = vp.rotation.getRow(2);
    const gridOffset = Point3d.create(viewZ.x * meterPerPixel, viewZ.y * meterPerPixel, viewZ.z * meterPerPixel); // Avoid z fighting with coincident geometry
    const builder = this.createGraphicBuilder(GraphicType.WorldDecoration, Transform.createTranslation(gridOffset));
    const color = vp.getContrastToBackgroundColor();
    const planeColor = (eyeDot < 0.0 ? ColorDef.red : color).withTransparency(GridDisplaySettings.planeTransparency);

    builder.setBlankingFill(planeColor);
    builder.addShape(shapePoints);

    const addGridLine = (pointA: Point3d, pointB: Point3d, startEndDistances: Segment1d | undefined, gridLineIdentifier: ViewportGraphicsGridLineIdentifier) => {
      if (skipRefLines && (0 === gridLineIdentifier.index % gridsPerRef)) {
        return; // skip reference lines when drawing grid lines...
      }

      if (undefined === startEndDistances || 0 === gridLineIdentifier.stepCount) {
        noOutput = false;
        firstLine = [pointA, pointB];
        return; // defer output of 1st direction line until minDist can be evaluated...
      }

      const minDist = Math.abs(startEndDistances.x0 + startEndDistances.x1) / (gridLineIdentifier.stepCount * 2);
      if (minDist < GridDisplaySettings.minFadeSeparation)
        thisTransparency = Math.ceil(Geometry.interpolate(255, minDist / (GridDisplaySettings.minFadeSeparation + gridOptions.distanceBetweenLines), lineTransparency));
      else
        thisTransparency = lineTransparency;

      if (gridLineIdentifier.stepCount > 1 && (skipRefLines || thisTransparency > 240))
        return; // limit number of steps...

      if (undefined === lastTransparency || (Math.abs(thisTransparency - lastTransparency) > 5)) {
        builder.setSymbology(color.withTransparency(thisTransparency), planeColor, 1, linePattern);
        lastTransparency = thisTransparency;
      }

      if (undefined !== firstLine) {
        builder.addLineString(firstLine);
        firstLine = undefined;
        if (1 === gridLineIdentifier.stepCount)
          drawGridLines = true; // Only need to draw grid lines when ref lines aren't being skipped...
      }

      builder.addLineString([pointA, pointB]);
    };

    const _world000 = vp.worldToNpcMap.transform1.multiplyXYZW(0, 0, 0, 1);
    const _world111 = vp.worldToNpcMap.transform1.multiplyXYZW(1, 1, 1, 1);
    const _view000 = vp.worldToViewMap.transform0.multiplyPoint4d(_world000);
    const _view111 = vp.worldToViewMap.transform0.multiplyPoint4d(_world111);
    const npcRange = Range3d.createXYZXYZ(_view000.x, _view000.y, _view000.z, _view111.x, _view111.y, _view111.z);

    const gridOptions = ViewportGraphicsGridSpacingOptions.create(
      (vp.isCameraOn && Math.abs(zVec.dotProduct(vp.rotation.getRow(2))) < 0.9) ? GridDisplaySettings.minPerspectiveSeparation : GridDisplaySettings.minSeparation,
      (vp.isCameraOn ? GridDisplaySettings.cullingPerspectiveOption : GridDisplaySettings.cullingOption),
      GridDisplaySettings.clippingOption
    );

    const gridRefXStep = rMatrix.rowX().scale(refSpacing.x);
    const gridRefYStep = rMatrix.rowY().scale(refSpacing.y);

    let noOutput = true;
    let drawGridLines = false;
    let skipRefLines = false;
    let firstLine: Point3d[] | undefined;
    let linePattern = eyeDot < 0.0 ? LinePixels.Code2 : LinePixels.Solid;
    let lineTransparency = GridDisplaySettings.refTransparency;
    let lastTransparency: number;
    let thisTransparency: number;

    ViewGraphicsOps.announceGridLinesInView(gridOrigin, gridRefXStep, gridRefYStep, vp.worldToViewMap, npcRange, gridOptions,
      (pointA: Point3d, pointB: Point3d, _perspectiveZA: number | undefined, _perspectiveZB: number | undefined,
        startEndDistances: Segment1d | undefined,
        gridLineIdentifier: ViewportGraphicsGridLineIdentifier) => {
        addGridLine(pointA, pointB, startEndDistances, gridLineIdentifier);
      });

    // add first line now if it ended up being the only one in the view due to zoom level...
    if (undefined !== firstLine) {
      builder.setSymbology(color.withTransparency(lineTransparency), planeColor, 1, linePattern);
      builder.addLineString(firstLine);
    }

    // might still need grid lines even if no ref lines are visible in the view due to zoom level...
    if (noOutput || undefined !== firstLine)
      drawGridLines = true;

    if (drawGridLines) {
      const gridXStep = gridRefXStep.scale(1 / gridsPerRef);
      const gridYStep = gridRefYStep.scale(1 / gridsPerRef);

      lineTransparency = GridDisplaySettings.lineTransparency;
      linePattern = LinePixels.Solid;
      skipRefLines = true;

      ViewGraphicsOps.announceGridLinesInView(gridOrigin, gridXStep, gridYStep, vp.worldToViewMap, npcRange, gridOptions,
        (pointA: Point3d, pointB: Point3d, _perspectiveZA: number | undefined, _perspectiveZB: number | undefined,
          startEndDistances: Segment1d | undefined,
          gridLineIdentifier: ViewportGraphicsGridLineIdentifier) => {
          addGridLine(pointA, pointB, startEndDistances, gridLineIdentifier);
        });
    }

    this.addDecorationFromBuilder(builder);
  }

  /** Display skyBox graphic that encompasses entire scene and rotates with camera.
   * @see [[RenderSystem.createSkyBox]].
   */
  public setSkyBox(graphic: RenderGraphic) {
    this._decorations.skyBox = graphic;
  }

  /** Set the graphic to be displayed behind all other geometry as the background of this context's [[ScreenViewport]]. */
  public setViewBackground(graphic: RenderGraphic) {
    this._decorations.viewBackground = graphic;
  }
}

/** Context used to create the scene for a [[Viewport]]. The scene consists of a set of [[RenderGraphic]]s produced by the
 * [[TileTree]]s visible within the viewport. Creating the scene may result in the enqueueing of requests for [[Tile]]s which
 * should be displayed in the viewport but are not yet loaded.
 * @beta
 */
export class SceneContext extends RenderContext {
  private _missingChildTiles = false;
  /** The graphics comprising the scene. */
  public readonly scene = new Scene();
  /** @internal */
  public readonly missingTiles = new Set<Tile>();
  /** @internal */
  public markChildrenLoading(): void {
    this._missingChildTiles = true;
  }
  /** @internal */
  public get hasMissingTiles(): boolean {
    return this._missingChildTiles || this.missingTiles.size > 0;
  }

  /** @internal */
  private _viewingSpace?: ViewingSpace;
  private _graphicType: TileGraphicType = TileGraphicType.Scene;

  public constructor(vp: Viewport, frustum?: Frustum) {
    super(vp, frustum);
  }

  public get viewingSpace(): ViewingSpace {
    return undefined !== this._viewingSpace ? this._viewingSpace : this.viewport.viewingSpace;
  }

  /** @internal */
  public get graphicType() { return this._graphicType; }

  /** @internal */
  public outputGraphic(graphic: RenderGraphic): void {
    switch (this._graphicType) {
      case TileGraphicType.BackgroundMap:
        this.backgroundGraphics.push(graphic);
        break;
      case TileGraphicType.Overlay:
        this.overlayGraphics.push(graphic);
        break;
      default:
        this.graphics.push(graphic);
        break;
    }
  }

  /** Indicate that the specified tile is desired for the scene but is not yet ready. A request to load its contents will later be enqueued. */
  public insertMissingTile(tile: Tile): void {
    switch (tile.loadStatus) {
      case TileLoadStatus.NotLoaded:
      case TileLoadStatus.Queued:
      case TileLoadStatus.Loading:
        this.missingTiles.add(tile);
        break;
    }
  }

  /** @internal */
  public requestMissingTiles(): void {
    IModelApp.tileAdmin.requestTiles(this.viewport, this.missingTiles);
  }

  /** @internal */
  public addPlanarClassifier(classifiedModelId: Id64String, classifierTree?: SpatialClassifierTileTreeReference, planarClipMask?: PlanarClipMaskState): RenderPlanarClassifier | undefined {
    // Target may have the classifier from a previous frame; if not we must create one.
    let classifier = this.viewport.target.getPlanarClassifier(classifiedModelId);
    if (undefined === classifier)
      classifier = this.viewport.target.createPlanarClassifier(classifierTree?.activeClassifier);

    // Either way, we need to collect the graphics to draw for this frame, and record that we did so.
    if (undefined !== classifier) {
      this.planarClassifiers.set(classifiedModelId, classifier);
      classifier.setSource(classifierTree, planarClipMask);
    }

    return classifier;
  }

  /** @internal */
  public getPlanarClassifierForModel(modelId: Id64String) {
    return this.planarClassifiers.get(modelId);
  }

  /** @internal */
  public addBackgroundDrapedModel(drapedTreeRef: TileTreeReference, _heightRange: Range1d | undefined): RenderTextureDrape | undefined {
    const drapedTree = drapedTreeRef.treeOwner.tileTree;
    if (undefined === drapedTree)
      return undefined;

    const id = drapedTree.modelId;
    let drape = this.getTextureDrapeForModel(id);
    if (undefined !== drape)
      return drape;

    drape = this.viewport.target.getTextureDrape(id);
    if (undefined === drape)
      drape = this.viewport.target.renderSystem.createBackgroundMapDrape(drapedTreeRef, this.viewport.displayStyle.backgroundDrapeMap);

    if (undefined !== drape)
      this.textureDrapes.set(id, drape);

    return drape;
  }

  /** @internal */
  public getTextureDrapeForModel(modelId: Id64String) {
    return this.textureDrapes.get(modelId);
  }

  /** @internal */
  public withGraphicType(type: TileGraphicType, func: () => void): void {
    const prevType = this._graphicType;
    this._graphicType = type;

    func();

    this._graphicType = prevType;
  }

  /** @internal */
  public get graphics() { return this.scene.foreground; }
  /** @internal */
  public get backgroundGraphics() { return this.scene.background; }
  /** @internal */
  public get overlayGraphics() { return this.scene.overlay; }
  /** @internal */
  public get planarClassifiers() { return this.scene.planarClassifiers; }
  /** @internal */
  public get textureDrapes() { return this.scene.textureDrapes; }

  /** @internal */
  public setVolumeClassifier(classifier: SpatialClassificationProps.Classifier, modelId: Id64String): void {
    this.scene.volumeClassifier = { classifier, modelId };
  }
}
