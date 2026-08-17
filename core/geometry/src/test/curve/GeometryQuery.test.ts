/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { AkimaCurve3d } from "../../bspline/AkimaCurve3d";
import { BezierCurve3d } from "../../bspline/BezierCurve3d";
import { BezierCurve3dH } from "../../bspline/BezierCurve3dH";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { BSplineCurve3dH } from "../../bspline/BSplineCurve3dH";
import { BSplineSurface3d, BSplineSurface3dH } from "../../bspline/BSplineSurface";
import { InterpolationCurve3d } from "../../bspline/InterpolationCurve3d";
import { Arc3d } from "../../curve/Arc3d";
import { CoordinateXYZ } from "../../curve/CoordinateXYZ";
import { CurveCollection } from "../../curve/CurveCollection";
import { CurveCurve } from "../../curve/CurveCurve";
import { CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { ParityRegion } from "../../curve/ParityRegion";
import { Path } from "../../curve/Path";
import { PointString3d } from "../../curve/PointString3d";
import { CylindricalRangeQuery } from "../../curve/Query/CylindricalRange";
import { StrokeCountSection } from "../../curve/Query/StrokeCountChain";
import { TransitionSpiral3d } from "../../curve/spiral/TransitionSpiral3d";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Geometry } from "../../Geometry";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { GeometryHandler, NullGeometryHandler, RecurseToCurvesGeometryHandler } from "../../geometry3d/GeometryHandler";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Transform } from "../../geometry3d/Transform";
import { Matrix4d } from "../../geometry4d/Matrix4d";
import { IndexedPolyface } from "../../polyface/Polyface";
import { Box } from "../../solid/Box";
import { Cone } from "../../solid/Cone";
import { LinearSweep } from "../../solid/LinearSweep";
import { RotationalSweep } from "../../solid/RotationalSweep";
import { RuledSweep } from "../../solid/RuledSweep";
import { Sphere } from "../../solid/Sphere";
import { TorusPipe } from "../../solid/TorusPipe";
import { Checker } from "../Checker";
import { Sample } from "../GeometrySamples";

/** Like  NullGeometryHandler, but allow various CurveCollections to flow to base class, where they reach handleCurveCollection. */
export class MinimalGeometryHandler extends GeometryHandler {
  /** no-action implementation */
  public handleLineSegment3d(_g: LineSegment3d): any { return undefined; }
  /** no-action implementation */
  public handleLineString3d(_g: LineString3d): any { return undefined; }
  /** no-action implementation */
  public handleArc3d(_g: Arc3d): any { return undefined; }
  /** no-action implementation */
  // public handleCurveCollection(_g: CurveCollection): any { return undefined; }
  /** no-action implementation */
  public handleBSplineCurve3d(_g: BSplineCurve3d): any { return undefined; }
  /** no-action implementation */
  public handleInterpolationCurve3d(_g: InterpolationCurve3d): any { return undefined; }
  /** no-action implementation */
  public handleAkimaCurve3d(_g: AkimaCurve3d): any { return undefined; }
  /** no-action implementation */
  public handleBSplineCurve3dH(_g: BSplineCurve3dH): any { return undefined; }
  /** no-action implementation */
  public handleBSplineSurface3d(_g: BSplineSurface3d): any { return undefined; }

  /** no-action implementation */
  public handleCoordinateXYZ(_g: CoordinateXYZ): any { return undefined; }
  /** no-action implementation */
  public handleBSplineSurface3dH(_g: BSplineSurface3dH): any { return undefined; }
  /** no-action implementation */
  public handleIndexedPolyface(_g: IndexedPolyface): any { return undefined; }
  /** no-action implementation
   * @alpha
   */
  public handleTransitionSpiral(_g: TransitionSpiral3d): any { return undefined; }

  /** no-action implementation */
  // public handlePath(_g: Path): any { return undefined; }
  /** no-action implementation */
  // public handleLoop(_g: Loop): any { return undefined; }
  /** no-action implementation */
  // public handleParityRegion(_g: ParityRegion): any { return undefined; }
  /** no-action implementation */
  // public handleUnionRegion(_g: UnionRegion): any { return undefined; }
  /** no-action implementation */
  // public handleBagOfCurves(_g: BagOfCurves): any { return undefined; }

