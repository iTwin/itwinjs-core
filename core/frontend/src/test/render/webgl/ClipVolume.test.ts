/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ClipPrimitive, ClipShape, ClipVector, Point3d, Transform, UnionOfConvexClipPlaneSets } from "@itwin/core-geometry";
import { ClipVolume } from "../../../render/webgl/ClipVolume";
import { IModelApp } from "../../../IModelApp";
import { EmptyLocalization } from "@itwin/core-common";

describe("ClipVolume", async () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("should ignore empty ClipVectors", () => {
    let clipVector = ClipVector.createEmpty();
    expect(ClipVolume.create(clipVector)).toBeUndefined();

    clipVector = ClipVector.createCapture([]);
    expect(ClipVolume.create(clipVector)).toBeUndefined();

    clipVector = ClipVector.createCapture([ClipPrimitive.createCapture(UnionOfConvexClipPlaneSets.createEmpty())]);
    expect(ClipVolume.create(clipVector)).toBeUndefined();
  });

  it("should support single-primitive ClipVectors", () => {
    const points = [
      Point3d.create(1.0, 1.0, 0.0),
      Point3d.create(2.0, 1.0, 0.0),
      Point3d.create(2.0, 2.0, 0.0),
      Point3d.create(1.0, 2.0, 0.0),
    ];

    const shape = ClipShape.createShape(points, 1.0, 2.0)!;
    expect(shape).toBeDefined();

    const clipVector = ClipVector.create([shape]);
    expect(clipVector).toBeDefined();

    const clipVolume = ClipVolume.create(clipVector)!;
    expect(clipVolume).toBeDefined();

    const data = new Float32Array(clipVolume.getData(Transform.createIdentity()).buffer);
    const expectedData = [0, 1, 0, -1, -1, 0, 0, 2, 0, -1, 0, 2, 1, 0, 0, -1, 0, 0, 1, -1, 0, 0, -1, 2, 2, 2, 2, 0];
    expect(data.length).toEqual(expectedData.length);
    for (let i = 0; i < data.length; i++)
      expect(data[i]).toEqual(expectedData[i]);
  });

  it("should support compound ClipVectors", () => {
    const vec = ClipVector.createEmpty();
    expect(vec.appendShape([Point3d.create(1, 1, 0), Point3d.create(2, 1, 0), Point3d.create(2, 2, 0), Point3d.create(1, 2, 0)], 1, 2)).toBe(true);
    let vol = ClipVolume.create(vec)!;
    expect(vol).toBeDefined();
    expect(vol.clipVector).toEqual(vec);
    expect(vol.numRows).toEqual(7); // 6 planes plus a boundary marker

    let planes = vec.clips[0].fetchClipPlanesRef()!;
    expect(planes).toBeDefined();
    planes = planes.clone();
    vec.appendReference(ClipPrimitive.createCapture(planes));
    vol = ClipVolume.create(vec)!;
    expect(vol).toBeDefined();
    expect(vol.numRows).toEqual(14); // 6 planes per ClipPrimitive, plus a plane after each serving as boundary marker.

    const planesData = [0, 1, 0, -1, -1, 0, 0, 2, 0, -1, 0, 2, 1, 0, 0, -1, 0, 0, 1, -1, 0, 0, -1, 2];
    const boundaryData = [2, 2, 2, 0];
    const expectedData = planesData.concat(boundaryData, planesData).concat(boundaryData);

    const data = new Float32Array(vol.getData(Transform.createIdentity()).buffer);
    expect(data.length).toEqual(expectedData.length);
    for (let i = 0; i < data.length; i++)
      expect(data[i]).toEqual(expectedData[i]);
  });
});
