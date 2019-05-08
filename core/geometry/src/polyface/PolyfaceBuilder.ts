/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Polyface */

// import { Geometry, AxisOrder, Angle, AngleSweep, BSIJSONValues } from "./Geometry";
import { IndexedPolyface } from "./Polyface";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { Point2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d, XYZ } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { BoxTopology } from "./BoxTopology";
import { StrokeOptions } from "../curve/StrokeOptions";
import { GeometryQuery } from "../curve/GeometryQuery";
import { Cone } from "../solid/Cone";
import { CurveChain, CurveCollection } from "../curve/CurveCollection";

import { Sphere } from "../solid/Sphere";
import { TorusPipe } from "../solid/TorusPipe";
import { LinearSweep } from "../solid/LinearSweep";
import { RotationalSweep } from "../solid/RotationalSweep";
import { Box } from "../solid/Box";
import { RuledSweep } from "../solid/RuledSweep";
import { AnyCurve } from "../curve/CurveChain";
import { Geometry, AxisOrder } from "../Geometry";
import { LineString3d } from "../curve/LineString3d";
import { HalfEdgeGraph, HalfEdge, HalfEdgeToBooleanFunction } from "../topology/Graph";
import { NullGeometryHandler, UVSurface } from "../geometry3d/GeometryHandler";
import { GrowableXYArray } from "../geometry3d/GrowableXYArray";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { StrokeCountSection } from "../curve/Query/StrokeCountChain";
import { ParityRegion } from "../curve/ParityRegion";
import { Range1d } from "../geometry3d/Range";
import { ConstructCurveBetweenCurves } from "../curve/ConstructCurveBetweenCurves";
import { CylindricalRangeQuery } from "../curve/Query/CylindricalRange";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Segment1d } from "../geometry3d/Segment1d";
import { BilinearPatch } from "../geometry3d/BilinearPatch";

/* tslint:disable:variable-name prefer-for-of*/

/**
 * A FacetSector
 * * initially holds coordinate data for a place where xyz and sectionDerivative are known
 * * normal is computed as a deferred step using an edge to adjacent place on ruled surface
 * * indices are set up even later.
 */
class FacetSector {
  public xyz: Point3d;
  public xyzIndex: number;
  public normal?: Vector3d;
  public normalIndex: number;
  public uv?: Point2d;
  public uvIndex: number;
  public sectionDerivative?: Vector3d;
  public constructor(needNormal: boolean = false, needUV: boolean = false, needSectionDerivative: boolean = false) {
    this.xyz = Point3d.create();
    this.normalIndex = -1;
    this.uvIndex = -1;

    this.xyzIndex = -1;
    if (needNormal) {
      this.normal = Vector3d.create();
    }
    if (needUV) {
      this.uv = Point2d.create();
      this.uvIndex = -1;
    }
    if (needSectionDerivative) {
      this.sectionDerivative = Vector3d.create();
    }
  }
  /** copy contents (not pointers) from source
   * * ASSUME all fields defined in this are defined int the source (undefined check only needed on this)
   */
  public copyContentsFrom(other: FacetSector) {
    this.xyz.setFromPoint3d(other.xyz);
    this.xyzIndex = other.xyzIndex;
    if (this.normal)
      this.normal.setFromVector3d(other.normal!);
    this.normalIndex = other.normalIndex;
    if (this.uv)
      this.uv.setFrom(other.uv);
    this.uvIndex = other.uvIndex;
    if (this.sectionDerivative)
      this.sectionDerivative.setFrom(other.sectionDerivative!);
  }
  /** access xyz, derivative from given arrays.
   * * ASSUME corresponding defined conditions
   * * xyz and derivative are set.
   * * index fields for updated data are cleared to -1.
   */
  public loadIndexedPointAndDerivativeCoordinatesFromPackedArrays(i: number, packedXYZ: GrowableXYZArray, packedDerivatives?: GrowableXYZArray, fractions?: GrowableFloat64Array, v?: number) {
    packedXYZ.getPoint3dAtCheckedPointIndex(i, this.xyz);
    if (fractions && v !== undefined)
      this.uv = Point2d.create(fractions.atUncheckedIndex(i), v);
    this.xyzIndex = -1;
    this.normalIndex = -1;
    this.uvIndex = -1;
    if (this.sectionDerivative !== undefined && packedDerivatives !== undefined)
      packedDerivatives!.getVector3dAtCheckedVectorIndex(i, this.sectionDerivative);
  }
  private static suppressSmallUnitVectorComponents(uvw: XYZ) {
    const tol = 1.0e-15;
    if (Math.abs(uvw.x) < tol) uvw.x = 0.0;
    if (Math.abs(uvw.y) < tol) uvw.y = 0.0;
    if (Math.abs(uvw.z) < tol) uvw.z = 0.0;
  }
  private static _edgeVector: Vector3d = Vector3d.create();
  /**
   * given two sectors with xyz and sectionDerivative (u derivative)
   * use the edge from A to B as v direction in-surface derivative.
   * compute cross products (and normalize)
   * @param sectorA "lower" sector
   * @param sectorB "upper" sector
   *
   */
  public static computeNormalsAlongRuleLine(sectorA: FacetSector, sectorB: FacetSector) {
    // We expect that if sectionDerivative is defined so is normal.
    // (If not, the cross product calls will generate normals that are never used ..  not good, garbage collector will clean up.)
    if (sectorA.sectionDerivative && sectorB.sectionDerivative) {
      const vectorAB = FacetSector._edgeVector;
      Vector3d.createStartEnd(sectorA.xyz, sectorB.xyz, vectorAB);
      sectorA.sectionDerivative!.crossProduct(vectorAB, sectorA.normal);
      sectorB.sectionDerivative!.crossProduct(vectorAB, sectorB.normal);
      sectorA.normal!.normalizeInPlace();
      sectorB.normal!.normalizeInPlace();
      FacetSector.suppressSmallUnitVectorComponents(sectorA.normal!);
      FacetSector.suppressSmallUnitVectorComponents(sectorB.normal!);
    }
  }
}
/**
 * UVSurfaceOps is a class containing static methods operating on UVSurface objects.
 * @public
 */
export class UVSurfaceOps {
  private constructor() { }  // private constructor -- no instances.
  /**
   * * evaluate `numEdge+1` points at surface uv parameters interpolated between (u0,v0) and (u1,v1)
   * * accumulate the xyz in a linestring.
   * * If xyzToUV is given, also accumulate transformed values as surfaceUV
   * * use xyzToUserUV transform to convert xyz to uv stored in the linestring (this uv is typically different from surface uv -- e.g. torus cap plane coordintes)
   * @param surface
   * @param u0 u coordinate at start of parameter space line
   * @param v0 v coordinate at end of parameter space line
   * @param u1 u coordinate at start of parameter space line
   * @param v1 v coordinate at end of parameter space line
   * @param numEdge number of edges.   (`numEdge+1` points are evaluated)
   * @param saveUV if true, save each surface uv fractions with `linestring.addUVParamsAsUV (u,v)`
   * @param saveFraction if true, save each fractional coordinate (along the u,v line) with `linestring.addFraction (fraction)`
   *
   * @param xyzToUV
   */
  public static createLinestringOnUVLine(
    surface: UVSurface,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    numEdge: number,
    saveUV: boolean = false,
    saveFraction: boolean = false): LineString3d {

    const ls = LineString3d.create();
    const xyz = Point3d.create();
    let fraction, u, v;
    const numEvaluate = numEdge + 1;
    for (let i = 0; i < numEvaluate; i++) {
      fraction = i / numEdge;
      u = Geometry.interpolate(u0, fraction, u1);
      v = Geometry.interpolate(v0, fraction, v1);
      surface.uvFractionToPoint(u, v, xyz);
      ls.addPoint(xyz);
      if (saveUV)
        ls.addUVParamAsUV(u, v);
      if (saveFraction)
        ls.addFraction(fraction);
    }
    return ls;
  }
}
/**
 *
 * * Simple construction for strongly typed GeometryQuery objects:
 *
 *  * Create a builder with `builder = PolyfaceBuilder.create()`
 *  * Add GeemotryQuery objects:
 *
 *    * `builder.addGeometryQuery(g: GeometryQuery)`
 *    * `builder.addCone(cone: Cone)`
 *    * `builder.addTorusPipe(surface: TorusPipe)`
 *    * `builder.addLinearSweepLineStrings(surface: LinearSweep)`
 *    * `builder.addRotationalSweep(surface: RotatationalSweep)`
 *    * `builder.addLinearSweep(surface: LinearSweep)`
 *    * `builder.addRuledSweep(surface: RuledSweep)`
 *    * `builder.addSphere(sphere: Sphere)`
 *    * `builder.addBox(box: Box)`
 *    * `buidler.addIndexedPolyface(polyface)`
 *  *  Extract with `builder.claimPolyface (true)`
 *
 * * Simple construction for ephemeral constructive data:
 *
 *  * Create a builder with `builder = PolyfaceBuilder.create()`
 *  * Add from fragmentary data:
 *    * `builder.addBetweenLineStrings (linestringA, linestringB, addClosure)`
 *    * `builder.addBetweenTransformedLineStrings (curves, transformA, transformB, addClosure)`
 *    * `builder.addBetweenStroked (curveA, curveB)`
 *    * `builder.addLinearSweepLineStrigns (contour, vector)`
 *    * `builder.addPolygon (points, numPointsToUse)`
 *    * `builder.addTransformedUnitBox (transform)`
 *    * `builder.addTriangleFan (conePoint, linestring, toggleOrientation)`
 *    * `builder.addTrianglesInUnchedkedPolygon (linestring, toggle)`
 *    * `builder.addUVGrid(surface,numU, numV, createFanInCaps)`
 *    * `builder.addGraph(Graph, acceptFaceFunction)`
 *  *  Extract with `builder.claimPolyface(true)`
 *
 * * Low-level detail construction -- direct use of indices
 *  * Create a builder with `builder = PolyfaceBuilder.create()`
 *  * Add GeometryQuery objects
 *    * `builder.findOrAddPoint(point)`
 *    * `builder.findOrAddPointInLineString (linestring, index)`
 *    * `builder.findorAddTransformedPointInLineString(linestring, index, transform)`
 *    * `builder.findOrAddPointXYZ(x,y,z)`
 *    * `builder.addTriangle (point0, point1, point2)`
 *    * `builder.addQuad (point0, point1, point2, point3)`
 *    * `builder.addOneBasedPointIndex (index)`
 * @public
 */
