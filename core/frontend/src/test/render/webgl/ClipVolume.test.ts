/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ClipPrimitive, ClipShape, ClipVector, Point3d } from "@bentley/geometry-core";
import { ClipVolume } from "../../../webgl";
import { IModelApp } from "../../../IModelApp";

describe("ClipVolume", async () => {
  before(async () => {
    await IModelApp.startup();
  });

  after(async () => {
    await IModelApp.shutdown();
  });

  it("should ignore empty ClipVectors", () => {
    const clipVector = ClipVector.createEmpty();
    const clipVolume = ClipVolume.create(clipVector);
    expect(clipVolume).to.be.undefined;
  });

  it("should support single-primitive ClipVectors", () => {
    const points = [
      Point3d.create(1.0, 1.0, 0.0),
      Point3d.create(2.0, 1.0, 0.0),
      Point3d.create(2.0, 2.0, 0.0),
      Point3d.create(1.0, 2.0, 0.0),
    ];

    const shape = ClipShape.createShape(points, 1.0, 2.0)!;
    expect(shape).not.to.be.undefined;

    const clipVector = ClipVector.create([ shape ])!;
    expect(clipVector).not.to.be.undefined;

    const clipVolume = ClipVolume.create(clipVector)!;
    expect(clipVolume).to.not.be.undefined;

    const data = clipVolume.getTextureData() as Float32Array;
    expect(data).not.to.be.undefined;
    expect(data instanceof Float32Array).to.be.true;

    const expectedData = [0, 1, 0, -1, -1, 0, 0, 2, 0, -1, 0, 2, 1, 0, 0, -1, 0, 0, 1, -1, 0, 0, -1, 2];
    expect(data.length).to.equal(expectedData.length);
    for (let i = 0; i < data.length; i++)
      expect(data[i]).to.equal(expectedData[i]);
  });

  it("should support compound ClipVectors", () => {
    const vec = ClipVector.createEmpty();
    expect(vec.appendShape([ Point3d.create(1, 1, 0), Point3d.create(2, 1, 0), Point3d.create(2, 2, 0), Point3d.create(1, 2, 0) ], 1, 2)).to.be.true;
    let vol = ClipVolume.create(vec)!;
    expect(vol).not.to.be.undefined;
    expect(vol.clipVector).to.equal(vec);
    expect(vol.numPlanes).to.equal(6);

    let planes = vec.clips[0].fetchClipPlanesRef()!;
    expect(planes).not.to.be.undefined;
    planes = planes.clone();
    vec.appendReference(ClipPrimitive.createCapture(planes));
    vol = ClipVolume.create(vec)!;
    expect(vol).not.to.be.undefined;
    expect(vol.numPlanes).to.equal(13); // 6 planes per ClipPrimitive, plus a plane in between serving as boundary marker.

    const planesData = [0, 1, 0, -1, -1, 0, 0, 2, 0, -1, 0, 2, 1, 0, 0, -1, 0, 0, 1, -1, 0, 0, -1, 2];
    const boundaryData = [2, 2, 2, 0];
    const expectedData = planesData.concat(boundaryData, planesData);

    const data = vol.getTextureData() as Float32Array;
    expect(data instanceof Float32Array).to.be.true;
    expect(data.length).to.equal(expectedData.length);
    for (let i = 0; i < data.length; i++)
      expect(data[i]).to.equal(expectedData[i]);
  });
});
