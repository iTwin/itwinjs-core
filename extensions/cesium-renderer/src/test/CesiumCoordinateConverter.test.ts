/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import { EcefLocation } from "@itwin/core-common";
import { Point3d, Range3d, XYAndZ } from "@itwin/core-geometry";
import type { IModelConnection } from "@itwin/core-frontend";
import { Cartesian3 } from "cesium";
import { CesiumCoordinateConverter } from "../decorations/CesiumCoordinateConverter.js";

type SpatialToEcefFn = (point: XYAndZ) => Point3d;
type EcefToSpatialFn = (point: XYAndZ) => Point3d;

interface ConverterOptions {
  isGeoLocated: boolean;
  projectExtents?: Range3d;
  ecefLocation?: EcefLocation;
  spatialToEcef?: SpatialToEcefFn;
  ecefToSpatial?: EcefToSpatialFn;
}

function createConverter(options: ConverterOptions) {
  const spatialToEcef: SpatialToEcefFn = options.spatialToEcef ?? ((point) => Point3d.create(point.x, point.y, point.z));
  const ecefToSpatial: EcefToSpatialFn = options.ecefToSpatial ?? ((point) => Point3d.create(point.x, point.y, point.z));
  const projectExtents = options.projectExtents ?? Range3d.createXYZXYZ(-10, -10, -10, 10, 10, 10);

  const iModel = {
    isGeoLocated: options.isGeoLocated,
    ecefLocation: options.ecefLocation,
    projectExtents,
    spatialToEcef,
    ecefToSpatial,
  } as unknown as IModelConnection;

  return {
    converter: new CesiumCoordinateConverter(iModel),
    iModel,
    spatialToEcef,
    ecefToSpatial,
  };
}

