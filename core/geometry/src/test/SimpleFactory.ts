/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */

import * as g from "../geometry-core";

console.log("=========================");
console.log("Standalone Output");
console.log("=========================");

/**
 * This class has static methods to create typical instances of various classes.
 * * Each method is expected to produce increasingly complex instances per the select parameter, then undefined for higher select value
 * * select === 0 should be a particularly simple object, with many zeros
 * * select === 1 should have few zeros, but prefer integer data.
 * * higher selects should have increasing complexity
 */
export class SimpleFactory {

  // an arc whose coordinates will all be "select == 2" compatible.
  private static _arc2 = g.Arc3d.create(g.Point3d.create(0.2, 0.5, 0.3), g.Vector3d.create(0.9, 0.1, 0.01), g.Vector3d.create(-0.2, 0.5, -0.2), g.AngleSweep.createStartEndDegrees(20.5, 345.2));
  // _point1 has integer coordinates
  private static _point1 = [
    g.Point3d.create(1, 2, 3),
    g.Point3d.create(-2, 3, 1),
    g.Point3d.create(-1, -2, 3)];
  // _vector1 has integer coordinates
  private static _vector1 = [
    g.Vector3d.create(0, 1, 0),
    g.Vector3d.create(1, 0, 0),
    g.Vector3d.create(1, 2, 4)];
  // _point2 has messy coordinates
  private static _point2 = [
    g.Point3d.create(0.234, -0.1, 0.52),
    g.Point3d.create(Math.sqrt(2.0), 3.234204809, -2.3),
    g.Point3d.create(-2.90089, 0.32481216727, -2.789798787)];
  // _vector1 has messy  coordinates
  private static _vector2 = [
    g.Vector3d.create(3 / 27, 4 / 27, 5 / 27)!,
    g.Vector3d.create(3, 5, 10).normalize()!,
    g.Vector3d.create(-2.90089, 0.32481216727, -2.789798787)];

  public static createDefaultLineSegment3d(select: number): g.LineSegment3d | undefined {
    if (select === 0)
      return g.LineSegment3d.create(g.Point3d.create(0, 0, 0), g.Point3d.create(1, 0, 0));
    if (select === 1)
      return g.LineSegment3d.create(SimpleFactory._point1[0], SimpleFactory._point1[1]);
    if (select === 2)
      return g.LineSegment3d.create(SimpleFactory._arc2.fractionToPoint(0.0), SimpleFactory._arc2.fractionToPoint(0.5));
    return undefined;
  }

  public static createDefaultLineString3d(select: number): g.LineString3d | undefined {
    if (select === 0)
      return g.LineString3d.create(g.Point3d.create(0, 0, 0), g.Point3d.create(1, 0, 0));
    if (select === 1)
      return g.LineString3d.create(SimpleFactory._point1[0], SimpleFactory._point1[1]);
    if (select === 2)
      return g.LineString3d.create(SimpleFactory._arc2.fractionToPoint(0.0), SimpleFactory._arc2.fractionToPoint(0.5), SimpleFactory._arc2.fractionToPoint(0.75), SimpleFactory._arc2.fractionToPoint(1.0));
    return undefined;
  }

  public static createDefaultPointString3d(select: number): g.PointString3d | undefined {
    if (select === 0)
      return g.PointString3d.create(g.Point3d.create(0, 0, 0), g.Point3d.create(1, 0, 0));
    if (select === 1)
      return g.PointString3d.create(SimpleFactory._point1[0], SimpleFactory._point1[1]);
    if (select === 2)
      return g.PointString3d.create(SimpleFactory._arc2.fractionToPoint(0.0), SimpleFactory._arc2.fractionToPoint(0.5), SimpleFactory._arc2.fractionToPoint(0.75), SimpleFactory._arc2.fractionToPoint(1.0));
    return undefined;
  }

  public static createDefaultAngle(select: number): g.Angle | undefined {
    if (select === 0)
      return g.Angle.createDegrees(0);
    if (select === 1)
      return g.Angle.createDegrees(45.0);
    if (select === 2)
      return g.Angle.createDegrees(15.23123122);
    return undefined;
  }

  public static createDefaultAngleSweep(select: number): g.AngleSweep | undefined {
    if (select === 0)
      return g.AngleSweep.create360();
    if (select === 1)
      return g.AngleSweep.createStartEndDegrees(5.0, 90.0);
    if (select === 2)
      return g.AngleSweep.createStartEndDegrees(15.23123122, 100.3234);
    return undefined;
  }

  public static createDefaultMatrix3d(select: number): g.Matrix3d | undefined {
    if (select === 0)
      return g.Matrix3d.createIdentity();
    if (select === 1)
      return g.Matrix3d.createRowValues(10, 2, 3, -2, 12, 5, 1, -4, 8);
    if (select === 2)
      return g.Matrix3d.createRotationAroundVector(SimpleFactory._vector2[0], g.Angle.createDegrees(15.23123122))!;
    return undefined;
  }

  public static createDefaultPlane3dByOriginAndUnitNormal(select: number): g.Plane3dByOriginAndUnitNormal | undefined {
    if (select === 0)
      return g.Plane3dByOriginAndUnitNormal.createXYPlane();
    if (select === 1)
      return g.Plane3dByOriginAndUnitNormal.create(g.Point3d.create(1, 2, 3), g.Vector3d.create(2, 4, -1))!;
    if (select === 2)
      return g.Plane3dByOriginAndUnitNormal.create(SimpleFactory._point2[0], SimpleFactory._vector2[1]);
    return undefined;
  }

