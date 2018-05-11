/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import {
  Transform,
  Range3d,
  Arc3d,
  LineSegment3d,
  CurvePrimitive,
  GeometryQuery,
  ClipVector,
  AnyCurve,
  Loop,
  Path,
  BagOfCurves,
  LineString3d,
  Point2d,
  Point3d,
  PointString3d,
  CurveCollection,
  CurveChain,
  Polyface,
  StrokeOptions,
  Angle,
  IndexedPolyface,
  PolyfaceBuilder,
  SweepContour,
} from "@bentley/geometry-core";
import {
  GraphicParams,
  QParams3d,
} from "@bentley/imodeljs-common";
import { IModelConnection } from "../../IModelConnection";
import { GraphicBuilder, GraphicBuilderCreateParams } from "../GraphicBuilder";
import { PrimitiveBuilderContext } from "../../ViewContext";
import { GeometryOptions } from "./Primitives";
import { RenderSystem, RenderGraphic } from "../System";
import { DisplayParams } from "./DisplayParams";
import { ViewContext } from "../../ViewContext";
import { StrokesPrimitive, StrokesPrimitiveList, StrokesPrimitivePointLists } from "./Strokes";
import { PolyfacePrimitive, PolyfacePrimitiveList } from "./Polyface";

export type PrimitiveGeometryType = Loop | Path | IndexedPolyface; // More will receive support

export abstract class Geometry {
  public readonly transform: Transform;
  public readonly tileRange: Range3d;
  public readonly displayParams: DisplayParams;
  public readonly isCurved: boolean;
  public clip?: ClipVector;

  public constructor(transform: Transform, tileRange: Range3d, displayParams: DisplayParams, isCurved: boolean) {
    this.transform = transform;
    this.tileRange = tileRange;
    this.displayParams = displayParams;
    this.isCurved = isCurved;
  }

  public static createFromGeom(geometry: PrimitiveGeometryType, tf: Transform, tileRange: Range3d, params: DisplayParams, isCurved: boolean, /*iModel: IModelConnection,*/ disjoint: boolean): Geometry {

    return PrimitiveGeometry.create(geometry, tf, tileRange, params, isCurved, disjoint);
  }

  protected abstract _getPolyfaces(facetOptions: StrokeOptions): PolyfacePrimitiveList | undefined;
  protected abstract _getStrokes(facetOptions: StrokeOptions): StrokesPrimitiveList | undefined;

  public getPolyfaces(facetOptions: StrokeOptions): PolyfacePrimitiveList | undefined {
    const polyfaces = this._getPolyfaces(facetOptions);
    if (undefined === polyfaces)
      return undefined;

    if (undefined === this.clip)
      return polyfaces;

    // ###TODO: clip the polyfaces if needed (See native code GeometryClipper); for now, return unclipped
    return polyfaces;
  }

  public getStrokes(facetOptions: StrokeOptions): StrokesPrimitiveList | undefined {
    const strokes = this._getStrokes(facetOptions);
    if (undefined === strokes)
      return undefined;

    if (undefined === this.clip)
      return strokes;

    // ###TODO: clip the strokes if needed (See native code GeometryClipper); for now, return unclipped
    return strokes;
  }

  public get hasTexture() { return this.displayParams.isTextured; }
  public doDecimate() { return false; }
  public doVertexCluster() { return true; }
  public part() { return undefined; }

  public static createFacetOptions(chordTolerance: number): StrokeOptions {
    const strkOpts: StrokeOptions = StrokeOptions.createForFacets();
    strkOpts.chordTol = chordTolerance;
    strkOpts.angleTol = Angle.createRadians(Angle.piOver2Radians);
    // ###TODO: strkOpts.convexFacetsRequired = true; // not available yet
    strkOpts.needParams = true;
    strkOpts.needNormals = true;

    return strkOpts;
  }
}

export class PrimitiveGeometry extends Geometry {
  public readonly geometry: PrimitiveGeometryType;
  public readonly isDisjoint: boolean;

  public constructor(geometry: PrimitiveGeometryType, tf: Transform, range: Range3d, params: DisplayParams, isCurved: boolean, /*iModel: IModelConnection,*/ isDisjoint: boolean) {
    super(tf, range, params, isCurved/*, iModel*/);
    this.geometry = geometry;
    this.isDisjoint = isDisjoint;
  }

