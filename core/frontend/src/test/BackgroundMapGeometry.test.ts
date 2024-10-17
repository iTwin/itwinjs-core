/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { IModelApp } from "../IModelApp";
import { Cartographic, EmptyLocalization, GlobeMode } from "@itwin/core-common";
import { BlankConnection, IModelConnection } from "../IModelConnection";
import { Point3d, Range3d, XYAndZ } from "@itwin/core-geometry";
import { BackgroundMapGeometry } from "../BackgroundMapGeometry";
import { createBlankConnection } from "./createBlankConnection";
import { Guid } from "@itwin/core-bentley";

describe("BackgroundMapGeometry", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterEach(async () => {
    sandbox.restore();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("provide cartographics from iModel coordinates", async () => {

    const wgs84CartographicFromSpatialFake = sandbox.stub(IModelConnection.prototype, "wgs84CartographicFromSpatial").callsFake(async function _(spatial: XYAndZ[]): Promise<Cartographic[]> {
      return Promise.resolve(spatial.map((value) => Cartographic.fromRadians({ longitude: value.x, latitude: value.y, height: value.z})));
    });

    const dbToCartographicFake = sandbox.stub(BackgroundMapGeometry.prototype, "dbToCartographic").callsFake(function _(db: XYAndZ, _result?: Cartographic): any {
      return Cartographic.fromRadians({longitude: db.x, latitude: db.y, height: db.z});
    });

    const imodel = createBlankConnection();
    const bgGeom = new BackgroundMapGeometry(0, GlobeMode.Ellipsoid, imodel);

    // Any value in the 'negative' range should get reprojected using 'wgs84CartographicFromSpatial'
    (bgGeom as any).cartesianRange = Range3d.createXYZXYZ(-100, -100, -100, 0, 0 , 0);
    const dataset = [{x: -1, y: -1, z: -1}, {x: 1, y: 1, z: 1}, {x: -2, y: -2, z: -2}];
    const result = await bgGeom.dbToWGS84CartographicFromGcs(dataset);
    expect(result.length).to.equals(dataset.length);
    expect(wgs84CartographicFromSpatialFake.getCalls().length).to.equals(1);
    expect(wgs84CartographicFromSpatialFake.getCalls()[0].args[0].length).to.equals(2);
    expect(dbToCartographicFake.getCalls().length).to.equals(1);

    for (let i = 0; i<dataset.length; i++) {
      expect(dataset[i].x).to.eq(result[i].longitude);
      expect(dataset[i].y).to.eq(result[i].latitude);
      expect(dataset[i].z).to.eq(result[i].height);
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
