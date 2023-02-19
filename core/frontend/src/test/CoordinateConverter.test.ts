/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d, Range3d, XYAndZ, XYZProps } from "@itwin/core-geometry";
import { Cartographic, EcefLocation, EmptyLocalization, GeoCoordStatus, PointWithStatus } from "@itwin/core-common";
import { BlankConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { CoordinateConverter, CoordinateConverterOptions } from "../GeoServices";

class Connection extends BlankConnection {
  private _isClosed = false;

  public constructor() {
    super({
      ecefLocation: EcefLocation.createFromCartographicOrigin(Cartographic.fromDegrees({ longitude: -75.686694, latitude: 40.065757, height: 0 })),
      projectExtents: new Range3d(-1000, -1000, -100, 1000, 1000, 100),
      rootSubject: { name: "geoservices-test" },
      key: "",
    });
  }

  public override get isClosed(): boolean {
    return this._isClosed;
  }

  public override async close(): Promise<void> {
    this._isClosed = true;
    return super.beforeClose();
  }
}

class Converter extends CoordinateConverter {
  public get cache() { return this._cache; }
  public get pending() { return this._pending; }
  public get maxPointsPerRequest() { return this._maxPointsPerRequest; }
}

describe.only("CoordinateConverter", () => {
  let iModel: Connection;

  // A default conversion that produces { x+1, y-1, z }
  async function requestPoints(pts: XYAndZ[]): Promise<PointWithStatus[]> {
    return Promise.resolve(pts.map((pt) => {
      return {
        p: { x: pt.x + 1, y: pt.y - 1, z: pt.z },
        s: GeoCoordStatus.Success,
      };
    }));
  };

  before(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    iModel = new Connection();
  });

  after(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  it("initializes default options", () => {
    const c = new Converter({ iModel, requestPoints });
    expect(c.maxPointsPerRequest).to.equal(300);
    expect(c.pending.isEmpty).to.be.true;
    expect(c.cache.size).to.equal(0);
  });

  it("initializes custom options", () => {
    const c = new Converter({
      iModel,
      requestPoints,
      maxPointsPerRequest: 123,
    });

    expect(c.maxPointsPerRequest).to.equal(123);
  });

  it("clamps options to permitted ranges", () => {
    let c = new Converter({
      iModel,
      requestPoints,
      maxPointsPerRequest: 0,
    });

    expect(c.maxPointsPerRequest).to.equal(1);

    c = new Converter({
      iModel,
      requestPoints,
      maxPointsPerRequest: -5,
    });

    expect(c.maxPointsPerRequest).to.equal(1);
  });

  function expectConvertedPoint(requested: XYZProps, received: PointWithStatus): void {
    expect(received.s).to.equal(GeoCoordStatus.Success);
    const rec = Point3d.fromJSON(received.p);
    const req = Point3d.fromJSON(requested);
    expect(rec.x).to.equal(req.x + 1);
    expect(rec.y).to.equal(req.y - 1);
    expect(rec.z).to.equal(req.z);
  }

  function expectConverted(requested: XYZProps[], received: PointWithStatus[]): void {
    expect(requested.length).to.equal(received.length);
    for (let i = 0; i < requested.length; i++)
      expectConvertedPoint(requested[i], received[i]);
  }

  it("converts points", async () => {
    const input: XYZProps[] = [
      { x: 0, y: 1, z: 2 },
      [ 6, 7, 8 ],
      [ 9, 10, 11 ],
      { x: 3, y: 4, z: 5 },
    ];

    const c = new Converter({ iModel, requestPoints });
    const output = await c.convert(input);
    expectConverted(input, output.points);
  });

  it("defaults omitted components to zero", async () => {
    const input: XYZProps[] = [
      { y: 1 },
      [ 6 ],
      { x: 3, z: 5 },
    ];

    const c = new Converter({ iModel, requestPoints });
    const output = await c.convert(input);
    expectConverted(input, output.points);
  });

  it("caches responses", async () => {
    const input = [
      [ 0, 1, 2 ],
      [ 3, 4, 5 ],
    ];

    const c = new Converter({ iModel, requestPoints });
    expect((await c.convert(input)).fromCache).to.equal(0);
    expect((await c.convert(input)).fromCache).to.equal(2);
  });

  it("makes no request if all points are in cache", async () => {
    let nRequests = 0;
    const reqPts = (pts: XYAndZ[]) => {
      ++nRequests;
      return requestPoints(pts);
    };

    const c = new Converter({ iModel, requestPoints: reqPts });
    const input = [ [ 0, 1, 2 ] ];
    expect(nRequests).to.equal(0);
    await c.convert(input);
    expect(nRequests).to.equal(1);
    await c.convert(input);
    expect(nRequests).to.equal(1);
    await c.convert([[3, 4, 5]]);
    expect(nRequests).to.equal(2);
  });

  it("requests only points that are not in cache", async () => {
    let ptsRequested: XYAndZ[] = [];
    const c = new Converter({
      iModel,
      requestPoints: (pts: XYAndZ[]) => {
        ptsRequested = pts;
        return requestPoints(pts);
      },
    });

    await c.convert([[0, 0, 0], [1, 1, 1]]);
    expect(ptsRequested).to.deep.equal([{x: 0, y: 0, z: 0}, {x: 1, y: 1, z: 1}]);

    await c.convert([[1, 1, 1], [2, 2, 2]]);
    expect(ptsRequested).to.deep.equal([{x: 2, y: 2, z: 2}]);
  });

  it("requests only points that are not currently in flight", async () => {
  });

  it("reports the number of points obtained from the cache", async () => {
  });

  it("does not request duplicate points", async () => {
  });

  it("produces and logs error upon exception", async () => {
  });

  it("does not make a request if the iModel is closed", async () => {
  });

  it("splits requests into batches of no more than maxPointsPerRequest", async () => {
  });

  it("dispatches on the very next frame if the request queue is full", async () => {
  });

  it("logs an error if number of points in response doesn't match number of points requested", async () => {
  });

  it("produces an error status for points requested but not returned", async () => {
  });
});