  public static create(geometry: PrimitiveGeometryType, tf: Transform, range: Range3d, params: DisplayParams, isCurved: boolean, /* iModel: IModelConnection,*/ isDisjoint: boolean) {
    assert(!isDisjoint || geometry instanceof CurveCollection);
    return new PrimitiveGeometry(geometry, tf, range, params, isCurved, /* iModel, */ isDisjoint);
  }

  protected _getPolyfaces(facetOptions: StrokeOptions): PolyfacePrimitiveList | undefined {
    // IndexedPolyface
    if (this.geometry instanceof IndexedPolyface) {
      const polyface = this.geometry as IndexedPolyface;

      if (this.hasTexture) {
        if (polyface.data.param) {
          polyface.data.param = [];
        }
        if (polyface.data.paramIndex) {
          polyface.data.paramIndex = [];
        }
      }

      // ###TODO: FixPolyface

      assert(this.transform.isIdentity());
      return new PolyfacePrimitiveList(PolyfacePrimitive.create(this.displayParams, polyface));
    }

    // used by Loop right now, could be used by other primitives
    const pfBuilder: PolyfaceBuilder = PolyfaceBuilder.create(facetOptions);
    let isPlanar = false;
    let builderHasPoly = false;

    // Loop
    if (this.geometry instanceof Loop) {
      const loop = this.geometry as Loop;

      if (!loop.isAnyRegionType()) {
        return undefined;
      }

      // The following is good for single loop things.
      const contour = SweepContour.createForLinearSweep(loop);
      if (contour !== undefined) {
        isPlanar = true;
        builderHasPoly = true;
        contour.emitFacets(pfBuilder, facetOptions, false); // build facets and emit them to the builder
      } // ###TODO: Will this handle all region cases? (might not work with holes)
    }

    // ###TODO: solidPrimitive
    // ###TODO: bsplineSurface

    if (builderHasPoly) {
      const polyface = pfBuilder.claimPolyface();
      const wantEdges = (!(this.geometry instanceof CurveChain) || DisplayParams.RegionEdgeType.Default === this.displayParams.regionEdgeType);
      return new PolyfacePrimitiveList(PolyfacePrimitive.create(this.displayParams, polyface, wantEdges, isPlanar));
    }

    return undefined;
  }

  // ###WIP  ###WIP
  protected _getStrokes(facetOptions: StrokeOptions): StrokesPrimitiveList | undefined {
    const strksList = new StrokesPrimitiveList();

    if (this.geometry instanceof CurveChain) {
      const chain = this.geometry as CurveChain; // ###WIP

      if (!chain.isAnyRegionType() || this.displayParams.wantRegionOutline) {
        const strksPts: StrokesPrimitivePointLists = new StrokesPrimitivePointLists();
        if (facetOptions.chordTol === undefined) { // shut up tslint
        }
        // PrimitiveGeometry.collectCurveStrokes(strksPts, chain, facetOptions, this.transform);

        if (strksPts.length > 0) {
          const isPlanar = chain.isAnyRegionType();
          assert(isPlanar === this.displayParams.wantRegionOutline);
          const strksPrim: StrokesPrimitive = StrokesPrimitive.create(this.displayParams, this.isDisjoint, isPlanar);
          // add strksPts to strskPrim:
          // strksPrim.strokes = strksPts;
          strksList.push(strksPrim);
        }
      }
    }

    return strksList;
  }

  /*
  private static collectCurveStrokes(strksPts: StrokesPrimitivePointLists, chain: CurveChain, facetOptions: StrokeOptions, trans: Transform) {
    const strokes: LineString3d = chain.cloneStroked(facetOptions) as LineString3d;
    const pt: Point3d = Point3d.create(0, 0, 0);
    for (let i = 0; i < strokes.numPoints(); i++) {
      strokes.pointAt(i, pt);
    }
  }
  */
}

export class GeometryList {
  private _list: Geometry[] = [];
  public get isEmpty(): boolean { return this._list.length === 0; }
  public push(geom: Geometry): number {
    return this._list.push(geom);
  }
  public append(src: GeometryList): GeometryList {
    this._list.push(...src._list);
    return this;
  }
  public clear(): void { this._list.length = 0; }
  public computeRange(): Range3d {
    const range: Range3d = Range3d.createNull();
    const extendRange = (geom: Geometry) => range.extendRange(geom.tileRange);
    this._list.forEach(extendRange);
    return range;
  }
  public computeQuantizationParams(): QParams3d { return QParams3d.fromRange(this.computeRange()); }
}

