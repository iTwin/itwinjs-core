/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, Id64 } from "@bentley/bentleyjs-core";
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
  BSplineCurve3d,
  BSplineSurface3d,
  SolidPrimitive,
  Polyface,
} from "@bentley/geometry-core";
import {
  GraphicParams,
  GeometryParams,
  AsThickenedLine,
  TextString,
  QParams3d,
} from "@bentley/imodeljs-common";
import { IModelConnection } from "../../IModelConnection";
import { GraphicBuilder, GraphicBuilderCreateParams } from "../GraphicBuilder";
import { PrimitiveBuilderContext } from "../../ViewContext";
import { GeometryOptions, NormalMode } from "./Primitives";
import { RenderSystem, RenderGraphic, GraphicBranch } from "../System";
import { DisplayParams } from "./DisplayParams";
import { ViewContext } from "../../ViewContext";
import { StrokesList } from "./Strokes";
import { PolyfaceList } from "./Polyface";

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

  public static createFromGeom(geometry: GeometryQuery, tf: Transform, tileRange: Range3d, params: DisplayParams, isCurved: boolean, /*iModel: IModelConnection,*/ disjoint: boolean): Geometry {
    return PrimitiveGeometry.create(geometry, tf, tileRange, params, isCurved, disjoint);
  }

  protected abstract _getPolyfaces(chordTolerance: number, nm: NormalMode, vc: ViewContext): PolyfaceList;
  protected abstract _getStrokes(chordTolerance: number, vc: ViewContext): StrokesList;

  public getPolyfaces(chordTolerance: number, nm: NormalMode, vc: ViewContext): PolyfaceList {
    const polyfaces = this._getPolyfaces(chordTolerance, nm, vc);
    if (this.clip === undefined || 0 === polyfaces.length)
      return polyfaces;

    // ###TODO: clip the polyfaces if needed (See native code GeometryClipper); for now, return unclipped
    return polyfaces;
  }

  public getStrokes(chordTolerance: number, vc: ViewContext): StrokesList {
    const strokes = this._getStrokes(chordTolerance, vc);
    if (this.clip === undefined || 0 === strokes.length)
      return strokes;

    // ###TODO: clip the strokes if needed (See native code GeometryClipper); for now, return unclipped
    return strokes;
  }

  public get hasTextured() { return this.displayParams.isTextured; }
  public doDecimate() { return false; }
  public doVertexCluster() { return true; }
  public part() { return undefined; }
  // public abstract set inCache(inCache: boolean);

  // public get feature() { return this.displayParams.isValid() ? new Feature(this.entityId, this.displayParams.subCategoryId, this.displayParams.geomClass) : new Feature(this.entityId, new Id64()); }
  // public static createFacetOptions(chordTolerance: number): StrokeOptions { }
}

export class PrimitiveGeometry extends Geometry {
  public inCache = false;

  public constructor(public geometry: GeometryQuery, tf: Transform, range: Range3d, params: DisplayParams, isCurved: boolean, /*iModel: IModelConnection,*/ public disjoint: boolean) {
    super(tf, range, params, isCurved/*, iModel*/);
  }

  public static create(geometry: GeometryQuery, tf: Transform, range: Range3d, params: DisplayParams, isCurved: boolean, /* iModel: IModelConnection,*/ disjoint: boolean) {
    assert(!disjoint || geometry instanceof CurveCollection);
    return new PrimitiveGeometry(geometry, tf, range, params, isCurved, /* iModel, */ disjoint);
  }

  // ###TODO: actual implementation
  protected _getPolyfaces(chordTolerance: number, nm: NormalMode, vc: ViewContext): PolyfaceList {
    if (0 === chordTolerance) { // shut up tslint
    }
    if (NormalMode.Always === nm) { // shut up tslint
    }
    if (vc.viewFlags.fill) { // shut up tslint
    }
    return new PolyfaceList();
  }

  // ###TODO: actual implementation
  protected _getStrokes(chordTolerance: number, vc: ViewContext): StrokesList {
    if (0 === chordTolerance) { // shut up tslint
    }
    if (vc.viewFlags.fill) { // shut up tslint
    }
    return new StrokesList();
  }
}

export class GeometryList {
  public list: Geometry[] = [];
  public isComplete = false;
  public isCurved = false;

