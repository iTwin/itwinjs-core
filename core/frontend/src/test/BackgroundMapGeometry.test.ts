/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IModelApp } from "../IModelApp.js";
import { Cartographic, EmptyLocalization, GlobeMode } from "@itwin/core-common";
import { BlankConnection, IModelConnection } from "../IModelConnection.js";
import { Point3d, Range3d, XYAndZ } from "@itwin/core-geometry";
import { BackgroundMapGeometry } from "../BackgroundMapGeometry.js";
import { createBlankConnection } from "./createBlankConnection.js";
import { Guid } from "@itwin/core-bentley";

describe("BackgroundMapGeometry", () => {

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("provide cartographics from iModel coordinates", async () => {

    const wgs84CartographicFromSpatialFake = vi.spyOn(IModelConnection.prototype, "wgs84CartographicFromSpatial").mockImplementation(async function _(spatial: XYAndZ[]): Promise<Cartographic[]> {
      return Promise.resolve(spatial.map((value) => Cartographic.fromRadians({ longitude: value.x, latitude: value.y, height: value.z})));
    });

    const dbToCartographicFake = vi.spyOn(BackgroundMapGeometry.prototype, "dbToCartographic").mockImplementation(function _(db: XYAndZ, _result?: Cartographic): any {
      return Cartographic.fromRadians({longitude: db.x, latitude: db.y, height: db.z});
    });

    const imodel = createBlankConnection();
    const bgGeom = new BackgroundMapGeometry(0, GlobeMode.Ellipsoid, imodel);

    // Any value in the 'negative' range should get reprojected using 'wgs84CartographicFromSpatial'
    (bgGeom as any).cartesianRange = Range3d.createXYZXYZ(-100, -100, -100, 0, 0 , 0);
    const dataset = [{x: -1, y: -1, z: -1}, {x: 1, y: 1, z: 1}, {x: -2, y: -2, z: -2}];
    const result = await bgGeom.dbToWGS84CartographicFromGcs(dataset);
    expect(result.length).toEqual(dataset.length);
    expect(wgs84CartographicFromSpatialFake).toHaveBeenCalledOnce();
    const firstCall = wgs84CartographicFromSpatialFake.mock.calls[0];
    expect(firstCall[0].length).toEqual(2);
    expect(dbToCartographicFake).toHaveBeenCalledOnce();

    for (let i = 0; i<dataset.length; i++) {
      expect(dataset[i].x).toEqual(result[i].longitude);
      expect(dataset[i].y).toEqual(result[i].latitude);
      expect(dataset[i].z).toEqual(result[i].height);
    }
  });

  it("creates new background map geometry when the origin is (0, 0, 0)", async () => {
    const name = "test-blank-connection";
    const extents = new Range3d(-2500, -2500, -1000, 2500, 2500, 1000);
    const globalOrigin = new Point3d(0, 0, 0);
    const iTwinId = Guid.createValue();
    const imodel = BlankConnection.create({ name, location: { origin: [0, 0, 0], orientation: { yaw: 0, pitch: 0, roll: 0 } }, extents, iTwinId, globalOrigin });

    const geometry = new BackgroundMapGeometry(0, 0, imodel);
    expect(geometry).to.not.be.undefined;
  });
});