  /** no-action implementation */
  public handleSphere(_g: Sphere): any { return undefined; }
  /** no-action implementation */
  public handleCone(_g: Cone): any { return undefined; }
  /** no-action implementation */
  public handleBox(_g: Box): any { return undefined; }
  /** no-action implementation */
  public handleTorusPipe(_g: TorusPipe): any { return undefined; }
  /** no-action implementation */
  public handleLinearSweep(_g: LinearSweep): any { return undefined; }
  /** no-action implementation */
  public handleRotationalSweep(_g: RotationalSweep): any { return undefined; }
  /** no-action implementation */
  public handleRuledSweep(_g: RuledSweep): any { return undefined; }
  /** no-action implementation */
  public handlePointString3d(_g: PointString3d): any { return undefined; }
  /** no-action implementation */
  public handleBezierCurve3d(_g: BezierCurve3d): any { return undefined; }
  /** no-action implementation */
  public handleBezierCurve3dH(_g: BezierCurve3dH): any { return undefined; }
}

describe("GeometryQuery", () => {
  it("HandlerBaseClasses", () => {
    const ck = new Checker();
    const geometry = Sample.createAllGeometryQueryTypes();
    const nullHandler = new NullGeometryHandler();
    for (const g of geometry)
      g.dispatchToGeometryHandler(nullHandler);

    const recurseHandler = new RecurseToCurvesGeometryHandler();
    for (const g of geometry) {
      g.dispatchToGeometryHandler(recurseHandler);
      if (g instanceof CurveCollection)
        recurseHandler.handleCurveCollection(g);

    }

    const minimalHandler = new MinimalGeometryHandler();
    for (const g of geometry)
      g.dispatchToGeometryHandler(minimalHandler);
    expect(ck.getNumErrors()).toBe(0);
  });

  it("ScaledTolerance", () => {
    const ck = new Checker();
    // fillet arc from OS+: tangent to line at arc start point
    const ls = LineString3d.create([[705560.2639031233, 4269299.373370663], [705560.2639031233, 4269238.413370663]]);
    const arc = Arc3d.create(Point3d.create(705567.8839031233, 4269260.717979588), Vector3d.create(7.619999999999999), Vector3d.create(0, 7.619999999999999), AngleSweep.createStartEndDegrees(180, 90));

    const verifyIntersection = (pairs: CurveLocationDetailPair[], knownIntersect: Point3d): boolean => {
      let minDistXY = Geometry.largeCoordinateResult;
      for (const pair of pairs) {
        const dist = knownIntersect.distanceXY(pair.detailB.point);
        if (dist < minDistXY)
          minDistXY = dist;
      }
    return Geometry.isSmallRelative(minDistXY);
    };

    // proof that large coords need larger tolerance to compute intersections accurately
    const knownIntersection = arc.startPoint();
    const tol0 = 1.0e-8; // leads to double root and 3e-5 error
    const intersections0 = CurveCurve.intersectionXYPairs(ls, false, arc, false, tol0);
    ck.testFalse(verifyIntersection(intersections0, knownIntersection), "Expect poor accuracy of computed intersection with overly tight tolerance");
    const tol1 = GeometryQuery.scaleToleranceForGeometry([ls, arc], tol0, { xyOnly: true }); // increased tol (1e-4) leads to 0 error
    ck.testLE(tol0, tol1, "Scaled tolerance should be larger than original");
    const intersections1 = CurveCurve.intersectionXYPairs(ls, false, arc, false, tol1);
    ck.testTrue(verifyIntersection(intersections1, knownIntersection), "Expect excellent accuracy of computed intersection with scaled tolerance");

    // spin the geometry out of horizontal plane
    const fromHorizontal = Transform.createOriginAndMatrix(undefined, Matrix3d.createRotationVectorToVector(arc.perpendicularVector, Vector3d.create(-3, -7, 5)));
    const toHorizontal = fromHorizontal.inverse()!;
    const toHorizontal4d = Matrix4d.createTransform(toHorizontal);
    const ls0 = ls.cloneTransformed(fromHorizontal);
    const arc0 = arc.cloneTransformed(fromHorizontal);
    const knownIntersection0 = arc0.startPoint();

    // repeat the tests on the rotated geometry
    const tol2 = tol0; // leads to 1e-5 error
    const intersections2 = CurveCurve.intersectionProjectedXYPairs(toHorizontal4d, ls0, false, arc0, false, tol2);
    ck.testFalse(verifyIntersection(intersections2, knownIntersection0), "Expect poor accuracy of computed intersection with overly tight tolerance");
    const tol3 = GeometryQuery.scaleToleranceForGeometry([ls0, arc0], tol2, { xyOnly: true, transform: toHorizontal }); // leads to 0 error
    ck.testCoordinate(tol1, tol3, "Scaled tolerance should be invariant after transform to horizontal plane");
    ck.testLE(tol2, tol3, "Scaled tolerance should be larger than original");
    const intersections3 = CurveCurve.intersectionProjectedXYPairs(toHorizontal4d, ls0, false, arc0, false, tol3);
    ck.testTrue(verifyIntersection(intersections3, knownIntersection0), "Expect excellent accuracy of computed intersection with scaled tolerance");

    // cover the other scaled tol constructor
    // This demonstrates that using the default 1e-6 tolerance for operations on the OS+ geometry above is equivalent
    // to imposing an operational relative error on the order of 1e-13, one 10-billionth, which is ridiculously tight.
    const absTol = GeometryQuery.computeScaledTolerance([ls, arc], { relativeTolerance: 1.0e-13, xyOnly: true, });
    const absTol0 = GeometryQuery.computeScaledTolerance([ls0, arc0], { minimumTolerance: 1.0e-15, relativeTolerance: 1.0e-13, xyOnly: true, transform: toHorizontal });
    ck.testCoordinate(absTol, absTol0, "Constructed absolute tolerance should be invariant after transform to horizontal plane");
    if (ck.testTrue(absTol > 0, "Computed tolerance should be positive"))
      ck.testExactNumber(-6, Math.trunc(Math.log10(absTol)), "Computed tol has expected exponent.");

    expect(ck.getNumErrors()).toBe(0);
  });
});

