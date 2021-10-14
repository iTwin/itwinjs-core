/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Arc3d } from "../../curve/Arc3d";
import { CurveFactory } from "../../curve/CurveFactory";
import { AnnounceNumberNumber, AnnounceNumberNumberCurvePrimitive, CurvePrimitive } from "../../curve/CurvePrimitive";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Ellipsoid, EllipsoidPatch, GeodesicPathSolver } from "../../geometry3d/Ellipsoid";
import { LongitudeLatitudeNumber } from "../../geometry3d/LongitudeLatitudeAltitude";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Segment1d } from "../../geometry3d/Segment1d";
import { Transform } from "../../geometry3d/Transform";
import { UVSurfaceOps } from "../../geometry3d/UVSurfaceOps";
import { Point4d } from "../../geometry4d/Point4d";
import { IndexedPolyface } from "../../polyface/Polyface";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { Sphere } from "../../solid/Sphere";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { prettyPrint } from "../testFunctions";

/* eslint-disable no-console */

describe("Ellipsoid", () => {
  Checker.noisy.ellipsoid = true;
  it("patchRange", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const radiusX = 0.9;
    const radiusY = 1.1;
    const radiusZ = 2.0;
    const maxRadius = Math.max(radiusX, radiusY, radiusZ);
    const center = Point3d.create(0.2, 0.4, -0.5);
    const pole = Math.PI * 0.5;
    const halfCircle = Math.PI;
    const degreeStep = 22.5;
    const phiRadiansArray = [-pole, -0.4 * pole, 0.0, 0.2 * pole, pole];
    // const phiRadiansArray = [-pole, pole];
    const thetaRadiansArray = [-halfCircle, -0.6 * halfCircle, -0.2 * halfCircle, 0.0, 0.45 * halfCircle, 0.9 * halfCircle, halfCircle, 1.3 * halfCircle, 2.8 * halfCircle];
    // const thetaRadiansArray = [-halfCircle, 0.0, halfCircle];
    let x0 = 0;
    const xStep = 4.0 * maxRadius;
    for (const ellipsoid of [
      // Ellipsoid.createCenterMatrixRadii(center, Matrix3d.createIdentity(), radiusX, radiusX, radiusX),
      Ellipsoid.createCenterMatrixRadii(center, Matrix3d.createIdentity(), radiusX, radiusY, radiusZ),
      Ellipsoid.createCenterMatrixRadii(center,
        Matrix3d.createRowValues(1.0, 0.2, 0.3, -0.2, 1.0, 0.4, 0.1, -0.5, 1.2),    // true skewed ellipsoid
        radiusX, radiusY, radiusZ)]) {
      let y0 = 0;
      const yStep = 4.0 * maxRadius;
      for (const theta0Radians of thetaRadiansArray) {
        for (const theta1Radians of thetaRadiansArray) {
          if (Math.abs(theta1Radians - theta0Radians) > Math.PI * 2.001)
            continue;
          y0 = 0;
          for (const phi0Radians of phiRadiansArray) {
            for (const phi1Radians of phiRadiansArray) {
              const patch = EllipsoidPatch.createCapture(
                ellipsoid.clone(),
                AngleSweep.createStartEndRadians(theta0Radians, theta1Radians),
                AngleSweep.createStartEndRadians(phi0Radians, phi1Radians))!;
              const builder = PolyfaceBuilder.create();
              const numU = Geometry.stepCount(degreeStep, patch.longitudeSweep.sweepDegrees, 1, 16);
              const numV = Geometry.stepCount(degreeStep, patch.latitudeSweep.sweepDegrees, 1, 16);
              builder.addUVGridBody(patch,
                numU,
                numV);
              const mesh = builder.claimPolyface();
              const patchRange = patch.range();
              const expandedPatchRange = patchRange.clone();
              expandedPatchRange.expandInPlace(1.0e-12);
              GeometryCoreTestIO.captureRangeEdges(allGeometry, patchRange, x0, y0);
              const pointRange = mesh.range();
              const expandedPointRange = pointRange.clone();
              expandedPointRange.expandInPlace(0.10 * maxRadius);
              const ok1 = ck.testTrue(expandedPatchRange.containsRange(pointRange), "points in patch range", { theta0: theta0Radians, theta1: theta1Radians, phi0: phi0Radians, phi1: phi1Radians });
              const ok2 = ck.testTrue(expandedPointRange.containsRange(patchRange), "patch in expanded point range", { theta0: theta0Radians, theta1: theta1Radians, phi0: phi0Radians, phi1: phi1Radians });
              if (!ok1 || !ok2)
                patch.range();
              GeometryCoreTestIO.captureGeometry(allGeometry, mesh, x0, y0);
              y0 += yStep;
            }
          }
          x0 += xStep;
        }
        x0 += 2.0 * xStep;
      }
      x0 += 10.0 * xStep;  // extra gap per ellipsoid
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Ellipsoid", "PatchRange");
    expect(ck.getNumErrors()).equals(0);
  });
  it("IntersectRay", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const radiusX = 0.9;
    const radiusY = 1.1;
    const radiusZ = 2.0;
    const maxRadius = Math.max(radiusX, radiusY, radiusZ);
    const center = Point3d.create(0.2, 0.4, -0.5);
    const pole = Math.PI * 0.5;
    const halfCircle = Math.PI;
    const degreeStep = 22.5;
    const phiRadiansArray = [-pole, 0.2 * pole, pole];
    // const phiRadiansArray = [-pole, pole];
    const thetaRadiansArray = [-halfCircle, 0.45 * halfCircle, halfCircle, 1.3 * halfCircle];
    // const thetaRadiansArray = [-halfCircle, 0.0, halfCircle];
    let x0 = 0;

    const thetaFractionA = 0.3;
    const thetaFractionB = 0.75;
    const phiFractionA = 0.1;
    const phiFractionB = 0.45;
    const xStep = 4.0 * maxRadius;
    const distantRay = Ray3d.createXYZUVW(12, 0, 1, 0.1, 0.1, 5.0);
    const nullRay = Ray3d.createXYZUVW(1, 2, 3, 0, 0, 0);
    const transform2 = Transform.createRowValues(
      1.2, 0, 2, 3,
      0.2, 4, 2, 1,
      -0.2, 3, 4, 2);
    for (const ellipsoid of [
      // Ellipsoid.createCenterMatrixRadii(center, Matrix3d.createIdentity(), radiusX, radiusX, radiusX),
      Ellipsoid.createCenterMatrixRadii(center, Matrix3d.createIdentity(), radiusX, radiusY, radiusZ),
      Ellipsoid.createCenterMatrixRadii(center,
        Matrix3d.createRowValues(1.0, 0.2, 0.3, -0.2, 1.0, 0.4, 0.1, -0.5, 1.2),    // true skewed ellipsoid
        radiusX, radiusY, radiusZ)]) {

      // confirm no intersections for distant ray . . .
      ck.testExactNumber(0, ellipsoid.intersectRay(distantRay, undefined, undefined, undefined), "confirm zero-intersection case");
      ck.testExactNumber(0, ellipsoid.intersectRay(nullRay, undefined, undefined, undefined));
      // confirm transform effects . ..
      const ellipsoid1 = ellipsoid.clone();
      const ellipsoid2 = ellipsoid.cloneTransformed(transform2)!;
      ck.testTrue(ellipsoid.isAlmostEqual(ellipsoid1), "clone is almostEqual");
      ck.testFalse(ellipsoid.isAlmostEqual(ellipsoid2), "cloneTransformed is different");
      const theta3Radians = 0.5;
      const phi3Radians = 0.24;
      const point3A = ellipsoid.radiansToPoint(theta3Radians, phi3Radians);
      const point3B = ellipsoid2.radiansToPoint(theta3Radians, phi3Radians);
      const point3C = transform2.multiplyPoint3d(point3A);
      ck.testPoint3d(point3B, point3C, "transformed ellipse point");

      let y0 = 0;
      const yStep = 4.0 * maxRadius;
      for (const theta0Radians of thetaRadiansArray) {
        for (const theta1Radians of thetaRadiansArray) {
          if (Math.abs(theta1Radians - theta0Radians) > Math.PI * 2.001)
            continue;
          if (Math.abs(theta1Radians - theta0Radians) < 1.0e-8)
            continue;
          y0 = 0;
          for (const phi0Radians of phiRadiansArray) {
            for (const phi1Radians of phiRadiansArray) {
              if (Math.abs(phi0Radians - phi1Radians) < 1.0e-8)
                continue;
              const patch = EllipsoidPatch.createCapture(
                ellipsoid.clone(),
                AngleSweep.createStartEndRadians(theta0Radians, theta1Radians),
                AngleSweep.createStartEndRadians(phi0Radians, phi1Radians))!;
              const builder = PolyfaceBuilder.create();
              const numU = Geometry.stepCount(degreeStep, patch.longitudeSweep.sweepDegrees, 1, 16);
              const numV = Geometry.stepCount(degreeStep, patch.latitudeSweep.sweepDegrees, 1, 16);
              builder.addUVGridBody(patch,
                numU,
                numV);
              const mesh = builder.claimPolyface();

              const thetaA = Geometry.interpolate(theta0Radians, thetaFractionA, theta1Radians);
              const thetaB = Geometry.interpolate(theta0Radians, thetaFractionB, theta1Radians);
              const phiA = Geometry.interpolate(phi0Radians, phiFractionA, phi1Radians);
              const phiB = Geometry.interpolate(phi0Radians, phiFractionB, phi1Radians);
              const pointA = ellipsoid.radiansToPoint(thetaA, phiA);
              const pointB = ellipsoid.radiansToPoint(thetaB, phiB);
              // Create the ray with start/end spread outside the sphere points .....
              const rayAB = Ray3d.createStartEnd(pointA.interpolate(-1, pointB), pointA.interpolate(3, pointB));
              GeometryCoreTestIO.captureGeometry(allGeometry,
                LineString3d.create(rayAB.fractionToPoint(0.0), rayAB.fractionToPoint(1.0)), x0, y0);
              const hits = patch.intersectRay(rayAB, true, true);
              ck.testExactNumber(2, hits.length, "Expect 2 intersections");
              for (const hit of hits) {
                const f = hit.curveDetail.fraction;
                ck.testTrue(Geometry.isSameCoordinate(0.25, f) || Geometry.isSameCoordinate(0.5, f), "Expect intersections at endpoints");
                GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 3, hit.curveDetail.point, 0.03, x0, y0);
              }

              GeometryCoreTestIO.captureGeometry(allGeometry, mesh, x0, y0);

              y0 += yStep;
            }
          }
          x0 += xStep;
        }
        x0 += 2.0 * xStep;
      }
      x0 += 10.0 * xStep;  // extra gap per ellipsoid
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Ellipsoid", "IntersectRay");
    expect(ck.getNumErrors()).equals(0);
  });
  it("NoIntersections", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    const center = Point3d.create(19476.688224632293, 9394.94304587366, -6369311.983587892);
    const matrix = Matrix3d.createRowValues(2230956.046389774, 4218075.517914913, 4217984.8981983,
      -5853439.760676313, 635312.655431714, 2444174.054179583,
      1200294.0430858273, -4741818.686714196, 4079572.590348847);
    const referenceSize = matrix.columnXMagnitude();
    const markerSizeA = 0.1 * referenceSize;
    const markerSizeB = 0.2 * referenceSize;
    /*
        const ray = Ray3d.createXYZUVW(-199314280.53012377, -146422125.0993345, -35134968.98020558,
          7946521.137480825, 8906977.42125833, -677213.3181646094,
        );
     */
    for (const ray of
      [Ray3d.createXYZUVW(38729632.01074491, -5490050.664369064, 12881295.636822795,
        0.09684505394456912, 0.9848250824825425, 0.1440159450884755),
        /* */ Ray3d.createXYZUVW(38729632.01074491, -5490050.664369064, 12881295.636822795,
          0.09684505394456912, 0.9848250824825425, 0.1440159450884755)]) {
      const builder = PolyfaceBuilder.create();
      const patch = EllipsoidPatch.createCapture(Ellipsoid.createCenterMatrixRadii(center, matrix, 1.0, 1.0, 1.0), AngleSweep.create360(), AngleSweep.createFullLatitude());
      builder.addUVGridBody(patch, 32, 32);
      const mesh = builder.claimPolyface();
      for (const rayScale of [1.0, Math.sqrt(referenceSize), referenceSize]) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0);

        for (const placementFraction of [0, 0.8, 0.9, 1.0, 1.05, 1.10, 2.0]) {
          const ray1 = Ray3d.create(ray.origin.interpolate(placementFraction, center), ray.direction);
          ray1.direction.scaleInPlace(rayScale);
          const displayScale = referenceSize / ray1.direction.magnitude();
          GeometryCoreTestIO.captureGeometry(allGeometry,
            LineSegment3d.create(ray1.fractionToPoint(-3.0 * displayScale), ray1.fractionToPoint(3.0 * displayScale)), x0, y0);
          const hits = patch.intersectRay(ray1, true, true);
          if (hits.length === 0) {
            GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, ray1.origin, markerSizeB, x0, y0);
          } else {
            for (const hit of hits) {
              GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, -4, hit.curveDetail.point, markerSizeA, x0, y0);
              GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 5, hit.surfaceDetail.point, 1.5 * markerSizeA, x0, y0);
            }
          }
        }
        x0 += 50.0 * referenceSize;
      }
      x0 = 0;
      y0 += 50.0 * referenceSize;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Ellipsoid", "NoIntersections");
    expect(ck.getNumErrors()).equals(0);
  });

  it("IntersectRayOutsidePatch", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const radiusX = 0.9;
    const radiusY = 1.1;
    const radiusZ = 2.0;
    const center = Point3d.create(0.2, 0.4, -0.5);
    const degreeStep = 10.0;
    const phiFractionsArray = [-0.02, 0.3, 1.03];
    // const phiRadiansArray = [-pole, pole];
    const thetaFractionsArray = [-0.1, 0.55, 1.01];
    // const thetaRadiansArray = [-halfCircle, 0.0, halfCircle];
    const x0 = 0;
    const y0 = 0;
    const thetaFractionB0 = 0.45;
    const phiFractionB0 = 0.55;
    for (const ellipsoid of [
      // Ellipsoid.createCenterMatrixRadii(center, Matrix3d.createIdentity(), radiusX, radiusX, radiusX),
      // Ellipsoid.createCenterMatrixRadii(center, Matrix3d.createIdentity(), radiusX, radiusY, radiusZ),
      Ellipsoid.createCenterMatrixRadii(center,
        Matrix3d.createRowValues(1.0, 0.2, 0.3, -0.2, 1.0, 0.4, 0.1, -0.5, 1.2),    // true skewed ellipsoid
        radiusX, radiusY, radiusZ)]) {
      // Create a fairly small patch so "outside fractions" do not wrap into the patch . ..
      const patch = EllipsoidPatch.createCapture(ellipsoid,
        AngleSweep.createStartEndDegrees(-20, 80),
        AngleSweep.createStartEndDegrees(-10, 30));

      const builder = PolyfaceBuilder.create();
      const numU = Geometry.stepCount(degreeStep, patch.longitudeSweep.sweepDegrees, 1, 16);
      const numV = Geometry.stepCount(degreeStep, patch.latitudeSweep.sweepDegrees, 1, 16);
      builder.addUVGridBody(patch,
        numU,
        numV);
      const mesh = builder.claimPolyface();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0);

      for (const thetaFractionA of thetaFractionsArray) {
        for (const phiFractionA of phiFractionsArray) {
          if (Geometry.isIn01(thetaFractionA) && Geometry.isIn01(phiFractionA))
            continue;
          const thetaFractionB = Geometry.interpolate(thetaFractionB0, 0.2, thetaFractionA);
          const phiFractionB = Geometry.interpolate(phiFractionB0, 0.2, phiFractionA);
          if (!Geometry.isIn01(thetaFractionB) || !Geometry.isIn01(phiFractionB))
            continue;
          const pointA = patch.uvFractionToPoint(thetaFractionA, phiFractionA);   // OUTSIDE
          const pointB = patch.uvFractionToPoint(thetaFractionB, phiFractionB);   // INSIDE
          // Create the ray with start/end spread outside the sphere points .....
          const rayAB = Ray3d.createStartEnd(pointA.interpolate(-0.01, pointB), pointA.interpolate(1.05, pointB));
          GeometryCoreTestIO.captureGeometry(allGeometry,
            LineString3d.create(rayAB.fractionToPoint(0.0), rayAB.fractionToPoint(1.0)), x0, y0);
          const hits = patch.intersectRay(rayAB, true, true);
          ck.testExactNumber(1, hits.length, "Expect 1 intersections");
          for (const hit of hits) {
            GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 3, hit.surfaceDetail.point, 0.03, x0, y0);
          }
        }
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Ellipsoid", "IntersectRayOutsidePatch");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Singular", () => {
    const ck = new Checker();
    // flatten to the equator.
    // normal is bad at phi = 0
    const flatten = Transform.createRowValues(
      1, 0, 0, 1,
      0, 1, 0, 2,
      0, 0, 0, 3);
    const ellipsoid = Ellipsoid.create(flatten);
    const patch = EllipsoidPatch.createCapture(ellipsoid, AngleSweep.createStartEndDegrees(0, 180), AngleSweep.createStartEndDegrees(0, 90));
    ck.testUndefined(patch.anglesToUnitNormalRay(LongitudeLatitudeNumber.createDegrees(0, 0, 0)));
    const equatorPoint = ellipsoid.radiansToPoint(0.1, 0.0);
    ck.testUndefined(patch.projectPointToSurface(equatorPoint), " Project to ellipsoid fails on fold line");
    ck.testExactNumber(0, ellipsoid.intersectRay(Ray3d.createZAxis(), undefined, undefined, undefined));
    const range0 = Range3d.createNull();
    const range = ellipsoid.patchRangeStartEndRadians(0, 1, 0, 1, range0);
    ck.testFalse(range.isNull);
    const ellipsoidB = Ellipsoid.create(Transform.createIdentity());
    const emptyInterval = AngleSweep.createStartEndDegrees(10, 10);
    const realInterval = AngleSweep.createStartEndDegrees(10, 40);
    const northPole = Angle.createDegrees(90);
    const southPole = Angle.createDegrees(-90);
    const notPole = Angle.createDegrees(10);
    ck.testTrue(northPole.isAlmostNorthOrSouthPole, "north pole test");
    ck.testTrue(southPole.isAlmostNorthOrSouthPole, "south pole test");
    ck.testFalse(notPole.isAlmostNorthOrSouthPole, "+=90 degree angle test");

    ck.testUndefined(ellipsoidB.constantLatitudeArc(emptyInterval, notPole), "null arc A");
    ck.testUndefined(ellipsoidB.constantLongitudeArc(northPole, emptyInterval), "null arc B");
    ck.testUndefined(ellipsoidB.constantLongitudeArc(southPole, emptyInterval), "null arc C");
    ck.testUndefined(ellipsoidB.constantLatitudeArc(realInterval, northPole), "null arc D");

    expect(ck.getNumErrors()).equals(0);
  });

  it("EarthLikeExample", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const equatorRadius = 1.2;
    const polarRadius = 1.0;
    const center = Point3d.create(1, 2, 3);
    // Ellipsoid something like the earth  -- center at 0, polar declination 23.45, a little fatter at equator than poles.
    const earthEllipsoid = Ellipsoid.createCenterMatrixRadii(center,
      Matrix3d.createRotationAroundAxisIndex(0, Angle.createDegrees(23.7)),
      equatorRadius, equatorRadius, polarRadius);
    // package the whole earth with a bit less than a full octant patch
    const earthPatch = EllipsoidPatch.createCapture(earthEllipsoid, AngleSweep.createStartEndDegrees(-10, 70), AngleSweep.createStartEndDegrees(0, 80));
    // create a grid mesh
    const builder = PolyfaceBuilder.create();
    builder.addUVGridBody(earthPatch, 10, 10);
    const mesh = builder.claimPolyface();
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh);

    // show the range ..
    const range = earthPatch.range();
    GeometryCoreTestIO.captureRangeEdges(allGeometry, range);

    // find pierce points for line from range high towards range low ...
    const ray = Ray3d.createStartEnd(range.high, range.low);
    const hits = earthPatch.intersectRay(ray, true, false);
    GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(ray.fractionToPoint(0), ray.fractionToPoint(1.0)));
    for (const hit of hits) {
      GeometryCoreTestIO.captureGeometry(allGeometry,
        Sphere.createCenterRadius(hit.surfaceDetail.point, 0.03));
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Ellipsoid", "EarthLikeExample");
    expect(ck.getNumErrors()).equals(0);
  });

  it("NormalInversion", () => {
    const ck = new Checker();
    // const allGeometry: GeometryQuery[] = [];

    const center = Point3d.create(1, 2, 3);
    const degrees = [0, 10, 45, 80, -85, -60]; // use one set of angle samples -- double it for theta to go all the way around
    const unitSphere = Ellipsoid.create();
    for (const matrix of [Matrix3d.createIdentity(),
      /* */ Matrix3d.createRotationAroundAxisIndex(0, Angle.createDegrees(23.7))])
      for (const e of [1.0, 2.0, 0.5]) {
        const ellipsoid = Ellipsoid.createCenterMatrixRadii(center,
          matrix,
          e, e, 1);
        for (const phiDegrees of degrees) {
          for (const thetaDegreesA of degrees) {
            const thetaDegrees = 2.0 * thetaDegreesA;
            const thetaRadians = Angle.degreesToRadians(thetaDegrees);
            const phiRadians = Angle.degreesToRadians(phiDegrees);
            const tangentPlane = ellipsoid.radiansToPointAndDerivatives(thetaRadians, phiRadians);
            const normal = tangentPlane.vectorU.unitCrossProduct(tangentPlane.vectorV);
            const inverseAngles = ellipsoid.surfaceNormalToAngles(normal!);
            ck.testCoordinate(thetaRadians, inverseAngles.longitudeRadians);
            ck.testCoordinate(phiRadians, inverseAngles.latitudeRadians);

            const anglesOnUnitSphere = LongitudeLatitudeNumber.createRadians(thetaRadians, phiRadians);
            const unitNormal = unitSphere.radiansToUnitNormalRay(thetaRadians, phiRadians)!;
            const myAngles = ellipsoid.otherEllipsoidAnglesToThisEllipsoidAngles(unitSphere, anglesOnUnitSphere)!;
            const myUnitNormal = ellipsoid.radiansToUnitNormalRay(myAngles.longitudeRadians, myAngles.latitudeRadians)!;
            ck.testVector3d(unitNormal.direction, myUnitNormal.direction);

            // verify default handling in inversion ...
            const myAngles1 = ellipsoid.otherEllipsoidAnglesToThisEllipsoidAngles(undefined, anglesOnUnitSphere)!;
            ck.testLongitudeLatitudeNumber(myAngles, myAngles1, "exercise default unit sphere branch in otherEllipsoidAnglesToThisEllipsoidAngles");
          }
        }
      }
    expect(ck.getNumErrors()).equals(0);
  });
  it("FrenetFrame", () => {
    const ck = new Checker();
    // const allGeometry: GeometryQuery[] = [];

    const center = Point3d.create(1, 2, 3);
    const degrees = [0, 10, 45, 80, -85, -60]; // use one set of angle samples -- double it for theta to go all the way around
    const fractions = [-0.3, 0.2, 0.8, 1.1];
    const frame0 = Transform.createIdentity();
    for (const matrix of [Matrix3d.createIdentity(),
      /* */ Matrix3d.createRotationAroundAxisIndex(0, Angle.createDegrees(23.7))])
      for (const e of [1.0, 2.0, 0.5]) {
        const ellipsoid = Ellipsoid.createCenterMatrixRadii(center,
          matrix,
          e, e * e, 1);
        for (const phiDegrees of degrees) {
          for (const thetaDegreesA of degrees) {
            const thetaDegrees = 2.0 * thetaDegreesA;
            const thetaRadians = Angle.degreesToRadians(thetaDegrees);
            const phiRadians = Angle.degreesToRadians(phiDegrees);
            const tangentPlane = ellipsoid.radiansToPointAndDerivatives(thetaRadians, phiRadians);
            const normal = tangentPlane.vectorU.unitCrossProduct(tangentPlane.vectorV)!;
            const frame = ellipsoid.radiansToFrenetFrame(thetaRadians, phiRadians)!;
            const frame0A = ellipsoid.radiansToFrenetFrame(thetaRadians, phiRadians, frame0)!;
            ellipsoid.radiansToFrenetFrame(thetaRadians, phiRadians)!;
            ck.testTransform(frame, frame0A);
            ck.testVector3d(normal, frame.matrix.columnZ());
          }
        }
        const patch = EllipsoidPatch.createCapture(ellipsoid, AngleSweep.createStartEndDegrees(-20, 50), AngleSweep.createStartEndDegrees(-45, 45));
        for (const phiFraction of fractions) {
          for (const thetaFraction of fractions) {
            const angles = patch.uvFractionToAngles(thetaFraction, phiFraction);
            ck.testBoolean(patch.containsAngles(angles), Geometry.isIn01(phiFraction) && Geometry.isIn01(thetaFraction));
            const uvFrame = patch.uvFractionToPointAndTangents(thetaFraction, phiFraction);
            const angleRay = patch.anglesToUnitNormalRay(angles)!;
            ck.testPoint3d(uvFrame.origin, angleRay.origin, "frame and ray share point");
            ck.testPerpendicular(uvFrame.vectorU, angleRay.direction, "frame and ray share point");
            ck.testPerpendicular(uvFrame.vectorV, angleRay.direction, "frame and ray share point");
          }
        }
      }
    expect(ck.getNumErrors()).equals(0);
  });
  it("ProjectSpacePoint", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    const y1 = 10.0;
    const center = Point3d.create(0, 0, 0);
    const fractions = [-0.1, 0, 0.5, 0.9, 1.0, 1.1];
    for (const distanceFromSurface of [0.1, 0.2, -0.05]) {
      for (const matrix of [
        Matrix3d.createIdentity(),
        Matrix3d.createRotationAroundAxisIndex(0, Angle.createDegrees(23.7))])
        for (const e of [1.0, 2.0, 0.5]) {
          const ellipsoid = Ellipsoid.createCenterMatrixRadii(center,
            matrix,
            e, e, 1);
          x0 += 8.0;
          const builder = PolyfaceBuilder.create();
          const patch = EllipsoidPatch.createCapture(ellipsoid,
            AngleSweep.createStartEndDegrees(0, 50),
            AngleSweep.createStartEndDegrees(0, 90));
          builder.addUVGridBody(patch, 5, 9);
          GeometryCoreTestIO.captureGeometry(allGeometry, builder.claimPolyface(), x0);
          GeometryCoreTestIO.captureGeometry(allGeometry,
            ellipsoid.constantLatitudeArc(
              patch.longitudeSweep,
              patch.latitudeSweep.startAngle),
            x0, y1);
          GeometryCoreTestIO.captureGeometry(allGeometry,
            ellipsoid.constantLatitudeArc(
              patch.longitudeSweep,
              patch.latitudeSweep.endAngle),
            x0, y1);
          GeometryCoreTestIO.captureGeometry(allGeometry,
            ellipsoid.constantLongitudeArc(
              patch.longitudeSweep.startAngle,
              patch.latitudeSweep),
            x0, y1);
          GeometryCoreTestIO.captureGeometry(allGeometry,
            ellipsoid.constantLongitudeArc(
              patch.longitudeSweep.endAngle,
              patch.latitudeSweep),
            x0, y1);
          // console.log({ eccentricity: e });
          for (const thetaFraction of fractions) {
            for (const phiFraction of fractions) {
              // console.log("(thetaFraction " + thetaFraction + ") (phiFraction " + phiFraction + ") (distance " + distanceFromSurface + ")");
              const anglesA = patch.uvFractionToAngles(thetaFraction, phiFraction, distanceFromSurface);
              const rayA = patch.anglesToUnitNormalRay(anglesA)!;
              const anglesB = patch.projectPointToSurface(rayA.origin);
              if (ck.testDefined(anglesB) && anglesB) {
                const planeB = patch.ellipsoid.radiansToPointAndDerivatives(anglesB.longitudeRadians, anglesB.latitudeRadians, false);
                GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(rayA.origin, planeB.origin), x0);
                const vectorAB = Vector3d.createStartEnd(planeB.origin, rayA.origin);
                if (!Geometry.isSameCoordinate(0, Math.abs(distanceFromSurface))) {
                  ck.testPerpendicular(vectorAB, planeB.vectorU, rayA.origin, anglesA.toJSON(),
                    planeB.origin, anglesB.toJSON());
                  ck.testPerpendicular(vectorAB, planeB.vectorV, rayA.origin, anglesA.toJSON(),
                    planeB.origin, anglesB.toJSON(), planeB.origin, anglesB.toJSON());
                }
                ck.testCoordinate(Math.abs(distanceFromSurface), planeB.origin.distance(rayA.origin));
              }
            }
          }
        }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "EllipsoidPatch", "ProjectSpacePoint");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LocalToWorld", () => {
    const ck = new Checker();
    const ellipsoid = Ellipsoid.create(Transform.createOriginAndMatrix(undefined, tippedEarthEllipsoidMatrix()));
    for (const angles of [LongitudeLatitudeNumber.createDegrees(0, 0), LongitudeLatitudeNumber.createDegrees(20, 10)]) {
      const xyz0 = ellipsoid.radiansToPoint(angles.longitudeRadians, angles.latitudeRadians)!;
      const uvw0 = ellipsoid.worldToLocal(xyz0)!;
      const xyz1 = ellipsoid.localToWorld(uvw0);
      ck.testPoint3d(xyz0, xyz1, "world to local round trip", angles, xyz0, uvw0, xyz1);
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("SectionPlanes", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const matrixArray = [];
    matrixArray.push(Matrix3d.createIdentity());
    matrixArray.push(Matrix3d.createScale(1, 1, 2));
    matrixArray.push(tippedEarthEllipsoidMatrix());
    const normalArray = [];
    normalArray.push(Vector3d.unitX(), Vector3d.unitY(), Vector3d.unitZ());
    normalArray.push(Vector3d.create(1, 1, 1), Vector3d.create(4, 2, 8));
    const originArray = [];
    originArray.push(Point3d.create(0, 0, 0), Point3d.create(0.2, 0.3, 0.5));
    let x0 = 0;
    // matrixArray.push (tippedEarthEllipsoidMatrix());
    for (const matrix of matrixArray) {
      const ellipsoid = Ellipsoid.create(Transform.createOriginAndMatrix(undefined, matrix));
      const xShift = 2.0 * matrix.maxAbs();
      x0 += xShift; // shift both before and after
      let y0 = 0;
      const patch = EllipsoidPatch.createCapture(ellipsoid,
        AngleSweep.create360(),
        AngleSweep.createStartEndDegrees(-89, 89));
      if (Checker.noisy.ellipsoid)
        console.log(" ELLIPSOID", prettyPrint(ellipsoid));
      GeometryCoreTestIO.captureMesh(allGeometry, patch, 48, 16, x0, y0);
      for (const localPoint of originArray) {
        y0 += xShift;
        for (const normal of normalArray) {
          const worldPoint = ellipsoid.transformRef.multiplyPoint3d(localPoint);
          const plane = Plane3dByOriginAndUnitNormal.create(worldPoint, normal)!;
          const arc = ellipsoid.createPlaneSection(plane);
          if (!arc)
            ellipsoid.createPlaneSection(plane); // for debugging
          else {
            const disk = Loop.create(arc);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, disk, x0, y0 + xShift);
          }
          if (ck.testDefined(arc, "Expect good section arc", prettyPrint(plane), prettyPrint(ellipsoid)) && arc) {
            for (const fraction of [0, 0.25, 0.6, 0.8, 0.95]) {
              const pointOnArc = arc.fractionToPoint(fraction);
              ck.testTrue(plane.isPointInPlane(pointOnArc));
              const angles = ellipsoid.projectPointToSurface(pointOnArc);
              if (ck.testDefined(angles) && angles) {
                const pointOnEllipsoid = ellipsoid.radiansToPoint(angles.longitudeRadians, angles.latitudeRadians);
                ck.testPoint3d(pointOnArc, pointOnEllipsoid, "section point is on the ellipsoid");
              }
            }
          }
        }
      }
      x0 += xShift;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "EllipsoidPatch", "PlaneSections");
    expect(ck.getNumErrors()).equals(0);
  });
  it("GreatArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    const center = Point3d.create(0, 0, 0);
    /*    const anglePointsA = [
          LongitudeLatitudeNumber.createDegrees(0, 0),
          LongitudeLatitudeNumber.createDegrees(90, 10),
          LongitudeLatitudeNumber.createDegrees(45, 58),
          LongitudeLatitudeNumber.createDegrees(200, 60),
          LongitudeLatitudeNumber.createDegrees(290, -30),
        ];
        */
    const anglePoints = [
      LongitudeLatitudeNumber.createDegrees(0, 0),
      LongitudeLatitudeNumber.createDegrees(70, 10),
      LongitudeLatitudeNumber.createDegrees(120, 58),
      // LongitudeLatitudeNumber.createDegrees(200, 60),
      // LongitudeLatitudeNumber.createDegrees(290, -30),
    ];

    for (const matrixNamePair of [
      // Matrix3d.createIdentity(),
      [Matrix3d.createRowValues(6378136.695200001, 0, 0,
        0, 6378136.695200001, 0,
        0, 0, 6378136.695200001), "Sphere with Earth Equator Radius"],
      [Matrix3d.createRowValues(6378136.695200001, 0, 0,
        0, 6378136.695200001, 0,
        0, 0, 6356751.995200001), "Earth no tip"],
      [tippedEarthEllipsoidMatrix(), "Tipped earth"]]) {
      const matrix = matrixNamePair[0] as Matrix3d;
      const name = matrixNamePair[1] as string;
      if (Checker.noisy.ellipsoid)
        console.log("Ellipsoid Paths", name);
      const y0 = 0.0;
      const dy = 2.0 * (matrix.columnXMagnitude() + matrix.columnYMagnitude());
      const dx = 3.0 * dy;
      x0 += dx;     // dx shifts both before and after, to catch larger
      if (Checker.noisy.ellipsoid) {
        console.log();
        console.log("*****************************************************************");
        console.log({ "  ELLIPSOID x magnitude ": matrix.columnXMagnitude() });
        console.log(matrix.toJSON());
      }
      const ellipsoid = Ellipsoid.create(Transform.createOriginAndMatrix(center, matrix));
      testEllipsoidPaths(ck, allGeometry, ellipsoid, anglePoints, dy, x0, y0);
      x0 += dx;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "EllipsoidPatch", "GreatArcsFullSizeEarth");
    allGeometry.length = 0;
    x0 = 0;
    for (const matrixNamePair of [
      // Matrix3d.createIdentity(),
      [Matrix3d.createRowValues(
        1, 0, -0.5,
        0, 1, 0,
        0, 0, 1), "mild x skew"],
      [Matrix3d.createRowValues(
        2, 0.1, 0.2,
        -0.1, 4, 0.3,
        0.1, 0.2, 3.0), "3-axis Skew"]]) {
      const matrix = matrixNamePair[0] as Matrix3d;
      const name = matrixNamePair[1] as string;
      if (Checker.noisy.ellipsoid)
        console.log("Ellipsoid Paths", name);
      const y0 = 0.0;
      const dy = 2.0 * (matrix.columnXMagnitude() + matrix.columnYMagnitude());
      const dx = 3.0 * dy;
      x0 += dx;     // dx shifts both before and after, to catch larger
      if (Checker.noisy.ellipsoid) {
        console.log();
        console.log("*****************************************************************");
        console.log({ "  ELLIPSOID x magnitude ": matrix.columnXMagnitude() });
        console.log(matrix.toJSON());
      }
      const ellipsoid = Ellipsoid.create(Transform.createOriginAndMatrix(center, matrix));
      testEllipsoidPaths(ck, allGeometry, ellipsoid, anglePoints, dy, x0, y0);
      x0 += dx;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "EllipsoidPatch", "GreatArcsSmallEllipsoids");

    expect(ck.getNumErrors()).equals(0);
  });
  it("DegenerateGreatArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const ellipsoid = Ellipsoid.create(tippedEarthEllipsoidMatrix());
    // const pointA = ellipsoid.localToWorld({ x: 0.2, y: 0.4, z: 0.5 });
    const angles = LongitudeLatitudeNumber.createDegrees(10, 20);
    const section = ellipsoid.anglePairToGreatArc(angles, angles);
    ck.testUndefined(section, "confirm great arc failure for identical points");
    GeometryCoreTestIO.saveGeometry(allGeometry, "EllipsoidPatch", "DegenerateGreatArc");

    expect(ck.getNumErrors()).equals(0);
  });
  it("PathsOnEllipsoid", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    const y0 = 0.0;
    const angles: LongitudeLatitudeNumber[] = [];
    for (const phiDegrees of [10, 40]) {
      for (const thetaDegrees of [0, 45]) {
        angles.push(LongitudeLatitudeNumber.createDegrees(thetaDegrees, phiDegrees));
      }
    }

    for (const matrixNamePair of [
      // Matrix3d.createIdentity(),
      [Matrix3d.createIdentity(), "sphere"],
      [Matrix3d.createRowValues(
        1, 0, 0,
        0, 1, 0,
        0, 0, 0.25), "4:4:1"]]) {
      const matrix = matrixNamePair[0] as Matrix3d;
      //      const name = matrixNamePair[1] as string;
      const ellipsoid = Ellipsoid.create(matrix);
      /*
      const patch = EllipsoidPatch.createCapture(ellipsoid,
        AngleSweep.createStartEndDegrees(-10, 50),
        AngleSweep.createStartEndDegrees(-20, 80));
      GeometryCoreTestIO.captureMesh(allGeometry, patch, 16, 12, x0, y0);
      */
      const arc03 = ellipsoid.anglePairToGreatArc(angles[0], angles[3])!;
      const normal1 = ellipsoid.radiansToUnitNormalRay(angles[1].longitudeRadians, angles[1].latitudeRadians)!;
      const normal2 = ellipsoid.radiansToUnitNormalRay(angles[2].longitudeRadians, angles[2].latitudeRadians)!;
      GeometryCoreTestIO.captureGeometry(allGeometry, arc03, x0, y0);
      for (const indices of [[0, 1], [1, 3], [3, 2], [2, 0]]) {
        const arc = ellipsoid.anglePairToGreatArc(angles[indices[0]], angles[indices[1]])!;
        GeometryCoreTestIO.captureGeometry(allGeometry, arc, x0, y0);
      }
      for (const fraction of [0, 0.5, 1.0]) {
        const arc031 = ellipsoid.createSectionArcPointPointVectorInPlane(angles[0], angles[3],
          normal1.direction.interpolate(-fraction, normal2.direction))!;
        const arc032 = ellipsoid.createSectionArcPointPointVectorInPlane(angles[0], angles[3],
          normal1.direction.interpolate(1.0 + fraction, normal2.direction))!;
        GeometryCoreTestIO.captureGeometry(allGeometry, [arc031, arc032], x0, y0);
      }
      // save the ellipsoid scaled into it towards its center to there is no chatter among strokes of the arc and the ellipsoid mesh
      const displayScale = 0.99;
      ellipsoid.transformRef.matrix.scaleColumnsInPlace(displayScale, displayScale, displayScale);
      // GeometryCoreTestIO.captureMesh(allGeometry, patch, 16, 12, x0, y0);
      const patch1 = EllipsoidPatch.createCapture(ellipsoid.clone(),
        AngleSweep.create360(),
        AngleSweep.createStartEndDegrees(-89.9, 89.9));
      GeometryCoreTestIO.captureMesh(allGeometry, patch1, 48, 24, x0, y0);
      x0 += 10;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "EllipsoidPatch", "PathOptions");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Silhouette", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const y0 = 0;
    for (const eyePoint of [Point4d.create(4, 0, 0, 1), Point4d.create(1, 2, 3, 0), Point4d.create(0, 0, 1, 0)]) {
      const realEyePoint = eyePoint.realPointOrVector();
      if (realEyePoint instanceof Point3d)
        GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, realEyePoint, x0, y0);
      for (const ellipsoid of [Ellipsoid.createCenterMatrixRadii(Point3d.create(0, 0, 0), Matrix3d.createIdentity(), 1, 1, 1),
        /* */ Ellipsoid.createCenterMatrixRadii(Point3d.create(3, 5, 1), Matrix3d.createRotationAroundVector(Vector3d.create(1, 2, 3), Angle.createDegrees(32)), 1, 1.2, 2.0),
        /* */ Ellipsoid.createCenterMatrixRadii(Point3d.create(0, 5, 0), Matrix3d.createRowValues(1, 0, 0.2, 0.1, 3, 0.2, -0.3, 0.1, 2), 1, 1, 1),
      ]) {
        GeometryCoreTestIO.captureGeometry(allGeometry, facetEllipsoid(ellipsoid), x0, y0);
        const arc = ellipsoid.silhouetteArc(eyePoint);
        if (arc) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, arc, x0, y0);
          for (const arcFraction of [0, 0.25, 0.4, 0.8]) {
            const q = arc.fractionToPoint(arcFraction);
            const angles = ellipsoid.projectPointToSurface(q);
            if (ck.testDefined(angles) && angles) {
              ck.testCoordinate(0.0, angles.altitude, "silhouette arc points are on ellipsoid");
              const surfaceNormal = ellipsoid.radiansToUnitNormalRay(angles.longitudeRadians, angles.latitudeRadians)!;
              const vectorToEye = eyePoint.crossWeightedMinusPoint3d(q);
              ck.testPerpendicular(surfaceNormal.direction, vectorToEye);
              GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(q, q.plus(vectorToEye)), x0, y0);
            }
          }
        }
      }
      x0 += 20.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Ellipsoid", "Silhouette");

    expect(ck.getNumErrors()).equals(0);
  });

  it("SilhouetteA", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    const y0 = 0;
    const matrix = Matrix3d.createRowValues(
      2230955.696607988, 4218074.856581404, 4217984.23465426,
      -5853438.842941238, 635312.5558238369, 2444173.6696791253,
      1200293.8548970034, -4741817.943265299, 4079571.948578869);
    const eye = Point4d.create(0.3901908903099731, 0.2662862131349449, 0.8813868173585089, 0);
    const ellipsoid = Ellipsoid.create(matrix);
    const silhouette = ellipsoid.silhouetteArc(eye);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, silhouette, x0, y0);
    GeometryCoreTestIO.captureGeometry(allGeometry, facetEllipsoid(ellipsoid), x0, y0);

    // expect failure for interior point ..
    const silhouetteInside = ellipsoid.silhouetteArc(Point4d.create(100, 100, 200, 1));
    ck.testUndefined(silhouetteInside);
    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Ellipsoid", "SilhouetteA");
  });

  it("SegmentClip", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    const y0 = 0;
    const matrix = Matrix3d.createRowValues(
      2230955.696607988, 4218074.856581404, 4217984.23465426,
      -5853438.842941238, 635312.5558238369, 2444173.6696791253,
      1200293.8548970034, -4741817.943265299, 4079571.948578869);

    const ellipsoid = Ellipsoid.create(matrix);
    const pointA = ellipsoid.localToWorld({ x: 0.2, y: 0.5, z: 0.6 });    // definitely inside !
    const pointB = ellipsoid.localToWorld({ x: 1.2, y: 0.5, z: 0.6 });    // definitely outside !
    GeometryCoreTestIO.captureGeometry(allGeometry, facetEllipsoid(ellipsoid), x0, y0);
    expect(ck.getNumErrors()).equals(0);
    ck.testTrue(ellipsoid.isPointOnOrInside(pointA));
    ck.testFalse(ellipsoid.isPointOnOrInside(pointB));

    // const scale = pointA.distance(pointB);
    const intervalStack: Segment1d[] = [];
    const announceSegment: AnnounceNumberNumber = (f0: number, f1: number) => {
      intervalStack.push(Segment1d.create(f0, f1));
    };
    ellipsoid.announceClippedSegmentIntervals(-4, 4, pointA, pointB, announceSegment);
    ellipsoid.announceClippedSegmentIntervals(4, -4, pointA, pointB, announceSegment);
    ellipsoid.announceClippedSegmentIntervals(0, 2, pointA, pointB, announceSegment);
    ellipsoid.announceClippedSegmentIntervals(-2, 0, pointA, pointB, announceSegment);
    const a0 = -0.3;
    const a1 = 0.125;
    const indexA0 = intervalStack.length;
    ellipsoid.announceClippedSegmentIntervals(a0, a1, pointA, pointB, announceSegment);
    ellipsoid.announceClippedSegmentIntervals(a1, a0, pointA, pointB, announceSegment);
    ck.testTrue(Segment1d.create(a0, a1).isAlmostEqual(intervalStack[indexA0]));
    ck.testTrue(Segment1d.create(a1, a0).isAlmostEqual(intervalStack[indexA0 + 1]));
    if (ck.testExactNumber(6, intervalStack.length, "line generates one interval per call")) {
      ck.testCoordinate(intervalStack[0].x0, intervalStack[1].x1);
      ck.testCoordinate(intervalStack[1].x0, intervalStack[0].x1);
    }
    // and some outside-only cases ...
    const length0 = intervalStack.length;
    ellipsoid.announceClippedSegmentIntervals(1, 5, pointA, pointB, announceSegment);
    ellipsoid.announceClippedSegmentIntervals(5, 1, pointA, pointB, announceSegment);
    ellipsoid.announceClippedSegmentIntervals(-3, -5, pointA, pointB, announceSegment);
    ellipsoid.announceClippedSegmentIntervals(-5, -3, pointA, pointB, announceSegment);
    ck.testExactNumber(length0, intervalStack.length, "no hits on outside segments");

    // GeometryCoreTestIO.saveGeometry(allGeometry, "Ellipsoid", "SilhouetteA");
  });
  it("ArcClip", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const y0 = 0;
    const z0 = 0.0;
    for (const ellipsoidRadius of [1.0, 2.0]) {
      console.log({ "*** ellipsoid radius ": ellipsoidRadius });
      for (const ellipsoid of [
        Ellipsoid.createCenterMatrixRadii(Point3d.create(0, 0, 0), undefined, ellipsoidRadius, ellipsoidRadius, ellipsoidRadius),
        Ellipsoid.createCenterMatrixRadii(Point3d.create(3, 1, 0), undefined, ellipsoidRadius, ellipsoidRadius, 0.6 * ellipsoidRadius)]) {
        GeometryCoreTestIO.captureGeometry(allGeometry, facetEllipsoid(ellipsoid), x0, y0, z0);
        const announceArc: AnnounceNumberNumberCurvePrimitive = (f0: number, f1: number, arc: CurvePrimitive) => {
          GeometryCoreTestIO.captureGeometry(allGeometry, arc.clonePartialCurve(f0, f1), x0, y0, z0);
          GeometryCoreTestIO.captureGeometry(allGeometry, arc.clonePartialCurve(f0, f1), x0, y0, z0 + 5);
          ck.testTrue(ellipsoid.isPointOnOrInside(arc.fractionToPoint(Geometry.interpolate(f0, 0.3, f1))));
        };

        for (const arcA of [
          Arc3d.createXY(Point3d.create(2, 0, 0), 1.1),
          Arc3d.createXY(Point3d.create(2, 0, 0), 1.5),
          Arc3d.createXY(Point3d.create(2, 0, 0), 1.2),
          Arc3d.createXYZXYZXYZ(2, 3, 1, 3, 0, 0.24, 0.2, 3, 1),
        ]) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, arcA, x0, y0);
          ellipsoid.announceClippedArcIntervals(arcA, announceArc);
        }
      }
      x0 += 10.0;
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Ellipsoid", "ArcClip");
    expect(ck.getNumErrors()).equals(0);

  });
  it("EarthClip", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    const y0 = 0;
    const z0 = 0;
    const ellipsoid = Ellipsoid.create(tippedEarthEllipsoidMatrix())!;
    GeometryCoreTestIO.captureGeometry(allGeometry, facetEllipsoid(ellipsoid), x0, y0, z0);
    const z1 = ellipsoid.transformRef.multiplyComponentXYZ(2, 0, 0, 1.5);

    const point0 = ellipsoid.transformRef.multiplyXYZ(2, 0, 0);
    const point1 = ellipsoid.transformRef.multiplyXYZ(0, -0.2, 1);
    const point2 = ellipsoid.transformRef.multiplyXYZ(-1, -1, 1);
    const arc012 = Arc3d.createCircularStartMiddleEnd(point0, point1, point2)!;
    const segment01 = LineSegment3d.create(point0, point1);
    const segment12 = LineSegment3d.create(point0, point2);
    for (const curve of [segment01, segment12, arc012]) {
      const announce: AnnounceNumberNumberCurvePrimitive = (f0: number, f1: number, cp: CurvePrimitive) => {
        GeometryCoreTestIO.captureGeometry(allGeometry, cp.clonePartialCurve(f0, f1), x0, y0, z0);
        GeometryCoreTestIO.captureGeometry(allGeometry, cp.clonePartialCurve(f0, f1), x0, y0, z1);
        ck.testTrue(ellipsoid.isPointOnOrInside(cp.fractionToPoint(Geometry.interpolate(f0, 0.3, f1))));
      };

      GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve, x0, y0);
      curve.announceClipIntervals(ellipsoid, announce);
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "Ellipsoid", "EarthClip");
    expect(ck.getNumErrors()).equals(0);
  });

  it("EarthPatchOffsetRange", () => {
    const ck = new Checker();
    const ellipsoid = Ellipsoid.create(tippedEarthEllipsoidMatrix())!;
    // this shares the ellipsoid ... should work fine ...
    for (const patch of [
      EllipsoidPatch.createCapture(ellipsoid, AngleSweep.createStartEndDegrees(10, 62), AngleSweep.createStartEndDegrees(-20, 20)),
      EllipsoidPatch.createCapture(ellipsoid, AngleSweep.createStartEndDegrees(220, 340), AngleSweep.createStartEndDegrees(-80, -20)),
      EllipsoidPatch.createCapture(ellipsoid, AngleSweep.createStartEndDegrees(-180, 180), AngleSweep.createStartEndDegrees(-90, 90)),
    ]) {
      const range = patch.range();
      range.expandInPlace(1.0e-8);
      const range20 = UVSurfaceOps.sampledRangeOfOffsetPatch(patch, 0.0, 80, 40);
      ck.testTrue(range.containsRange(range20), "Sampled range must be smaller than true range");
      const a = 1.05;
      ck.testTrue(range.xLength() < a * range20.xLength(), "x range");
      ck.testTrue(range.yLength() < a * range20.yLength(), "y range");
      ck.testTrue(range.zLength() < a * range20.zLength(), "z range");
    }
    // GeometryCoreTestIO.saveGeometry(allGeometry, "Ellipsoid", "EarthPatchOffsetRange");
    expect(ck.getNumErrors()).equals(0);
  });

  it("SphereOffsetPatchRange", () => {
    const ck = new Checker();
    // Work with spheres of various radii -- they have precise ranges to compare to offsets of each other.
    const a = 1.0;
    const options4 = StrokeOptions.createForCurves();
    const options10 = StrokeOptions.createForCurves();
    options4.angleTol = Angle.createDegrees(4);
    options10.angleTol = Angle.createDegrees(10);
    const sphereA = Ellipsoid.create(Matrix3d.createScale(a, a, a));
    let maxDiff4 = 0;
    let maxDiff10 = 0;
    for (const offsetDistance of [0.2, 0.0, -0.3]) {
      const b = a + offsetDistance;
      const sphereB = Ellipsoid.create(Matrix3d.createScale(b, b, b));
      // patchB is offset.  It's range can be directly computed.
      // offset of patchA is sampled.
      for (const patchB of [
        EllipsoidPatch.createCapture(sphereB, AngleSweep.createStartEndDegrees(10, 62), AngleSweep.createStartEndDegrees(-20, 20)),
        EllipsoidPatch.createCapture(sphereB, AngleSweep.createStartEndDegrees(220, 340), AngleSweep.createStartEndDegrees(-80, -20)),
        EllipsoidPatch.createCapture(sphereB, AngleSweep.createStartEndDegrees(-180, 180), AngleSweep.createStartEndDegrees(-90, 90)),
      ]) {
        const patchA = EllipsoidPatch.createCapture(sphereA, patchB.longitudeSweep, patchB.latitudeSweep);
        const rangeB = patchB.range();
        const rangeA4 = UVSurfaceOps.sampledRangeOfOffsetEllipsoidPatch(patchA, offsetDistance, options4);
        const rangeA10 = UVSurfaceOps.sampledRangeOfOffsetEllipsoidPatch(patchA, offsetDistance, options10);
        const diff4 = rangeA4.low.distance(rangeB.low) + rangeA4.high.distance(rangeB.high);
        const diff10 = rangeA10.low.distance(rangeB.low) + rangeA10.high.distance(rangeB.high);
        maxDiff4 = Math.max(diff4, maxDiff4);
        maxDiff10 = Math.max(diff10, maxDiff10);
        console.log({ offset: offsetDistance, diffs: [diff4, diff10] });
        ck.testLE(diff4, 0.005, "approximate range error");
      }
      console.log({ offset: offsetDistance, finalMaxDiffs: [maxDiff4, maxDiff10] });
    }
    // GeometryCoreTestIO.saveGeometry(allGeometry, "Ellipsoid", "EarthPatchOffsetRange");
    expect(ck.getNumErrors()).equals(0);
  });
});