  public get isEmpty() { return this.list.length === 0; }
  public size() { return this.list.length; }
  public push_back(geom: Geometry) { this.list.push(geom); this.isCurved = this.isCurved || geom.isCurved; }
  public append(src: GeometryList) { this.list.concat(src.list); this.isCurved = this.isCurved || src.isCurved; }
  public clear() { this.list = []; }

  public computeRange(): Range3d {
    const range: Range3d = Range3d.createNull();
    this.list.forEach((geom: Geometry) => {
      range.extendRange(geom.tileRange);
    });
    return range;
  }
  public computeQuantizationParams(): QParams3d { return QParams3d.fromRange(this.computeRange()); }
}

export class GeometryAccumulator {
  public geometries?: GeometryList;
  public transform: Transform;
  public elementId: Id64 = new Id64();
  public surfacesOnly: boolean;
  public haveTransform: boolean;
  public checkGlyphBoxes: boolean = false;
  public tileRange: Range3d;
  public readonly iModel: IModelConnection;
  public readonly system: RenderSystem;

  public constructor(iModel: IModelConnection, system: RenderSystem, surfacesOnly: boolean = false, transform?: Transform, tileRange?: Range3d) {
    this.surfacesOnly = surfacesOnly;
    this.iModel = iModel;
    this.system = system;
    if (transform && tileRange) {
      this.transform = transform;
      this.tileRange = tileRange;
      this.haveTransform = !transform.isIdentity();
    } else {
      this.transform = Transform.createIdentity();
      this.tileRange = Range3d.createNull();
      this.haveTransform = false;
    }
  }

  public get isEmpty(): boolean { return !!this.geometries && this.geometries.isEmpty; }

  public addCurveVector(curves: CurveCollection, /*filled: boolean, */ displayParams: DisplayParams, transform: Transform, disjoint: boolean, clip?: ClipVector) {
    if (this.surfacesOnly && !curves.isAnyRegionType()) { return true; } // ignore...
    const isCurved: boolean = curves.hasNonLinearPrimitives();
    return this.addGeometry(curves, isCurved, displayParams, transform, disjoint, clip);
  }
  public addGeometry(geom: GeometryQuery, isCurved: boolean, displayParams: DisplayParams, transform: Transform, disjoint: boolean, clip?: ClipVector, range?: Range3d): boolean {
    let range3d;
    if (!range) {
      if (!geom.range(undefined, range3d)) { return false; }
      let tf: Transform;
      if (this.haveTransform) {
        tf = Transform.createIdentity();
        this.transform.multiplyTransformTransform(transform, tf);
      } else {
        tf = transform;
      }
      if (range3d) { tf.multiplyRange(range3d, range3d); }
    } else {
      range3d = range;
    }
    if (!range3d) { range3d = new Range3d(); }
    const geometry = Geometry.createFromGeom(geom, transform, range3d, displayParams, isCurved, /*this.iModel,*/ disjoint);
    if (!geometry) { return false; }
    geometry.clip = clip;
    if (this.geometries) { this.geometries.push_back(geometry); }
    return true;
  }
  public addGeometryWithGeom(geom: Geometry): void { if (this.geometries) { this.geometries.push_back(geom); } }
  public clear() { if (this.geometries) { this.geometries.clear(); } }

  public reInitialize(transform: Transform = Transform.createIdentity(), elemId: Id64 = new Id64(), surfacesOnly: boolean = false) {
    this.clear();
    this.transform = transform;
    this.elementId = elemId;
    this.surfacesOnly = surfacesOnly;
  }

  public saveToGraphicList(_graphics: RenderGraphic[], _options: GeometryOptions, _tolerance: number, _context: ViewContext): void { } //tslint:disable-line
}

export abstract class GeometryListBuilder extends GraphicBuilder {
  public accum?: GeometryAccumulator;
  public graphicParams: GraphicParams = new GraphicParams();
  private _geometryParams?: GeometryParams;
  public geometryParamsValid: boolean = false;
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

