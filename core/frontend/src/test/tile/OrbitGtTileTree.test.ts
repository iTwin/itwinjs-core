/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it, vi } from "vitest";
import { GeoCoordStatus, GeographicCRSProps } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";
import { IModelConnection } from "../../IModelConnection";
import { computeOrthometricVerticalShift } from "../../internal/tile/OrbitGtTileTree";

interface FakeConnectionOptions {
  noGcsDefined?: boolean;
  converterUndefined?: boolean;
  status?: GeoCoordStatus;
  geoidZ?: number;
  throws?: boolean;
}

function createFakeConnection(options: FakeConnectionOptions) {
  const getConverter = vi.fn((_datumOrGCRS?: string | GeographicCRSProps) => {
    if (options.converterUndefined)
      return undefined;

    return {
      getIModelCoordinatesFromGeoCoordinates: async (_geoPoints: Point3d[]) => {
        if (options.throws)
          throw new Error("conversion failed");

        return {
          iModelCoords: [{ p: { x: 1, y: 2, z: options.geoidZ ?? 0 }, s: options.status ?? GeoCoordStatus.Success }],
          fromCache: 0,
        };
      },
    };
  });

  const iModel = {
    noGcsDefined: options.noGcsDefined ?? false,
    geoServices: { getConverter },
  } as unknown as IModelConnection;

  return { iModel, getConverter };
}

describe("computeOrthometricVerticalShift", () => {
  const geoOrigin = Point3d.create(-116.87, 33.04, 457);

  it("returns the difference between geoid-based and ellipsoid-based conversions", async () => {
    // Ellipsoidal interpretation put the origin ~33m higher than the orthometric (geoid) interpretation.
    const { iModel } = createFakeConnection({ geoidZ: 457 });
    const shift = await computeOrthometricVerticalShift(geoOrigin, 489.96, iModel);
    expect(shift).toBeCloseTo(-32.96, 10);
  });

  it("requests a converter with a geoid-based vertical CRS", async () => {
    const { iModel, getConverter } = createFakeConnection({ geoidZ: 0 });
    await computeOrthometricVerticalShift(geoOrigin, 0, iModel);
    expect(getConverter).toHaveBeenCalledWith({ horizontalCRS: { epsg: 4326 }, verticalCRS: { id: "GEOID" } });
  });

  it("returns zero when the iModel has no GCS", async () => {
    const { iModel, getConverter } = createFakeConnection({ noGcsDefined: true, geoidZ: 457 });
    expect(await computeOrthometricVerticalShift(geoOrigin, 489.96, iModel)).toBe(0);
    expect(getConverter).not.toHaveBeenCalled();
  });

  it("returns zero when no converter is available", async () => {
    const { iModel } = createFakeConnection({ converterUndefined: true });
    expect(await computeOrthometricVerticalShift(geoOrigin, 489.96, iModel)).toBe(0);
  });

  it("returns zero when the conversion does not succeed", async () => {
    const { iModel } = createFakeConnection({ geoidZ: 457, status: GeoCoordStatus.OutOfMathematicalDomain });
    expect(await computeOrthometricVerticalShift(geoOrigin, 489.96, iModel)).toBe(0);
  });

  it("returns zero when the conversion throws", async () => {
    const { iModel } = createFakeConnection({ throws: true });
    expect(await computeOrthometricVerticalShift(geoOrigin, 489.96, iModel)).toBe(0);
  });

  it("returns zero when both interpretations agree", async () => {
    const { iModel } = createFakeConnection({ geoidZ: 457 });
    expect(await computeOrthometricVerticalShift(geoOrigin, 457, iModel)).toBe(0);
  });
});