export class PolyfaceBuilder extends NullGeometryHandler {
  private _polyface: IndexedPolyface;
  private _options: StrokeOptions;
  /** return (pointer to) the `StrokeOptions` in use by the builder. */
  public get options(): StrokeOptions { return this._options; }
  // State data that affects the current construction.
  private _reversed: boolean;
  /** extract the polyface. */
  public claimPolyface(compress: boolean = true): IndexedPolyface {
    if (compress)
      this._polyface.data.compress();
    return this._polyface;
  }
  /** Toggle (reverse) the flag controlling orientation flips for newly added facets. */
  public toggleReversedFacetFlag() { this._reversed = !this._reversed; }

  private constructor(options?: StrokeOptions) {
    super();
    this._options = options ? options : StrokeOptions.createForFacets();
    this._polyface = IndexedPolyface.create(this._options.needNormals,
      this._options.needParams, this._options.needColors);
    this._reversed = false;
  }
  /**
   * Create a builder with given StrokeOptions
   * @param options StrokeOptions (captured)
   */
  public static create(options?: StrokeOptions): PolyfaceBuilder {
    return new PolyfaceBuilder(options);
  }
  /** add facets for a transformed unit box. */
  public addTransformedUnitBox(transform: Transform) {
    const pointIndex0 = this._polyface.data.pointCount;
    // these will have sequential indices starting at pointIndex0 . . .
    for (const p of BoxTopology.points)
      this._polyface.addPoint(transform.multiplyPoint3d(p));

    for (const facet of BoxTopology.cornerIndexCCW) {
      for (const pointIndex of facet)
        this._polyface.addPointIndex(pointIndex0 + pointIndex);
      this._polyface.terminateFacet();
    }
  }

  /** Add triangles from points[0] to each far edge.
   * @param ls linestring with point coordinates
   * @param toggle if true, wrap the triangle creation in toggleReversedFacetFlag.
   */
  public addTriangleFan(conePoint: Point3d, ls: LineString3d, toggle: boolean): void {
    const n = ls.numPoints();
    if (n > 2) {
      if (toggle)
        this.toggleReversedFacetFlag();
      const index0 = this.findOrAddPoint(conePoint);
      let index1 = this.findOrAddPointInLineString(ls, 0)!;
      let index2 = 0;
      for (let i = 1; i < n; i++) {
        index2 = this.findOrAddPointInLineString(ls, i)!;
        this.addIndexedTrianglePointIndexes(index0, index1, index2);
        index1 = index2;
      }
      if (toggle)
        this.toggleReversedFacetFlag();
    }
  }

  /** Add triangles from points[0] to each far edge
   * * Assume the polygon is convex.
   * * i.e. simple triangulation from point0
   * * i.e. simple cross products give a good normal.
   * @param ls linestring with point coordinates
   * @param reverse if true, wrap the triangle creation in toggleReversedFacetFlag.
   */
  public addTrianglesInUncheckedConvexPolygon(ls: LineString3d, toggle: boolean): void {
    const n = ls.numPoints();
    if (n > 2) {
      if (toggle)
        this.toggleReversedFacetFlag();
      let normal;
      let normalIndex;
      if (this._options.needNormals) {
        normal = ls.quickUnitNormal(PolyfaceBuilder._workVectorFindOrAdd)!;
        if (toggle)
          normal.scaleInPlace(-1.0);
        normalIndex = this._polyface.addNormal(normal);
      }
      const needParams = this._options.needParams;

      const packedUV = needParams ? ls.packedUVParams : undefined;
      let paramIndex0 = -1;
      let paramIndex1 = -1;
      let paramIndex2 = -1;
      if (packedUV) {
        paramIndex0 = this.findOrAddParamInGrowableXYArray(packedUV, 0)!;
        paramIndex1 = this.findOrAddParamInGrowableXYArray(packedUV, 1)!;
      }
      const pointIndex0 = this.findOrAddPointInLineString(ls, 0)!;
      let pointIndex1 = this.findOrAddPointInLineString(ls, 1)!;
      let pointIndex2 = 0;
      let numEdge = n;
      if (ls.isPhysicallyClosed)
        numEdge--;
      for (let i = 2; i < numEdge; i++ , pointIndex1 = pointIndex2, paramIndex1 = paramIndex2) {
        pointIndex2 = this.findOrAddPointInLineString(ls, i)!;
        this.addIndexedTrianglePointIndexes(pointIndex0, pointIndex1, pointIndex2, false);
        if (normalIndex !== undefined)
          this.addIndexedTriangleNormalIndexes(normalIndex, normalIndex, normalIndex);
        if (packedUV) {
          paramIndex2 = this.findOrAddParamInGrowableXYArray(packedUV, i)!;
          this.addIndexedTriangleParamIndexes(paramIndex0, paramIndex1, paramIndex2);
        }
        this._polyface.terminateFacet();
      }
      if (toggle)
        this.toggleReversedFacetFlag();
    }
  }

  /**
   * Announce point coordinates.  The implemetation is free to either create a new point or (if known) return indxex of a prior point with the same coordinates.
   */
  public findOrAddPoint(xyz: Point3d): number {
    return this._polyface.addPoint(xyz);
  }

  /**
   * Announce point coordinates.  The implemetation is free to either create a new param or (if known) return indxex of a prior param with the same coordinates.
   */
  public findOrAddParamXY(x: number, y: number): number {
    return this._polyface.addParamXY(x, y);
  }
  private static _workPointFindOrAddA = Point3d.create();
  private static _workVectorFindOrAdd = Vector3d.create();
  private static _workUVFindOrAdd = Point2d.create();
  /**
   * Announce point coordinates.  The implemetation is free to either create a new point or (if knonw) return indxex of a prior point with the same coordinates.
   * @returns Returns the point index in the Polyface.
   * @param index Index of the point in the linestring.
   */
  public findOrAddPointInLineString(ls: LineString3d, index: number, transform?: Transform, priorIndex?: number): number | undefined {
    const q = ls.pointAt(index, PolyfaceBuilder._workPointFindOrAddA);
    if (q) {
      if (transform)
        transform.multiplyPoint3d(q, q);
      return this._polyface.addPoint(q, priorIndex);
    }
    return undefined;
  }

