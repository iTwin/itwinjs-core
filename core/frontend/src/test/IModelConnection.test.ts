/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, assert, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Cartographic, DbResponseKind, DbResponseStatus, EmptyLocalization, IModelReadRpcInterface } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { getHeightAverage, getHeightRange } from "../GeoProviders";
import { createBlankConnection } from "./createBlankConnection";

function makeEmptyDoneResponse() {
  return {
    status: DbResponseStatus.Done,
    data: [],
    meta: [],
    rowCount: 0,
    kind: DbResponseKind.ECSql,
    stats: { cpuTime: 0, totalTime: 0, memUsed: 0, prepareTime: 0, timeLimit: 0, memLimit: 0 },
  };
}

describe("IModelConnection geo-elevation getters on non-geolocated iModels", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  function createNonGeoLocatedConnection() {
    const imodel = createBlankConnection();
    imodel.ecefLocation = undefined;
    expect(imodel.isGeoLocated).toBe(false);
    return imodel;
  }

  it("geodeticToSeaLevel returns 0 without throwing for non-geolocated iModel", () => {
    const imodel = createNonGeoLocatedConnection();
    const result = imodel.geodeticToSeaLevel;
    expect(result).toBe(0);
  });

  it("projectCenterAltitude returns 0 without throwing for non-geolocated iModel", () => {
    const imodel = createNonGeoLocatedConnection();
    const result = imodel.projectCenterAltitude;
    expect(result).toBe(0);
  });

  it("geodeticToSeaLevel delegates to injected geoidProvider on geolocated iModel", async () => {
    const mock = { getGeodeticToSeaLevelOffset: vi.fn().mockResolvedValue(-30.5) };
    IModelApp.geoidProvider = mock;
    const imodel = createBlankConnection();
    expect(imodel.isGeoLocated).toBe(true);

    // First access returns undefined (async request in flight)
    const initial = imodel.geodeticToSeaLevel;
    expect(initial).toBeUndefined();
    expect(mock.getGeodeticToSeaLevelOffset).toHaveBeenCalled();

    // Wait for the promise to resolve and the event to fire
    await vi.waitFor(() => {
      expect(imodel.geodeticToSeaLevel).toBe(-30.5);
    });
  });

  it("projectCenterAltitude delegates to injected elevationProvider on geolocated iModel", async () => {
    const mock = { getHeight: vi.fn().mockResolvedValue(250.0) };
    IModelApp.elevationProvider = mock;
    const imodel = createBlankConnection();
    expect(imodel.isGeoLocated).toBe(true);

    // First access returns undefined (async request in flight)
    const initial = imodel.projectCenterAltitude;
    expect(initial).toBeUndefined();
    expect(mock.getHeight).toHaveBeenCalled();

    // Wait for the promise to resolve
    await vi.waitFor(() => {
      expect(imodel.projectCenterAltitude).toBe(250.0);
    });
  });
});

