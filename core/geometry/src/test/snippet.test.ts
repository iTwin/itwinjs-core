/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import * as geometry from "../geometry-core";

/* tslint:disable:no-console */

// In geometry source tests, convert to string and emit to console.
// In browser or other playpen, implement this function appropriately.
function emit(...data: any[]) {
  const stringData = [];
  // Catch known types for special formatting.  Dispatch others unchanged.
  for (const d of data) {
    const imjs = geometry.IModelJson.Writer.toIModelJson(d);
    if (imjs !== undefined) {
      stringData.push(imjs);
    } else if (d.toJSON) {
      stringData.push(d.toJSON());
    } else {
      stringData.push(d);
    }
  }
  console.log(stringData);
}
// Typical snippets for sandbox windows . . . . These assume that
// the window alwyas has
// 1) the "import * as geometry" directive
// 2) An additional "import" directive to obtain an appropriate implemetation of "emit".

describe.only("Snippets", () => {
  it("Point3d", () => {
    const myPoint = geometry.Point3d.create(1, 2, 3);
    const myVector = geometry.Vector3d.create(3, 1, 0);
    emit(" Here is a point ", myPoint);
    emit(" Here is a vector ", myVector);
    emit(" Here is the point reached by moving 3 times the vector ", myPoint.plusScaled(myVector, 3));
  });

  it("LineSegment3d", () => {
    const mySegment = geometry.LineSegment3d.createXYXY(1, 2, 5, 1);
    emit("Here is a LineSegment3d ", mySegment);
    emit(mySegment);
  });

  it("Arc3d", () => {
    const myArc = geometry.Arc3d.createXY(geometry.Point3d.create(1, 2, 5), 1);
    emit("Here is an Arc3d ", myArc);
    emit("QuarterPoint of myArc is ", myArc.fractionToPoint(0.25));
  });

  it("LineString3d", () => {
    const myLineString = geometry.LineString3d.createPoints([
      geometry.Point3d.create(1, 0, 0),
      geometry.Point3d.create(2, 1, 0),
      geometry.Point3d.create(1, 3, 0),
      geometry.Point3d.create(1, 4, 0),
    ]);
    emit("Here is a LineString3d ", myLineString);
    emit("The length of myLineString is ", myLineString.curveLength());
  });
});
