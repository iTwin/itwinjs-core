/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, Id64 } from "@bentley/bentleyjs-core";
import { Transform, Range3d, Arc3d, LineSegment3d, CurvePrimitive, GeometryQuery, ClipVector, AnyCurve, Loop, Path, BagOfCurves, LineString3d, Point2d, Point3d, PointString3d, CurveCollection } from "@bentley/geometry-core";
import { Graphic, GraphicParams, GeometryParams } from "@bentley/imodeljs-common";
// import { IModelConnection } from "../IModelConnection";
import { GraphicBuilder, GraphicBuilderCreateParams } from "./GraphicBuilder";
import { QParams3d } from "./QPoint";
// import { ViewContext } from "../ViewContext";
// import { Feature } from "../../common/Render";

export abstract class Geometry {
  public facetCount: number;
  public hasTextured: boolean;
  public clip?: ClipVector;

  public constructor(public transform: Transform, public tileRange: Range3d, public entityId: Id64, public displayParams: any /* should be DisplayParams */, public isCurved: boolean) {
    this.facetCount = 0;
    this.hasTextured = displayParams.hasTextured();
  }

  // public abstract get polyfaces(chordTolerance: number, nm: NormalMode, vc: ViewContext): PolyfaceList;
  // public get strokes(chordTolerance: number, vc: ViewContext): StrokesList;
  public doDecimate() { return false; }
  public doVertexCluster() { return true; }
  public part() { return undefined; }
  // public abstract set inCache(inCache: boolean);

  // public abstract get facetCount(param1?: StrokeCounter | StrokeOptions);
  // public get feature() { return this.displayParams.isValid() ? new Feature(this.entityId, this.displayParams.subCategoryId, this.displayParams.class) : new Feature(); }
  // public static createFacetOptions(chordTolerance: number): StrokeOptions { }

  public static createFromGeom(geometry: GeometryQuery, tf: Transform, tileRange: Range3d, entityId: Id64, params: any /* should be DisplayParams */, isCurved: boolean, /*iModel: IModelConnection,*/ disjoint: boolean): Geometry {
    return PrimitiveGeometry.create(geometry, tf, tileRange, entityId, params, isCurved, disjoint);
  }
}

export class PrimitiveGeometry extends Geometry { // This is temporary until PrimitiveGeometry is actually translated
  public inCache = false;

  public constructor(public geometry: GeometryQuery, tf: Transform, range: Range3d, elemId: Id64, params: any /* should be DisplayParams*/, isCurved: boolean, /*iModel: IModelConnection,*/ public disjoint: boolean) {
    super(tf, range, elemId, params, isCurved/*, iModel*/);
  }

  public static create(geometry: GeometryQuery, tf: Transform, range: Range3d, elemId: Id64, params: any /* should be DisplayParams*/, isCurved: boolean, /* iModel: IModelConnection,*/ disjoint: boolean) {
    assert(!disjoint || geometry instanceof CurveCollection);
    return new PrimitiveGeometry(geometry, tf, range, elemId, params, isCurved, /* iModel, */ disjoint);
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
  public computeQuantizationParams(): QParams3d { return new QParams3d(this.computeRange()); }
}

export class GeometryAccumulator {
  public geometries?: GeometryList;
  public transform: Transform;
  public elementId: Id64 = new Id64();
  // public displayParamsCache: DisplayParamsCache; // DisplayParamsCache doesn't exist!!!
  public surfacesOnly: boolean;
  public haveTransform: boolean;
  public checkGlyphBoxes: boolean = false;
  public tileRange: Range3d;

  public constructor(/*iModel: IModelConnection, system: System, */ surfacesOnly: boolean = false, transform?: Transform, tileRange?: Range3d) {
    this.surfacesOnly = surfacesOnly;
    // this.displayParamsCache = new DisplayParamsCache(iModel, system);
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

  public get iModel() { return undefined; } // temporary until DisplayParamsCache exists! // return this.displayParamsCache.iModel; }
  public get isEmpty(): boolean { return !!this.geometries && this.geometries.isEmpty; }

  public addCurveVector(curves: CurveCollection, /*filled: boolean, */ displayParams: any /* should be DisplayParams */, transform: Transform, disjoint: boolean, clip?: ClipVector) {
    if (this.surfacesOnly && !curves.isAnyRegionType()) { return true; } // ignore...
    const isCurved: boolean = false; // containsNonLinearPrimitive() function doesn't exist?? // curves.containsNonLinearPrimitive();
    return this.addGeometry(curves, isCurved, displayParams, transform, disjoint, clip);
  }
  public addGeometry(geom: GeometryQuery, isCurved: boolean, displayParams: any /* should be DisplayParams */, transform: Transform, disjoint: boolean, clip?: ClipVector, range?: Range3d) {
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
    const geometry = Geometry.createFromGeom(geom, transform, range3d, this.elementId, displayParams, isCurved, /*this.iModel,*/ disjoint);
    if (!geometry) { return false; }
    geometry.clip = clip;
    if (this.geometries) { this.geometries.push_back(geometry); }
    return true;
  }
  public clear() { if (this.geometries) { this.geometries.clear(); } }

  public reInitialize(transform: Transform = Transform.createIdentity(), elemId: Id64 = new Id64(), surfacesOnly: boolean = false) {
    this.clear();
    this.transform = transform;
    this.elementId = elemId;
    this.surfacesOnly = surfacesOnly;
  }
}

export abstract class GeometryListBuilder extends GraphicBuilder {
  public accum?: GeometryAccumulator;
  public graphicParams: GraphicParams = new GraphicParams();
  private _geometryParams?: GeometryParams;
  public geometryParamsValid: boolean = false;
  // private _isOpen: boolean = false;

