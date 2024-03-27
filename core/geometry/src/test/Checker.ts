/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Arc3d } from "../curve/Arc3d";
import { GeometryQuery } from "../curve/GeometryQuery";
import { LineString3d } from "../curve/LineString3d";
import { Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { LongitudeLatitudeNumber } from "../geometry3d/LongitudeLatitudeAltitude";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d, XYZ } from "../geometry3d/Point3dVector3d";
import { Range1d, Range2d, Range3d } from "../geometry3d/Range";
import { Segment1d } from "../geometry3d/Segment1d";
import { Transform } from "../geometry3d/Transform";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { MomentData } from "../geometry4d/MomentData";
import { Point4d } from "../geometry4d/Point4d";
import { Complex } from "../numerics/Complex";
import { IModelJson } from "../serialization/IModelJsonSchema";
import { GeometryCoreTestIO } from "./GeometryCoreTestIO";
import { prettyPrint } from "./testFunctions";

export class Checker {
  private _savedErrors: number;
  private _savedOK: number;
  private _numErrors: number;
  private _numOK: number;
  public lastMessage: string = "";
  public static noisy = {
    bsiJSON: false,
    bsiJSONFirstAppearance: false,
    serialization: false,
    stroke: false,
    factorPerpendicularColumns: false,
    symmetricEigenvalues: false,
    momentData: false,
    matrixMultiplyAliasing: false,
    checkpoint: false,
    flatbufferRoundTrip: false,
    bsplineEvaluation: false,
    tridiagonalSolver: false,
    gaussQuadrature: false,
    quarticRoots: false,
    cubicRoots: false,
    printJSONSuccess: false,
    printJSONFailure: true,
    spirals: false,
    cluster: false,
    clipPlane: false,
    clipTree: false,
    squareWaves: false,
    axisOrderVerify: false,
    parityClipPlanes: false,
    rectangleMoments: false,
    boxMap: false,
    rotMatrixAxisAndAngle: false,
    map4d: false,
    bsiJsonValuesQuick: false,
    testTransitionSpiral: true,
    newtonRtoRD: false,
    acsArrows: false,
    orderedRotationAngles: false,
    raggedViewMatrix: false,
    reportRoundTripFileNames: false,
    convexSetCorners: false,
    polygonOffset: false,
    unionFind: false,
    ellipsoid: false,
    regionBoolean: false,
    parityRegionAnalysis: false,
    isolateFacetsOnClipPlane: false,
    bandedMatrix: false,
    directSpiralDistanceAlong: false,
    skipKnownClothoidSeriesProblems: false,
    czechSpiralDistanceChecks: false,
    flatBuffer: false,
    buildFacetsFromSweptParityRegions: true,
    halfEdgeGraphFromIndexedLoops: false,
    offsetMesh: false,
  };
  /**
   * Constructor that allows setting statics in `GeometryCoreTestIO` as a debugging convenience.
   * * Do not push to server an invocation that passes true.
   */
  public constructor(enableConsole: boolean = false, enableSave: boolean = false) {
    this._numErrors = 0;
    this._numOK = 0;
    this._savedErrors = 0;
    this._savedOK = 0;
    GeometryCoreTestIO.enableConsole = enableConsole;
    GeometryCoreTestIO.enableSave = enableSave;
    // Note that GeometryCoreTestIO.enableLongTests remains unchanged.
  }
  public getNumErrors(): number {
    return this._savedErrors + this._numErrors;
  }
  public getNumOK(): number { return this._numOK + this._savedOK; }

  // ===================================================================================
  // Tests
  // ===================================================================================