function tippedEarthEllipsoidMatrix(): Matrix3d {
  return Matrix3d.createRowValues(2230956.046389774, 4218075.517914913, 4217984.8981983,
    -5853439.760676313, 635312.655431714, 2444174.054179583,
    1200294.0430858273, -4741818.686714196, 4079572.590348847);
}

function testEllipsoidPaths(ck: Checker, allGeometry: GeometryQuery[], ellipsoid: Ellipsoid, anglePoints: LongitudeLatitudeNumber[], delta: number, x0: number, y0: number) {
  const fullCircle = AngleSweep.createStartEndDegrees(-180, 180);
  const tropic = AngleSweep.createStartEndDegrees(0, 30);
  const dy = delta;
  let y1 = y0 + dy;
  const optionalResultEllipsoid = Ellipsoid.create(Transform.createIdentity());
  const center = ellipsoid.transformRef.getOrigin();
  const builder = PolyfaceBuilder.create();
  const patch = EllipsoidPatch.createCapture(ellipsoid,
    AngleSweep.createStartEndDegrees(0, 120),
    AngleSweep.createStartEndDegrees(0, 85));
  ck.testUndefined(ellipsoid.radiansPairToEquatorialEllipsoid(1, 1, 1, 1));
  builder.addUVGridBody(patch, 32, 16);
  GeometryCoreTestIO.captureGeometry(allGeometry, builder.claimPolyface(), x0, y0);
  for (let i = 1; i < anglePoints.length; i++) {
    const angleA = anglePoints[i - 1];
    const angleB = anglePoints[i];
    const startPoint = patch.ellipsoid.radiansToPoint(angleA.longitudeRadians, angleA.latitudeRadians);
    const endPoint = patch.ellipsoid.radiansToPoint(angleB.longitudeRadians, angleB.latitudeRadians);
    const arc = ellipsoid.radiansPairToGreatArc(angleA.longitudeRadians, angleA.latitudeRadians,
      angleB.longitudeRadians, angleB.latitudeRadians);
    GeometryCoreTestIO.captureGeometry(allGeometry,
      LineString3d.create(center.interpolate(1.4, startPoint), center, center.interpolate(1.4, endPoint)), x0, y0);
    if (ck.testDefined(arc) && arc) {
      const arc1 = arc.clone();
      arc1.scaleAboutCenterInPlace(1.4);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, arc1, x0, y0);
      // const arc1 = arc.clone();
      // arc1.sweep.cloneComplement(false, arc1.sweep);
      // GeometryCoreTestIO.captureCloneGeometry(allGeometry, arc1, x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, arc, x0, y0);
      const ellipsoid1 = ellipsoid.radiansPairToEquatorialEllipsoid(angleA.longitudeRadians, angleA.latitudeRadians,
        angleB.longitudeRadians, angleB.latitudeRadians)!;
      ellipsoid.radiansPairToEquatorialEllipsoid(angleA.longitudeRadians, angleA.latitudeRadians,
        angleB.longitudeRadians, angleB.latitudeRadians, optionalResultEllipsoid);
      ck.testTrue(ellipsoid1.isAlmostEqual(optionalResultEllipsoid), "optional ellipsoid");
      GeometryCoreTestIO.captureMesh(allGeometry, EllipsoidPatch.createCapture(ellipsoid1, fullCircle, tropic), 32, 4, x0, y1);
      const arcLength = arc.curveLength();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, arc, x0, y1);
      const arcA = ellipsoid.sectionArcWithIntermediateNormal(angleA, 0.0, angleB)!;
      const arcB = ellipsoid.sectionArcWithIntermediateNormal(angleA, 1.0, angleB)!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [arcA, arcB], x0, y1);

      for (const angle of [/* Angle.createDegrees(10), Angle.createDegrees(5), */ Angle.createDegrees(2)]) {
        const path = GeodesicPathSolver.createGeodesicPath(ellipsoid, angleA, angleB, angle);
        if (path) {
          if (Checker.noisy.ellipsoid) {
            const xyz = [];
            for (const p of path) {
              xyz.push(p.point);
            }
            const ls = LineString3d.create(xyz);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, ls, x0, y1);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, ls, x0, y0);
            if (Checker.noisy.ellipsoid)
              console.log({ greatArcTrueLength: arcLength, n: ls.numPoints(), l: ls.curveLength() });
          }
          const arcPath = CurveFactory.assembleArcChainOnEllipsoid(ellipsoid, path, 0.5);
          const arcPathLength = arcPath.sumLengths();
          if (Checker.noisy.ellipsoid) {
            console.log("path sums ", arcPathLength);
          }
          GeometryCoreTestIO.captureGeometry(allGeometry, arcPath, x0, y0);
        }
      }

      for (const numSample of [40]) {
        const minLengthArcDataA = GeodesicPathSolver.approximateMinimumLengthSectionArc(ellipsoid, angleA, angleB, numSample, -0.10, 1.10);
        if (minLengthArcDataA !== undefined) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, minLengthArcDataA.minLengthArc, x0, y1);
          const lA = minLengthArcDataA.minLengthArc.curveLength();
          if (Checker.noisy.ellipsoid)
            console.log({ "approximate min section lengthA ": minLengthArcDataA.minLengthArc.curveLength(), "fraction ": minLengthArcDataA.minLengthNormalInterpolationFraction });
          const minLengthArcDataB = GeodesicPathSolver.approximateMinimumLengthSectionArc(ellipsoid, angleA, angleB, numSample,
            minLengthArcDataA.minLengthNormalInterpolationFraction - 0.10, minLengthArcDataA.minLengthNormalInterpolationFraction + 0.10);
          if (minLengthArcDataB) {
            const lB = minLengthArcDataB.minLengthArc.curveLength();
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, minLengthArcDataB.minLengthArc, x0, y1);
            ck.testLE(lB, lA * (1.0 + 1.0e-10), "Secondary search refines min length");
            if (Checker.noisy.ellipsoid)
              console.log({
                "approximate min section lengthB ": minLengthArcDataB.minLengthArc.curveLength(),
                "fraction ": minLengthArcDataB.minLengthNormalInterpolationFraction,
                "ratio ": lB / lA,
              });
          }
        }
      }
      y1 += dy;
    }
  }
}

function facetEllipsoid(ellipsoid: Ellipsoid, degreeStep: number = 15.0): IndexedPolyface {
  const patch = EllipsoidPatch.createCapture(
    ellipsoid.clone(),
    AngleSweep.create360(),
    AngleSweep.createFullLatitude());

  const builder = PolyfaceBuilder.create();
  const numU = Geometry.stepCount(degreeStep, patch.longitudeSweep.sweepDegrees, 1, 16);
  const numV = Geometry.stepCount(degreeStep, patch.latitudeSweep.sweepDegrees, 1, 16);
  builder.addUVGridBody(patch,
    numU,
    numV);
  const mesh = builder.claimPolyface();
  return mesh;
}
