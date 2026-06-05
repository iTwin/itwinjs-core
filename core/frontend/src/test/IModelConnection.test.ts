/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, assert, beforeAll, describe, expect, it, vi } from "vitest";
import { DbResponseKind, DbResponseStatus, EmptyLocalization, IModelReadRpcInterface } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
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