  public checkpoint(...params: any[]) {
    // this.show(params);
    if (Checker.noisy.checkpoint || this._numErrors > 0)
      GeometryCoreTestIO.consoleLog("               (ok ", this._numOK, ")  (errors ", this._numErrors, ")", params);
    this._savedErrors += this._numErrors;
    this._savedOK += this._numOK;
    this._numErrors = 0;
    this._numOK = 0;
  }
  public announceError(...params: any[]): boolean {
    this._numErrors++;
    GeometryCoreTestIO.consoleLogGo("ERROR");
    this.showGo(params);
    return false;
  }
  public announceOK(): boolean {
    this._numOK++;
    return true;
  }
  /** Test if 2 Point3ds are almost equal. */
  public testPoint3d(dataA: Point3d, dataB: Point3d, ...params: any[]): boolean {
    if (Geometry.isSamePoint3d(dataA, dataB))
      return this.announceOK();
    this.announceError("expect same Point3d", dataA, dataB, params);
    return false;
  }
  /** Test if `transformAToB * dataA` matches pointB. */
  public testTransformedPoint3d(transformAToB: Transform, dataA: Point3d, dataB: Point3d, ...params: any[]): boolean {
    const dataA1 = transformAToB.multiplyPoint3d(dataA);
    if (Geometry.isSamePoint3d(dataA1, dataB))
      return this.announceOK();
    this.announceError("expect same transformed Point3d",
      `${prettyPrint(transformAToB)} * ${prettyPrint(dataA)} ==> ${prettyPrint(dataA1)} =?= ${prettyPrint(dataB)}`, params);
    return false;
  }
  public testPoint3dArray(dataA: Point3d[], dataB: Point3d[], ...params: any[]): boolean {
    if (dataA.length !== dataB.length)
      return this.announceError("mismatched Point3d array lengths", dataA, dataB, params);

    for (let i = 0; i < dataA.length; i++)
      if (!Geometry.isSamePoint3d(dataA[i], dataB[i]))
        return this.announceError(`mismatched point at array position ${i}`, dataA, dataB, params);
    return this.announceOK();
  }
  /** Test if number arrays (either or both possibly undefined) match. */
  public testNumberArray(dataA: number[] | Float64Array | undefined, dataB: number[] | Float64Array | undefined, ...params: any[]): boolean {
    const numA = dataA === undefined ? 0 : dataA.length;
    const numB = dataB === undefined ? 0 : dataB.length;
    if (numA !== numB)
      return this.announceError("array length mismatch", dataA, dataB, params);
    if (dataA && dataB) {
      let numError = 0;
      for (let i = 0; i < dataA.length; i++) {
        if (!Geometry.isSameCoordinate(dataA[i], dataB[i]))
          numError++;
      }
      if (numError !== 0)
        return this.announceError("contents different", dataA, dataB, params);
    }
    return this.announceOK();
  }
  /** Test if number arrays (either or both possibly undefined) match. */
  public testNumberArrayG(dataA: number[] | undefined, dataB: GrowableFloat64Array | undefined, ...params: any[]): boolean {
    const numA = dataA === undefined ? 0 : dataA.length;
    const numB = dataB === undefined ? 0 : dataB.length;
    if (numA !== numB)
      return this.announceError("array length mismatch", dataA, dataB, params);
    if (dataA && dataB) {
      let numError = 0;
      for (let i = 0; i < dataA.length; i++) {
        if (!Geometry.isSameCoordinate(dataA[i], dataB.atUncheckedIndex(i)))
          numError++;
      }
      if (numError !== 0)
        return this.announceError("contents different", dataA, dataB, params);
    }
    return this.announceOK();
  }
  /** Test if number arrays (either or both possibly undefined) match. */
  public testNumberArrayGG(dataA: GrowableFloat64Array | undefined, dataB: GrowableFloat64Array | undefined, ...params: any[]): boolean {
    const numA = dataA === undefined ? 0 : dataA.length;
    const numB = dataB === undefined ? 0 : dataB.length;
    if (numA !== numB)
      return this.announceError("array length mismatch", dataA, dataB, params);
    if (dataA && dataB) {
      let numError = 0;
      for (let i = 0; i < dataA.length; i++) {
        if (!Geometry.isSameCoordinate(dataA.atUncheckedIndex(i), dataB.atUncheckedIndex(i)))
          numError++;
      }
      if (numError !== 0)
        return this.announceError("contents different", dataA, dataB, params);
    }
    return this.announceOK();
  }
  /** Test if both ranges have equal low and high parts, or both are null ranges. */
  public testRange3d(dataA: Range3d, dataB: Range3d, ...params: any[]): boolean {
    if (dataA.isAlmostEqual(dataB))
      return this.announceOK();
    this.announceError("expect same Range3d", dataA, dataB, params);
    return false;
  }
  public testRange1d(dataA: Range1d, dataB: Range1d, ...params: any[]): boolean {
    if (dataA.isAlmostEqual(dataB))
      return this.announceOK();
    this.announceError("expect same Range1d", dataA, dataB, params);
    return false;
  }
  public testRange2d(dataA: Range2d, dataB: Range2d, ...params: any[]): boolean {
    if (dataA.isAlmostEqual(dataB))
      return this.announceOK();
    this.announceError("expect same Range2d", dataA, dataB, params);
    return false;
  }
  /** Test if 2 Point3ds have almost equal X and Y parts. */
  public testPoint3dXY(dataA: Point3d, dataB: Point3d, ...params: any[]): boolean {
    if (Geometry.isSamePoint3dXY(dataA, dataB))
      return this.announceOK();
    this.announceError("expect same Point3d XY", dataA, dataB, params);
    return false;
  }
  /** Test if 2 Point2ds are almost equal. */
  public testPoint2d(dataA: Point2d, dataB: Point2d, ...params: any[]): boolean {
    if (Geometry.isSamePoint2d(dataA, dataB))
      return this.announceOK();
    this.announceError("expect same Point2d", dataA, dataB, params);
    return false;
  }
  public testBoolean(dataA: boolean, dataB: boolean, ...params: any[]): boolean {
    if (dataA === dataB)
      return this.announceOK();
    this.announceError("Expect same boolean", JSON.stringify(dataA), JSON.stringify(dataB), params);

    return false;
  }
  public testTrue(dataA: boolean, ...params: any[]): boolean {
    if (dataA)
      return this.announceOK();
    this.announceError("Expect true", params);

    return false;
  }
  public testFalse(dataA: boolean, ...params: any[]): boolean {
    if (!dataA)
      return this.announceOK();
    this.announceError("Expect false", params);

    return false;
  }
  public testUndefined(dataA: any, ...params: any[]): boolean {
    if (dataA === undefined)
      return this.announceOK();
    this.announceError("Expect undefined", dataA, params);

    return false;
  }
  /** Fails if dataA is undefined */
  public testDefined(dataA: any, ...params: any[]): boolean {
    if (dataA !== undefined)
      return this.announceOK();
    this.announceError("Expect defined", dataA, params);

    return false;
  }
  public testType<T extends Function>(data: any, classType: T, ...params: any[]): data is T["prototype"] {
    if (data !== undefined && data instanceof classType)
      return this.announceOK();
    this.announceError("Expect defined with type", data, params);
    return false;
  }
  public testIsFinite(dataA: any, ...params: any[]): dataA is number {
    if (Number.isFinite(dataA))
      return this.announceOK();
    this.announceError("Expect number", dataA, params);

    return false;
  }
  /** Returns true if dataA is less than or equal to dataB. */
  public testLE(dataA: number, dataB: number, ...params: any[]): boolean {
    if (dataA <= dataB)
      return this.announceOK();
    this.announceError("Expect dataA <= dataB", dataA, dataB, params);

    return false;
  }
  /** Returns true if dataA is less than or almost equal to dataB. */
  public testLETol(dataA: number, dataB: number, tol: number = Geometry.smallMetricDistance, ...params: any[]): boolean {
    if (dataA <= dataB || Geometry.isSameCoordinate(dataA, dataB, tol))
      return this.announceOK();
    this.announceError("Expect dataA <= dataB + tol", dataA, dataB, params);
    return false;
  }
  public testBetween(dataA: number, dataB: number, dataC: number, ...params: any[]): boolean {
    if ((dataB - dataA) * (dataC - dataB) >= 0.0)
      return this.announceOK();
    this.announceError("Expect dataB in [dataA, dataC]", [dataA, dataB, dataC], params);
    return false;
  }
  /** Returns true if dataA is less than dataB. */
  public testLT(dataA: number, dataB: number, ...params: any[]): boolean {
    if (dataA < dataB)
      return this.announceOK();
    this.announceError("Expect dataA < dataB", dataA, dataB, params);
    return false;
  }
  public testVector3d(dataA: Vector3d, dataB: Vector3d, ...params: any[]): boolean {
    if (Geometry.isSameVector3d(dataA, dataB))
      return this.announceOK();
    return this.announceError(" expect same Vector3d", dataA, dataB, params);
  }
  public testLongitudeLatitudeNumber(dataA: LongitudeLatitudeNumber, dataB: LongitudeLatitudeNumber, ...params: any[]): boolean {
    if (dataA.isAlmostEqual(dataB))
      return this.announceOK();
    return this.announceError(" expect same LongitudeLatitudeNumber", dataA, dataB, params);
  }
  public testVector2d(dataA: Vector2d, dataB: Vector2d, ...params: any[]): boolean {
    if (Geometry.isSameVector2d(dataA, dataB))
      return this.announceOK();
    return this.announceError(" expect same Vector2d", dataA, dataB, params);
  }
  public testXYZ(dataA: XYZ, dataB: XYZ, ...params: any[]): boolean {
    if (Geometry.isSameXYZ(dataA, dataB))
      return this.announceOK();
    return this.announceError(" expect same XYZ", dataA, dataB, params);
  }
  public testComplex(dataA: Complex, dataB: Complex, ...params: any[]): boolean {
    if (Geometry.isSmallMetricDistance(dataA.distance(dataB)))
      return this.announceOK();
    return this.announceError(" expect same Vector3d", dataA, dataB, params);
  }
  public testPoint4d(dataA: Point4d, dataB: Point4d, ...params: any[]): boolean {
    if (Geometry.isSmallMetricDistance(dataA.distanceXYZW(dataB)))
      return this.announceOK();
    return this.announceError(" expect same Point4d", dataA, dataB, params);
  }
  public testMatrix4d(dataA: Matrix4d, dataB: Matrix4d, ...params: any[]): boolean {
    if (Geometry.isSmallMetricDistance(dataA.maxDiff(dataB)))
      return this.announceOK();
    return this.announceError(" expect same Matrix4d", dataA, dataB, params);
  }
  /**
   * Test these components of MomentData:
   * * centroid
   * * radiiOfGyration
   * * principal directions
   */
  public testCentroidAndRadii(dataA: MomentData, dataB: MomentData, ...params: any[]): boolean {
    if (MomentData.areEquivalentPrincipalAxes(dataA, dataB))
      return this.announceOK();
    return this.announceError("Fail areEquivalentPrincipalAxes", dataA, dataB, params);
  }
  public testMatrix3d(dataA: Matrix3d, dataB: Matrix3d, ...params: any[]): boolean {
    if (dataA.maxDiff(dataB) < Geometry.smallMetricDistance)
      return this.announceOK();
    return this.announceError("expect same Matrix3d", dataA, dataB, params);
  }
  public testTransform(dataA: Transform, dataB: Transform, ...params: any[]): boolean {
    if (dataA.matrix.maxDiff(dataB.matrix) < Geometry.smallMetricDistance
      && dataA.origin.maxDiff(dataB.origin) < Geometry.smallMetricDistance)
      return this.announceOK();
    return this.announceError("expect same Transform", dataA, dataB, params);
  }
  /** Return true if 2 numbers are almost equal. */
  public testCoordinate(dataA: number, dataB: number, ...params: any[]): boolean {
    if (Geometry.isSameCoordinate(dataA, dataB))
      return this.announceOK();
    return this.announceError("Expect same coordinate", dataA, dataB, params);
  }
  public testCoordinateWithToleranceFactor(dataA: number, dataB: number, toleranceFactor: number, ...params: any[]): boolean {
    if (Geometry.isSameCoordinateWithToleranceFactor(dataA, dataB, toleranceFactor))
      return this.announceOK();
    return this.announceError("Expect same coordinate", dataA, dataB, params);
  }
  public testNumberInRange1d(dataA: number, range: Range1d, ...params: any[]): boolean {
    if (range.containsX(dataA))
      return this.announceOK();
    return this.announceError("Expect number in range", dataA, range, params);
  }