  /**
   * Announce param coordinates.  The implemetation is free to either create a new param or (if knonw) return indxex of a prior point with the same coordinates.
   * @returns Returns the point index in the Polyface.
   * @param index Index of the param in the linestring.
   */
  public findOrAddParamInGrowableXYArray(data: GrowableXYArray, index: number): number | undefined {
    if (!data)
      return undefined;
    const q = data.getPoint2dAtUncheckedPointIndex(index, PolyfaceBuilder._workUVFindOrAdd);
    if (q) {
      return this._polyface.addParam(q);
    }
    return undefined;
  }
  /**
   * Announce param coordinates, taking u from ls.fractions and v from parameter.  The implemetation is free to either create a new param or (if knonw) return indxex of a prior point with the same coordinates.
   * @returns Returns the point index in the Polyface.
   * @param index Index of the point in the linestring.
   */
  public findOrAddParamInLineString(ls: LineString3d, index: number, v: number, priorIndexA?: number, priorIndexB?: number): number | undefined {
    const u = (ls.fractions && index < ls.fractions.length) ? ls.fractions.atUncheckedIndex(index) : index / ls.points.length;
    return this._polyface.addParamUV(u, v, priorIndexA, priorIndexB);
  }

  /**
   * Announce normal coordinates found at index in the linestring's surfaceNormal array
   * @returns Returns the point index in the Polyface.
   * @param index Index of the point in the linestring.
   * @param priorIndex possible prior normal index to reuse
   */
  public findOrAddNormalnLineString(ls: LineString3d, index: number, transform?: Transform, priorIndexA?: number, priorIndexB?: number): number | undefined {
    const linestringNormals = ls.packedSurfaceNormals;
    if (linestringNormals) {
      const q = linestringNormals.getVector3dAtCheckedVectorIndex(index, PolyfaceBuilder._workVectorFindOrAdd);
      if (q) {
        if (transform)
          transform.multiplyVector(q, q);
        return this._polyface.addNormal(q, priorIndexA, priorIndexB);
      }
    }
    return undefined;

  }

  /**
   * Announce point coordinates.  The implemetation is free to either create a new point or (if known) return index of a prior point with the same coordinates.
   */
  public findOrAddPointXYZ(x: number, y: number, z: number): number {
    return this._polyface.addPointXYZ(x, y, z);
  }

  /** Returns a transform who can be applied to points on a triangular facet in order to obtain UV parameters. */
  private getUVTransformForTriangleFacet(pointA: Point3d, pointB: Point3d, pointC: Point3d): Transform | undefined {
    const vectorAB = pointA.vectorTo(pointB);
    const vectorAC = pointA.vectorTo(pointC);
    const unitAxes = Matrix3d.createRigidFromColumns(vectorAB, vectorAC, AxisOrder.XYZ);
    const localToWorld = Transform.createOriginAndMatrix(pointA, unitAxes);
    return localToWorld.inverse();
  }

  /** Returns the normal to a triangular facet. */
  private getNormalForTriangularFacet(pointA: Point3d, pointB: Point3d, pointC: Point3d): Vector3d {
    const vectorAB = pointA.vectorTo(pointB);
    const vectorAC = pointA.vectorTo(pointC);
    let normal = vectorAB.crossProduct(vectorAC).normalize();
    normal = normal ? normal : Vector3d.create();
    return normal;
  }

  // ###: Consider case where normals will be reversed and point through the other end of the facet
  /**
   * Add a quad to the polyface given its points in order around the edges.
   * Optionally provide params and the plane normal, otherwise they will be calculated without reference data.
   * Optionally mark this quad as the last piece of a face in this polyface.
   */
  public addQuadFacet(points: Point3d[] | GrowableXYZArray, params?: Point2d[], normals?: Vector3d[]) {
    if (points instanceof GrowableXYZArray)
    points = points.getPoint3dArray ();
    // If params and/or normals are needed, calculate them first
    const needParams = this.options.needParams;
    const needNormals = this.options.needNormals;
    let param0: Point2d, param1: Point2d, param2: Point2d, param3: Point2d;
    let normal0: Vector3d, normal1: Vector3d, normal2: Vector3d, normal3: Vector3d;
    if (needParams) {
      if (params !== undefined && params.length > 3) {
        param0 = params[0];
        param1 = params[1];
        param2 = params[2];
        param3 = params[3];
      } else {
        const paramTransform = this.getUVTransformForTriangleFacet(points[0], points[1], points[2]);
        if (paramTransform === undefined) {
          param0 = param1 = param2 = param3 = Point2d.createZero();
        } else {
          param0 = Point2d.createFrom(paramTransform.multiplyPoint3d(points[0]));
          param1 = Point2d.createFrom(paramTransform.multiplyPoint3d(points[1]));
          param2 = Point2d.createFrom(paramTransform.multiplyPoint3d(points[2]));
          param3 = Point2d.createFrom(paramTransform.multiplyPoint3d(points[3]));
        }
      }
    }
    if (needNormals) {
      if (normals !== undefined && normals.length > 3) {
        normal0 = normals[0];
        normal1 = normals[1];
        normal2 = normals[2];
        normal3 = normals[3];
      } else {
        normal0 = this.getNormalForTriangularFacet(points[0], points[1], points[2]);
        normal1 = this.getNormalForTriangularFacet(points[0], points[1], points[2]);
        normal2 = this.getNormalForTriangularFacet(points[0], points[1], points[2]);
        normal3 = this.getNormalForTriangularFacet(points[0], points[1], points[2]);
      }
    }

    if (this._options.shouldTriangulate) {
      // Add as two triangles, with a diagonal along the shortest distance
      const vectorAC = points[0].vectorTo(points[2]);
      const vectorBD = points[1].vectorTo(points[3]);

      // Note: We pass along any values for normals or params that we calculated
      if (vectorAC.magnitude() >= vectorBD.magnitude()) {
        this.addTriangleFacet([points[0], points[1], points[2]], needParams ? [param0!, param1!, param2!] : undefined, needNormals ? [normal0!, normal1!, normal2!] : undefined);
        this.addTriangleFacet([points[0], points[2], points[3]], needParams ? [param0!, param2!, param3!] : undefined, needNormals ? [normal0!, normal2!, normal3!] : undefined);
      } else {
        this.addTriangleFacet([points[0], points[1], points[3]], needParams ? [param0!, param1!, param3!] : undefined, needNormals ? [normal0!, normal1!, normal3!] : undefined);
        this.addTriangleFacet([points[1], points[2], points[3]], needParams ? [param1!, param2!, param3!] : undefined, needNormals ? [normal1!, normal2!, normal3!] : undefined);
      }
      return;
    }

    let idx0, idx1, idx2, idx3;

    // Add params if needed
    if (needParams) {
      idx0 = this._polyface.addParam(param0!);
      idx1 = this._polyface.addParam(param1!);
      idx2 = this._polyface.addParam(param2!);
      idx3 = this._polyface.addParam(param3!);
      this.addIndexedQuadParamIndexes(idx0, idx1, idx3, idx2);
    }

    // Add normals if needed
    if (needNormals) {
      idx0 = this._polyface.addNormal(normal0!);
      idx1 = this._polyface.addNormal(normal1!);
      idx2 = this._polyface.addNormal(normal2!);
      idx3 = this._polyface.addNormal(normal3!);
      this.addIndexedQuadNormalIndexes(idx0, idx1, idx3, idx2);
    }

    // Add point and point indexes last (terminates the facet)
    idx0 = this.findOrAddPoint(points[0]);
    idx1 = this.findOrAddPoint(points[1]);
    idx2 = this.findOrAddPoint(points[2]);
    idx3 = this.findOrAddPoint(points[3]);
    this.addIndexedQuadPointIndexes(idx0, idx1, idx3, idx2);
  }

  /** Announce a single quad facet's point indexes.
   *
   * * The actual quad may be reversed or trianglulated based on builder setup.
   * *  indexA0 and indexA1 are in the forward order at the "A" end of the quad
   * *  indexB0 and indexB1 are in the forward order at the "B" end of the quad.
   */
  private addIndexedQuadPointIndexes(indexA0: number, indexA1: number, indexB0: number, indexB1: number, terminate: boolean = true) {
    if (this._reversed) {
      this._polyface.addPointIndex(indexA0);
      this._polyface.addPointIndex(indexB0);
      this._polyface.addPointIndex(indexB1);
      this._polyface.addPointIndex(indexA1);
    } else {
      this._polyface.addPointIndex(indexA0);
      this._polyface.addPointIndex(indexA1);
      this._polyface.addPointIndex(indexB1);
      this._polyface.addPointIndex(indexB0);
    }
    if (terminate)
      this._polyface.terminateFacet();
  }

  /** For a single quad facet, add the indexes of the corresponding param points. */
  private addIndexedQuadParamIndexes(indexA0: number, indexA1: number, indexB0: number, indexB1: number) {
    if (this._reversed) {
      this._polyface.addParamIndex(indexA0);
      this._polyface.addParamIndex(indexB0);
      this._polyface.addParamIndex(indexB1);
      this._polyface.addParamIndex(indexA1);
    } else {
      this._polyface.addParamIndex(indexA0);
      this._polyface.addParamIndex(indexA1);
      this._polyface.addParamIndex(indexB1);
      this._polyface.addParamIndex(indexB0);
    }
  }

