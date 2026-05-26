/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaViewBuilder } from "@itwin/ecschema-metadata";
import { BriefcaseConnection } from "../BriefcaseConnection";
import { IModelApp } from "../IModelApp";
import { IpcApp } from "../IpcApp";

/** Minimal fake props returned by the mocked openBriefcase IPC call. */
const fakeBriefcaseProps = {
  key: "test-key",
  rootSubject: { name: "test" },
  iTwinId: "11111111-1111-1111-1111-111111111111",
  iModelId: "22222222-2222-2222-2222-222222222222",
};

/** Open a BriefcaseConnection backed entirely by mocked IPC. */
async function openMockedConnection(): Promise<BriefcaseConnection> {
  vi.spyOn(IpcApp, "appFunctionIpc", "get").mockReturnValue({
    openBriefcase: vi.fn().mockResolvedValue(fakeBriefcaseProps),
    pullChanges: vi.fn().mockResolvedValue({ index: 5, id: "cs-0005" }),
    cancelPullChangesRequest: vi.fn(),
    closeIModel: vi.fn().mockResolvedValue(undefined),
  } as any);
  return BriefcaseConnection.openFile({ fileName: "test.bim" });
}

/**
 * Returns a minimal mock ECSqlReader whose single row reports the given checksum.
 * Used to simulate the response from `PRAGMA checksum(ecdb_schema)`.
 */
function makeChecksumReader(checksum: string) {
  // Property key must match the column name returned by PRAGMA checksum(ecdb_schema).
  // eslint-disable-next-line @typescript-eslint/naming-convention
  return { next: vi.fn().mockResolvedValue({ done: false, value: { "sha3_256": checksum } }) } as any;
}

describe("SchemaView frontend cache invalidation", () => {
  beforeEach(async () => {
    await IModelApp.startup();
    vi.spyOn(IpcApp, "addListener").mockReturnValue(() => {});
    vi.spyOn(IpcApp, "removeListener").mockReturnValue(undefined);
  });

  afterEach(async () => {
    await IModelApp.shutdown();
    vi.restoreAllMocks();
  });

  it("invalidateSchemaViewIfChanged is a no-op when no schema view is cached", async () => {
    const conn = await openMockedConnection();

    // _schemasPromise is undefined - the method should return immediately without error.
    await (conn as any).invalidateSchemaViewIfChanged();

    expect((conn as any)._schemasPromise).toBeUndefined();
  });

  it("invalidateSchemaViewIfChanged preserves the cached view when the schema checksum is unchanged", async () => {
    const conn = await openMockedConnection();
    const token = "sha3-256-checksum-abc";
    const view = new SchemaViewBuilder().build(token);
    (conn as any)._schemasPromise = Promise.resolve(view);

    // PRAGMA checksum returns the same token - schemas did not change.
    vi.spyOn(conn, "createQueryReader").mockReturnValue(makeChecksumReader(token));

    await (conn as any).invalidateSchemaViewIfChanged();

    expect(view.isOutdated).toBe(false);
    expect((conn as any)._schemasPromise).not.toBeUndefined();
  });

  it("invalidateSchemaViewIfChanged marks old view outdated and clears cache when schemas changed", async () => {
    const conn = await openMockedConnection();
    const view = new SchemaViewBuilder().build("checksum-before");
    (conn as any)._schemasPromise = Promise.resolve(view);

    // PRAGMA checksum returns a different token - schemas changed since the view was built.
    vi.spyOn(conn, "createQueryReader").mockReturnValue(makeChecksumReader("checksum-after"));

    await (conn as any).invalidateSchemaViewIfChanged();

    expect(view.isOutdated).toBe(true);
    expect((conn as any)._schemasPromise).toBeUndefined();
  });

  it("pullChanges invalidates schema view when a schema changeset was pulled", async () => {
    const conn = await openMockedConnection();
    const view = new SchemaViewBuilder().build("checksum-before");
    (conn as any)._schemasPromise = Promise.resolve(view);

    // Simulate that the pull brought in a schema changeset - checksum differs afterwards.
    vi.spyOn(conn, "createQueryReader").mockReturnValue(makeChecksumReader("checksum-after"));

    await conn.pullChanges();

    expect(view.isOutdated).toBe(true);
    expect((conn as any)._schemasPromise).toBeUndefined();
  });

  it("pullChanges preserves schema view when no schema change was pulled", async () => {
    const conn = await openMockedConnection();
    const token = "stable-checksum";
    const view = new SchemaViewBuilder().build(token);
    (conn as any)._schemasPromise = Promise.resolve(view);

    // Checksum is unchanged - a data-only pull should leave the schema view intact.
    vi.spyOn(conn, "createQueryReader").mockReturnValue(makeChecksumReader(token));

    await conn.pullChanges();

    expect(view.isOutdated).toBe(false);
    expect((conn as any)._schemasPromise).not.toBeUndefined();
  });
});