describe("IModelApp provider injection", () => {
  beforeEach(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterEach(async () => IModelApp.shutdown());

  it("uses injected elevationProvider via startup", async () => {
    await IModelApp.shutdown();
    const mock = { getHeight: vi.fn().mockResolvedValue(123.4) };
    await IModelApp.startup({ localization: new EmptyLocalization(), geospatialProviders: { elevationProvider: mock } });
    const carto = Cartographic.fromDegrees({ longitude: -75, latitude: 40, height: 0 });
    const result = await IModelApp.elevationProvider.getHeight(carto);
    expect(result).toBe(123.4);
    expect(mock.getHeight).toHaveBeenCalledWith(carto);
  });

  it("uses injected geoidProvider via setter", async () => {
    const mock = { getGeodeticToSeaLevelOffset: vi.fn().mockResolvedValue(-32.5) };
    IModelApp.geoidProvider = mock;
    const carto = Cartographic.fromDegrees({ longitude: 0, latitude: 0, height: 0 });
    const result = await IModelApp.geoidProvider.getGeodeticToSeaLevelOffset(carto);
    expect(result).toBe(-32.5);
    expect(mock.getGeodeticToSeaLevelOffset).toHaveBeenCalledWith(carto);
  });

  it("uses injected locationProvider via setter", async () => {
    const center = Cartographic.fromDegrees({ longitude: -122, latitude: 47, height: 0 });
    const mock = { getLocation: vi.fn().mockResolvedValue({ center }) };
    IModelApp.locationProvider = mock;
    const result = await IModelApp.locationProvider.getLocation("Seattle");
    expect(result).toEqual({ center });
    expect(mock.getLocation).toHaveBeenCalledWith("Seattle");
  });
});

describe("getHeightRange and getHeightAverage utilities", () => {
  beforeAll(async () => {
    if (!IModelApp.initialized)
      await IModelApp.startup({ localization: new EmptyLocalization() });
  });
  afterAll(async () => IModelApp.shutdown());

  it("getHeightRange returns null range for non-geolocated iModel", async () => {
    const imodel = createBlankConnection();
    imodel.ecefLocation = undefined;
    const mock = { getHeight: vi.fn().mockResolvedValue(0), getHeights: vi.fn().mockResolvedValue([10, 20, 30]) };
    const result = await getHeightRange(mock, imodel);
    expect(result.isNull).toBe(true);
    expect(mock.getHeights).not.toHaveBeenCalled();
  });

  it("getHeightAverage returns 0 for non-geolocated iModel", async () => {
    const imodel = createBlankConnection();
    imodel.ecefLocation = undefined;
    const mock = { getHeight: vi.fn().mockResolvedValue(0), getHeights: vi.fn().mockResolvedValue([10, 20, 30]) };
    const result = await getHeightAverage(mock, imodel);
    expect(result).toBe(0);
    expect(mock.getHeights).not.toHaveBeenCalled();
  });

  it("getHeightRange calls provider.getHeights for geolocated iModel", async () => {
    const imodel = createBlankConnection();
    expect(imodel.isGeoLocated).toBe(true);
    const mock = { getHeight: vi.fn().mockResolvedValue(0), getHeights: vi.fn().mockResolvedValue([5, 15, 25]) };
    const result = await getHeightRange(mock, imodel);
    expect(result.low).toBe(5);
    expect(result.high).toBe(25);
    expect(mock.getHeights).toHaveBeenCalled();
  });

  it("getHeightAverage computes mean from provider.getHeights", async () => {
    const imodel = createBlankConnection();
    const mock = { getHeight: vi.fn().mockResolvedValue(0), getHeights: vi.fn().mockResolvedValue([10, 20, 30]) };
    const result = await getHeightAverage(mock, imodel);
    expect(result).toBe(20);
  });

  it("getHeightRange returns null range when provider lacks getHeights", async () => {
    const imodel = createBlankConnection();
    const mock = { getHeight: vi.fn().mockResolvedValue(0) };
    const result = await getHeightRange(mock, imodel);
    expect(result.isNull).toBe(true);
  });
});

describe("IModelConnection.createQueryReader should return safely if the connection is closed", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());
  afterEach(() => vi.restoreAllMocks());

  it("toArray() returns [] and does not throw when the connection is closed before iteration", async () => {
    const imodel = createBlankConnection();
    assert.isFalse(imodel.isOpen, "BlankConnection correctly simulates our closed connection setup");

    await expect(imodel.createQueryReader("SELECT ECInstanceId FROM bis.Element").toArray()).resolves.toEqual([]);
    await imodel.close();
  });

  it("async iterator yields no rows and does not throw when the connection is closed before iteration", async () => {
    const imodel = createBlankConnection();
    assert.isFalse(imodel.isOpen, "BlankConnection correctly simulates our closed connection setup");

    const rows: any[] = [];
    for await (const row of imodel.createQueryReader("SELECT ECInstanceId FROM bis.Element")) {
      rows.push(row.toRow());
    }
    expect(rows).toEqual([]);
    await imodel.close();
  });

  it("step() returns false immediately and does not throw when the connection is closed", async () => {
    const imodel = createBlankConnection();
    assert.isFalse(imodel.isOpen, "BlankConnection correctly simulates our closed connection setup");
    const hasRow = await imodel.createQueryReader("SELECT ECInstanceId FROM bis.Element").step();
    expect(hasRow).toBe(false);
    await imodel.close();
  });

  const queries = [
    "SELECT ECInstanceId FROM bis.Element",
    "SELECT ECInstanceId FROM bis.Model",
    "SELECT ECInstanceId FROM bis.Category",
  ];

  it("all concurrent toArray() calls resolve to [] when the connection is closed mid-flight instead of throwing", async () => {
    let closed = false;

    const conn = {
      get isOpen() { return !closed; },
      routingContext: { token: {} },
      getRpcProps: () => {
        if (closed) {
          throw new Error("IModel is not open for rpc");
        }
        return { key: "" };
      },
      createQueryReader: (...args: Parameters<IModelConnection["createQueryReader"]>) =>
        IModelConnection.prototype.createQueryReader.apply(conn, args),
    } as unknown as IModelConnection;

    const fakeClient = { queryRows: vi.fn().mockResolvedValue(makeEmptyDoneResponse()) };
    const getClientForRouting = vi.spyOn(IModelReadRpcInterface, "getClientForRouting").mockReturnValue(
      fakeClient as unknown as IModelReadRpcInterface
    );

    const readers = queries.map((ecsql) => conn.createQueryReader(ecsql));

    // Connection closes before any actual iteration starts.
    closed = true;

    const results = await Promise.all(readers.map(async (r) => r.toArray()));
    for (const rows of results) {
      expect(rows).toEqual([]);
    }
    expect(getClientForRouting).not.toHaveBeenCalled();
    expect(fakeClient.queryRows).not.toHaveBeenCalled();
  });

  it("all concurrent for-await loops complete with no rows when the connection is closed mid-flight", async () => {
    let closed = false;
    const conn = {
      get isOpen() { return !closed; },
      routingContext: { token: {} },
      getRpcProps: () => {
        if (closed) throw new Error("IModel is not open for rpc");
        return { key: "" };
      },
      createQueryReader: (...args: Parameters<IModelConnection["createQueryReader"]>) =>
        IModelConnection.prototype.createQueryReader.apply(conn, args),
    } as unknown as IModelConnection;

    const fakeClient = { queryRows: vi.fn().mockResolvedValue(makeEmptyDoneResponse()) };
    const getClientForRouting = vi.spyOn(IModelReadRpcInterface, "getClientForRouting").mockReturnValue(
      fakeClient as unknown as IModelReadRpcInterface
    );

    const readers = queries.map((ecsql) => conn.createQueryReader(ecsql));

    // Connection closes before any actual iteration starts.
    closed = true;

    const errors: unknown[] = [];

    const results = await Promise.all(queries.map(async (_, i) => {
      const rows: any[] = [];
      try {
        for await (const row of readers[i]) {
          rows.push(row.toRow());
        }
      } catch (err) {
        errors.push(err);
      }
      return rows;
    }));

    // No unhandled errors at any independent call site.
    expect(errors).toEqual([]);

    // Every loop terminated cleanly with no rows.
    for (const rows of results) {
      expect(rows).toEqual([]);
    }
    expect(getClientForRouting).not.toHaveBeenCalled();
    expect(fakeClient.queryRows).not.toHaveBeenCalled();
  });
});