describe("CesiumCoordinateConverter", () => {
  it("converts spatial coordinates using ECEF when geo-located", () => {
    const spatialToEcef = vi.fn<SpatialToEcefFn>((point) => Point3d.create(point.x + 100, point.y + 200, point.z + 300));
    const { converter } = createConverter({ isGeoLocated: true, spatialToEcef });

    const result = converter.spatialToCesiumCartesian3(Point3d.create(1, 2, 3));

    expect(spatialToEcef).toHaveBeenCalledOnce();
    expect(result.x).toBeCloseTo(101);
    expect(result.y).toBeCloseTo(202);
    expect(result.z).toBeCloseTo(303);
  });

  it("falls back to approximate conversion when the model is not geo-located", () => {
    const projectExtents = Range3d.createXYZXYZ(10, 20, 30, 20, 30, 40);
    const spatialToEcef = vi.fn<SpatialToEcefFn>(() => Point3d.createZero());
    const { converter } = createConverter({ isGeoLocated: false, projectExtents, spatialToEcef });

    const spatial = Point3d.create(16, 27, 40);
    const result = converter.spatialToCesiumCartesian3(spatial);

    expect(spatialToEcef).not.toHaveBeenCalled();

    const center = projectExtents.center;
    const longitude = (spatial.x - center.x) * 0.00001;
    const latitude = (spatial.y - center.y) * 0.00001;
    const height = Math.max(spatial.z - center.z + 100, 100);
    const expected = Cartesian3.fromDegrees(longitude, latitude, height);

    expect(result.x).toBeCloseTo(expected.x);
    expect(result.y).toBeCloseTo(expected.y);
    expect(result.z).toBeCloseTo(expected.z);
  });

  it("converts ECEF coordinates back to spatial coordinates when geo-located", () => {
    const ecefToSpatial = vi.fn<EcefToSpatialFn>((point) => Point3d.create(point.x - 50, point.y - 60, point.z - 70));
    const { converter } = createConverter({ isGeoLocated: true, ecefToSpatial });

    const result = converter.cesiumCartesian3ToSpatial(new Cartesian3(150, 260, 370));

    expect(ecefToSpatial).toHaveBeenCalledOnce();
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200);
    expect(result.z).toBeCloseTo(300);
  });

  it("returns raw coordinates when converting from ECEF without geo-location", () => {
    const { converter } = createConverter({ isGeoLocated: false });

    const cartesian = new Cartesian3(5, 10, 15);
    const result = converter.cesiumCartesian3ToSpatial(cartesian);

    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(10);
    expect(result.z).toBeCloseTo(15);
  });

  it("maps arrays of points through spatial conversions", () => {
    const spatialToEcef = vi.fn<SpatialToEcefFn>((point) => Point3d.create(point.x + 1, point.y + 2, point.z + 3));
    const { converter } = createConverter({ isGeoLocated: true, spatialToEcef });

    const input = [Point3d.create(0, 0, 0), Point3d.create(1, 1, 1)];
    const result = converter.spatialArrayToCesiumArray(input);

    expect(result).toHaveLength(2);
    expect(spatialToEcef).toHaveBeenCalledTimes(2);
    expect(result[0].x).toBeCloseTo(1);
    expect(result[0].y).toBeCloseTo(2);
    expect(result[0].z).toBeCloseTo(3);
    expect(result[1].x).toBeCloseTo(2);
    expect(result[1].y).toBeCloseTo(3);
    expect(result[1].z).toBeCloseTo(4);
  });

  it("converts line strings to Cesium positions when geo-located", () => {
    const spatialToEcef = vi.fn<SpatialToEcefFn>((point) => Point3d.create(point.x + 5, point.y + 6, point.z + 7));
    const { converter } = createConverter({ isGeoLocated: true, spatialToEcef });

    const points = [Point3d.create(0, 0, 0), Point3d.create(1, 2, 3)];
    const result = converter.convertLineStringToCesium(points);

    expect(result).toHaveLength(2);
    expect(spatialToEcef).toHaveBeenCalledTimes(2);
    expect(result[1].x).toBeCloseTo(6);
    expect(result[1].y).toBeCloseTo(8);
    expect(result[1].z).toBeCloseTo(10);
  });

  it("converts model extents when geo-located", () => {
    const projectExtents = Range3d.createXYZXYZ(-1, -2, -3, 4, 5, 6);
    const spatialToEcef = vi.fn<SpatialToEcefFn>((point) => Point3d.create(point.x + 1000, point.y + 2000, point.z + 3000));
    const { converter } = createConverter({ isGeoLocated: true, projectExtents, spatialToEcef });

    const result = converter.getModelExtentsInCesium();

    expect(spatialToEcef).toHaveBeenCalledTimes(2);
    expect(result.low.x).toBeCloseTo(projectExtents.low.x + 1000);
    expect(result.low.y).toBeCloseTo(projectExtents.low.y + 2000);
    expect(result.low.z).toBeCloseTo(projectExtents.low.z + 3000);
    expect(result.high.x).toBeCloseTo(projectExtents.high.x + 1000);
    expect(result.high.y).toBeCloseTo(projectExtents.high.y + 2000);
    expect(result.high.z).toBeCloseTo(projectExtents.high.z + 3000);
  });

  it("returns the original extents when the model is not geo-located", () => {
    const projectExtents = Range3d.createXYZXYZ(-2, -2, -2, 2, 2, 2);
    const { converter } = createConverter({ isGeoLocated: false, projectExtents });

    const result = converter.getModelExtentsInCesium();

    expect(result).toBe(projectExtents);
  });

  it("reports whether ECEF conversion can be used", () => {
    const ecefLocation = new EcefLocation({
      origin: [0, 0, 0],
      orientation: { yaw: 0, pitch: 0, roll: 0 },
    });

    const { converter: readyConverter } = createConverter({ isGeoLocated: true, ecefLocation });
    expect(readyConverter.canUseEcefConversion()).toBe(true);

    const { converter: missingEcef } = createConverter({ isGeoLocated: true });
    expect(missingEcef.canUseEcefConversion()).toBe(false);

    const { converter: notGeo } = createConverter({ isGeoLocated: false, ecefLocation });
    expect(notGeo.canUseEcefConversion()).toBe(false);
  });

  it("summarizes geo-location information", () => {
    const ecefLocation = new EcefLocation({
      origin: [1, 2, 3],
      orientation: { yaw: 0, pitch: 0, roll: 0 },
    });
    const projectExtents = Range3d.createXYZXYZ(-5, -5, -5, 5, 5, 5);
    const spatialToEcef = vi.fn<SpatialToEcefFn>((point) => Point3d.create(point.x, point.y, point.z));
    const { converter } = createConverter({ isGeoLocated: true, ecefLocation, projectExtents, spatialToEcef });

    const info = converter.getGeoLocationInfo() as Record<string, unknown>;

    expect(info).toMatchObject({
      isGeoLocated: true,
      hasEcefLocation: true,
      canUseEcefConversion: true,
      ecefLocation,
      projectExtents,
      spatialToEcefAvailable: true,
    });
  });
});