  public testSmallRelative(dataA: number, ...params: any[]): boolean {
    if (Geometry.isSmallRelative(dataA))
      return this.announceOK();
    return this.announceError("Expect small relative", dataA, params);
  }
  /** Return true if dataA is strictly before dataB as a signed toleranced coordinate value.. */
  public testCoordinateOrder(dataA: number, dataB: number, ...params: any[]): boolean {
    if (dataA + Geometry.smallMetricDistance < dataB)
      return this.announceOK();
    return this.announceError("Expect coordinate order", dataA, dataB, params);
  }
  /** Return true if dataA is strictly before dataB as a signed toleranced coordinate value.. */
  public testParallel(dataA: Vector3d, dataB: Vector3d, ...params: any[]): boolean {
    if (dataA.isParallelTo(dataB))
      return this.announceOK();
    return this.announceError("Expect parallel", dataA, dataB, params);
  }
  /** Return true if dataA is strictly before dataB as a signed toleranced coordinate value.. */
  public testPerpendicular(dataA: Vector3d, dataB: Vector3d, ...params: any[]): boolean {
    if (dataA.isPerpendicularTo(dataB))
      return this.announceOK();
    return this.announceError("Expect perpendicular", dataA, dataB, params);
  }
  /** Return true if dataA is strictly before dataB as a signed toleranced coordinate value.. */
  public testParallel2d(dataA: Vector2d, dataB: Vector2d, ...params: any[]): boolean {
    if (dataA.isParallelTo(dataB))
      return this.announceOK();
    return this.announceError("Expect parallel", dataA, dataB, params);
  }
  /** Return true if dataA is strictly before dataB as a signed toleranced coordinate value.. */
  public testPerpendicular2d(dataA: Vector2d, dataB: Vector2d, ...params: any[]): boolean {
    if (dataA.isPerpendicularTo(dataB))
      return this.announceOK();
    return this.announceError("Expect perpendicular", dataA, dataB, params);
  }
  /** Return true for exact numeric equality. */
  public testExactNumber(dataA: number, dataB: number, ...params: any[]): boolean {
    if (dataA === dataB)
      return this.announceOK();
    return this.announceError("Expect exact number", dataA, dataB, params);
  }
  /** Return true for exact numeric equality. */
  public testString(dataA: string, dataB: string, ...params: any[]): boolean {
    if (dataA === dataB)
      return this.announceOK();
    return this.announceError("Expect exact string", dataA, dataB, params);
  }
  /** Return true if numbers are nearly identical, tolerance e * (1 + abs(dataA) + abs (dataB)) for e = 8e-16. */
  public testTightNumber(dataA: number, dataB: number, ...params: any[]): boolean {
    const d = Math.abs(dataB - dataA);
    const tol = 8.0e-16 * (1.0 + Math.abs(dataA) + Math.abs(dataB));
    if (d < tol)
      return this.announceOK();
    return this.announceError("Expect exact number", dataA, dataB, params);
  }
  /** Return true if dataA is strictly before dataB as a signed toleranced coordinate value.. */
  public testContainsCoordinate(dataA: GrowableFloat64Array, dataB: number, ...params: any[]): boolean {
    for (let i = 0; i < dataA.length; i++)
      if (Geometry.isSameCoordinate(dataA.atUncheckedIndex(i), dataB)) {
        return this.announceOK();
      }
    return this.announceError("Expect containsCoordinate", dataA, dataB, params);
  }
  public testArrayContainsCoordinate(dataA: Float64Array | number[], dataB: number, ...params: any[]): boolean {
    // simple number array.
    for (const a of dataA)
      if (Geometry.isSameCoordinate(a, dataB)) {
        return this.announceOK();
      }
    return this.announceError("Expect containsCoordinate", dataA, dataB, params);
  }
  /** Return true if dataA and dataB are almost equal as Segment1d. */
  public testSegment1d(dataA: Segment1d, dataB: Segment1d, ...params: any[]): boolean {
    if (dataA.isAlmostEqual(dataB))
      return this.announceOK();
    return this.announceError("Expect exact number", dataA, dataB, params);
  }
  /** Fails if value is undefined, null, NaN, empty string, 0, or false. */
  public testPointer<T>(value: T | undefined, ...params: any[]): value is T {
    if (value)
      return this.announceOK();
    return this.announceError("Expect pointer", value, params);
  }
  public testAngleNoShift(dataA: Angle, dataB: Angle, ...params: any[]): boolean {
    if (dataA.isAlmostEqualNoPeriodShift(dataB))
      return this.announceOK();
    return this.announceError("Angle.isAlmostEqualNoPeriodShift", params);
  }
  public testAngleAllowShift(dataA: Angle, dataB: Angle, ...params: any[]): boolean {
    if (dataA.isAlmostEqualAllowPeriodShift(dataB))
      return this.announceOK();
    return this.announceError("Angle.isAlmostEqualNoPeriodShift", params);
  }
  public testGeometry(
    dataA: GeometryQuery | GeometryQuery[] | undefined,
    dataB: GeometryQuery | GeometryQuery[] | undefined,
    ...params: any[]
  ): boolean {
    if (dataA === undefined && dataB === undefined)
      return false;
    if (dataA instanceof GeometryQuery && dataB instanceof GeometryQuery) {
      if (dataA.isAlmostEqual(dataB))
        return this.announceOK();
      GeometryCoreTestIO.consoleLog(prettyPrint(IModelJson.Writer.toIModelJson(dataA)));
      GeometryCoreTestIO.consoleLog(prettyPrint(IModelJson.Writer.toIModelJson(dataB)));
      return this.announceError("same geometry", params);
    } else if (Array.isArray(dataA) && Array.isArray(dataB) && dataA.length === dataB.length) {
      let numError = 0;
      for (let i = 0; i < dataA.length; i++) {
        if (!dataA[i].isAlmostEqual(dataB[i])) {
          GeometryCoreTestIO.consoleLog(`dataA[${i}]`, prettyPrint(IModelJson.Writer.toIModelJson(dataA)));
          GeometryCoreTestIO.consoleLog(`dataB[${i}]`, prettyPrint(IModelJson.Writer.toIModelJson(dataB)));
          numError++;
        }
        if (numError === 0)
          return true;
        return this.announceError(`Component errors ${numError}`);
      }
    }
    this.announceError("GeometryQuery mismatch", dataA, dataB, params);
    return false;
  }
  // ===================================================================================
  // Caching and Storage
  // ===================================================================================

