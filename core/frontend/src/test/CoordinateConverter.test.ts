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
  public constructor(opts: Omit<CoordinateConverterOptions, "isIModelClosed"> & { iModel: BlankConnection }) {
    super({
      ...opts,
      isIModelClosed: () => opts.iModel.isClosed,
    });
  }

  public get cache() { return this._cache; }
  public get pending() { return this._pending; }
  public get inflight() { return this._inflight; }
  public get maxPointsPerRequest() { return this._maxPointsPerRequest; }
  public get state() { return this._state; }
}

describe("CoordinateConverter", () => {
  let iModel: Connection;

  // A default conversion that produces { x+1, y-1, z }
  async function requestPoints(pts: XYAndZ[]): Promise<PointWithStatus[]> {
    return Promise.resolve(pts.map((pt) => {
      return {
        p: { x: pt.x + 1, y: pt.y - 1, z: pt.z },
        s: GeoCoordStatus.Success,
      };
    }));
  }

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
    const reqPts = async (pts: XYAndZ[]) => {
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
      requestPoints: async (pts: XYAndZ[]) => {
        ptsRequested = pts;
        return requestPoints(pts);
      },
    });

    await c.convert([[0, 0, 0], [1, 1, 1]]);
    expect(ptsRequested).to.deep.equal([{x: 0, y: 0, z: 0}, {x: 1, y: 1, z: 1}]);

    await c.convert([[1, 1, 1], [2, 2, 2]]);
    expect(ptsRequested).to.deep.equal([{x: 2, y: 2, z: 2}]);
  });

  async function waitOneFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function waitNFrames(n: number): Promise<void> {
    for (let i = 0; i < n; i++)
      await waitOneFrame();
  }

  it("has only one request in flight at a time", async () => {
    const c = new Converter({
      iModel,
      requestPoints: async (pts: XYAndZ[]) => {
        await waitNFrames(5);
        return requestPoints(pts);
      },
    });

    expect(c.state).to.equal("idle");
    const p0 = c.convert([[0, 0, 0]]);
    expect(c.state).to.equal("scheduled");
    expect(c.pending.length).to.equal(1);
    expect(c.inflight.length).to.equal(0);

    await waitOneFrame();
    expect(c.state).to.equal("in-flight");
    expect(c.inflight.length).to.equal(1);
    expect(c.pending.length).to.equal(0);

    const p1 = c.convert([[1, 1, 1]]);
    expect(c.pending.length).to.equal(1);

    await waitOneFrame();
    expect(c.state).to.equal("in-flight");
    expect(c.pending.length).to.equal(1);

    const r = await Promise.all([p0, p1]);
    expect(c.state).to.equal("idle");
    expect(c.pending.length).to.equal(0);
    expect(c.inflight.length).to.equal(0);
    expectConverted([[0, 0, 0]], r[0].points);
    expectConverted([[1, 1, 1]], r[1].points);
  });

  it("requests only points that are not currently in flight", async () => {
    const ptsRequested: Array<XYAndZ[]> = [];
    const c = new Converter({
      iModel,
      requestPoints: async (pts: XYAndZ[]) => {
        await waitNFrames(5);
        ptsRequested.push(pts);
        return requestPoints(pts);
      },
    });

    const p0 = c.convert([[0, 0, 0], [1, 1, 1]]);
    await waitOneFrame();
    const p1 = c.convert([[1, 1, 1], [2, 2, 2]]);
    const results = await Promise.all([p0, p1]);

    expect(ptsRequested).to.deep.equal([
      [{x: 0, y: 0, z: 0}, {x: 1, y: 1, z: 1}],
      [{x: 2, y: 2, z: 2}],
    ]);

    expectConverted(ptsRequested[0], results[0].points);
    expectConverted([[1, 1, 1], [2, 2, 2]], results[1].points);
  });

  it("does not request duplicate points", async () => {
    let ptsRequested: XYAndZ[] = [];
    const c = new Converter({
      iModel,
      requestPoints: async (pts: XYAndZ[]) => {
        ptsRequested = pts;
        return requestPoints(pts);
      },
    });

    await c.convert([
      {x: 3, y: 3, z: 3},
      [1, 1, 1],
      [0, 0, 0],
      {x: 2, y: 2, z: 2},
      {x: 0, y: 0, z: 0},
      [2, 2, 2],
      {x: 3, y: 3, z: 3},
      [0, 0, 0],
    ]);

    expect(ptsRequested).to.deep.equal([
      {x: 0, y: 0, z: 0},
      {x: 1, y: 1, z: 1},
      {x: 2, y: 2, z: 2},
      {x: 3, y: 3, z: 3},
    ]);
  });

  it("produces and logs error status upon exception", async () => {
    const c = new Converter({
      iModel,
      requestPoints: async () => {
        await waitOneFrame();
        throw new Error("uh-oh");
      },
    });

    const result = await c.convert([[1, 2, 3]]);
    expect(result.points.length).to.equal(1);
    const p = Point3d.fromJSON(result.points[0].p);
    expect(result.points[0].s).to.equal(GeoCoordStatus.CSMapError);
    expect(p.x).to.equal(1);
    expect(p.y).to.equal(2);
    expect(p.z).to.equal(3);
  });

  it("does not make a request if the iModel is closed", async () => {
    const imodel = new Connection();
    let requested = false;
    const c = new Converter({
      iModel: imodel,
      requestPoints: async (xyz: XYAndZ[]) => {
        requested = true;
        return requestPoints(xyz);
      },
    });

    const p = c.convert([[1, 2, 3]]);
    expect(requested).to.be.false;
    await imodel.close();
    const pts = await p;
    expect(requested).to.be.false;
    expect(pts.points.length).to.equal(1);
    expect(pts.points[0].s).to.equal(GeoCoordStatus.CSMapError);
  });

  it("batches requests received during the same frame", async () => {
    const c = new Converter({
      iModel,
      requestPoints: async (pts: XYAndZ[]) => {
        expect(pts).to.deep.equal([{x: 0, y: 0, z: 0}, {x: 1, y: 1, z: 1}]);
        return requestPoints(pts);
      },
    });

    const results = await Promise.all([
      c.convert([[0, 0, 0]]),
      c.convert([[1, 1, 1]]),
    ]);

    expect(results.length).to.equal(2);
    expectConverted([[0, 0, 0]], results[0].points);
    expectConverted([[1, 1, 1]], results[1].points);
  });

  it("splits requests into batches of no more than maxPointsPerRequest", async () => {
    let nRequests = 0;
    const c = new Converter({
      iModel,
      maxPointsPerRequest: 2,
      requestPoints: async (pts: XYAndZ[]) => {
        ++nRequests;
        expect(pts.length).most(2);
        return requestPoints(pts);
      },
    });

    const input = [[0, 0, 0], [1, 1, 1], [2, 2, 2], [3, 3, 3], [4, 4, 4]];
    const output = await c.convert(input);
    expect(nRequests).to.equal(3);
    expectConverted(input, output.points);
  });

  it("produces an error status for points requested but not returned", async () => {
    const c = new Converter({
      iModel,
      requestPoints: async () => Promise.resolve([{ p: [1, 2, 3], s: GeoCoordStatus.Success }]),
    });

    const results = await c.convert([[2, 2, 2], [1, 1, 1], [3, 3, 3]]);
    expect(results.points).to.deep.equal([{
      s: GeoCoordStatus.CSMapError,
      p: {x: 2, y: 2, z: 2},
    }, {
      s: GeoCoordStatus.Success,
      p: [1, 2, 3],
    }, {
      s: GeoCoordStatus.CSMapError,
      p: {x: 3, y: 3, z: 3},
    }]);
  });
});
