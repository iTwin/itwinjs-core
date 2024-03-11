/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// import { expect } from "chai";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { PointString3d } from "../../curve/PointString3d";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Plane3dByOriginAndVectors } from "../../geometry3d/Plane3dByOriginAndVectors";
import { Range1d, Range2d, Range3d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Transform } from "../../geometry3d/Transform";
import { YawPitchRollAngles } from "../../geometry3d/YawPitchRollAngles";
import { Map4d } from "../../geometry4d/Map4d";
import { Matrix4d } from "../../geometry4d/Matrix4d";
import { Point4d } from "../../geometry4d/Point4d";
import { Complex } from "../../numerics/Complex";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { SimpleFactory } from "../SimpleFactory";

let noisy = 0;
function report(a: any, b: any) {
  if (noisy > 0)
    GeometryCoreTestIO.consoleLog(a);
  if (noisy > 10)
    GeometryCoreTestIO.consoleLog(b);
}
function reportType(a: any) {
  if (noisy > 0)
    GeometryCoreTestIO.consoleLog(a);
}
/**
 * Verify toJSON and fromJSON for various classes.
 */
describe("SimpleFactory ", () => {
  it("FromJSON", () => {
    noisy = 0;
    const ck = new Checker();
    const maxTest = 10;
    {
      reportType("LineSegment3d");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultLineSegment3d(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = LineSegment3d.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("LineString3d");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultLineString3d(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = LineString3d.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("PointString3d");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultPointString3d(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = PointString3d.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("Angle");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultAngle(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = Angle.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("AngleSweep");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultAngleSweep(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = AngleSweep.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("Matrix3d");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultMatrix3d(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = Matrix3d.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("Plane3dByOriginAndUnitNormal");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultPlane3dByOriginAndUnitNormal(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = Plane3dByOriginAndUnitNormal.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("Plane3dByOriginAndVectors");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultPlane3dByOriginAndVectors(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = Plane3dByOriginAndVectors.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("Range3d");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultRange3d(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = Range3d.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("Range1d");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultRange1d(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = Range1d.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("Range2d");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultRange2d(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = Range2d.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("Ray3d");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultRay3d(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = Ray3d.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("Transform");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultTransform(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = Transform.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("YawPitchRollAngles");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultYawPitchRollAngles(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = YawPitchRollAngles.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("Map4d");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultMap4d(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = Map4d.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("Matrix4d");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultMatrix4d(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = Matrix4d.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("Point4d");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultPoint4d(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = Point4d.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

    {
      reportType("Complex");
      for (let i = 0; i < maxTest; i++) {
        const a = SimpleFactory.createDefaultComplex(i);
        if (a === undefined)
          break;
        const json = a.toJSON();
        const b = Complex.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

  });
});
