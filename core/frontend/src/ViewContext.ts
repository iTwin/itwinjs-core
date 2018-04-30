/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Viewport } from "./Viewport";
import { Sprite } from "./Sprites";
import { Point3d, Vector3d, Point2d, RotMatrix, Transform, Vector2d, Range3d, LineSegment3d, CurveLocationDetail } from "@bentley/geometry-core";
import { Plane3dByOriginAndUnitNormal } from "@bentley/geometry-core/lib/AnalyticGeometry";
import { HitDetail, SnapMode, SnapDetail } from "./HitDetail";
import { GraphicType, GraphicBuilder, GraphicBuilderCreateParams } from "./render/GraphicBuilder";
import { ViewFlags, Npc } from "@bentley/imodeljs-common";

import { ACSDisplayOptions, AuxCoordSystemState } from "./AuxCoordSys";
import { IModelConnection } from "./IModelConnection";
import { PrimitiveBuilder } from "./render/primitives/Geometry";
import { DecorationList, GraphicList, Decorations, RenderGraphic, RenderTarget, RenderSystem } from "./render/System";

const gridConstants = { maxGridDotsInRow: 500, gridDotTransparency: 100, gridLineTransparency: 200, gridPlaneTransparency: 225, maxGridPoints: 90, maxGridRefs: 40 };

export class ViewContext {
  private _viewFlags?: ViewFlags;
  private _viewport?: Viewport;

  public get viewFlags(): ViewFlags { return this._viewFlags!; }
  public get viewport(): Viewport { return this._viewport!; }

  constructor(vp?: Viewport) { if (!!vp) this.attachViewport(vp); }

  public attachViewport(vp: Viewport): void {
    this._viewport = vp;
    this._viewFlags = vp.viewFlags.clone(); // viewFlags can diverge from viewport after attachment
  }

  public getPixelSizeAtPoint(inPoint?: Point3d): number {
    const vp = this.viewport;
    const viewPt = !!inPoint ? vp.worldToView(inPoint) : vp.npcToView(new Point3d(0.5, 0.5, 0.5));
    const viewPt2 = new Point3d(viewPt.x + 1.0, viewPt.y, viewPt.z);
    return vp.viewToWorld(viewPt).distance(vp.viewToWorld(viewPt2));
  }
}

export class NullContext extends ViewContext {
}

export class DynamicsContext extends ViewContext {
}

export class SnapContext extends ViewContext {
  public snapDetail?: SnapDetail; // result of the snap
  public snapAperture = 10;
  public snapMode = SnapMode.Invalid;
  public snapDivisor = 2;

  public async snapToPath(_thisPath: HitDetail, _snapMode: SnapMode, _snapDivisor: number, _hotAperture: number): Promise<SnapDetail | undefined> {
    //   if (!Application.locateManager.isSnappableModel(thisPath.getModel())   {
    //       return undefined nullptr;
    //     return SnapStatus.ModelNotSnappable;
    //   }

    //   // test for un-snappable hits...ex. pattern, linestyle...
    //   GeomDetail const& detail = thisPath -> GetGeomDetail();

    //   if (!detail.IsSnappable())
    //     return SnapStatus:: NotSnappable;

    //   SnapStatus  status = SnapStatus:: NotSnappable;

    //   // attach the context
    //   Attach(& thisPath -> GetViewport(), DrawPurpose:: Pick);

    //   snapMode = snapMode;
    //   snapDivisor = snapDivisor ? snapDivisor : 2;
    //   snapPath = new SnapDetail(thisPath);
    //   snapAperture = hotAperture;

    //   snapPath -> AddRef();

    //   // Save divisor used for this snap
    //   snapPath -> SetSnapDivisor(snapDivisor);

    //   DgnElementCPtr   element = snapPath -> GetElement();
    //   GeometrySourceCP geom = (element.IsValid() ? element -> ToGeometrySource() : nullptr);

    //   if (nullptr == geom) {
    //     IElemTopologyCP elemTopo = snapPath -> GetElemTopology();

    //     geom = (nullptr != elemTopo ? elemTopo -> _ToGeometrySource() : nullptr);
    //   }

    //   if (nullptr != geom)
    //     status = geom -> OnSnap(* this);
    //   else
    //     status = DoDefaultDisplayableSnap(); // Default snap for transients using HitDetail...

    //   if (SnapStatus:: Success == status)
    //   ElementLocateManager:: GetManager()._AdjustSnapDetail(* this);

    //   if (SnapStatus:: Success != status)
    //   {
    //     delete snapPath;
    //     snapPath = nullptr;
    //   }

    //   * snappedPath = snapPath;
    //   snapPath = nullptr;

    //   return status;
    return undefined;
  }
}

