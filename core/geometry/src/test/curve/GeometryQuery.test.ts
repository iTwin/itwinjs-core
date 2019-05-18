/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Checker } from "../Checker";
import { expect } from "chai";
import { Sample } from "../../serialization/GeometrySamples";
import { NullGeometryHandler, RecurseToCurvesGeometryHandler, GeometryHandler } from "../../geometry3d/GeometryHandler";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Arc3d } from "../../curve/Arc3d";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { BSplineCurve3dH } from "../../bspline/BSplineCurve3dH";
import { CoordinateXYZ } from "../../curve/CoordinateXYZ";
import { BSplineSurface3dH, BSplineSurface3d } from "../../bspline/BSplineSurface";
import { IndexedPolyface } from "../../polyface/Polyface";
import { TransitionSpiral3d } from "../../curve/TransitionSpiral";
import { Sphere } from "../../solid/Sphere";
import { Cone } from "../../solid/Cone";
import { Box } from "../../solid/Box";
import { TorusPipe } from "../../solid/TorusPipe";
import { LinearSweep } from "../../solid/LinearSweep";
import { RotationalSweep } from "../../solid/RotationalSweep";
import { RuledSweep } from "../../solid/RuledSweep";
import { PointString3d } from "../../curve/PointString3d";
import { BezierCurve3d } from "../../bspline/BezierCurve3d";
import { BezierCurve3dH } from "../../bspline/BezierCurve3dH";
import { CurveCollection } from "../../curve/CurveCollection";
import { Path } from "../../curve/Path";
import { CylindricalRangeQuery } from "../../curve/Query/CylindricalRange";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Vector3d } from "../../geometry3d/Point3dVector3d";
import { StrokeCountSection } from "../../curve/Query/StrokeCountChain";
import { StrokeOptions } from "../../curve/StrokeOptions";

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
    expect(ck.getNumErrors()).equals(0);
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

    const options = StrokeOptions.createForFacets ();
    options.needNormals = true;
    options.needParams = true;
    const section = StrokeCountSection.createForParityRegionOrChain(path, options);
    const strokes = section.getStrokes();
    CylindricalRangeQuery.buildRotationalNormalsInLineStrings(strokes, Ray3d.createYAxis(), Vector3d.unitZ());

    expect(ck.getNumErrors()).equals(0);
  });

});
