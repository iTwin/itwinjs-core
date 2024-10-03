/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { Arc3d } from "../../curve/Arc3d";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineString3d } from "../../curve/LineString3d";
import { Path } from "../../curve/Path";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { NumberArray, Point3dArray } from "../../geometry3d/PointHelpers";
import { Transform } from "../../geometry3d/Transform";
import { AuxChannel, AuxChannelData, AuxChannelDataType, PolyfaceAuxData } from "../../polyface/AuxData";
import { IndexedPolyface } from "../../polyface/Polyface";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { BentleyGeometryFlatBuffer } from "../../serialization/BentleyGeometryFlatBuffer";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { ImportedSample } from "../ImportedSamples";

/** Create a polyface representing a cantilever beam with [[PolyfaceAuxData]] representing the stress and deflection. */
function createCantileverBeamPolyface(beamRadius: number = 10.0, beamLength: number = 100.0, facetSize: number = 1.0, zScale: number = 1.0) {

  const builder = PolyfaceBuilder.create();
  const crossSectionArc = Arc3d.create(Point3d.createZero(), Vector3d.create(0.0, beamRadius, 0.0), Vector3d.create(0.0, 0.0, beamRadius));
  const strokedCrossSection = LineString3d.create();
  const strokeOptions = StrokeOptions.createForCurves();
  strokeOptions.maxEdgeLength = facetSize;
  crossSectionArc.emitStrokes(strokedCrossSection, strokeOptions);
  // pack as a singleton path to touch "else"
  const path = Path.create(strokedCrossSection);
  for (let x = 0.0; x < beamLength; x += facetSize)
    builder.addBetweenTransformedLineStrings(path, Transform.createTranslationXYZ(x, 0.0, 0.0), Transform.createTranslationXYZ(x + facetSize, 0.0, 0.0), true);

  const polyface = builder.claimPolyface();
  const heightData: number[] = [];

  const scratchPoint = Point3d.create();
  for (let i = 0; i < polyface.data.point.length; i++) {
    const point = polyface.data.point.getPoint3dAtCheckedPointIndex(i, scratchPoint) as Point3d;
    heightData.push(point.z * zScale);
  }
  const heightChannel = new AuxChannel([new AuxChannelData(0.0, heightData)], AuxChannelDataType.Distance, "Height", "");

  polyface.data.auxData = new PolyfaceAuxData([heightChannel], polyface.data.pointIndex);

  return polyface;
}
// ---------------------------------------------------------------------------------------------------

