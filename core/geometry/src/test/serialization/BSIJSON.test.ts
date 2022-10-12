/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
/* eslint-disable no-console, comma-dangle, quote-props */
// Requires for grabbing json object from external file
import * as fs from "fs";
import { Arc3d } from "../../curve/Arc3d";
import { CoordinateXYZ } from "../../curve/CoordinateXYZ";
import { BagOfCurves } from "../../curve/CurveCollection";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { ParityRegion } from "../../curve/ParityRegion";
import { Path } from "../../curve/Path";
import { PointString3d } from "../../curve/PointString3d";
import { IntegratedSpiral3d } from "../../curve/spiral/IntegratedSpiral3d";
import { UnionRegion } from "../../curve/UnionRegion";
import { BeJSONFunctions } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { NullGeometryHandler } from "../../geometry3d/GeometryHandler";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Plane3dByOriginAndVectors } from "../../geometry3d/Plane3dByOriginAndVectors";
import { Point2d, Vector2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d, Range2d, Range3d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Segment1d } from "../../geometry3d/Segment1d";
import { Transform } from "../../geometry3d/Transform";
import { YawPitchRollAngles } from "../../geometry3d/YawPitchRollAngles";
import { Map4d } from "../../geometry4d/Map4d";
import { Matrix4d } from "../../geometry4d/Matrix4d";
import { Point4d } from "../../geometry4d/Point4d";
import { Complex } from "../../numerics/Complex";
import { IndexedPolyface } from "../../polyface/Polyface";
import { Sample } from "../../serialization/GeometrySamples";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { Checker } from "../Checker";

// cspell::word bsijson

// Variables used for testing
let outputFolderPath = "./src/test/output";

// Output folder typically not tracked by git... make directory if not there
if (!fs.existsSync(outputFolderPath))
  fs.mkdirSync(outputFolderPath);
outputFolderPath = `${outputFolderPath}/`;
if (!fs.existsSync(outputFolderPath))
  fs.mkdirSync(outputFolderPath);

const bsiJsonPunchList: object[] = [];
let previousConstructor: object;

Checker.noisy.printJSONSuccess = false;
Checker.noisy.printJSONFailure = true;

/** Compares the constructor references of objects */
function isDifferentTypeName(obj: object, noisy: boolean = false): boolean {
  if (!obj.constructor)   // Unsure of case in which this would equate to false
    return true;
  if (obj.constructor) {
    if (obj.constructor !== previousConstructor) {
      if (noisy)
        console.log("First ", obj.constructor.name);
      previousConstructor = obj.constructor;
      return true;
    }
    return false;
  }

  return true;
}