  /** For a single quad facet, add the indexes of the corresponding normal vectors. */
  private addIndexedQuadNormalIndexes(indexA0: number, indexA1: number, indexB0: number, indexB1: number) {
    if (this._reversed) {
      this._polyface.addNormalIndex(indexA0);
      this._polyface.addNormalIndex(indexB0);
      this._polyface.addNormalIndex(indexB1);
      this._polyface.addNormalIndex(indexA1);
    } else {
      this._polyface.addNormalIndex(indexA0);
      this._polyface.addNormalIndex(indexA1);
      this._polyface.addNormalIndex(indexB1);
      this._polyface.addNormalIndex(indexB0);
    }
  }

  // ### TODO: Consider case where normals will be reversed and point through the other end of the facet
  /**
   * Add a triangle to the polyface given its points in order around the edges.
   * * Optionally provide params and triangle normals, otherwise they will be calculated without reference data.
   */
  public addTriangleFacet(points: Point3d[] | GrowableXYZArray, params?: Point2d[], normals?: Vector3d[]) {
    if (points.length < 3)
      return;
    let idx0: number;
    let idx1: number;
    let idx2: number;
    let point0, point1, point2;
    if (points instanceof GrowableXYZArray) {
      point0 = points.getPoint3dAtCheckedPointIndex(0)!;
      point1 = points.getPoint3dAtCheckedPointIndex(1)!;
      point2 = points.getPoint3dAtCheckedPointIndex(2)!;
    } else {
      point0 = points[0];
      point1 = points[1];
      point2 = points[2];
    }

    // Add params if needed
    if (this._options.needParams) {
      if (params && params.length >= 3) { // Params were given
        idx0 = this._polyface.addParam(params[0]);
        idx1 = this._polyface.addParam(params[1]);
        idx2 = this._polyface.addParam(params[2]);
      } else {  // Compute params
        const paramTransform = this.getUVTransformForTriangleFacet(point0, point1, point2);
        idx0 = this._polyface.addParam(Point2d.createFrom(paramTransform ? paramTransform.multiplyPoint3d(point0) : undefined));
        idx1 = this._polyface.addParam(Point2d.createFrom(paramTransform ? paramTransform.multiplyPoint3d(point1) : undefined));
        idx2 = this._polyface.addParam(Point2d.createFrom(paramTransform ? paramTransform.multiplyPoint3d(point1) : undefined));
      }
      this.addIndexedTriangleParamIndexes(idx0, idx1, idx2);
    }

    // Add normals if needed
    if (this._options.needNormals) {
      if (normals !== undefined && normals.length > 2) { // Normals were given
        idx0 = this._polyface.addNormal(normals[0]);
        idx1 = this._polyface.addNormal(normals[1]);
        idx2 = this._polyface.addNormal(normals[2]);
      } else {  // Compute normals
        const normal = this.getNormalForTriangularFacet(point0, point1, point2);
        idx0 = this._polyface.addNormal(normal);
        idx1 = this._polyface.addNormal(normal);
        idx2 = this._polyface.addNormal(normal);
      }
      this.addIndexedTriangleNormalIndexes(idx0, idx1, idx2);
    }

    // Add point and point indexes last (terminates the facet)
    idx0 = this.findOrAddPoint(point0);
    idx1 = this.findOrAddPoint(point1);
    idx2 = this.findOrAddPoint(point2);
    this.addIndexedTrianglePointIndexes(idx0, idx1, idx2);
  }

  /** Announce a single triangle facet's point indexes.
   *
   * * The actual quad may be reversed or trianglulated based on builder setup.
   * *  indexA0 and indexA1 are in the forward order at the "A" end of the quad
   * *  indexB0 and indexB1 are in the forward order at the "B" end of hte quad.
   */
  private addIndexedTrianglePointIndexes(indexA: number, indexB: number, indexC: number, terminateFacet: boolean = true) {
    if (!this._reversed) {
      this._polyface.addPointIndex(indexA);
      this._polyface.addPointIndex(indexB);
      this._polyface.addPointIndex(indexC);
    } else {
      this._polyface.addPointIndex(indexA);
      this._polyface.addPointIndex(indexC);
      this._polyface.addPointIndex(indexB);
    }
    if (terminateFacet)
      this._polyface.terminateFacet();
  }

  /** For a single triangle facet, add the indexes of the corresponding params. */
  private addIndexedTriangleParamIndexes(indexA: number, indexB: number, indexC: number) {
    if (!this._reversed) {
      this._polyface.addParamIndex(indexA);
      this._polyface.addParamIndex(indexB);
      this._polyface.addParamIndex(indexC);
    } else {
      this._polyface.addParamIndex(indexA);
      this._polyface.addParamIndex(indexC);
      this._polyface.addParamIndex(indexB);
    }
  }

  /** For a single triangle facet, add the indexes of the corresponding params. */
  private addIndexedTriangleNormalIndexes(indexA: number, indexB: number, indexC: number) {
    if (!this._reversed) {
      this._polyface.addNormalIndex(indexA);
      this._polyface.addNormalIndex(indexB);
      this._polyface.addNormalIndex(indexC);
    } else {
      this._polyface.addNormalIndex(indexA);
      this._polyface.addNormalIndex(indexC);
      this._polyface.addNormalIndex(indexB);
    }
  }
  /** Find or add xyzIndex and normalIndex for coordinates in the sector. */
  private setSectorIndices(sector: FacetSector) {
    sector.xyzIndex = this.findOrAddPoint(sector.xyz);
    if (sector.normal)
      sector.normalIndex = this._polyface.addNormal(sector.normal);
    if (sector.uv)
      sector.uvIndex = this._polyface.addParam(sector.uv);
  }
  private addSectorQuadA01B01(sectorA0: FacetSector, sectorA1: FacetSector, sectorB0: FacetSector, sectorB1: FacetSector) {
    if (sectorA0.xyz.isAlmostEqual(sectorA1.xyz) && sectorB0.xyz.isAlmostEqual(sectorB1.xyz)) {
      // ignore null quad !!
    } else {
      if (this._options.needNormals)
        this.addIndexedQuadNormalIndexes(sectorA0.normalIndex, sectorA1.normalIndex, sectorB0.normalIndex, sectorB1.normalIndex);
      if (this._options.needParams)
        this.addIndexedQuadParamIndexes(sectorA0.uvIndex, sectorA1.uvIndex, sectorB0.uvIndex, sectorB1.uvIndex);
      this.addIndexedQuadPointIndexes(sectorA0.xyzIndex, sectorA1.xyzIndex, sectorB0.xyzIndex, sectorB1.xyzIndex);
      this._polyface.terminateFacet();

    }

  }
  /** Add facets betwee lineStrings with matched point counts.
   * * surface normals are computed from (a) curve tangents in the linestrings and (b)rule line between linestrings.
   * * Facets are announced to addIndexedQuad.
   * * addIndexedQuad is free to apply reversal or triangulation options.
   */
  public addBetweenLineStringsWithRuleEdgeNormals(lineStringA: LineString3d, vA: number, lineStringB: LineString3d, vB: number, addClosure: boolean = false) {
    const pointA = lineStringA.packedPoints;
    const pointB = lineStringB.packedPoints;
    const derivativeA = lineStringA.packedDerivatives;
    const derivativeB = lineStringB.packedDerivatives;
    const fractionA = lineStringA.fractions;
    const fractionB = lineStringB.fractions;
    const needNormals = this._options.needNormals;
    const needParams = this._options.needParams;
    const sectorA0 = new FacetSector(needNormals, needParams, needNormals);
    const sectorA1 = new FacetSector(needNormals, needParams, needNormals);
    const sectorB0 = new FacetSector(needNormals, needParams, needNormals);
    const sectorB1 = new FacetSector(needNormals, needParams, needNormals);
    const sectorA00 = new FacetSector(needNormals, needParams, needNormals);
    const sectorB00 = new FacetSector(needNormals, needParams, needNormals);

    const numPoints = pointA.length;
    if (numPoints < 2 || numPoints !== pointB.length) return;
    sectorA0.loadIndexedPointAndDerivativeCoordinatesFromPackedArrays(0, pointA, derivativeA, fractionA, vA);
    sectorB0.loadIndexedPointAndDerivativeCoordinatesFromPackedArrays(0, pointB, derivativeB, fractionB, vB);
    if (needNormals)
      FacetSector.computeNormalsAlongRuleLine(sectorA0, sectorB0);
    this.setSectorIndices(sectorA0);
    this.setSectorIndices(sectorB0);

    sectorA00.copyContentsFrom(sectorA0);
    sectorB00.copyContentsFrom(sectorB0);
    for (let i = 1; i < numPoints; i++) {
      sectorA1.loadIndexedPointAndDerivativeCoordinatesFromPackedArrays(i, pointA, derivativeA, fractionA, vA);
      sectorB1.loadIndexedPointAndDerivativeCoordinatesFromPackedArrays(i, pointB, derivativeA, fractionB, vB);
      FacetSector.computeNormalsAlongRuleLine(sectorA1, sectorB1);
      this.setSectorIndices(sectorA1);
      this.setSectorIndices(sectorB1);
      // create the facet ...
      this.addSectorQuadA01B01(sectorA0, sectorA1, sectorB0, sectorB1);
      sectorA0.copyContentsFrom(sectorA1);
      sectorB0.copyContentsFrom(sectorB1);
    }
    if (addClosure)
      this.addSectorQuadA01B01(sectorA0, sectorA00, sectorB0, sectorB00);
  }