export class GeometryAccumulator {
  private _transform: Transform;
  private _surfacesOnly: boolean;

  public readonly tileRange: Range3d;
  public readonly geometries: GeometryList = new GeometryList();
  public readonly checkGlyphBoxes: boolean = false; // #TODO: obviously update when checkGlyphBoxes needs to be mutuable
  public readonly iModel: IModelConnection;
  public readonly system: RenderSystem;

  public get surfacesOnly(): boolean { return this._surfacesOnly; }
  public get transform(): Transform { return this._transform; }
  public get isEmpty(): boolean { return this.geometries.isEmpty; }
  public get haveTransform(): boolean { return !this._transform.isIdentity(); }

  public constructor(iModel: IModelConnection, system: RenderSystem, surfacesOnly: boolean = false, transform: Transform = Transform.createIdentity(), tileRange: Range3d = Range3d.createNull()) {
    this._surfacesOnly = surfacesOnly;
    this._transform = transform;
    this.iModel = iModel;
    this.system = system;
    this.tileRange = tileRange;
  }

  public addCurveVector(curves: CurveCollection, displayParams: DisplayParams, transform: Transform, disjoint: boolean, clip?: ClipVector): boolean {
    const { surfacesOnly, addGeometry } = this;

    if (surfacesOnly && !curves.isAnyRegionType())
      return true;

    // NB: If we're stroking a styled curve vector, we have set m_addingCurved based on whether the input curve vector was curved - the
    // stroked components may not be.
    const isCurved = curves.hasNonLinearPrimitives(),
      geom = curves as CurveChain;
    return addGeometry(geom, isCurved, displayParams, transform, disjoint, undefined, clip);
  }

  public addGeometry(geom: PrimitiveGeometryType, isCurved: boolean, displayParams: DisplayParams, transform: Transform, disjoint: boolean, range: Range3d = new Range3d(), clip?: ClipVector): boolean {
    const { _transform, haveTransform, geometries } = this;

    geom.range(undefined, range);
    if (range.isNull())
      return false;

    if (haveTransform) _transform.multiplyTransformTransform(transform, transform);
    transform.multiplyRange(range, range);

    // #TODO: should createFromGeom be possibly undefined? seems like native expects that possibility
    const geometry = Geometry.createFromGeom(geom, transform, range, displayParams, isCurved, disjoint);

    if (undefined !== clip)
      geometry.clip = ClipVector.createFrom(clip, geometry.clip);

    geometries.push(geometry);
    return true;
  }

  public addGeometryWithGeom(geom: Geometry): void { this.geometries.push(geom); }
  public clear() { this.geometries.clear(); }

  public reset(transform: Transform = Transform.createIdentity(), surfacesOnly: boolean = false) {
    this.clear();
    this._transform = transform;
    this._surfacesOnly = surfacesOnly;
  }

  /**
   * Populate a list of Graphic objects from the accumulated Geometry objects.
   * #TODO: implement MeshBuilderMap
   */
  public saveToGraphicList(_graphics: RenderGraphic[], _options: GeometryOptions, _tolerance: number, _context: ViewContext): void { }
}

export abstract class GeometryListBuilder extends GraphicBuilder {
  public accum?: GeometryAccumulator;
  public graphicParams: GraphicParams = new GraphicParams();
  // private _isOpen: boolean = false;

  public abstract finishGraphic(accum: GeometryAccumulator): RenderGraphic; // Invoked by _Finish() to obtain the finished RenderGraphic.

  private static isDisjointCurvePrimitive(prim: AnyCurve | GeometryQuery): boolean {
    if (prim instanceof PointString3d) {
      return true;
    } else if (prim instanceof LineSegment3d) {
      return prim.point0Ref.isAlmostEqual(prim.point1Ref);
    } else if (prim instanceof LineString3d) {
      return 1 === prim.points.length || (2 === prim.points.length && prim.points[0].isAlmostEqual(prim.points[1]));
    } else {
      return false;
    }
  }