describe("PolyfaceAuxData", () => {
  it("testRoundTrip", () => {
    const ck = new Checker();
    const beam = createCantileverBeamPolyface();

    const writer = new IModelJson.Writer();

    const json = writer.emit(beam);
    const roundTrippedBeam = IModelJson.Reader.parse(json);

    ck.testTrue(beam.isAlmostEqual(roundTrippedBeam));
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CreateAuxChannelData", () => {
    const ck = new Checker();
    const auxData0 = new AuxChannelData(1, [10, 11, 12]);
    const auxData1 = auxData0.clone();
    const auxData10 = new AuxChannelData(2, [10, 11, 12]);
    const auxData11 = new AuxChannelData(2, [10, 11, 12, 13]);
    const auxData12 = new AuxChannelData(2, [10, 21, 12]);
    ck.testTrue(auxData0.isAlmostEqual(auxData1, 1.0e-5));
    ck.testFalse(auxData0.isAlmostEqual(auxData10));
    ck.testFalse(auxData0.isAlmostEqual(auxData11));
    ck.testFalse(auxData0.isAlmostEqual(auxData12));

    expect(ck.getNumErrors()).toBe(0);
  });
  it("CreateAuxChannel", () => {
    const ck = new Checker();
    const data00 = new AuxChannelData(0, [1, 2, 3]);
    const data10 = new AuxChannelData(10, [11, 12, 13]);
    const data20 = new AuxChannelData(20, [21, 22, 25]);
    const data20B = new AuxChannelData(20, [21, 22, 26]);
    const channel0 = new AuxChannel([data00, data10, data20],
      AuxChannelDataType.Distance,
      "MyDistances",
      "MicrometerA");

    const channelA = new AuxChannel([data00, data10],
      AuxChannelDataType.Distance,
      "MyDistancesA",
      "MicrometerA");

    const channelB = new AuxChannel([data00, data20, data10],
      AuxChannelDataType.Distance,
      "MyDistancesB",
      "MicrometerA");

    const channelC = new AuxChannel([data00, data20, data10],
      AuxChannelDataType.Distance,
      "MyDistancesC",
      "MicrometerA");
    const channelD = new AuxChannel([data00, data20B, data10],
      AuxChannelDataType.Distance,
      "MyDistancesC",
      "MicrometerA");

    const channel1 = channel0.clone();
    ck.testTrue(channel0.isAlmostEqual(channel0));
    ck.testTrue(channel0.isAlmostEqual(channel1));

    ck.testFalse(channel0.isAlmostEqual(channelA));
    ck.testFalse(channel0.isAlmostEqual(channelB));
    ck.testFalse(channel0.isAlmostEqual(channelC));
    ck.testFalse(channelD.isAlmostEqual(channelC));

    ck.testExactNumber(data00.values.length, channel0.valueCount);
    const range00 = channel0.scalarRange!;
    ck.testTrue(range00.containsX(12), "channel range");
    ck.testFalse(range00.containsX(100), "channel range");

    for (const channelType of [AuxChannelDataType.Normal, AuxChannelDataType.Vector]) {
      const vectorData = new AuxChannelData(1, [10, 11, 12, 20, 21, 22, 30, 31, 32]);
      const vectorChannel = new AuxChannel([vectorData], channelType, "vector or normal data", "inputB");
      ck.testFalse(vectorChannel.isScalar, "vector type");
      ck.testUndefined(vectorChannel.scalarRange, "no scalarRange on vector channel");
      ck.testExactNumber(vectorChannel.entriesPerValue, 3, "3 members in vector data");
    }
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CreatePolyfaceAuxData", () => {
    const ck = new Checker();
    const beam = createCantileverBeamPolyface(10, 100, 1);
    const beam1 = createCantileverBeamPolyface(20, 25, 0.5);
    const beam2 = createCantileverBeamPolyface(20, 25, 0.5, 4.0);
    const auxDataA = beam.data.auxData;
    ck.testFalse(PolyfaceAuxData.isAlmostEqual(auxDataA, undefined));
    ck.testFalse(PolyfaceAuxData.isAlmostEqual(undefined, auxDataA));
    if (ck.testPointer(auxDataA)) {
      const auxDataB = beam.data.auxData!.clone();
      ck.testTrue(auxDataA.isAlmostEqual(auxDataB), "cloned PolyfaceAuxData");
      ck.testFalse(auxDataA.isAlmostEqual(beam1.data.auxData!, 1.0e-9));
    }
    ck.testFalse(beam1.isAlmostEqual(beam2));
    expect(ck.getNumErrors()).toBe(0);
  });

  it("Compress", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const mesh = ImportedSample.createPolyhedron62();
    if (ck.testType(mesh, IndexedPolyface, "imported mesh")) {
      const latitude = mesh.data.point.getPoint3dArray().map((pt: Point3d) => { return pt.z; });
      const latitudeChannel = new AuxChannel([new AuxChannelData(0, latitude)], AuxChannelDataType.Distance, "Latitude", "Time");

      const octant = mesh.data.point.getPoint3dArray().map((pt: Point3d) => { return Point3d.create(Geometry.split3Way01(pt.x), Geometry.split3Way01(pt.y), Geometry.split3Way01(pt.z)); });
      const octantChannel = new AuxChannel([new AuxChannelData(0, Point3dArray.packToNumberArray(octant))], AuxChannelDataType.Vector, "Octant", "Time");

      const mesh0 = mesh.clone();
      mesh0.data.auxData = new PolyfaceAuxData([latitudeChannel.clone()], mesh0.data.pointIndex.slice());
      mesh0.data.compress();
      ck.testFalse(NumberArray.isAlmostEqual(mesh.data.pointIndex, mesh0.data.auxData.indices, 0.0), "Single 1D channel AuxData was compressed");
      ck.testExactNumber(mesh0.data.auxData.channels[0].valueCount, 13, "Compress leaves expected number of AuxData 1D values");

      const mesh1 = mesh.clone();
      mesh1.data.auxData = new PolyfaceAuxData([octantChannel.clone()], mesh1.data.pointIndex.slice());
      mesh1.data.compress();
      ck.testFalse(NumberArray.isAlmostEqual(mesh.data.pointIndex, mesh1.data.auxData.indices, 0.0), "Single 3D channel AuxData was compressed");
      ck.testExactNumber(mesh1.data.auxData.channels[0].valueCount, 20, "Compress leaves expected number of AuxData 3D values");

      const mesh2 = mesh.clone();
      mesh2.data.auxData = new PolyfaceAuxData([latitudeChannel.clone(), octantChannel.clone()], mesh2.data.pointIndex.slice());
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh2);
      mesh2.data.compress();
      ck.testNumberArray(mesh.data.pointIndex, mesh2.data.auxData.indices, "Multichannel AuxData indices was untouched by compress");
      ck.testExactNumber(mesh2.data.auxData.channels[0].valueCount, 60, "Compress leaves multichannel AuxData 1D values untouched");
      ck.testExactNumber(mesh2.data.auxData.channels[1].valueCount, 60, "Compress leaves multichannel AuxData 3D values untouched");

      // sanity check roundtrips
      for (const meshWithAuxData of [mesh0, mesh1, mesh2]) {
        const bytes = BentleyGeometryFlatBuffer.geometryToBytes(meshWithAuxData, true);
        const meshFB = bytes ? BentleyGeometryFlatBuffer.bytesToGeometry(bytes, true) : undefined;
        const json = IModelJson.Writer.toIModelJson(meshWithAuxData);
        const meshJson = json ? IModelJson.Reader.parse(json) as IndexedPolyface : undefined;
        if (ck.testType(meshFB, IndexedPolyface) && ck.testType(meshJson, IndexedPolyface))
          ck.testTrue(meshFB.isAlmostEqual(meshJson), "roundtrip through FB compares to roundtrip through JSON");
      }

      // sanity check flatbuffer file write
      const bytes2 = BentleyGeometryFlatBuffer.geometryToBytes(mesh2, true);
      if (bytes2 && GeometryCoreTestIO.enableSave) {
        const dir = "PolyfaceAuxData";
        const filename = "Compress";
        GeometryCoreTestIO.writeByteArrayToTextFile(bytes2, dir, filename, undefined, "fbjs");  // used for fuzz seed
        const pathname = GeometryCoreTestIO.makeOutputDir(dir).concat(`/${filename}`).concat(".fb");
        GeometryCoreTestIO.writeBytesToFile(bytes2, pathname);
        const bytes3 = GeometryCoreTestIO.readBytesFromFile(pathname);
        if (ck.testDefined(bytes3, "read file")) {
          ck.testTrue(bytes2.length === bytes3.length, "read expected number bytes");
          for (let i = 0; i < bytes2.length; ++i)
            ck.testTrue(bytes2[i] === bytes3[i], "bytes are the same");
        }
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceAuxData", "Compress");
    expect(ck.getNumErrors()).toBe(0);
  });

  // This test generates a mesh with auxData, inspired by the sandbox https://www.itwinjs.org/sandboxes/iTwinPlatform/Scientific%20Visualization
  it("FlatMeshWithWaves", () => {
    const ck = new Checker();

    const createFlatMeshWithWaves = (): IndexedPolyface => {
      const options = StrokeOptions.createForFacets();
      options.shouldTriangulate = true;
      const builder = PolyfaceBuilder.create(options);
      const nDimensions = 4;
      const spacing = 1.0;

      // Create a simple flat mesh with nDimensions x nDimensions points
      for (let iRow = 0; iRow < nDimensions - 1; iRow++) {
        for (let iColumn = 0; iColumn < nDimensions - 1; iColumn++) {
          const quad = [
            Point3d.create(iRow * spacing, iColumn * spacing, 0.0),
            Point3d.create((iRow + 1) * spacing, iColumn * spacing, 0.0),
            Point3d.create((iRow + 1) * spacing, (iColumn + 1) * spacing, 0.0),
            Point3d.create(iRow * spacing, (iColumn + 1) * spacing),
          ];
          builder.addQuadFacet(quad);
        }
      }

      const polyface = builder.claimPolyface();
      const zeroScalarData = [], zeroDisplacementData = [], radialHeightData = [], radialSlopeData = [], radialDisplacementData = [];
      const radius = nDimensions * spacing / 2.0;
      const center = new Point3d(radius, radius, 0.0);
      const maxHeight = radius / 4.0;
      const auxChannels = [];

      // Create a radial wave - start and return to zero
      for (let i = 0; i < polyface.data.point.length; i++) {
        const angle = Angle.pi2Radians * polyface.data.point.distanceIndexToPoint(i, center)! / radius;
        const height = maxHeight * Math.sin(angle);
        const slope = Math.abs(Math.cos(angle));

        zeroScalarData.push(0.0);
        zeroDisplacementData.push(0.0);
        zeroDisplacementData.push(0.0);
        zeroDisplacementData.push(0.0);

        radialHeightData.push(height);
        radialSlopeData.push(slope);
        radialDisplacementData.push(0.0);
        radialDisplacementData.push(0.0);
        radialDisplacementData.push(height);
      }

      // Static Channels
      auxChannels.push(new AuxChannel([new AuxChannelData(0.0, radialDisplacementData)], AuxChannelDataType.Vector, "Static Radial Displacement", "Radial: Static"));
      auxChannels.push(new AuxChannel([new AuxChannelData(1.0, radialHeightData)], AuxChannelDataType.Distance, "Static Radial Height", "Radial: Static"));
      auxChannels.push(new AuxChannel([new AuxChannelData(1.0, radialSlopeData)], AuxChannelDataType.Scalar, "Static Radial Slope", "Radial: Static"));

      // Animated Channels
      const radialDisplacementDataVector = [new AuxChannelData(0.0, zeroDisplacementData), new AuxChannelData(1.0, radialDisplacementData), new AuxChannelData(2.0, zeroDisplacementData)];
      const radialHeightDataVector = [new AuxChannelData(0.0, zeroScalarData), new AuxChannelData(1.0, radialHeightData), new AuxChannelData(2.0, zeroScalarData)];
      const radialSlopeDataVector = [new AuxChannelData(0.0, zeroScalarData), new AuxChannelData(1.0, radialSlopeData), new AuxChannelData(2.0, zeroScalarData)];

      auxChannels.push(new AuxChannel(radialDisplacementDataVector, AuxChannelDataType.Vector, "Animated Radial Displacement", "Radial: Time"));
      auxChannels.push(new AuxChannel(radialHeightDataVector, AuxChannelDataType.Distance, "Animated Radial Height", "Radial: Time"));
      auxChannels.push(new AuxChannel(radialSlopeDataVector, AuxChannelDataType.Scalar, "Animated Radial Slope", "Radial: Time"));

      // Create linear waves -- 10 separate frames
      const waveHeight = radius / 20.0;
      const waveLength = radius / 2.0;
      const frameCount = 10;
      const linearDisplacementDataVector = [], linearHeightDataVector = [], linearSlopeDataVector = [];

      for (let i = 0; i < frameCount; i++) {
        const fraction = i / (frameCount - 1);
        const waveCenter = waveLength * fraction;
        const linearHeightData = [], linearSlopeData = [], linearDisplacementData = [];

        for (let j = 0; j < polyface.data.point.length; j++) {
          const point = polyface.data.point.getPoint3dAtUncheckedPointIndex(j);
          const theta = Angle.pi2Radians * (point.x - waveCenter) / waveLength;
          const height = waveHeight * Math.sin(theta);
          const slope = Math.abs(Math.cos(theta));

          linearHeightData.push(height);
          linearSlopeData.push(slope);
          linearDisplacementData.push(0.0);
          linearDisplacementData.push(0.0);
          linearDisplacementData.push(height);
        }
        linearDisplacementDataVector.push(new AuxChannelData(i, linearDisplacementData));
        linearHeightDataVector.push(new AuxChannelData(i, linearHeightData));
        linearSlopeDataVector.push(new AuxChannelData(i, linearSlopeData));
      }
      auxChannels.push(new AuxChannel(linearDisplacementDataVector, AuxChannelDataType.Vector, "Linear Displacement", "Linear: Time"));
      auxChannels.push(new AuxChannel(linearHeightDataVector, AuxChannelDataType.Distance, "Linear Height", "Linear: Time"));
      auxChannels.push(new AuxChannel(linearSlopeDataVector, AuxChannelDataType.Scalar, "Linear Slope", "Linear: Time"));

      polyface.data.auxData = new PolyfaceAuxData(auxChannels, polyface.data.pointIndex);
      return polyface;
    };

    const dir = "PolyfaceAuxData";
    const filename = "indexedMesh-auxData2-new";
    const mesh = createFlatMeshWithWaves();
    if (ck.testDefined(mesh, "created mesh with auxData")) {
      GeometryCoreTestIO.saveGeometry(mesh, dir, filename);   // write .imjs file
      const bytes = BentleyGeometryFlatBuffer.geometryToBytes(mesh, true);
      if (ck.testDefined(bytes, "exported mesh to fb bytes")) {
        const pathname = GeometryCoreTestIO.makeOutputDir(dir).concat(`/${filename}`).concat(".fb");
        GeometryCoreTestIO.writeBytesToFile(bytes, pathname); // write .fb file
      }
    }
    expect(ck.getNumErrors()).toBe(0);
  });
});