  private static _cache: GeometryQuery[] = [];
  private static _transform: Transform = Transform.createIdentity();

  public static setTransform(transform: Transform) { Checker._transform = transform; }
  public static getTransform(): Transform { return Checker._transform; }

  public static saveTransformed(g: GeometryQuery, maxCoordinate: number = 1.0e12) {
    const range = g.range();

    if (!range.isNull && range.maxAbs() <= maxCoordinate) {
      Checker._cache.push(g.clone()!);
      Checker._cache[Checker._cache.length - 1].tryTransformInPlace(Checker._transform);
    }
  }
  public static saveTransformedLineString(points: Point3d[]) {
    const cv = LineString3d.createPoints(points);
    Checker.saveTransformed(cv);
  }
  public static saveTransformedMarker(xyz: Point3d, markerSize: number) {
    let cp: any;
    if (markerSize > 0) {
      cp = LineString3d.createPoints([
        Point3d.create(xyz.x - markerSize, xyz.y, xyz.z),
        Point3d.create(xyz.x + markerSize, xyz.y, xyz.z),
        Point3d.create(xyz.x, xyz.y + markerSize, xyz.z),
        Point3d.create(xyz.x, xyz.y - markerSize, xyz.z),
      ]);
    } else {
      cp = Arc3d.createXY(xyz, Math.abs(markerSize));
    }
    Checker.saveTransformed(cp);
  }
  public static shift(dx: number, dy: number, dz: number = 0) {
    Checker._transform.multiplyTransformTransform(Transform.createTranslationXYZ(dx, dy, dz), Checker._transform);
  }
  public static moveTo(dx: number, dy: number, dz: number = 0) {
    Checker._transform = Transform.createTranslationXYZ(dx, dy, dz), Checker._transform;
  }