  public constructor(system: RenderSystem, params: GraphicBuilderCreateParams, accumulatorTf: Transform = Transform.createIdentity()) {
    super(params);
    if (params.iModel) {
      this.accum = new GeometryAccumulator(params.iModel, system, undefined, accumulatorTf);
    }
  }

  public _finish(): RenderGraphic | undefined {
    if (!this.isOpen || !this.accum) {
      assert(false);
      return undefined;
    }
    const graphic = this.finishGraphic(this.accum);
    this._isOpen = false;
    if (this.accum) { this.accum.clear(); }
    return graphic;
  }

  public activateGraphicParams(graphicParams: GraphicParams): void {
    this.graphicParams = graphicParams;
  }
  public addArc2d(ellipse: Arc3d, isEllipse: boolean, filled: boolean, zDepth: number): void {
    if (0.0 === zDepth) {
      this.addArc(ellipse, isEllipse, filled);
    } else {
      const ell: Arc3d = ellipse;
      ell.center.z = zDepth;
      this.addArc(ell, isEllipse, filled);
    }
  }
  public addArc(ellipse: Arc3d, isEllipse: boolean, filled: boolean): void {
    let curve;
    if (isEllipse || filled) {
      curve = Loop.create(ellipse);
    } else {
      curve = Path.create(ellipse);
    }

    if (filled && !isEllipse && !ellipse.sweep.isFullCircle()) {
      const gapSegment: CurvePrimitive = LineSegment3d.create(ellipse.startPoint(), ellipse.endPoint());
      (gapSegment as any).markerBits = 0x00010000; // Set the CURVE_PRIMITIVE_BIT_GapCurve marker bit
      curve.children.push(gapSegment);
    }
    if (this.accum) {
      const displayParams = curve.isAnyRegionType() ? this.getMeshDisplayParams() : this.getLinearDisplayParams();
      this.accum.addCurveVector(curve, displayParams, this.localToWorldTransform, false, this.currClip);
    }
  }

  public addLineString(points: Point3d[]): void {
    const curve = BagOfCurves.create(LineString3d.create(points));
    this.addCurveVector(curve, false);
  }

  public addLineString2d(points: Point2d[], zDepth: number): void {
    const pt3d: Point3d[] = [];
    points.forEach((element: Point2d) => {
      pt3d.push(Point3d.create(element.x, element.y, zDepth));
    });
    this.addLineString(pt3d);
  }

  public abstract reset(): void;

  public addCurveVector(curves: CurveCollection, filled: boolean, disjoint?: boolean): void {
    if (disjoint !== undefined) {
      assert(!filled || !disjoint);
      if (this.accum) {
        const displayParams = curves.isAnyRegionType() ? this.getMeshDisplayParams() : this.getLinearDisplayParams();
        this.accum.addCurveVector(curves, displayParams, this.localToWorldTransform, disjoint, this.currClip);
      }
    }
    let numDisjoint = 0;
    let haveContinuous = false;
    // NB: Somebody might stick a 'point' or point string into a curve vector with a boundary...
    // No idea what they expect us to do if it also contains continuous curves but it is dumb anyway.
    if (!filled && curves instanceof BagOfCurves) {
      curves.children.forEach((prim) => {
        if (GeometryListBuilder.isDisjointCurvePrimitive(prim)) {
          numDisjoint++;
        } else {
          haveContinuous = true;
        }
      });
    } else {
      haveContinuous = true;
    }

    const haveDisjoint = numDisjoint > 0;
    assert(haveDisjoint || haveContinuous);
    if (haveDisjoint !== haveContinuous) {
      // The typical case...
      assert(!filled || !haveDisjoint);
      if (this.accum) {
        const displayParams = curves.isAnyRegionType() ? this.getMeshDisplayParams() : this.getLinearDisplayParams();
        this.accum.addCurveVector(curves, /*filled,*/ displayParams, this.localToWorldTransform, haveDisjoint, this.currClip);
      }
      return;
    }

    // Must split up disjoint and continuous into two separate curve vectors...
    // Note std::partition does not preserve relative order, but we don't care because boundary type NONE.
    const disjointCurves = BagOfCurves.create();
    if (curves.children) {
      curves.children.forEach((child) => {
        if (GeometryListBuilder.isDisjointCurvePrimitive(child)) {
          disjointCurves.children.push(child as AnyCurve);
        }
      });
      curves.children.filter((child) => !GeometryListBuilder.isDisjointCurvePrimitive(child));
    }
    if (this.accum) {
      const displayParams = curves.isAnyRegionType() ? this.getMeshDisplayParams() : this.getLinearDisplayParams();
      this.accum.addCurveVector(curves, /*false,*/ displayParams, this.localToWorldTransform, false, this.currClip);
    }
    if (this.accum) {
      const displayParams = curves.isAnyRegionType() ? this.getMeshDisplayParams() : this.getLinearDisplayParams();
      this.accum.addCurveVector(disjointCurves, /*false,*/ displayParams, this.localToWorldTransform, true, this.currClip);
    }
  }
  public getGraphicParams(): GraphicParams { return this.graphicParams; }