describe("CylindricalRangeQuery", () => {
  it("HandlerBaseClasses", () => {
    const ck = new Checker();
    // need linestring geometry with (a) a point on the rotational axis and (b) linestring buried in path or loop.
    const stringA = LineString3d.create([0, 0, 0], [1, 0, 0], [1, 1, 0]);
    const stringB = LineString3d.create([1, 1, 0], [2, 2, 0]);
    const path = Path.create(stringA, stringB);
    CylindricalRangeQuery.buildRotationalNormalsInLineStrings(path, Ray3d.createYAxis(), Vector3d.unitZ());

    const options = StrokeOptions.createForFacets();
    options.needNormals = true;
    options.needParams = true;
    const section = StrokeCountSection.create(path, options);
    const strokes = section.getStrokes();
    CylindricalRangeQuery.buildRotationalNormalsInLineStrings(strokes, Ray3d.createYAxis(), Vector3d.unitZ());

    expect(ck.getNumErrors()).toBe(0);
  });

  it("StrokeCountChainCoverage", () => {
    const ck = new Checker();
    // need linestring geometry with (a) a point on the rotational axis and (b) linestring buried in path or loop.
    const linestring = LineString3d.create([0, 0, 0], [1, 0, 0], [1, 1, 0]);
    const linestring0 = LineString3d.create();
    const arc = Arc3d.createCenterNormalRadius(undefined, Vector3d.unitZ(), 1);
    const chain1 = Loop.create();
    chain1.tryAddChild(linestring);
    const chain2 = Loop.create();
    chain2.tryAddChild(arc);
    const range = Range1d.createNull();
    ck.testFalse(StrokeCountSection.extendDistanceRangeBetweenStrokes(arc, chain1, range));
    ck.testFalse(StrokeCountSection.extendDistanceRangeBetweenStrokes(chain1, arc, range));
    ck.testFalse(StrokeCountSection.extendDistanceRangeBetweenStrokes(linestring, chain1, range));
    ck.testFalse(StrokeCountSection.extendDistanceRangeBetweenStrokes(linestring, linestring0, range));
    ck.testFalse(StrokeCountSection.extendDistanceRangeBetweenStrokes(chain1, linestring, range));
    ck.testFalse(StrokeCountSection.extendDistanceRangeBetweenStrokes(chain1, chain2, range));
    ck.testFalse(StrokeCountSection.extendDistanceRangeBetweenStrokes(chain1, arc, range));

    const parity1 = ParityRegion.create(chain1);
    const parity2 = ParityRegion.create(chain2);
    const parity0 = ParityRegion.create();
    ck.testFalse(StrokeCountSection.extendDistanceRangeBetweenStrokes(parity1, parity2, range));
    ck.testFalse(StrokeCountSection.extendDistanceRangeBetweenStrokes(parity0, parity2, range));
    ck.testFalse(StrokeCountSection.extendDistanceRangeBetweenStrokes(parity0, chain1, range));

    expect(ck.getNumErrors()).toBe(0);
  });
});
