/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { FacetFaceData } from "../../polyface/FacetFaceData";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/* eslint-disable no-console */

describe("FacetFaceData", () => {

  it("HelloWorld", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const ffd = FacetFaceData.createNull();
    const polyfaceA = Sample.createTriangularUnitGridPolyface(
      Point3d.create(0, 0, 0),
      Vector3d.unitX(2.5),
      Vector3d.unitY(4), 2, 3, true, true, true);
    ffd.setParamDistanceRangeFromNewFaceData(polyfaceA, 0, polyfaceA.facetCount);

    const paramRange = ffd.paramRange;
    const distanceRange = ffd.paramDistanceRange;

    const ffdB0 = FacetFaceData.createNull();
    const ffdB1 = ffd.clone(ffdB0);
    ck.testTrue(ffdB0 === ffdB1, "clone to result");
    const scale = 3.5;
    ffdB1.scaleDistances(3.5);
    const distanceRange1 = ffdB1.paramDistanceRange;

    for (const uv of [Point2d.create(0, 0), Point2d.create(0.2, 0.5), Point2d.create(0.75, 0.8)]) {
      const uvA = paramRange.fractionToPoint(uv.x, uv.y);
      const uvB = distanceRange.fractionToPoint(uv.x, uv.y);
      const uvAtoB = ffd.convertParamToDistance(uvA);
      ck.testPoint2d(uvB, uvAtoB, "range to range mapping", uv);

      const uvFraction = ffd.convertParamToNormalized(uvA);
      ck.testPoint2d(uv, uvFraction, "Fraction round trip");

      const uvB1 = distanceRange1.fractionToPoint(uv.x, uv.y);
      ck.testCoordinate(scale * uvB.x, uvB1.x, "clone, scale x");
      ck.testCoordinate(scale * uvB.y, uvB1.y, "clone, scale y");
    }

    // confirm failure with start face out of range
    ck.testFalse(ffdB0.setParamDistanceRangeFromNewFaceData(polyfaceA, 100, 110));
    // confirm failure with end face less than start face
    ck.testFalse(ffdB0.setParamDistanceRangeFromNewFaceData(polyfaceA, 2, 0));
    ck.testFalse(ffdB0.setParamDistanceRangeFromNewFaceData(polyfaceA, 2, 2));

    const polyfaceB = Sample.createTriangularUnitGridPolyface(
      Point3d.create(0, 0, 0),
      Vector3d.unitX(),
      Vector3d.unitY(), 2, 3, false, false, false);
    // confirm failure if there are no params in the polyface
    ck.testFalse(ffdB0.setParamDistanceRangeFromNewFaceData(polyfaceB, 2, 3));

    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "AddPolyface");
    expect(ck.getNumErrors()).equals(0);
  });
});