  public static createDefaultPlane3dByOriginAndVectors(select: number): g.Plane3dByOriginAndVectors | undefined {
    if (select === 0)
      return g.Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(0, 0, 0, 1, 0, 0, 0, 1, 0)!;
    if (select === 1)
      return g.Plane3dByOriginAndVectors.createOriginAndVectors(SimpleFactory._point1[1], SimpleFactory._vector1[0], SimpleFactory._vector1[2]);
    if (select === 2)
      return g.Plane3dByOriginAndVectors.createOriginAndVectors(SimpleFactory._point2[1], SimpleFactory._vector2[0], SimpleFactory._vector2[2]);
    return undefined;
  }

  public static createDefaultRange3d(select: number): g.Range3d | undefined {
    if (select === 0)
      return g.Range3d.createNull();
    if (select === 1)
      return g.Range3d.createArray(SimpleFactory._point1);
    if (select === 2)
      return g.Range3d.createArray(SimpleFactory._point2);
    return undefined;
  }

  public static createDefaultRange1d(select: number): g.Range1d | undefined {
    if (select === 0)
      return g.Range1d.createNull();
    if (select === 1)
      return g.Range1d.createX(10.0);
    if (select === 2)
      return g.Range1d.createXX(1.234, -0.32432);
    return undefined;
  }

  public static createDefaultRange2d(select: number): g.Range2d | undefined {
    if (select === 0)
      return g.Range2d.createNull();
    if (select === 1)
      return g.Range2d.createXYXY(-1, 2, 3, 1);
    if (select === 2)
      return g.Range2d.createXYXY(0.234239, -1.34, Math.sqrt(3), Math.exp(1.2));
    return undefined;
  }

  public static createDefaultRay3d(select: number): g.Ray3d | undefined {
    if (select === 0)
      return g.Ray3d.createXAxis();
    if (select === 1)
      return g.Ray3d.create(SimpleFactory._point1[0], SimpleFactory._vector1[2]);
    if (select === 2)
      return g.Ray3d.create(SimpleFactory._point2[0], SimpleFactory._vector2[2]);
    return g.Ray3d.createXAxis();

    return undefined;
  }

  public static createDefaultTransform(select: number): g.Transform | undefined {
    if (select === 0)
      return g.Transform.createIdentity();
    if (select === 1)
      return g.Transform.createOriginAndMatrix(g.Point3d.create(-1, 2, 3), g.Matrix3d.createScale(2, 2, 2));
    if (select === 2)
      return g.Transform.createOriginAndMatrix(g.Point3d.create(-1, 2, 3), g.Matrix3d.createRotationAroundAxisIndex(2, g.Angle.createDegrees(30)));
    if (select === 3)
      return g.Transform.createOriginAndMatrix(g.Point3d.create(-1, 2, 3), g.Matrix3d.createRotationAroundVector(g.Vector3d.create(4, 2, -1), g.Angle.createDegrees(30)));
    return undefined;
  }

  public static createDefaultYawPitchRollAngles(select: number): g.YawPitchRollAngles | undefined {
    switch (select) {
      case 0:
        return g.YawPitchRollAngles.createDegrees(0, 0, 0);
      case 1:
        return g.YawPitchRollAngles.createDegrees(30, 0, 0);
      case 2:
        return g.YawPitchRollAngles.createDegrees(0, 60, 0);
      case 3:
        return g.YawPitchRollAngles.createDegrees(0, 0, 45);
      case 4:
        return g.YawPitchRollAngles.createDegrees(20, 10, 40);
      case 5:
        return g.YawPitchRollAngles.createDegrees(-20, 0.1, 39);
    }
    return undefined;
  }

  public static createDefaultMap4d(select: number): g.Map4d | undefined {
    if (select === 0)
      return g.Map4d.createIdentity();
    const matrix = SimpleFactory.createDefaultMatrix4d(select);
    if (matrix !== undefined) {
      const inverse = matrix.createInverse();
      if (inverse)
        return g.Map4d.createRefs(matrix, inverse);
    }
    return undefined;
  }

  public static createDefaultMatrix4d(select: number): g.Matrix4d | undefined {
    switch (select) {
      case 0:
        return g.Matrix4d.createZero();   // and that is singular!!!
      case 1:
        return g.Matrix4d.createIdentity();
      case 2:
        return g.Matrix4d.createTranslationAndScaleXYZ(1, 3, 2, 3, 2, 4);
      case 2:
        return g.Matrix4d.createRowValues(
          12, 1, 0.2, 0.1,
          0.13, 10, 1.1, 2,
          -0.3, 0.9, 12, 0.8,
          0.2, -0.23, 0.26, 15);
    }
    return undefined;
  }

  public static createDefaultPoint4d(select: number): g.Point4d | undefined {
    if (select === 0)
      return g.Point4d.create();
    if (select === 1)
      return g.Point4d.create(1, 2, 3, 4);
    if (select === 2)
      return g.Point4d.create(Math.sqrt(2), Math.sqrt(3), -Math.expm1(2), 11 / 13);
    return undefined;
  }

  public static createDefaultComplex(select: number): g.Complex | undefined {
    switch (select) {
      case 0:
        return g.Complex.create();
      case 1:
        return g.Complex.create(1, 2);
    }
    return undefined;
  }
}