export class RenderContext extends ViewContext {
  public get target(): RenderTarget { return this.viewport.target; }
  constructor(vp: Viewport) { super(vp); }
  public createGraphic(_tf: Transform, _type: GraphicType): GraphicBuilder | undefined {
    return this._createGraphic(GraphicBuilderCreateParams.create(_type, this.viewport, _tf));
  }
  private _createGraphic(params: GraphicBuilderCreateParams): GraphicBuilder { return this.target.createGraphic(params); }
}

export class DecorateContext extends RenderContext {
  private readonly decorations: Decorations;
  constructor(vp: Viewport, decorations: Decorations = new Decorations()) {
    super(vp);
    this.decorations = decorations;
  }
  public drawSheetHit(hit: HitDetail): void { hit.viewport.setFlashed(hit.elementId, 0.25); } // NEEDSWORK
  public drawNormalHit(hit: HitDetail): void { hit.viewport.setFlashed(hit.elementId, 0.25); } // NEEDSWORK
  public drawHit(hit: HitDetail): void {
    const sheetVp = hit.sheetViewport;
    return (sheetVp && hit.viewport === this.viewport) ? this.drawSheetHit(hit) : this.drawNormalHit(hit);
  }

  /** wrapped nRepetitions and min in object to preserve changes */
  public static getGridDimension(props: { nRepetitions: number, min: number },  gridSize: number , org: Point3d, dir: Point3d, points: Point3d[]): boolean {
    // initialized only to avoid warning.
    let distLow  = 0.0,
        distHigh = 0.0;

    for (let i = 0, n = points.length; i < n; ++i) {
      const distance = points[i].dotVectorsToTargets(org, dir);
      if (i) {
        if (distance < distLow)
          distLow = distance;
        if (distance > distHigh)
          distHigh = distance;
      } else {
        distLow = distHigh = distance;
      }
    }

    if (distHigh <= distLow)
      return false;

    props.min = Math.floor(distLow / gridSize); // NOTE: Should be ok to let grid extend outside project extents since view extends padded for ground plane...
    const max = Math.ceil(distHigh / gridSize);
    props.nRepetitions = max - props.min;
    props.min *= gridSize;

    return true;
  }

  public static getGridPlaneViewIntersections(planePoint: Point3d, planeNormal: Vector3d, vp: Viewport, useProjectExtents: boolean): Point3d[] {
    const intersections: CurveLocationDetail[] = [];
    const limitRange = useProjectExtents && vp.view.isSpatialView();
    let range: Range3d = new Range3d();

    // Limit non-view aligned grid to project extents in spatial views...
    if (limitRange) {
      range = vp.view.iModel.projectExtents as Range3d;
      if (range.isNull())
        return [];
    }

    const index = new Array<[number, number]>(
                    // lines connecting front to back
                    [Npc._000, Npc._001],
                    [Npc._000, Npc._001],
                    [Npc._000, Npc._001],
                    [Npc._000, Npc._001],
                    // around front face
                    [Npc._000, Npc._001],
                    [Npc._000, Npc._001],
                    [Npc._000, Npc._001],
                    [Npc._000, Npc._001],
                    // around back face.
                    [Npc._000, Npc._001],
                    [Npc._000, Npc._001],
                    [Npc._000, Npc._001],
                    [Npc._000, Npc._001]);

    const frust = vp.getFrustum();

    range = limitRange ? range.intersect(frust.toRange()) : frust.toRange();
    frust.initFromRange(range); // equivalent to: range.Get8Corners(frust.m_pts);

    const plane = Plane3dByOriginAndUnitNormal.create(planePoint, planeNormal);
    if (undefined === plane)
      return [];

    for (let i = 0, n = index.length; i < n; ++i) {
      const corner1 = frust.getCorner(index[i][0]),
            corner2 = frust.getCorner(index[i][1]);
      const lineSegment = LineSegment3d.create(corner1, corner2);
      lineSegment.appendPlaneIntersectionPoints(plane, intersections);
    }

    return intersections.map((cld: CurveLocationDetail) => cld.point.clone());
  }