  /** Add facets betwee lineStrings with matched point counts.
   * * point indices prestored
   * * normal indices prestored
   * * uv indices prestored
   */
  public addBetweenLineStringsWithStoredIndices(lineStringA: LineString3d, lineStringB: LineString3d) {
    const pointA = lineStringA.pointIndices!;
    const pointB = lineStringB.pointIndices!;
    let normalA: GrowableFloat64Array | undefined = lineStringA.normalIndices;
    let normalB: GrowableFloat64Array | undefined = lineStringB.normalIndices;
    if (!this._options.needNormals) {
      normalA = undefined;
      normalB = undefined;
    }
    let paramA: GrowableFloat64Array | undefined = lineStringA.paramIndices;
    let paramB: GrowableFloat64Array | undefined = lineStringB.paramIndices;
    if (!this._options.needParams) {
      paramA = undefined;
      paramB = undefined;
    }

    const numPoints = pointA.length;
    for (let i = 1; i < numPoints; i++) {
      if (pointA.atUncheckedIndex(i - 1) !== pointA.atUncheckedIndex(i) || pointB.atUncheckedIndex(i - 1) !== pointB.atUncheckedIndex(i)) {
        this.addIndexedQuadPointIndexes(pointA.atUncheckedIndex(i - 1), pointA.atUncheckedIndex(i), pointB.atUncheckedIndex(i - 1), pointB.atUncheckedIndex(i));
        if (normalA && normalB)
          this.addIndexedQuadNormalIndexes(normalA.atUncheckedIndex(i - 1), normalA.atUncheckedIndex(i), normalB.atUncheckedIndex(i - 1), normalB.atUncheckedIndex(i));
        if (paramA && paramB)
          this.addIndexedQuadParamIndexes(paramA.atUncheckedIndex(i - 1), paramA.atUncheckedIndex(i), paramB.atUncheckedIndex(i - 1), paramB.atUncheckedIndex(i));
        this._polyface.terminateFacet();
      }
    }
  }

  /** Add facets betwee lineStrings with matched point counts.
   *
   * * Facets are announced to addIndexedQuad.
   * * addIndexedQuad is free to apply reversal or triangulation options.
   */
  public addBetweenTransformedLineStrings(curves: AnyCurve, transformA: Transform, transformB: Transform, addClosure: boolean = false) {
    if (curves instanceof LineString3d) {
      const pointA = curves.points;
      const numPoints = pointA.length;
      let indexA0 = this.findOrAddPointInLineString(curves, 0, transformA)!;
      let indexB0 = this.findOrAddPointInLineString(curves, 0, transformB)!;
      const indexA00 = indexA0;
      const indexB00 = indexB0;
      let indexA1 = 0;
      let indexB1 = 0;
      for (let i = 1; i < numPoints; i++) {
        indexA1 = this.findOrAddPointInLineString(curves, i, transformA)!;
        indexB1 = this.findOrAddPointInLineString(curves, i, transformB)!;
        this.addIndexedQuadPointIndexes(indexA0, indexA1, indexB0, indexB1);
        indexA0 = indexA1;
        indexB0 = indexB1;
      }
      if (addClosure)
        this.addIndexedQuadPointIndexes(indexA0, indexA00, indexB0, indexB00);
    } else {
      const children = curves.children;
      // just send the children individually -- final compres will fix things??
      if (children)
        for (const c of children) {
          this.addBetweenTransformedLineStrings(c as AnyCurve, transformA, transformB);
        }
    }
  }

  private addBetweenStrokeSetPair(dataA: AnyCurve, vA: number, dataB: AnyCurve, vB: number) {
    if (dataA instanceof LineString3d && dataB instanceof LineString3d) {
      this.addBetweenLineStringsWithRuleEdgeNormals(dataA, vA, dataB, vB, false);
    } else if (dataA instanceof ParityRegion && dataB instanceof ParityRegion) {
      if (dataA.children.length === dataB.children.length) {
        for (let i = 0; i < dataA.children.length; i++) {
          this.addBetweenStrokeSetPair(dataA.children[i], vA, dataB.children[i], vB);
        }
      }
    } else if (dataA instanceof CurveChain && dataB instanceof CurveChain) {
      const chainA = dataA.children;
      const chainB = dataB.children;
      if (chainA.length === chainB.length) {
        for (let i = 0; i < chainA.length; i++) {
          const cpA = chainA[i];
          const cpB = chainB[i];
          if (cpA instanceof LineString3d && cpB instanceof LineString3d) {
            this.addBetweenLineStringsWithRuleEdgeNormals(cpA, vA, cpB, vB);
          }
        }
      }
    }
  }
  /**
   *
   * @param cone cone to facet
   * @param strokeCount number of strokes around the cone.  If present, it overrides size-based stroking.
   */
  public addCone(cone: Cone) {
    // ensure identical stroke counts at each end . . .
    let strokeCount = 16;
    if (this._options)
      strokeCount = this._options.applyTolerancesToArc(cone.getMaxRadius());
    let axisStrokeCount = 1;
    const lineStringA = cone.strokeConstantVSection(0.0, strokeCount, this._options);
    const lineStringB = cone.strokeConstantVSection(1.0, strokeCount, this._options);

    if (this._options) {
      const vDistanceRange = GrowableXYZArray.distanceRangeBetweenCorrespondingPoints(lineStringA.packedPoints, lineStringB.packedPoints);
      axisStrokeCount = this._options.applyMaxEdgeLength(1, vDistanceRange.low);
    }
    const sizes = cone.maxIsoParametricDistance();
    this.addUVGridBody(cone, strokeCount, axisStrokeCount, Segment1d.create(0, sizes.x), Segment1d.create(0, sizes.y));
    this.endFace();

    if (cone.capped) {
      if (!Geometry.isSmallMetricDistance(cone.getRadiusA())) {
        this.addTrianglesInUncheckedConvexPolygon(lineStringA, true);  // lower triangles flip
        this.endFace();
      }
      if (!Geometry.isSmallMetricDistance(cone.getRadiusB())) {
        this.addTrianglesInUncheckedConvexPolygon(lineStringB, false); // upper triangles to not flip.
        this.endFace();
      }
    }
  }

  /**
   *
   * @param surface TorusPipe to facet
   * @param strokeCount number of strokes around the cone.  If omitted, use the strokeOptions previously supplied to the builder.
   */
  public addTorusPipe(surface: TorusPipe, phiStrokeCount?: number, thetaStrokeCount?: number) {
    const thetaFraction = surface.getThetaFraction();
    const numU = Geometry.clamp(Geometry.resolveNumber(phiStrokeCount, 8), 4, 64);
    const numV = Geometry.clamp(
      Geometry.resolveNumber(thetaStrokeCount, Math.ceil(16 * thetaFraction)),
      2, 64);

    this.toggleReversedFacetFlag();
    const sizes = surface.maxIsoParametricDistance();
    this.addUVGridBody(surface, numU, numV, Segment1d.create(0, sizes.x), Segment1d.create(0, sizes.y));
    this.toggleReversedFacetFlag();

    if (surface.capped && thetaFraction < 1.0) {
      const centerFrame = surface.getConstructiveFrame()!;
      const minorRadius = surface.getMinorRadius();
      const majorRadius = surface.getMajorRadius();
      const a = 2 * minorRadius;
      const r0 = majorRadius - minorRadius;
      const r1 = majorRadius + minorRadius;
      const z0 = -minorRadius;
      const cap0ToLocal = Transform.createRowValues(
        a, 0, 0, r0,
        0, 0, -1, 0,
        0, a, 0, z0);
      const cap0ToWorld = centerFrame.multiplyTransformTransform(cap0ToLocal);
      const worldToCap0 = cap0ToWorld.inverse();
      if (worldToCap0) {
        const ls0 = UVSurfaceOps.createLinestringOnUVLine(surface, 0, 0, 1, 0, numU, false, true);
        ls0.computeUVFromXYZTransform(worldToCap0);
        this.addTrianglesInUncheckedConvexPolygon(ls0, false);
      }
      const thetaRadians = surface.getSweepAngle().radians;
      const cc = Math.cos(thetaRadians);
      const ss = Math.sin(thetaRadians);

      const cap1ToLocal = Transform.createRowValues(
        -cc * a, 0, -ss, r1 * cc,
        -ss * a, 0, cc, r1 * ss,
        0, a, 0, z0);

      const cap1ToWorld = centerFrame.multiplyTransformTransform(cap1ToLocal);
      const worldToCap1 = cap1ToWorld.inverse();
      if (worldToCap1) {
        const ls1 = UVSurfaceOps.createLinestringOnUVLine(surface, 1, 1, 0, 1, numU, false, true);
        ls1.computeUVFromXYZTransform(worldToCap1);
        this.addTrianglesInUncheckedConvexPolygon(ls1, false);
      }

    }
  }

