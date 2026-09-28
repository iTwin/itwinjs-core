/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it, vi } from "vitest";
import { GeoCoordStatus, GeographicCRSProps, VerticalCRSProps } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";
import { IModelConnection } from "../../IModelConnection";
import { computeVerticalDatumShift } from "../../internal/tile/OrbitGtTileTree";

interface FakeConnectionOptions {
  noGcsDefined?: boolean;
  /** The iModel's vertical datum. Defaults to GEOID. */
  verticalDatum?: VerticalCRSProps["id"] | "none";
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

  const verticalDatum = options.verticalDatum ?? "GEOID";
  const iModel = {
    noGcsDefined: options.noGcsDefined ?? false,
    geographicCoordinateSystem: {
      horizontalCRS: { epsg: 25830 },
      verticalCRS: "none" === verticalDatum ? undefined : { id: verticalDatum },
    },
    geoServices: { getConverter },
  } as unknown as IModelConnection;

  return { iModel, getConverter };
}

describe("computeVerticalDatumShift", () => {
  const geoOrigin = Point3d.create(-116.87, 33.04, 457);

  it("returns the difference between geoid-based and ellipsoid-based conversions", async () => {
    // Ellipsoidal interpretation put the origin ~33m higher than the orthometric (geoid) interpretation.
    const { iModel } = createFakeConnection({ geoidZ: 457 });
    const shift = await computeVerticalDatumShift(geoOrigin, 489.96, iModel);
    expect(shift).toBeCloseTo(-32.96, 10);
  });

  it("applies the shift for every geoid-based iModel vertical datum", async () => {
    for (const verticalDatum of ["GEOID", "NAVD88", "NGVD29"] as const) {
      const { iModel } = createFakeConnection({ verticalDatum, geoidZ: 457 });
      expect(await computeVerticalDatumShift(geoOrigin, 489.96, iModel)).toBeCloseTo(-32.96, 10);
    }
  });

  it("returns zero without converting when the iModel's vertical datum is ellipsoidal", async () => {
    // The cloud is assumed to share the iModel's ellipsoidal convention; shifting would displace it by the geoid separation.
    for (const verticalDatum of ["ELLIPSOID", "LOCAL_ELLIPSOID", "none"] as const) {
      const { iModel, getConverter } = createFakeConnection({ verticalDatum, geoidZ: 457 });
      expect(await computeVerticalDatumShift(geoOrigin, 489.96, iModel)).toBe(0);
      expect(getConverter).not.toHaveBeenCalled();
    }
  });

  it("converts against the iModel's own vertical datum", async () => {
    const expected = [
      ["GEOID", { horizontalCRS: { epsg: 4326 }, verticalCRS: { id: "GEOID" } }],
      ["NAVD88", { horizontalCRS: { epsg: 4269 }, verticalCRS: { id: "NAVD88" } }],
      ["NGVD29", { horizontalCRS: { epsg: 4269 }, verticalCRS: { id: "NGVD29" } }],
    ] as const;
    for (const [verticalDatum, source] of expected) {
      const { iModel, getConverter } = createFakeConnection({ verticalDatum, geoidZ: 0 });
      await computeVerticalDatumShift(geoOrigin, 0, iModel);
      expect(getConverter).toHaveBeenCalledWith(source);
    }
  });

  it("returns zero when the iModel has no GCS", async () => {
    const { iModel, getConverter } = createFakeConnection({ noGcsDefined: true, geoidZ: 457 });
    expect(await computeVerticalDatumShift(geoOrigin, 489.96, iModel)).toBe(0);
    expect(getConverter).not.toHaveBeenCalled();
  });

  it("returns zero when no converter is available", async () => {
    const { iModel } = createFakeConnection({ converterUndefined: true });
    expect(await computeVerticalDatumShift(geoOrigin, 489.96, iModel)).toBe(0);
  });

  it("returns zero when the conversion does not succeed", async () => {
    const { iModel } = createFakeConnection({ geoidZ: 457, status: GeoCoordStatus.OutOfMathematicalDomain });
    expect(await computeVerticalDatumShift(geoOrigin, 489.96, iModel)).toBe(0);
  });

  it("returns zero when the conversion throws", async () => {
    const { iModel } = createFakeConnection({ throws: true });
    expect(await computeVerticalDatumShift(geoOrigin, 489.96, iModel)).toBe(0);
  });

  it("returns zero when both interpretations agree", async () => {
    const { iModel } = createFakeConnection({ geoidZ: 457 });
    expect(await computeVerticalDatumShift(geoOrigin, 457, iModel)).toBe(0);
  });
});