  public getDisplayParams(type: DisplayParams.Type): DisplayParams { return DisplayParams.createForType(type, this.graphicParams); }
  public getMeshDisplayParams(): DisplayParams { return this.getDisplayParams(DisplayParams.Type.Mesh); }
  public getLinearDisplayParams(): DisplayParams { return this.getDisplayParams(DisplayParams.Type.Linear); }
  public get textDisplayParams(): DisplayParams { return this.getDisplayParams(DisplayParams.Type.Text); }

  public get system(): RenderSystem | undefined { return this.accum ? this.accum.system : undefined; }

  public add(geom: Geometry): void { if (this.accum) this.accum.addGeometryWithGeom(geom); }

  public reInitialize(localToWorld: Transform, accumTf: Transform = Transform.createIdentity()) {
    if (this.accum) this.accum.reset(accumTf);
    this.activateGraphicParams(this.graphicParams);
    this.createParams.placement = localToWorld;
    this._isOpen = true;
    this.reset();
  }
}

export class PrimitiveBuilder extends GeometryListBuilder {
  public primitives: RenderGraphic[] = [];
  constructor(public system: RenderSystem, public params: GraphicBuilderCreateParams) { super(system, params); }

  public createSubGraphic(subToGf: Transform, _clip: ClipVector): GraphicBuilder {
    const tf = subToGf.isIdentity() ? this.localToWorldTransform : Transform.createIdentity();
    const params = this.params.subGraphic(tf);
    return this.system.createGraphic(params);
  }

  public finishGraphic(accum: GeometryAccumulator): RenderGraphic {
    if (!accum.isEmpty) {
      // Overlay decorations don't test Z. Tools like to layer multiple primitives on top of one another; they rely on the primitives rendering
      // in that same order to produce correct results (e.g., a thin line rendered atop a thick line of another color).
      // No point generating edges for graphics that are always rendered in smooth shade mode.
      const options = GeometryOptions.createForGraphicBuilder(this.params);
      const context = PrimitiveBuilderContext.fromPrimitiveBuilder(this);
      const tolerance = this.computeTolerance(accum);
      accum.saveToGraphicList(this.primitives, options, tolerance, context);
    }
    return (this.primitives.length !== 1) ? this.system.createGraphicList(this.primitives, this.iModel) : this.primitives.pop() as RenderGraphic;
  }

  public computeTolerance(accum: GeometryAccumulator): number {
    const toleranceMult = 0.25;
    if (this.params.isViewCoordinates) return toleranceMult;
    if (!this.params.viewport) return 20;
    const range = accum.geometries!.computeRange(); // NB: Already multiplied by transform...
    // NB: Geometry::CreateFacetOptions() will apply any scale factors from transform...no need to do it here.
    const pt = range.low.interpolate(0.5, range.high);
    return this.params.viewport!.getPixelSizeAtPoint(pt) * toleranceMult;
  }

  public reset(): void { }
  public addPointString(_numPoints: number, _points: Point3d[]): void { } //tslint:disable-line
  public addPointString2d(_numPoints: number, _points: Point2d[], _zDepth: number): void { } //tslint:disable-line
  public addPolyface(_meshData: Polyface, _filled: boolean): void { } //tslint:disable-line
  public addShape(_numPoints: number, _points: Point3d[], _filled: boolean): void { } //tslint:disable-line
  public addShape2d(_numPoints: number, _points: Point2d[], _filled: boolean, _zDepth: number): void { } //tslint:disable-line
}