  public constructor(system: RenderSystem, params: GraphicBuilderCreateParams, elemId: Id64 = new Id64(), accumulatorTf: Transform = Transform.createIdentity()) {
    super(params);
    if (params.iModel) {
      this.accum = new GeometryAccumulator(params.iModel, system);
      this.accum.elementId = elemId;
      this.accum.transform = accumulatorTf;
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

  public activateGraphicParams(graphicParams: GraphicParams, geomParams?: GeometryParams): void {
    this.graphicParams = graphicParams;
    this.geometryParamsValid = geomParams !== undefined;
    if (this.geometryParamsValid) {
      this._geometryParams = geomParams;
    } else {
      this._geometryParams = new GeometryParams(new Id64());
    }
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
      this.accum.addCurveVector(curve, /*filled,*/ displayParams, this.localToWorldTransform, false, this.currClip);
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
        this.accum.addCurveVector(curves, /*filled,*/ displayParams, this.localToWorldTransform, disjoint, this.currClip);
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
  public get geometryParams(): GeometryParams | undefined { return this.geometryParamsValid ? this._geometryParams : undefined; }
  public get elementId(): Id64 { return this.accum ? this.accum.elementId : new Id64(); }

  public getDisplayParams(type: DisplayParams.Type): DisplayParams { return DisplayParams.createForType(type, this.graphicParams); }
  public getMeshDisplayParams(): DisplayParams { return this.getDisplayParams(DisplayParams.Type.Mesh); }
  public getLinearDisplayParams(): DisplayParams { return this.getDisplayParams(DisplayParams.Type.Linear); }
  public get textDisplayParams(): DisplayParams { return this.getDisplayParams(DisplayParams.Type.Text); }

  public get system(): RenderSystem | undefined { return this.accum ? this.accum.system : undefined; }

  public add(geom: Geometry): void { if (this.accum) this.accum.addGeometryWithGeom(geom); }

  public reInitialize(localToWorld: Transform, accumTf: Transform = Transform.createIdentity(), elemId: Id64 = new Id64()) {
    if (this.accum) this.accum.reInitialize(accumTf, elemId);
    this.activateGraphicParams(this.graphicParams);
    this.createParams.placement = localToWorld;
    this._isOpen = true;
    this.reset();
  }
}

export class PrimitiveBuilder extends GeometryListBuilder {
  public primitives: RenderGraphic[] = [];
  constructor(public system: RenderSystem, public params: GraphicBuilderCreateParams, public elemId: Id64 = new Id64()) { super(system, params, elemId); }
  public addSubGraphic(gf: RenderGraphic, subToGf: Transform, _gfParams: GraphicParams, clips?: ClipVector): void {
    // ###TODO_ELEMENT_TILE: Overriding GraphicParams?
    // ###TODO_ELEMENT_TILE: Clip...
    if (undefined !== clips || !subToGf.isIdentity()) {
      const branch = new GraphicBranch();
      const tf = this.localToWorldTransform.multiplyTransformTransform(subToGf);
      branch.add(gf);
      const graphic = this.system.createBranch(branch, this.iModel, tf, clips);
      this.primitives.push(graphic);
    } else this.primitives.push(gf);
  }

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
  public addBSplineCurve(_curve: BSplineCurve3d, _filled: boolean): void { } //tslint:disable-line
  public addBSplineCurve2d(_curve: BSplineCurve3d, _filled: boolean, _zDepth: number): void { } //tslint:disable-line
  public addBSplineSurface(_surface: BSplineSurface3d): void { } //tslint:disable-line
  public addPointString(_numPoints: number, _points: Point3d[]): void { } //tslint:disable-line
  public addPointString2d(_numPoints: number, _points: Point2d[], _zDepth: number): void { } //tslint:disable-line
  public addPolyface(_meshData: Polyface, _filled: boolean): void { } //tslint:disable-line
  public addShape(_numPoints: number, _points: Point3d[], _filled: boolean): void { } //tslint:disable-line
  public addShape2d(_numPoints: number, _points: Point2d[], _filled: boolean, _zDepth: number): void { } //tslint:disable-line
  public addSolidPrimitive(_primitive: SolidPrimitive): void { } //tslint:disable-line
  public addTextString(_text: TextString): void { } //tslint:disable-line
  public addTextString2d(_text: TextString, _zDepth: number): void { } //tslint:disable-line
  public addTriStrip(_numPoints: number, _points: Point3d[], _asThickenedLine: AsThickenedLine): void { } //tslint:disable-line
  public addTriStrip2d(_numPoints: number, _points: Point2d[], _asThickenedLine: AsThickenedLine, _zDepth: number): void { } //tslint:disable-line
}