  public abstract finishGraphic(accum: GeometryAccumulator): Graphic; // Invoked by _Finish() to obtain the finished Graphic.

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

  public constructor(system: any /* should be System */, params: GraphicBuilderCreateParams, elemId: Id64 = new Id64(), accumulatorTf: Transform = Transform.createIdentity()) {
    super(params);
    if (params.iModel) {
      this.accum = new GeometryAccumulator(/*params.iModel,*/ system);
      this.accum.elementId = elemId;
      this.accum.transform = accumulatorTf;
    }
  }

  public _finish(): Graphic {
    if (!this.isOpen) {
      assert(false);
      return new Graphic();
    }
    const graphic: Graphic = this.accum ? this.finishGraphic(this.accum) : new Graphic();
    // assert(graphic.isValid()); // isValid function doesn't actually exist yet in Graphic class.
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
    if (this.accum) { this.accum.addCurveVector(curve, /*filled,*/ curve.isAnyRegionType() ? this.getMeshDisplayParams(filled) : this.getLinearDisplayParams(), this.localToWorldTransform, false, this.currClip); }
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
      if (this.accum) { this.accum.addCurveVector(curves, /*filled,*/ curves.isAnyRegionType() ? this.getMeshDisplayParams(filled) : this.getLinearDisplayParams(), this.localToWorldTransform, disjoint, this.currClip); }
    }
    let numDisjoint = 0;
    let haveContinuous = false;
    // NB: Somebody might stick a 'point' or point string into a curve vector with a boundary...
    // No idea what they expect us to do if it also contains continuous curves but it's dumb anyway.
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
      if (this.accum) { this.accum.addCurveVector(curves, /*filled,*/ curves.isAnyRegionType() ? this.getMeshDisplayParams(filled) : this.getLinearDisplayParams(), this.localToWorldTransform, haveDisjoint, this.currClip); }
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
    if (this.accum) { this.accum.addCurveVector(curves, /*false,*/ curves.isAnyRegionType() ? this.getMeshDisplayParams(filled) : this.getLinearDisplayParams(), this.localToWorldTransform, false, this.currClip); }
    if (this.accum) { this.accum.addCurveVector(disjointCurves, /*false,*/ curves.isAnyRegionType() ? this.getMeshDisplayParams(filled) : this.getLinearDisplayParams(), this.localToWorldTransform, true, this.currClip); }
  }
  public getGraphicParams(): GraphicParams { return this.graphicParams; }
  public get geometryParams(): GeometryParams | undefined { return this.geometryParamsValid ? this._geometryParams : undefined; }
  public get elementId(): Id64 { return this.accum ? this.accum.elementId : new Id64(); }

  // Commented out until DisplayParams, DisplayParamsCache, and DisplayParamsType are translated into TypeScript
  // public get displayParamsCache() { return this.accum.displayParamsCache; }
  // public getDisplayParams(type: DisplayParamsType, filled: boolean) { return this.accum.displayParamsCache.get(type, this.graphicParams, this.geometryParams, filled); }
  public getMeshDisplayParams(filled: boolean) { return filled; } // Commented out until DisplayParams is created // return this.displayParams(DisplatParamsType.Mesh, filled); }
  public getLinearDisplayParams() { return undefined; } // Commented out until DisplayParams is created // return this.displayParams(DisplatParamsType.Linear, false); }
  // public get textDisplayParams() { return this.displayParams(DisplatParamsType.Text, false); }

  // Commented out until System is translated into TypeScript
  // public get system() { return this.accum.system; }

  // Commented out until GeometryAccumulator.addGeometry() is translated into TypeScript
  // public add(geom: Geometry) { this.accum.addGeometry(geom); }

  public reInitialize(localToWorld: Transform, accumTf: Transform = Transform.createIdentity(), elemId: Id64 = new Id64()) {
    if (this.accum) this.accum.reInitialize(accumTf, elemId);
    this.activateGraphicParams(this.graphicParams);
    this.createParams.placement = localToWorld;
    this._isOpen = true;
    this.reset();
  }
}
