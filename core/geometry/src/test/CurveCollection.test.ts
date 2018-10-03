/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Sample } from "../serialization/GeometrySamples";
import { CurveCollection } from "../curve/CurveCollection";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";
import { Checker } from "./Checker";
import { expect } from "chai";
// import { prettyPrint } from "./testFunctions";
// import { CurveLocationDetail } from "../curve/CurvePrimitive";
/* tslint:disable:no-console */

function verifyCurveCollection(ck: Checker, collection: CurveCollection) {
  const scaleFactor = 3.0;
  const scaleTransform = Transform.createScaleAboutPoint(Point3d.createZero(), scaleFactor);
  const length0 = collection.sumLengths();
  const gap0 = collection.maxGap();
  const range0 = collection.range();

  const path2 = collection.clone();
  if (ck.testPointer(path2, "clone!!") && path2) {
    const length2 = path2.sumLengths();
    ck.testCoordinate(length0, length2, "path2.sumLengths");
  }
  const path3 = collection.cloneTransformed(scaleTransform);
  if (ck.testPointer(path3) && path3) {
    if (!ck.testBoolean(false, path3.isAlmostEqual(collection), "cloneTransform not almostEqual")) {
      const path3A = collection.cloneTransformed(scaleTransform);
      if (ck.testPointer(path3A) && path3A) {
        ck.testBoolean(false, path3A.isAlmostEqual(collection), "cloneTransform not almostEqual");
      }
    }
  }

  ck.testBoolean(true, collection.isAlmostEqual(collection), "isAlmostEqual on self");
  // console.log (prettyPrint (collection));
  collection.tryTransformInPlace(scaleTransform);
  const length1 = collection.sumLengths();
  // console.log (prettyPrint (collection));
  const gap1 = collection.maxGap();
  const range1 = collection.range();

  if (path3) {
    const length3 = path3.sumLengths();
    ck.testCoordinate(length1, length3, "length of clone(transfom), transformInPlace");
    const path5 = collection.cloneTransformed(scaleTransform)!;
    path5.sumLengths();

  }

  ck.testCoordinate(length0 * scaleFactor, length1, "scaled length");
  ck.testCoordinate(gap0 * scaleFactor, gap1, "scaled maxGap");
  ck.testCoordinate(range0.xLength() * scaleFactor, range1.xLength(), "scaled rangeX");
  ck.testCoordinate(range0.yLength() * scaleFactor, range1.yLength(), "scaled rangeY");
  ck.testCoordinate(range0.zLength() * scaleFactor, range1.zLength(), "scaled rangeZ");
  const path4 = collection.cloneStroked();
  ck.testPointer(path4, "clone Stroked");

  ck.testFalse(collection.isOpenPath && collection.isClosedPath, "Collection cannot be both open and closed path");
  ck.testFalse(collection.isOpenPath && collection.isAnyRegionType, "Collection cannot be both open and region");
  if (collection.children) {
    let i = 0;
    for (const child of collection.children) {
      const child1 = collection.getChild(i++);
      ck.testTrue(child === child1, "collection.getChild matcehs iterator ");
    }
  }

}
describe("CurveCollection", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    for (const data of Sample.createBagOfCurves()) verifyCurveCollection(ck, data);
    for (const data of Sample.createSimpleParityRegions()) verifyCurveCollection(ck, data);
    for (const data of Sample.createSimplePaths(true)) verifyCurveCollection(ck, data);
    for (const data of Sample.createSimpleLoops()) verifyCurveCollection(ck, data);
    for (const data of Sample.createSimpleUnions()) verifyCurveCollection(ck, data);
    ck.checkpoint("CurveCollection.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
  it("hasNonLinearPrimitives", () => {
    const ck = new Checker();
    const counts = { nonLinearTrue: 0, nonLinearFalse: 1 };
    for (const data of Sample.createBagOfCurves())
      if (data.checkForNonLinearPrimitives())
        counts.nonLinearTrue++;
      else
        counts.nonLinearFalse++;
    // We think (hard to prove!!) that the array of BagOfCurves had some members in each category ... flag if not.
    ck.testLE(0, counts.nonLinearFalse, "BagOfCurves samples should have some linear-only");
    ck.testLE(0, counts.nonLinearTrue, "BagOfCurves samples should have some nonLinear");
    ck.checkpoint("CurveCollection.hasNonLinearPrimitives");
    expect(ck.getNumErrors()).equals(0);
  });
});
