/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@itwin/core-bentley";
import { GeoCoordStatus, GeographicCRS, GeographicCRSProps, VerticalCRSProps } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";
import { IModelConnection } from "../../IModelConnection";
import { computeVerticalDatumShift } from "../../internal/tile/OrbitGtTileTree";

interface FakeConnectionOptions {
  noGcsDefined?: boolean;
  /** The iModel's vertical datum. Defaults to GEOID. */
  verticalDatum?: VerticalCRSProps["id"] | "none";
  verticalCRS?: VerticalCRSProps;
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
    geographicCoordinateSystem: GeographicCRS.fromJSON({
      horizontalCRS: { epsg: 25830 },
      verticalCRS: options.verticalCRS ?? ("none" === verticalDatum ? undefined : { id: verticalDatum }),
    }),
    geoServices: { getConverter },
  } as unknown as IModelConnection;

  return { iModel, getConverter };
}

describe("computeVerticalDatumShift", () => {
  const geoOrigin = Point3d.create(-116.87, 33.04, 457);
  afterEach(() => vi.restoreAllMocks());

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

  it("preserves named and EPSG-only vertical definitions in the conversion source", async () => {
    const definitions: VerticalCRSProps[] = [
      { id: "GEOID", crsName: "EGM2008 height" },
      { id: "GEOID", crsName: "EGM2008 height", epsg: 3855 },
      { id: "GEOID", epsg: 3855 },
      { id: "NAVD88", crsName: "NAVD88 height", epsg: 5703 },
      { id: "NGVD29", epsg: 5702 },
    ];
    for (const verticalCRS of definitions) {
      const { iModel, getConverter } = createFakeConnection({ verticalCRS });
      await computeVerticalDatumShift(geoOrigin, 0, iModel);
      expect(getConverter).toHaveBeenCalledWith({
        horizontalCRS: { epsg: verticalCRS.id === "GEOID" ? 4326 : 4269 },
        verticalCRS,
      });
    }
  });

  it("uses the named datum's correction instead of its generic GEOID fallback", async () => {
    const createConverter = (source?: string | GeographicCRSProps) => ({
      getIModelCoordinatesFromGeoCoordinates: async (_geoPoints: Point3d[]) => ({
        iModelCoords: [{
          p: { x: 1, y: 2, z: typeof source === "object" && source.verticalCRS?.crsName === "EGM2008 height" ? 457 : 450 },
          s: GeoCoordStatus.Success,
        }],
        fromCache: 0,
      }),
    });
    const named = createFakeConnection({ verticalCRS: { id: "GEOID", crsName: "EGM2008 height", epsg: 3855 } });
    const legacy = createFakeConnection({ verticalDatum: "GEOID" });
    named.getConverter.mockImplementation(createConverter);
    legacy.getConverter.mockImplementation(createConverter);

    expect(await computeVerticalDatumShift(geoOrigin, 489.96, named.iModel)).toBeCloseTo(-32.96, 10);
    expect(await computeVerticalDatumShift(geoOrigin, 489.96, legacy.iModel)).toBeCloseTo(-39.96, 10);
  });

  it("returns zero without converting for named and EPSG-only ellipsoidal datums", async () => {
    const definitions: VerticalCRSProps[] = [
      { id: "ELLIPSOID", crsName: "WGS84", epsg: 4979 },
      { id: "ELLIPSOID", epsg: 4979 },
      { id: "LOCAL_ELLIPSOID", crsName: "WGS84" },
    ];
    for (const verticalCRS of definitions) {
      const { iModel, getConverter } = createFakeConnection({ verticalCRS, geoidZ: 457 });
      expect(await computeVerticalDatumShift(geoOrigin, 489.96, iModel)).toBe(0);
      expect(getConverter).not.toHaveBeenCalled();
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

  it.each([GeoCoordStatus.OutOfMathematicalDomain, GeoCoordStatus.VerticalDatumConvertError])("returns zero when the conversion does not succeed (status %s)", async (status) => {
    const { iModel } = createFakeConnection({ geoidZ: 457, status });
    expect(await computeVerticalDatumShift(geoOrigin, 489.96, iModel)).toBe(0);
  });

  it.each([457, 460, Number.NaN, Number.POSITIVE_INFINITY])("ignores unreliable elevation %s and warns on status 26", async (geoidZ) => {
    const warning = vi.spyOn(Logger, "logWarning").mockImplementation(() => { });
    const { iModel } = createFakeConnection({ geoidZ, status: GeoCoordStatus.VerticalDatumConvertError });
    expect(await computeVerticalDatumShift(geoOrigin, 489.96, iModel)).toBe(0);
    expect(warning).toHaveBeenCalledExactlyOnceWith(expect.any(String), expect.stringContaining("status 26"));
  });

  it.each([
    [Number.NaN, 489.96],
    [Number.POSITIVE_INFINITY, 489.96],
    [Number.NEGATIVE_INFINITY, 489.96],
    [457, Number.NaN],
    [457, Number.POSITIVE_INFINITY],
    [Number.MAX_VALUE, -Number.MAX_VALUE],
  ])("rejects a non-finite correction even on success (%s, %s)", async (geoidZ, ellipsoidZ) => {
    const warning = vi.spyOn(Logger, "logWarning").mockImplementation(() => { });
    const { iModel } = createFakeConnection({ geoidZ });
    expect(await computeVerticalDatumShift(geoOrigin, ellipsoidZ, iModel)).toBe(0);
    expect(warning).toHaveBeenCalledExactlyOnceWith(expect.any(String), expect.stringContaining("Non-finite"));
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