  // ===================================================================================
  // Output
  // ck.show () -- obeys enableConsole
  // ck.showGo () -- ignores enableConsole
  // ===================================================================================

  public show(...params: any[]) {
    let p;
    for (p of params) {
      GeometryCoreTestIO.consoleLog(p);
    }
  }

  public showGo(...params: any[]) {
    let p;
    for (p of params) {
      GeometryCoreTestIO.consoleLogGo(p);
    }
  }

  public static clearGeometry(name: string, outDir: string) {
    GeometryCoreTestIO.saveGeometry(Checker._cache, outDir, name);

    Checker._cache.length = 0;
    // Checker.lowerRightBaseIndex = 0;  // First index of "lower right" range
    Transform.createIdentity(Checker._transform);
  }
}

export class SaveAndRestoreCheckTransform {
  public baseTransform: Transform;
  public finalShift: Vector3d;

  public constructor(dxFinal: number, dyFinal: number, dzFinal: number) {
    this.finalShift = Vector3d.create(dxFinal, dyFinal, dzFinal);
    this.baseTransform = Checker.getTransform().clone();
  }

  public doShift() {
    Checker.setTransform(this.baseTransform);
    Checker.shift(this.finalShift.x, this.finalShift.y, this.finalShift.z);
    this.baseTransform = Checker.getTransform();
  }
}