  /**
   *
   * @param vector sweep vector
   * @param contour contour which contains only linestrings
   */
  public addLinearSweepLineStringsXYZOnly(contour: AnyCurve, vector: Vector3d) {
    if (contour instanceof LineString3d) {
      const ls = contour as LineString3d;
      let pointA = Point3d.create();
      let pointB = Point3d.create();
      let indexA0 = 0;
      let indexA1 = 0;
      let indexB0 = 0;
      let indexB1 = 0;
      const n = ls.numPoints();
      for (let i = 0; i < n; i++) {
        pointA = ls.pointAt(i, pointA)!;
        pointB = pointA.plus(vector, pointB);
        indexA1 = this.findOrAddPoint(pointA);
        indexB1 = this.findOrAddPoint(pointB);
        if (i > 0) {
          this.addIndexedQuadPointIndexes(indexA0, indexA1, indexB0, indexB1);
        }
        indexA0 = indexA1;
        indexB0 = indexB1;
      }
    } else if (contour instanceof CurveChain) {
      for (const ls of contour.children) {
        this.addLinearSweepLineStringsXYZOnly(ls, vector);
      }
    }
  }
  /**
   * Construct facets for a rotational sweep.
   */
  public addRotationalSweep(surface: RotationalSweep) {
    const contour = surface.getCurves();
    const section0 = StrokeCountSection.createForParityRegionOrChain(contour, this._options);
    const baseStrokes = section0.getStrokes();

    const axis = surface.cloneAxisRay();
    const perpendicularVector = CylindricalRangeQuery.computeMaxVectorFromRay(axis, baseStrokes);
    const swingVector = axis.direction.crossProduct(perpendicularVector);
    if (this._options.needNormals)
      CylindricalRangeQuery.buildRotationalNormalsInLineStrings(baseStrokes, axis, swingVector);
    const maxDistance = perpendicularVector.magnitude();
    const maxPath = Math.abs(maxDistance * surface.getSweep().radians);
    let numStep = StrokeOptions.applyAngleTol(this._options, 1, surface.getSweep().radians, undefined);
    numStep = StrokeOptions.applyMaxEdgeLength(this._options, numStep, maxPath);
    for (let i = 1; i <= numStep; i++) {
      const transformA = surface.getFractionalRotationTransform((i - 1) / numStep);
      const transformB = surface.getFractionalRotationTransform(i / numStep);
      this.addBetweenRotatedStrokeSets(baseStrokes, transformA, i - 1, transformB, i);
    }
    if (surface.capped) {
      const capContour = surface.getSweepContourRef();
      capContour.purgeFacets();
      capContour.emitFacets(this, true, undefined);
      // final loop pass left transformA at end ..
      capContour.emitFacets(this, false, surface.getFractionalRotationTransform(1.0));
    }
  }
  /**
   * * Recursively visit all children of data.
   * * At each primitive, invoke the computeStrokeCountForOptions method, with options from the builder.
   * @param data
   */
  public applyStrokeCountsToCurvePrimitives(data: AnyCurve | GeometryQuery) {
    const options = this._options;
    if (data instanceof CurvePrimitive) {
      data.computeStrokeCountForOptions(options);
    } else if (data instanceof CurveCollection) {
      const children = data.children;
      if (children)
        for (const child of children) {
          this.applyStrokeCountsToCurvePrimitives(child);
        }
    }
  }

  private addBetweenStrokeSetsWithRuledNormals(stroke0: AnyCurve, stroke1: AnyCurve, numVEdge: number) {
    const strokeSets = [stroke0];
    const fractions = [0.0];
    for (let vIndex = 1; vIndex < numVEdge; vIndex++) {
      const vFraction = vIndex / numVEdge;
      const strokeA = ConstructCurveBetweenCurves.interpolateBetween(stroke0, vIndex / numVEdge, stroke1) as AnyCurve;
      strokeSets.push(strokeA);
      fractions.push(vFraction);
    }
    strokeSets.push(stroke1);
    fractions.push(1.0);
    for (let vIndex = 0; vIndex < numVEdge; vIndex++) {
      this.addBetweenStrokeSetPair(strokeSets[vIndex], fractions[vIndex], strokeSets[vIndex + 1], fractions[vIndex + 1]);
    }
  }
  private createIndicesInLineString(ls: LineString3d, vParam: number, transform?: Transform) {

    const n = ls.numPoints();
    {
      const pointIndices = ls.ensureEmptyPointIndices();
      const index0 = this.findOrAddPointInLineString(ls, 0, transform);
      pointIndices.push(index0!);
      if (n > 1) {
        let indexA = index0;
        let indexB;
        for (let i = 1; i + 1 < n; i++) {
          indexB = this.findOrAddPointInLineString(ls, i, transform, indexA);
          pointIndices.push(indexB!);
          indexA = indexB;
        }
        // assume last point can only repeat back to zero ...
        indexB = this.findOrAddPointInLineString(ls, n - 1, transform, index0);
        pointIndices.push(indexB!);
      }
    }
    if (this._options.needNormals && ls.packedSurfaceNormals !== undefined) {
      const normalIndices = ls.ensureEmptyNormalIndices();
      const normalIndex0 = this.findOrAddNormalnLineString(ls, 0, transform);
      normalIndices.push(normalIndex0!);
      let normalIndexA = normalIndex0;
      let normalIndexB;
      if (n > 1) {
        for (let i = 1; i + 1 < n; i++) {
          normalIndexB = this.findOrAddNormalnLineString(ls, i, transform, normalIndexA);
          normalIndices.push(normalIndexB!);
          normalIndexA = normalIndexB;
        }
        // assume last point can only repeat back to zero ...
        normalIndexB = this.findOrAddNormalnLineString(ls, n - 1, transform, normalIndex0, normalIndexA);
        normalIndices.push(normalIndexB!);
      }
    }
    if (this._options.needParams && ls.packedUVParams !== undefined) {
      const uvIndices = ls.ensureEmptyUVIndices();
      const uvIndex0 = this.findOrAddParamInLineString(ls, 0, vParam);
      uvIndices.push(uvIndex0!);
      let uvIndexA = uvIndex0;
      let uvIndexB;
      if (n > 1) {
        for (let i = 1; i + 1 < n; i++) {
          uvIndexB = this.findOrAddParamInLineString(ls, i, vParam, uvIndexA);
          uvIndices.push(uvIndexB!);
          uvIndexA = uvIndexB;
        }
        // assume last point can only repeat back to zero ...
        uvIndexB = this.findOrAddParamInLineString(ls, n - 1, vParam, uvIndexA, uvIndex0);
        uvIndices.push(uvIndexB!);
      }
    }

  }

