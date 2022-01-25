/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// import { expect } from "chai";
import * as g from "../../core-geometry";
/* eslint-disable no-console */
import { Checker } from "../Checker";
import { SimpleFactory } from "../SimpleFactory";

let noisy = 0;
function report(a: any, b: any) {
  if (noisy > 0)
    console.log(a);
  if (noisy > 10)
    console.log(b);
}
function reportType(a: any) {
  if (noisy > 0)
    console.log(a);
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
        const b = g.LineSegment3d.fromJSON(json);
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
        const b = g.LineString3d.fromJSON(json);
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
        const b = g.PointString3d.fromJSON(json);
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
        const b = g.Angle.fromJSON(json);
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
        const b = g.AngleSweep.fromJSON(json);
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
        const b = g.Matrix3d.fromJSON(json);
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
        const b = g.Plane3dByOriginAndUnitNormal.fromJSON(json);
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
        const b = g.Plane3dByOriginAndVectors.fromJSON(json);
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
        const b = g.Range3d.fromJSON(json);
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
        const b = g.Range1d.fromJSON(json);
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
        const b = g.Range2d.fromJSON(json);
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
        const b = g.Ray3d.fromJSON(json);
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
        const b = g.Transform.fromJSON(json);
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
        const b = g.YawPitchRollAngles.fromJSON(json);
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
        const b = g.Map4d.fromJSON(json);
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
        const b = g.Matrix4d.fromJSON(json);
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
        const b = g.Point4d.fromJSON(json);
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
        const b = g.Complex.fromJSON(json);
        report(a, b);
        ck.testTrue(a.isAlmostEqual(b));
      }
    }

  });
});
