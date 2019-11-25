/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Checker } from "../Checker";
import { expect } from "chai";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { LineString3d } from "../../curve/LineString3d";
import { Range3d } from "../../geometry3d/Range";
import { Ellipsoid, EllipsoidPatch } from "../../geometry3d/Ellipsoid";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Geometry } from "../../Geometry";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Transform } from "../../geometry3d/Transform";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { Angle } from "../../geometry3d/Angle";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Sphere } from "../../solid/Sphere";

describe("Ellipsoid", () => {
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
    const flatten = Transform.createRowValues(
      1, 0, 0, 1,
      0, 1, 0, 2,
      0, 0, 0, 3);
    const ellipsoid = Ellipsoid.create(flatten);
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

    for (const matrix of [Matrix3d.createIdentity(),
    Matrix3d.createRotationAroundAxisIndex(0, Angle.createDegrees(23.7))])
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
            const inverseAngles = ellipsoid.surfaceNormalToRadians(normal!);
            ck.testCoordinate(thetaRadians, inverseAngles.x);
            ck.testCoordinate(phiRadians, inverseAngles.y);
            ellipsoid.surfaceNormalToRadians(normal!);
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
    Matrix3d.createRotationAroundAxisIndex(0, Angle.createDegrees(23.7))])
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
});