  private addBetweenRotatedStrokeSets(stroke0: AnyCurve, transformA: Transform, vA: number, transformB: Transform, vB: number) {
    if (stroke0 instanceof LineString3d) {
      const strokeA = stroke0.cloneTransformed(transformA) as LineString3d;
      this.createIndicesInLineString(strokeA, vA);
      const strokeB = stroke0.cloneTransformed(transformB) as LineString3d;
      this.createIndicesInLineString(strokeB, vB);
      this.addBetweenLineStringsWithStoredIndices(strokeA, strokeB);
    } else if (stroke0 instanceof ParityRegion) {
      for (let i = 0; i < stroke0.children.length; i++) {
        this.addBetweenRotatedStrokeSets(stroke0.children[i], transformA, vA, transformB, vB);
      }
    } else if (stroke0 instanceof CurveChain) {
      const chainA = stroke0.children;
      for (let i = 0; i < chainA.length; i++) {
        const cpA = chainA[i];
        if (cpA instanceof LineString3d) {
          this.addBetweenRotatedStrokeSets(cpA, transformA, vA, transformB, vB);
        }
      }
    }
  }
  /**
   *
   * @param cone cone to facet
   */
  public addLinearSweep(surface: LinearSweep) {
    const contour = surface.getCurvesRef();
    const section0 = StrokeCountSection.createForParityRegionOrChain(contour, this._options);
    const stroke0 = section0.getStrokes();
    const sweepVector = surface.cloneSweepVector();
    const sweepTransform = Transform.createTranslation(sweepVector);
    const stroke1 = stroke0.cloneTransformed(sweepTransform) as AnyCurve;
    const numVEdge = this._options.applyMaxEdgeLength(1, sweepVector.magnitude());
    this.addBetweenStrokeSetsWithRuledNormals(stroke0, stroke1, numVEdge);

    if (surface.capped && contour.isAnyRegionType) {
      const contourA = surface.getSweepContourRef();
      contourA.purgeFacets();

      contourA.emitFacets(this, true, undefined);
      contourA.emitFacets(this, false, sweepTransform);
    }
  }

  /**
   *
   * @param surface RuledSurface to facet.
   */
  public addRuledSweep(surface: RuledSweep): boolean {
    const contours = surface.sweepContoursRef();
    let stroke0: AnyCurve | undefined;
    let stroke1: AnyCurve;
    const sectionMaps = [];
    for (let i = 0; i < contours.length; i++) {
      sectionMaps.push(StrokeCountSection.createForParityRegionOrChain(contours[i].curves, this._options));
    }
    if (StrokeCountSection.enforceStrokeCountCompatibility(sectionMaps)) {
      StrokeCountSection.enforceCompatibleDistanceSums(sectionMaps);
      for (let i = 0; i < contours.length; i++) {
        stroke1 = sectionMaps[i].getStrokes();
        if (!stroke1)
          stroke1 = contours[i].curves.cloneStroked();
        if (i > 0 && stroke0 && stroke1) {
          const distanceRange = Range1d.createNull();
          if (StrokeCountSection.extendDistanceRangeBetweenStrokes(stroke0, stroke1, distanceRange)
            && !distanceRange.isNull) {
            const numVEdge = this._options.applyMaxEdgeLength(1, distanceRange.high);
            this.addBetweenStrokeSetsWithRuledNormals(stroke0, stroke1, numVEdge);
          }
        }
        stroke0 = stroke1;
      }
    }

    if (surface.capped && contours[0].curves.isAnyRegionType) {
      contours[0].purgeFacets();

      contours[0].emitFacets(this, true, undefined);
      contours[contours.length - 1].purgeFacets();
      contours[contours.length - 1].emitFacets(this, false, undefined);
    }
    return true;
  }
  /**
   * @param sphere Sphere to facet.
   */
  public addSphere(sphere: Sphere, strokeCount?: number) {
    const numStrokeTheta = strokeCount ? strokeCount : this._options.defaultCircleStrokes;
    const numStrokePhi = Geometry.clampToStartEnd(numStrokeTheta * sphere.latitudeSweepFraction, 1, Math.ceil(numStrokeTheta * 0.5));

    const lineStringA = sphere.strokeConstantVSection(0.0, numStrokeTheta, this._options);
    if (sphere.capped && !Geometry.isSmallMetricDistance(lineStringA.quickLength())) {
      this.addTrianglesInUncheckedConvexPolygon(lineStringA, true);  // lower triangles flip
      this.endFace();
    }

    const sizes = sphere.maxIsoParametricDistance();

    this.addUVGridBody(sphere, numStrokeTheta, numStrokePhi, Segment1d.create(0, sizes.x), Segment1d.create(0, sizes.y));
    this.endFace();

    const lineStringB = sphere.strokeConstantVSection(1.0, numStrokeTheta, this._options);
    if (sphere.capped && !Geometry.isSmallMetricDistance(lineStringB.quickLength())) {
      this.addTrianglesInUncheckedConvexPolygon(lineStringB, false);  // upper triangles do not flip
      this.endFace();
    }
  }
  /**
   * @param box `Box` to facet.
   */
  public addBox(box: Box) {
    const corners = box.getCorners();
    const xLength = Geometry.maxXY(box.getBaseX(), box.getBaseX());
    const yLength = Geometry.maxXY(box.getBaseY(), box.getTopY());
    let zLength = 0.0;
    for (let i = 0; i < 4; i++) {
      zLength = Geometry.maxXY(zLength, corners[i].distance(corners[i + 4]));

    }

    const numX = this._options.applyMaxEdgeLength(1, xLength);
    const numY = this._options.applyMaxEdgeLength(1, yLength);
    const numZ = this._options.applyMaxEdgeLength(1, zLength);
    // Wrap the 4 out-of-plane faces as a single parameters space with "distance" advancing in x then y then negative x then negative y ...
    const uParamRange = Segment1d.create(0, xLength);
    const vParamRange = Segment1d.create(0, zLength);
    this.addUVGridBody(BilinearPatch.create(corners[0], corners[1], corners[4], corners[5]), numX, numZ, uParamRange, vParamRange);
    uParamRange.shift(xLength);
    this.addUVGridBody(BilinearPatch.create(corners[1], corners[3], corners[5], corners[7]), numY, numZ, uParamRange, vParamRange);
    uParamRange.shift(yLength);
    this.addUVGridBody(BilinearPatch.create(corners[3], corners[2], corners[7], corners[6]), numX, numZ, uParamRange, vParamRange);
    uParamRange.shift(xLength);
    this.addUVGridBody(BilinearPatch.create(corners[2], corners[0], corners[6], corners[4]), numY, numZ, uParamRange, vParamRange);
    // finally end that wraparound face !!
    this.endFace();
    if (box.capped) {
      uParamRange.set(0.0, xLength);
      vParamRange.set(0.0, yLength);
      this.addUVGridBody(BilinearPatch.create(corners[4], corners[5], corners[6], corners[7]), numX, numY, uParamRange, vParamRange);
      this.endFace();

      uParamRange.set(0.0, xLength);
      vParamRange.set(0.0, yLength);
      this.addUVGridBody(BilinearPatch.create(corners[2], corners[3], corners[0], corners[1]), numX, numY, uParamRange, vParamRange);
      this.endFace();
    }
  }

  /** Add a polygon to the evolving facets.
   *
   * * Add points to the polyface
   * * indices are added (in reverse order if indicated by the builder state)
   * @param points array of points.  This may contain extra points not to be used in the polygon
   * @param numPointsToUse number of points to use.
   */
  public addPolygon(points: Point3d[], numPointsToUse?: number) {
    // don't use trailing points that match start point.
    if (numPointsToUse === undefined)
      numPointsToUse = points.length;
    while (numPointsToUse > 1 && points[numPointsToUse - 1].isAlmostEqual(points[0]))
      numPointsToUse--;
    let index = 0;
    if (!this._reversed) {
      for (let i = 0; i < numPointsToUse; i++) {
        index = this.findOrAddPoint(points[i]);
        this._polyface.addPointIndex(index);
      }
    } else {
      for (let i = numPointsToUse; --i >= 0;) {
        index = this.findOrAddPoint(points[i]);
        this._polyface.addPointIndex(index);
      }
    }
    this._polyface.terminateFacet();
  }

  /** Add a polyface, with optional reverse and transform. */
  public addIndexedPolyface(source: IndexedPolyface, reversed: boolean, transform?: Transform) {
    this._polyface.addIndexedPolyface(source, reversed, transform);
  }

  /**
   * Produce a new FacetFaceData for all terminated facets since construction of the previous face.
   * Each facet number/index is mapped to the FacetFaceData through the faceToFaceData array.
   * Returns true if successful, and false otherwise.
   */
  public endFace(): boolean {
    return this._polyface.setNewFaceData();
  }

