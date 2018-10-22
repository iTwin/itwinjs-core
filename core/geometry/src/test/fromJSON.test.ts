/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */
import { Checker } from "./Checker";
// import { expect } from "chai";

import * as g from "../geometry-core";
import { SimpleFactory } from "./SimpleFactory";
let noisy = 0;
function report(a: any, b: any) {
  if (noisy > 0)
    console.log(a);
  if (noisy > 10)
    console.log(b);
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
      console.log("LineSegment3d");
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
      console.log("LineString3d");
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
      console.log("PointString3d");
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
      console.log("Angle");
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
      console.log("AngleSweep");
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
      console.log("Matrix3d");
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
      console.log("Plane3dByOriginAndUnitNormal");
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
      console.log("Plane3dByOriginAndVectors");
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
      console.log("Range3d");
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
      console.log("Range1d");
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
      console.log("Range2d");
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
      console.log("Ray3d");
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
      console.log("Transform");
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
      console.log("YawPitchRollAngles");
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
      console.log("Map4d");
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
      console.log("Matrix4d");
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
      console.log("Point4d");
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
      console.log("Complex");
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