  public addNormal(graphic: RenderGraphic) {
    // if (nullptr != viewlet) {
    //   viewlet -> Add(graphic);
    //   return;
    // }

    if (!this.decorations.normal)
      this.decorations.normal = new GraphicList();

    this.decorations.normal.add(graphic);
  }

  /** Display world coordinate graphic with smooth shading, default lighting, and z testing enabled. */
  public addWorldDecoration(graphic: RenderGraphic, _ovr?: any) {
    if (!this.decorations.world)
      this.decorations.world = new DecorationList();
    this.decorations.world.add(graphic); // , ovrParams);
  }

  /** Display world coordinate graphic with smooth shading, default lighting, and z testing disabled. */
  public addWorldOverlay(graphic: RenderGraphic, _ovr?: any) {
    if (!this.decorations.worldOverlay)
      this.decorations.worldOverlay = new DecorationList();
    this.decorations.worldOverlay.add(graphic); // , ovrParams);
  }

  /** Display view coordinate graphic with smooth shading, default lighting, and z testing disabled. */
  public addViewOverlay(graphic: RenderGraphic, _ovr?: any) {
    if (!this.decorations.viewOverlay)
      this.decorations.viewOverlay = new DecorationList();
    this.decorations.viewOverlay.add(graphic); // , ovrParams);
  }

  /** Display sprite as view overlay graphic. */
  public addSprite(_sprite: Sprite, _location: Point3d, _xVec: Vector3d, _transparency: number) {
    //  this.addViewOverlay(* target.CreateSprite(sprite, location, xVec, transparency, GetDgnDb()), nullptr);
  }

  /** @private */
  public drawStandardGrid(gridOrigin: Point3d, rMatrix: RotMatrix, spacing: Vector2d, gridsPerRef: number, isoGrid: boolean = false, fixedRepetitions?: Point2d): void {
    const vp = this.viewport;

    // rotMatrix returns new Vectors instead of references
    const xVec  = rMatrix.rowX(),
          yVec  = rMatrix.rowY(),
          zVec  = rMatrix.rowZ(),
          viewZ = vp.rotMatrix.getRow(2);

    if (!vp.isCameraOn() && Math.abs(viewZ.dotProduct(zVec)) < 0.005)
      return;

    const refScale   = (0 === gridsPerRef) ? 1.0 : gridsPerRef,
          refSpacing = spacing.scale(refScale).clone();

    let gridOrg     = new Point3d(),
        repetitions = new Point2d();

    if (undefined === fixedRepetitions || 0 === fixedRepetitions.x || 0 === fixedRepetitions.y) {
      // expect gridOrigin and zVec to be modified from this call
      const intersections  = DecorateContext.getGridPlaneViewIntersections(gridOrigin, zVec, vp, undefined !== fixedRepetitions);

      if (intersections.length < 3)
        return;

      const min    = new Point2d(),
            xProps = { nRepetitions: repetitions.x, min: min.x },
            yProps = { nRepetitions: repetitions.y, min: min.y };
      if (!DecorateContext.getGridDimension(xProps, refSpacing.x, gridOrigin, Point3d.createFrom(xVec), intersections) ||
          !DecorateContext.getGridDimension(yProps, refSpacing.y, gridOrigin, Point3d.createFrom(yVec), intersections))
          return;

      // update vectors. (workaround for native passing primitives by reference)
      repetitions.x = xProps.nRepetitions; min.x = xProps.min;
      repetitions.y = yProps.nRepetitions; min.y = yProps.min;

      gridOrg.plus3Scaled(gridOrigin, 1, xVec, min.x, yVec, min.y);
    } else {
      gridOrg = gridOrigin;
      repetitions = fixedRepetitions;
    }

    if (0 === repetitions.x || 0 === repetitions.y)
      return;

    const gridX = xVec.scale(refSpacing.x),
          gridY = yVec.scale(refSpacing.y);

    const testPt = gridOrg.plus2Scaled(gridX, repetitions.x / 2.0, gridY, repetitions.y / 2.0);

    let maxGridPts  = gridConstants.maxGridPoints,
        maxGridRefs = gridConstants.maxGridRefs;

    if (maxGridPts < 10)
      maxGridPts = 10;
    if (maxGridRefs < 10)
      maxGridRefs = 10;

    // values are "per 1000 pixels"
    const minGridSeperationPixels = 1000 / maxGridPts,
          minRefSeperation        = 1000 / maxGridRefs;
    let uorPerPixel = vp.getPixelSizeAtPoint(testPt);

    if ((refSpacing.x / uorPerPixel) < minRefSeperation || (refSpacing.y / uorPerPixel) < minRefSeperation)
      gridsPerRef = 0;

    // Avoid z fighting with coincident geometry...let the wookie win...
    gridOrg.plus2Scaled(gridOrg, 1, viewZ, uorPerPixel); // was SumOf(DPoint2dCR point, DPoint2dCR vector, double s)
    uorPerPixel *= refScale;

    const drawDots = ((refSpacing.x / uorPerPixel) > minGridSeperationPixels) && ((refSpacing.y / uorPerPixel) > minGridSeperationPixels);
    const graphic  = this.createWorldDecoration();

    DecorateContext.drawGrid(graphic, isoGrid, drawDots, gridOrg, gridX, gridY, gridsPerRef, repetitions, vp);
    this.addWorldDecoration(graphic.finish()!);
  }