function exerciseGo(obj: any, noisy: boolean): number {
  let errors = 0;
  if (noisy) {
    console.log("**");
    console.log("Type", typeof obj);
    console.log("  log format", obj);
    console.log("  stringify", JSON.stringify(obj));
    if ((obj as BeJSONFunctions).toJSON())
      console.log("BSIJSONValues", (obj as BeJSONFunctions).toJSON());
  }
  if (obj instanceof GeometryQuery) {

    const clone = obj.clone();
    if (!(clone !== undefined && clone instanceof GeometryQuery && clone.isSameGeometryClass(obj))) {
      errors++;
      console.log("clone failure ", obj);
    }
    const gq = obj;
    // heavy object ... method fulfillment assured by inheritance.
    let imjsObject = IModelJson.Writer.toIModelJson(gq);
    if (!imjsObject) {
      console.log("GeometryQuery object did not convert to IModelJson", obj);
      // repeat call for so easy to catch in debugger. ..
      imjsObject = IModelJson.Writer.toIModelJson(gq);
    } else {
      const firstAppearance = isDifferentTypeName(obj);
      let obj1 = IModelJson.Reader.parse(imjsObject) as GeometryQuery;
      if (!obj1) {
        console.log(" imjs object roundtrips to empty ", obj);
        // repeat call for so easy to catch in debugger. ..
        obj1 = IModelJson.Reader.parse(imjsObject) as GeometryQuery;
      } else {
        if (noisy || (firstAppearance && Checker.noisy.bsiJSONFirstAppearance)) {
          console.log("original", obj);
          console.log("imjsObject", imjsObject);
        }
        if (!gq.isAlmostEqual(obj1)) {
          // repeat call for so easy to catch in debugger. ..
          obj1 = IModelJson.Reader.parse(imjsObject) as GeometryQuery;
          console.log("RoundTrip but not equal ", gq.isAlmostEqual(obj1), obj, obj1);
          errors++;
        }
      }
    }
  } else if (!obj.toJSON) {
    console.log("\n   **** not BSIJSONValues ***", obj);
    bsiJsonPunchList.push({ toJSONNotSupported: obj });
    errors++;
  } else {
    // This is a leaf-level bsijson ...
    if (!obj.setFrom)
      bsiJsonPunchList.push({ noSetFromMethod: obj });

    if (!obj.clone)
      bsiJsonPunchList.push({ noCloneMethod: obj });
    if (!obj.isAlmostEqual
      && !(obj.isAlmostEqualRadiansAllowPeriodShift || obj.isAlmostEqualNoPeriodShift))
      bsiJsonPunchList.push({ noAlmostEqualMethod: obj });

    if (isDifferentTypeName(obj) && Checker.noisy.bsiJSONFirstAppearance)
      console.log(obj, "first toJSON() ==>", (obj as BeJSONFunctions).toJSON());
    const jsonFuncs = obj as BeJSONFunctions;
    const asJson = jsonFuncs.toJSON();
    if (asJson === undefined) {
      errors++;
    } else {
      const obj1 = obj.clone();
      obj1.setFromJSON(asJson);
    }
  }
  return errors;
}
function exercise(obj: any, noisy: boolean = Checker.noisy.bsiJSON): number {
  return exerciseGo(obj, noisy);
}
describe("BSIJSON.ExerciseAllTypes", () => {
  const ck = new Checker();
  Checker.noisy.bsiJSONFirstAppearance = false;
  it("BSIJSON.ExerciseAllTypes", () => {
    // output various types in toJSON form and via console default.
    let errors = 0;

    {
      let a;
      for (a of Sample.angle) {
        exercise(a);
        const a1 = Angle.fromJSON(a.toJSON());
        expect(a.isAlmostEqualAllowPeriodShift(a1)).equals(true);
      }
    }
    {
      let a;
      for (a of Sample.point3d) {
        exercise(a);
        const a1 = Point3d.fromJSON(a.toJSON());
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }

    {
      let a;
      for (a of Sample.point2d) {
        exercise(a);
        const a1 = Point2d.fromJSON(a.toJSON());
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }

    {
      let a;
      for (a of Sample.point4d) {
        exercise(a);
        const a1 = Point4d.fromJSON(a.toJSON());
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }

    {
      let a;
      for (a of Sample.vector2d) {
        exercise(a);
        let a1 = Vector2d.fromJSON(a.toJSON());
        // console.log(a, a1);
        if (!a.isAlmostEqual(a1)) {
          console.log("FAIL", a, a1);
          a1 = Vector2d.fromJSON(a.toJSON());
        }
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }
    {
      let a;
      for (a of Sample.createNonZeroVectors()) {
        exercise(a);
        let a1 = Vector3d.fromJSON(a.toJSON());
        // console.log(a, a1);
        if (!a.isAlmostEqual(a1)) {
          console.log("FAIL", a, a1);
          a1 = Vector3d.fromJSON(a.toJSON());
        }
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }
    {
      const a = YawPitchRollAngles.createDegrees(10, 20, 30);
      exercise(a);
      const a1 = YawPitchRollAngles.fromJSON(a.toJSON());
      expect(a.isAlmostEqual(a1)).equals(true);
    }

    {
      const a = Complex.create(1, 2);
      exercise(a);
      const a1 = Complex.fromJSON(a.toJSON());
      // console.log(a, a1);
      expect(a.isAlmostEqual(a1)).equals(true);
    }

    {
      let a;
      for (a of Sample.plane3dByOriginAndUnitNormal) {
        exercise(a);
        const a1 = Plane3dByOriginAndUnitNormal.fromJSON(a.toJSON());
        // console.log(a, a1);
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }

    {
      let a;
      for (a of Sample.ray3d) {
        exercise(a);
        const a1 = Ray3d.fromJSON(a.toJSON());
        // console.log(a, a1);
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }

    {
      let a;
      for (a of Sample.angle) {
        exercise(a);
        const a1 = Angle.fromJSON(a.toJSON());
        // console.log(a, a1);
        expect(a.isAlmostEqualNoPeriodShift(a1)).equals(true);
      }
    }

    {
      let a;
      for (a of Sample.angleSweep) {
        exercise(a);
        const a1 = AngleSweep.fromJSON(a.toJSON());
        // console.log(a, a1);
        expect(a.isAlmostEqualNoPeriodShift(a1)).equals(true);
      }
    }

    {
      let a;
      for (a of Sample.lineSegment3d) {
        exercise(a);
        let a1 = LineSegment3d.fromJSON(a.toJSON());
        // console.log(a, a1);
        if (!a.isAlmostEqual(a1)) {
          console.log("FAIL", a, a1);
          a1 = LineSegment3d.fromJSON(a.toJSON());
        }
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }

    errors += exercise(Arc3d.createUnitCircle());

    {
      let a;
      const linestrings = Sample.createLineStrings();
      for (a of linestrings) {
        exercise(a);
        let a1 = LineString3d.fromJSON(a.toJSON());
        // console.log(a, a1);
        if (!a.isAlmostEqual(a1)) {
          console.log("FAIL", a, a1);
          a1 = LineString3d.fromJSON(a.toJSON());
        }
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }
    {
      let a;
      for (a of Sample.range1d) {
        exercise(a);
        let a1 = Range1d.fromJSON(a.toJSON());
        // console.log(a, a1);
        if (!a.isAlmostEqual(a1)) {
          console.log("FAIL", a, a1);
          a1 = Range1d.fromJSON(a.toJSON());
        }
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }
    {
      let a;
      for (a of Sample.range2d) {
        exercise(a);
        let a1 = Range2d.fromJSON(a.toJSON());
        // console.log(a, a1);
        if (!a.isAlmostEqual(a1)) {
          console.log("FAIL", a, a1);
          a1 = Range2d.fromJSON(a.toJSON());
        }
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }
    {
      let a;
      for (a of Sample.range3d) {
        exercise(a);
        let a1 = Range3d.fromJSON(a.toJSON());
        // console.log(a, a1);
        if (!a.isAlmostEqual(a1)) {
          console.log("FAIL", a, a1);
          a1 = Range3d.fromJSON(a.toJSON());
        }
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }

    {
      let a;
      for (a of Sample.createInvertibleTransforms()) {
        exercise(a);
        let a1 = Transform.fromJSON(a.toJSON());
        // console.log (a.toJSON ());
        // console.log(a, a1);
        if (!a.isAlmostEqual(a1)) {
          console.log("FAIL", a, a1);
          a1 = Transform.fromJSON(a.toJSON());
        }
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }
    // exercise variants of row-major array json ..
    {
      const a1 = Transform.fromJSON([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const a2 = Transform.fromJSON([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]);
      ck.testTransform(a1, a2, "Transform.fromJSON via [] and [][] variants.");
    }
    {
      let a;
      for (a of Sample.createMatrix3dArray()) {
        exercise(a);
        let a1 = Matrix3d.fromJSON(a.toJSON());
        // console.log (a.toJSON ());
        // console.log(a, a1);
        if (!a.isAlmostEqual(a1)) {
          console.log("FAIL", a, a1);
          a1 = Matrix3d.fromJSON(a.toJSON());
        }
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }

    {
      let a;
      const matrix4d = Sample.createMatrix4ds(true);
      for (a of matrix4d) {
        exercise(a);
        let a1 = Matrix4d.fromJSON(a.toJSON());
        // console.log(a, a1);
        if (!a.isAlmostEqual(a1)) {
          console.log("FAIL", a, a1);
          a1 = Matrix4d.fromJSON(a.toJSON());
        }
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }

    {
      let a;
      const map4d = Sample.createMap4ds();
      for (a of map4d) {
        exercise(a);
        let a1 = Map4d.fromJSON(a.toJSON());
        // console.log(a, a1);
        if (!a.isAlmostEqual(a1)) {
          console.log("FAIL", a, a1);
          a1 = Map4d.fromJSON(a.toJSON());
        }
        expect(a.isAlmostEqual(a1)).equals(true);
      }
    }

    {
      const data = Sample.createSimplePaths(true);
      let d; for (d of data) { exercise(d, false); }
    }

    {
      const data = Sample.createSimpleLoops();
      let d; for (d of data) { exercise(d, false); }
    }

    {
      const data = Sample.createSimpleParityRegions();
      let d; for (d of data) { exercise(d, false); }
    }
    {
      const data = Sample.createSimpleUnions();
      let d; for (d of data) { exercise(d, false); }
    }

    {
      const data = Sample.createBsplineCurves(true);
      let d; for (d of data) { exercise(d, false); }
    }

    {
      const data = Sample.createSimplePointStrings();
      let d; for (d of data) { exercise(d, false); }
    }
    // exercise(CurveChain.createZero());
    // exercise(Path.createZero());
    // exercise(Loop.createZero());
    // exercise(ParityRegion.createZero());
    // exercise(UnionRegion.createZero());
    // exercise(CurveCollection.createZero());o

    ck.testExactNumber(0, errors, "errors exercising geometry");
    //    errors += exercise({ q: 1 });
    if (bsiJsonPunchList.length > 0)
      console.log(bsiJsonPunchList);

    ck.checkpoint("BSIJSON.ExerciseAllTypes");
    expect(ck.getNumErrors()).equals(0);
    expect(errors).equals(0);
  });
});

function exerciseBSIJSONValuesQuick(name: string, obj: any) {
  if (Checker.noisy.bsiJsonValuesQuick && obj as BeJSONFunctions) {
    console.log(`${name}.toJSON():`);
    console.log(obj.toJSON());
  }
}

describe("BSIJSONValuesQuick", () => {
  const ck = new Checker();
  it("Test1", () => {
    exerciseBSIJSONValuesQuick("Point2d", Point2d.create(1, 2));
    exerciseBSIJSONValuesQuick("Point3d", Point3d.create(1, 2, 3));
    exerciseBSIJSONValuesQuick("Point4d", Point4d.create(1, 2, 3, 4));
    exerciseBSIJSONValuesQuick("Vector2d", Vector2d.create(1, 2));
    exerciseBSIJSONValuesQuick("Vector3d", Vector3d.create(1, 2, 3));
    exerciseBSIJSONValuesQuick("Angle", Angle.createDegrees(90));
    exerciseBSIJSONValuesQuick("AngleSweep", AngleSweep.createStartEndDegrees(45, 90));
    exerciseBSIJSONValuesQuick("Plane3dByOriginAndUnitNormal", Plane3dByOriginAndUnitNormal.create(Point3d.create(1, 2, 3), Vector3d.create(6, 2, 1)));
    exerciseBSIJSONValuesQuick("Ray3d", Ray3d.createXYZUVW(1, 2, 3, 10, 5, 9));
    exerciseBSIJSONValuesQuick("Plane3dByOriginAndVectors", Plane3dByOriginAndVectors.createOriginAndVectors
      (Point3d.create(1, 2, 3), Vector3d.create(5, 6, 3), Vector3d.create(-6, 5, 1)));
    exerciseBSIJSONValuesQuick("YawPitchRollAngles", YawPitchRollAngles.createDegrees(10, 20, 30));
    exerciseBSIJSONValuesQuick("Range3d", Range3d.createXYZXYZ(1, 2, 3, 10, 11, 20));
    exerciseBSIJSONValuesQuick("Matrix3d", Matrix3d.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9));
    exerciseBSIJSONValuesQuick("Transform", Transform.createOriginAndMatrix(
      Point3d.create(10, 20, 30), Matrix3d.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9)));
    exerciseBSIJSONValuesQuick("Matrix4d", Matrix4d.createRowValues(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16));
    exerciseBSIJSONValuesQuick("Complex", Complex.create(1, 2));

    ck.checkpoint("BSIJSONValuesQuick.Test1");
    expect(ck.getNumErrors()).equals(0);
  });
});

class TempHandler extends NullGeometryHandler {
  public handleLineSegment(_g: LineSegment3d): any { return true; }
}

describe("ExerciseGeometryHandler", () => {
  const ck = new Checker();
  const tempHandler = new TempHandler();
  it("Ensure null handler fails for only non-implemented methods", () => {
    const segment = LineSegment3d.createXYXY(0, 0, 0, 0);
    const origin = Point3d.create();
    ck.testTrue(tempHandler.handleLineSegment(segment));
    ck.testUndefined(tempHandler.handleLineSegment3d(segment));
    ck.testUndefined(tempHandler.handleLineString3d(LineString3d.create()));
    ck.testUndefined(tempHandler.handlePointString3d(PointString3d.create()));
    ck.testUndefined(tempHandler.handleArc3d(Arc3d.createUnitCircle()));
    ck.testUndefined(tempHandler.handleCurveCollection(Sample.createSimpleLoops()[0]));
    ck.testUndefined(tempHandler.handleBSplineCurve3d(Sample.createBsplineCurves()[0]));
    ck.testUndefined(tempHandler.handleBSplineSurface3d(Sample.createXYGridBsplineSurface(4, 3, 3, 2)!));
    ck.testUndefined(tempHandler.handleCoordinateXYZ(CoordinateXYZ.create(origin)));
    ck.testUndefined(tempHandler.handleBSplineSurface3dH(Sample.createWeightedXYGridBsplineSurface(4, 3, 3, 2, 1.0, 1.1, 0.9, 1.0)!));
    ck.testUndefined(tempHandler.handleIndexedPolyface(IndexedPolyface.create()));
    ck.testUndefined(tempHandler.handleTransitionSpiral(
      IntegratedSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1), AngleSweep.create360(), Segment1d.create(0, 1),
        Transform.createIdentity())!));
    ck.testUndefined(tempHandler.handleSphere(Sample.createSpheres()[0]));
    ck.testUndefined(tempHandler.handleCone(Sample.createCones()[0]));
    ck.testUndefined(tempHandler.handleBox(Sample.createBoxes()[0]));
    ck.testUndefined(tempHandler.handleTorusPipe(Sample.createTorusPipes()[0]));
    ck.testUndefined(tempHandler.handleLinearSweep(Sample.createSimpleLinearSweeps()[0]));
    ck.testUndefined(tempHandler.handleRotationalSweep(Sample.createSimpleRotationalSweeps()[0]));
    ck.testUndefined(tempHandler.handleRuledSweep(Sample.createRuledSweeps()[0]));

    ck.testUndefined(tempHandler.handlePath(Path.create()));
    ck.testUndefined(tempHandler.handleLoop(Loop.create()));
    ck.testUndefined(tempHandler.handleParityRegion(ParityRegion.create()));
    ck.testUndefined(tempHandler.handleUnionRegion(UnionRegion.create()));
    ck.testUndefined(tempHandler.handleBagOfCurves(BagOfCurves.create()));

  });
});
