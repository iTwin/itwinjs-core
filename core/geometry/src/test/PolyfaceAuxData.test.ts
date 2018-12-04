/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Checker } from "./Checker";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";
import { PolyfaceAuxData, AuxChannel, AuxChannelData, AuxChannelDataType } from "../polyface/Polyface";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Arc3d } from "../curve/Arc3d";
import { LineString3d } from "../curve/LineString3d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";
import { IModelJson } from "../serialization/IModelJsonSchema";
import { expect } from "chai";

/** Create a polyface representing a cantilever beam with [[PolyfaceAuxData]] representing the stress and deflection. */
function createCantileverBeamPolyface() {
  const beamRadius = 10.0;
  const beamLength = 100.0;
  const facetSize = 1.0;
  const builder = PolyfaceBuilder.create();
  const crossSectionArc = Arc3d.create(Point3d.createZero(), Vector3d.create(0.0, beamRadius, 0.0), Vector3d.create(0.0, 0.0, beamRadius));
  const strokedCrossSection = LineString3d.create();
  const strokeOptions = StrokeOptions.createForCurves();
  strokeOptions.maxEdgeLength = facetSize;
  crossSectionArc.emitStrokes(strokedCrossSection, strokeOptions);

  for (let x = 0.0; x < beamLength; x += facetSize)
    builder.addBetweenTransformedLineStrings(strokedCrossSection, Transform.createTranslationXYZ(x, 0.0, 0.0), Transform.createTranslationXYZ(x + facetSize, 0.0, 0.0), true);

  const polyface = builder.claimPolyface();
  const heightData: number[] = [];

  const scratchPoint = Point3d.create();
  for (let i = 0; i < polyface.data.point.length; i++) {
    const point = polyface.data.point.atPoint3dIndex(i, scratchPoint) as Point3d;
    heightData.push(point.z);
  }
  const heightChannel = new AuxChannel([new AuxChannelData(0.0, heightData)], AuxChannelDataType.Distance, "Height", "");

  polyface.data.auxData = new PolyfaceAuxData([heightChannel], polyface.data.pointIndex);

  return polyface;
}
// ---------------------------------------------------------------------------------------------------

it("testRoundTrip", () => {
  const ck = new Checker();
  const beam = createCantileverBeamPolyface();

  const writer = new IModelJson.Writer();

  const json = writer.emit(beam);
  const roundTrippedBeam = IModelJson.Reader.parse(json);

  ck.testTrue(beam.isAlmostEqual(roundTrippedBeam));
  expect(ck.getNumErrors()).equals(0);
});