  public static drawGrid(_graphic: RenderGraphic, _doIsogrid: boolean, _drawDots: boolean, _gridOrigin: Point3d, _xVec: Vector3d, _yVec: Vector3d, _gridsPerRef: number, _repetitions: Point2d, _vp: Viewport): void {}

  /** Display view coordinate graphic as background with smooth shading, default lighting, and z testing disabled. e.g., a sky box. */
  public setViewBackground(graphic: RenderGraphic) { this.decorations.viewBackground = graphic; }

  public createViewBackground(tf = Transform.createIdentity()): GraphicBuilder { return this.createGraphic(tf, GraphicType.ViewBackground)!; }
  public createWorldDecoration(tf = Transform.createIdentity()): GraphicBuilder { return this.createGraphic(tf, GraphicType.WorldDecoration)!; }
  public createWorldOverlay(tf = Transform.createIdentity()): GraphicBuilder { return this.createGraphic(tf, GraphicType.WorldOverlay)!; }
  public createViewOverlay(tf = Transform.createIdentity()): GraphicBuilder { return this.createGraphic(tf, GraphicType.ViewOverlay)!; }

  public displayAuxCoordSystem(_acs: AuxCoordSystemState, _options: ACSDisplayOptions): void {
    //   const checkOutOfView = (ACSDisplayOptions.None !== (options & ACSDisplayOptions.CheckVisible));
    //   const drawOrigin = acs.getOrigin();

    //   if (checkOutOfView && !isOriginInView(drawOrigin, * context.GetViewport(), true))
    //     options = options | ACSDisplayOptions:: Deemphasized;

    //   double      pixelSize = context.GetViewport() -> PixelsFromInches(TRIAD_SIZE_INCHES); // Active size...

    //   if (ACSDisplayOptions:: None != (options & ACSDisplayOptions:: Deemphasized))
    //   pixelSize *= 0.8;
    // else if (ACSDisplayOptions:: None == (options & ACSDisplayOptions:: Active))
    //   pixelSize *= 0.9;

    //   double      exagg = context.GetViewport() -> GetViewController().GetViewDefinition().GetAspectRatioSkew();
    //   double      scale = context.GetPixelSizeAtPoint(& drawOrigin) * pixelSize;
    //   RotMatrix   rMatrix = _GetRotation();
    //   Transform   transform;

    //   rMatrix.InverseOf(rMatrix);
    //   rMatrix.ScaleRows(rMatrix, scale, scale / exagg, scale);
    //   transform.InitFrom(rMatrix, drawOrigin);

    //   auto graphic = context.CreateWorldOverlay(transform);

    //   DgnViewportR vp = * context.GetViewport();
    //   _AddAxis(* graphic, 0, options, vp);
    //   _AddAxis(* graphic, 1, options, vp);
    //   _AddAxis(* graphic, 2, options, vp);

    //   return graphic;

    //   if (!graphic.IsValid())
    //     return;

    //   context.AddWorldOverlay(* graphic -> Finish());
  }

}

export class PrimitiveBuilderContext extends ViewContext {
  constructor(public viewport: Viewport, public imodel: IModelConnection, public system: RenderSystem) { super(viewport); }
  public static fromPrimitiveBuilder(builder: PrimitiveBuilder): PrimitiveBuilderContext { return new PrimitiveBuilderContext(builder.viewport, builder.iModel, builder.system); }
}
