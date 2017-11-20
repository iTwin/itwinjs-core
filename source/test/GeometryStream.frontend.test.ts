/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */

import { assert } from "chai";
import { Point3d, Vector3d } from "@bentley/geometry-core/lib/PointVector";
import { AngleSweep } from "@bentley/geometry-core/lib/Geometry";
import { Arc3d } from "@bentley/geometry-core/lib/curve/Arc3d";
import { Path } from "@bentley/geometry-core/lib/curve/CurveChain";
import { Cone } from "@bentley/geometry-core/lib/solid/Cone";
import { Sample } from "@bentley/geometry-core/lib/serialization/GeometrySamples";
import { BSplineSurface3d } from "@bentley/geometry-core/lib/bspline/BSplineSurface";
import { PolyfaceBuilder } from "@bentley/geometry-core/lib/polyface/PolyfaceBuilder";
import { IndexedPolyface } from "@bentley/geometry-core/lib/polyface/Polyface";
import { GeometricPrimitive, GeometryType } from "../common/geometry/Primitives";

describe ("GeometricPrimitive", () => {
  it("Create", () => {

    // CurvePrimitive
    const arc = Arc3d.create(Point3d.create(1, 2, 3), Vector3d.create(0, 0, 2), Vector3d.create(0, 3, 0), AngleSweep.createStartEndRadians(0, 2 * Math.PI));
    let elmGeom = GeometricPrimitive.createCurvePrimitiveClone(arc!);
    assert.isTrue(GeometryType.CurvePrimitive === elmGeom.type, "Correctly stored CurvePrimitive in GeometricPrimitive");
    assert.isTrue(elmGeom.isWire(), "CurvePrimitive is wire");
    assert.isFalse(elmGeom.isSheet(), "CurvePrimitive is not sheet");
    assert.isFalse(elmGeom.isSolid(), "CurvePrimitive is not solid");
    // Clone CurvePrimitive
    let elmGeomC = elmGeom.clone();
    const getAsCurvePrimitive = elmGeomC.asCurvePrimitive;
    assert.isTrue(getAsCurvePrimitive instanceof Arc3d, "GeometricPrimitive correctly returned CurvePrimitive data");
    assert.isFalse(getAsCurvePrimitive === arc, "CurvePrimitive stored as deep copy in GeometricPrimitive");
    assert.isTrue(elmGeomC.type === elmGeom.type, "GeometricPrimitive clone type matches");
    assert.isTrue(getAsCurvePrimitive!.isAlmostEqual(arc!), "CurvePrimitive and its clone are equal");

    // CurveCollection
    const loops = Sample.createSimplePaths(true);
    const curveCollection = loops[2];   // <-- Is a loop containing 4 LineSegments
    elmGeom = GeometricPrimitive.createCurveCollectionClone(curveCollection);
    assert.isTrue(elmGeom.type === GeometryType.CurveCollection, "Correctly stored CurveCollection in GeometricPrimitive");
    assert.isTrue(elmGeom.isWire(), "CurveCollection is wire");
    assert.isFalse(elmGeom.isSheet(), "CurveCollection is not sheet");
    assert.isFalse(elmGeom.isSolid(), "CurveCollection is not solid");
    // Clone CurveCollection
    elmGeomC = elmGeom.clone();
    const getAsCurveCollection = elmGeomC.asCurveCollection;
    assert.isTrue(getAsCurveCollection instanceof Path, "GeometricPrimitive correctly returned CurveCollection data");
    assert.isFalse(getAsCurveCollection === curveCollection, "CurveCollection stored as deep copy in GeometricPrimitive");
    assert.isTrue(elmGeom.type === elmGeomC.type, "GeometricPrimitive clone type matches");
    assert.isTrue(getAsCurveCollection!.isAlmostEqual(curveCollection!), "CurveCollection and its clone are equal");

    // SolidPrimitive
    const dz = 3.0;
    const radius = 1.5;
    const solidPrimitve = Cone.createAxisPoints(Point3d.create(0, 0, 0), Point3d.create(0, 0, dz), radius, radius, true);
    elmGeom = GeometricPrimitive.createSolidPrimitiveClone(solidPrimitve!);
    assert.isTrue(GeometryType.SolidPrimitive === elmGeom.type, "Correctly stored SolidPrimitve in GeometricPrimitive");
    assert.isFalse(elmGeom.isWire(), "SolidPrimitive is not wire");
    assert.isFalse(elmGeom.isSheet(), "SolidPrimitive is not sheet");
    assert.isTrue(elmGeom.isSolid(), "SolidPrimitive is solid");
    // Clone SolidPrimitive
    elmGeomC = elmGeom.clone();
    const getAsSolidPrimitive = elmGeomC.asSolidPrimitive;
    assert.isTrue(getAsSolidPrimitive instanceof Cone, "GeometricPrimitive correctly returned SolidPrimitve data");
    assert.isFalse(getAsSolidPrimitive === solidPrimitve, "SolidPrimitive stored as deep copy in GeometricPrimitive");
    assert.isTrue(elmGeom.type === elmGeomC.type, "GeometricPrimitive clone type matches");
    assert.isTrue(getAsSolidPrimitive!.isAlmostEqual(solidPrimitve!), "SolidPrimitive and its clone are equal");

    // BsplineSurface
    const surface = BSplineSurface3d.createUniformKnots([Point3d.create(0, 0), Point3d.create(1, 1)], 1, 1, 1);
    elmGeom = GeometricPrimitive.createBsplineSurfaceClone(surface!);
    assert.isTrue(GeometryType.BsplineSurface === elmGeom.type, "Correctly stored BsplineSurface in GeometricPrimitive");
    assert.isFalse(elmGeom.isWire(), "BsplineSurface is not wire");
    assert.isTrue(elmGeom.isSheet(), "BsplineSurface is sheet");
    assert.isFalse(elmGeom.isSolid(), "BsplineSurface is not solid");
    // Clone BsplineSurface
    elmGeomC = elmGeom.clone();
    const getAsBspline = elmGeomC.asBsplineSurface;
    assert.isTrue(getAsBspline instanceof BSplineSurface3d, "GeometricPrimitive correctly returned BsplineSurface data");
    assert.isFalse(getAsBspline === surface, "BsplineSurface stored as deep copy in GeometricPrimitive");
    assert.isTrue(elmGeom.type === elmGeomC.type, "GeometricPrimitive clone type matches");
    assert.isTrue(getAsBspline!.isAlmostEqual(surface!), "BsplineSurface and its clone are equal");

    // Polyface
    const builder = PolyfaceBuilder.create();
    builder.addCone(solidPrimitve!);
    const polyface = builder.claimPolyface();
    elmGeom = GeometricPrimitive.createIndexedPolyfaceClone(polyface);
    assert.isTrue(GeometryType.IndexedPolyface === elmGeom.type, "Correctly stored Polyface in GeometricPrimitive");
    assert.isFalse(elmGeom.isWire(), "Polyface is not wire");
    assert.isTrue(elmGeom.isSheet(), "Polyface is sheet");
    assert.isFalse(elmGeom.isSolid(), "Polyface is not solid");
    // Clone Polyface
    elmGeomC = elmGeom.clone();
    const getAsPolyface = elmGeomC.asIndexedPolyface;
    assert.isTrue(getAsPolyface instanceof IndexedPolyface, "GeometricPrimitive correctly returned Polyface data");
    assert.isFalse(getAsPolyface === polyface, "Polyface stored as deep copy in GeometricPrimitive");
    assert.isTrue(elmGeom.type === elmGeomC.type, "GeometricPrimitive clone type matches");
    assert.isTrue(getAsPolyface!.isAlmostEqual(polyface!), "Polyface and its clone are equal");

    // BRepEntity...

    // TextString...
  });
});