  /** Double dispatch handler for Cone */
  public handleCone(g: Cone): any { return this.addCone(g); }
  /** Double dispatch handler for TorusPipe */
  public handleTorusPipe(g: TorusPipe): any { return this.addTorusPipe(g); }
  /** Double dispatch handler for Sphere */
  public handleSphere(g: Sphere): any { return this.addSphere(g); }
  /** Double dispatch handler for Box */
  public handleBox(g: Box): any { return this.addBox(g); }
  /** Double dispatch handler for LinearSweep */
  public handleLinearSweep(g: LinearSweep): any { return this.addLinearSweep(g); }
  /** Double dispatch handler for RotationalSweep */
  public handleRotationalSweep(g: RotationalSweep): any { return this.addRotationalSweep(g); }
  /** Double dispatch handler for RuledSweep */
  public handleRuledSweep(g: RuledSweep): any { return this.addRuledSweep(g); }
  /** add facets for a GeometryQuery object.   This is double dispatch through `dispatchToGeometryHandleer(this)` */
  public addGeometryQuery(g: GeometryQuery) { g.dispatchToGeometryHandler(this); }

  /**
   *
   * * Visit all faces
   * * Test each face with f(node) for any node on the face.
   * * For each face that passes, pass its coordinates to the builder.
   * * Rely on the builder's compress step to find common vertex coordinates
   * @internal
   */
  public addGraph(graph: HalfEdgeGraph, needParams: boolean, acceptFaceFunction: HalfEdgeToBooleanFunction = HalfEdge.testNodeMaskNotExterior) {
    let index = 0;
    const needNormals = this._options.needNormals;
    let normalIndex = 0;
    if (needNormals)
      normalIndex = this._polyface.addNormalXYZ(0, 0, 1);   // big assumption !!!!  someday check if that's where the facets actually are!!

    graph.announceFaceLoops(
      (_graph: HalfEdgeGraph, seed: HalfEdge) => {
        if (acceptFaceFunction(seed)) {
          let node = seed;
          do {
            index = this.findOrAddPointXYZ(node.x, node.y, node.z);
            this._polyface.addPointIndex(index);
            if (needParams) {
              index = this.findOrAddParamXY(node.x, node.y);
              this._polyface.addParamIndex(index);
            }
            if (needNormals) {
              this._polyface.addNormalIndex(normalIndex);
            }
            node = node.faceSuccessor;
          } while (node !== seed);
          this._polyface.terminateFacet();
        }
        return true;
      });
  }
  /**
   *
   * * For each ndoe in `faces`
   *  * add all of its vertices to the polyface
   *  * add point indices to form a new facet.
   *    * (Note: no normal or param indices are added)
   *  * terminate the facet
   * @internal
   */
  public addGraphFaces(_graph: HalfEdgeGraph, faces: HalfEdge[]) {
    let index = 0;
    for (const seed of faces) {
      let node = seed;
      do {
        index = this.findOrAddPointXYZ(node.x, node.y, node.z);
        this._polyface.addPointIndex(index);
        node = node.faceSuccessor;
      } while (node !== seed);
      this._polyface.terminateFacet();
    }
  }
  /** Create a polyface containing the faces of a HalfEdgeGraph, with test function to filter faces.
   * @internal
   */
  public static graphToPolyface(graph: HalfEdgeGraph, options?: StrokeOptions, acceptFaceFunction: HalfEdgeToBooleanFunction = HalfEdge.testNodeMaskNotExterior): IndexedPolyface {
    const builder = PolyfaceBuilder.create(options);
    builder.addGraph(graph, builder.options.needParams, acceptFaceFunction);
    builder.endFace();
    return builder.claimPolyface();
  }
  /** Create a polyface containing an array of faces of a HalfEdgeGraph, with test function to filter faces.
   * @internal
   */
  public static graphFacesToPolyface(graph: HalfEdgeGraph, faces: HalfEdge[]): IndexedPolyface {
    const builder = PolyfaceBuilder.create();
    builder.addGraphFaces(graph, faces);
    builder.endFace();
    return builder.claimPolyface();
  }

  /**
   * Given arrays of coordinates for multiple facets.
   * * pointArray[i] is an array of 3 or 4 points
   * * paramArray[i] is an array of matching number of params
   * * normalArray[i] is an array of matching number of normals.
   * @param pointArray array of arrays of point coordinates
   * @param paramArray array of arrays of uv parameters
   * @param normalArray array of arrays of normals
   * @param endFace if true, call this.endFace after adding all the facets.
   */
  public addCoordinateFacets(pointArray: Point3d[][], paramArray?: Point2d[][], normalArray?: Vector3d[][], endFace: boolean = false) {
    for (let i = 0; i < pointArray.length; i++) {
      const params = paramArray ? paramArray[i] : undefined;
      const normals = normalArray ? normalArray[i] : undefined;

      if (pointArray[i].length === 3)
        this.addTriangleFacet(pointArray[i], params, normals);
      else if (pointArray[i].length === 4)
        this.addQuadFacet(pointArray[i], params, normals);
    }

    if (endFace)
      this.endFace();
  }
  /**
   * * Evaluate `(numU + 1) * (numV + 1)` grid points (in 0..1 in both u and v) on a surface.
   * * Add the facets for `numU * numV` quads.
   * * uv params are the 0..1 fractions.
   * * normals are cross products of u and v direction partial derivatives.
   * @param surface
   * @param numU
   * @param numV
   */
  public addUVGridBody(surface: UVSurface, numU: number, numV: number, uMap?: Segment1d, vMap?: Segment1d) {
    let xyzIndex0 = new GrowableFloat64Array(numU);
    let xyzIndex1 = new GrowableFloat64Array(numU);
    let paramIndex0: GrowableFloat64Array | undefined;
    let paramIndex1: GrowableFloat64Array | undefined;
    let normalIndex0: GrowableFloat64Array | undefined;
    let normalIndex1: GrowableFloat64Array | undefined;
    const reverse = this._reversed;
    const needNormals = this.options.needNormals;
    if (needNormals) {
      normalIndex0 = new GrowableFloat64Array(numU);
      normalIndex1 = new GrowableFloat64Array(numU);
    }
    const needParams = this.options.needParams;
    if (needParams) {
      paramIndex0 = new GrowableFloat64Array(numU);
      paramIndex1 = new GrowableFloat64Array(numU);
    }

    let indexSwap;
    xyzIndex0.ensureCapacity(numU);
    xyzIndex1.ensureCapacity(numU);
    const uv = Point2d.create();
    const normal = Vector3d.create();
    const du = 1.0 / numU;
    const dv = 1.0 / numV;
    const plane = Plane3dByOriginAndVectors.createXYPlane();
    for (let v = 0; v <= numV; v++) {
      // evaluate new points ....
      xyzIndex1.clear();
      if (needNormals)
        normalIndex1!.clear();
      if (needParams)
        paramIndex1!.clear();
      for (let u = 0; u <= numU; u++) {
        const uFrac = u * du;
        const vFrac = v * dv;
        surface.uvFractionToPointAndTangents(uFrac, vFrac, plane);
        xyzIndex1.push(this._polyface.addPoint(plane.origin));
        if (needNormals) {
          plane.vectorU.crossProduct(plane.vectorV, normal);
          normal.normalizeInPlace();
          if (reverse)
            normal.scaleInPlace(-1.0);
          normalIndex1!.push(this._polyface.addNormal(normal));
        }
        if (needParams)
          paramIndex1!.push(this._polyface.addParam(Point2d.create(
            uMap ? uMap.fractionToPoint(uFrac) : uFrac,
            vMap ? vMap.fractionToPoint(vFrac) : vFrac,
            uv)));
      }

      if (v > 0) {
        for (let u = 0; u < numU; u++) {
          this.addIndexedQuadPointIndexes(
            xyzIndex0.atUncheckedIndex(u), xyzIndex0.atUncheckedIndex(u + 1),
            xyzIndex1.atUncheckedIndex(u), xyzIndex1.atUncheckedIndex(u + 1), false);
          if (needNormals)
            this.addIndexedQuadNormalIndexes(
              normalIndex0!.atUncheckedIndex(u), normalIndex0!.atUncheckedIndex(u + 1),
              normalIndex1!.atUncheckedIndex(u), normalIndex1!.atUncheckedIndex(u + 1));
          if (needParams)
            this.addIndexedQuadParamIndexes(
              paramIndex0!.atUncheckedIndex(u), paramIndex0!.atUncheckedIndex(u + 1),
              paramIndex1!.atUncheckedIndex(u), paramIndex1!.atUncheckedIndex(u + 1));
          this._polyface.terminateFacet();
        }
      }
      indexSwap = xyzIndex1; xyzIndex1 = xyzIndex0; xyzIndex0 = indexSwap;
      if (needParams) {
        indexSwap = paramIndex1; paramIndex1 = paramIndex0; paramIndex0 = indexSwap;
      }
      if (needNormals) {
        indexSwap = normalIndex1; normalIndex1 = normalIndex0; normalIndex0 = indexSwap;
      }

    }
    xyzIndex0.clear();
    xyzIndex1.clear();
  }

}
