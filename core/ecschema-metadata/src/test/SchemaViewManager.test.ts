/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { SchemaManifest } from "../SchemaView/SchemaManifest";
import { SchemaView } from "../SchemaView/SchemaView";
import { SchemaViewBuilder } from "../SchemaView/SchemaViewBuilder";
import { schemaViewFormatVersion } from "../SchemaView/SchemaViewInterfaces";
import { SchemaViewDataProvider, SchemaViewManager } from "../SchemaView/SchemaViewManager";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function makeDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

/** A provider whose `fetchSchemaToken` blocks until the test releases it, so a `getSchemaView` call
 * can be made while an invalidation is waiting on the token. Every other fetch throws: a blob fetch
 * only happens if the manager decided to rebuild, which the tests assert on by its message. */
function makeBlockingProvider(tokenRequested: Deferred<void>, token: Deferred<string>): SchemaViewDataProvider {
  return {
    fetchFullBlob: async () => { throw new Error("reload attempted"); },
    fetchFragmentBlob: async () => { throw new Error("reload attempted"); },
    fetchManifest: async () => { throw new Error("reload attempted"); },
    fetchSchemaToken: async () => { tokenRequested.resolve(); return token.promise; },
  };
}

/** Seeds a manager with `view` already cached, as it would be after a real getSchemaView call. */
function installCachedView(manager: SchemaViewManager, view: SchemaView): void {
  (manager as any)._viewPromise = Promise.resolve(view);
}

describe("SchemaViewManager.invalidateIfChanged", () => {
  it("discards a stale view even when a getSchemaView call arrives while the token is in flight", async () => {
    const view = new SchemaViewBuilder().build("token-before");
    const tokenRequested = makeDeferred<void>();
    const token = makeDeferred<string>();
    const manager = new SchemaViewManager(makeBlockingProvider(tokenRequested, token));
    installCachedView(manager, view);

    const invalidated = manager.invalidateIfChanged();
    await tokenRequested.promise; // the token fetch is now in flight

    // A cache read landing mid-check would satisfy itself from the cached view and swap in a new
    // promise. The invalidation must still see the token change and drop the view.
    const concurrentRead = manager.getSchemaView();

    token.resolve("token-after");
    await invalidated;

    expect(view.isOutdated).toBe(true);
    // The read was serialized behind the invalidation, so it rebuilds instead of returning the
    // discarded view.
    await expect(concurrentRead).rejects.toThrow("reload attempted");
  });

  it("keeps the view when the token is unchanged, and a concurrent read returns that same view", async () => {
    const view = new SchemaViewBuilder().build("stable-token");
    const tokenRequested = makeDeferred<void>();
    const token = makeDeferred<string>();
    const manager = new SchemaViewManager(makeBlockingProvider(tokenRequested, token));
    installCachedView(manager, view);

    const invalidated = manager.invalidateIfChanged();
    await tokenRequested.promise;

    const concurrentRead = manager.getSchemaView();

    token.resolve("stable-token");
    await invalidated;

    expect(view.isOutdated).toBe(false);
    expect(await concurrentRead).toBe(view);
  });
});

/** Build the smallest valid SchemaView blob (all tables empty), same as in SchemaView.test.ts. Token
 * consistency is what these tests exercise; an empty fragment merges nothing, like an excluded schema. */
function makeMinimalBlob(): Uint8Array {
  const total = 9 + 30 + 4;
  const buf = new Uint8Array(total);
  const view = new DataView(buf.buffer);
  let p = 0;
  view.setUint32(p, 0x43534348, true); p += 4; // "CSCH" magic
  buf[p++] = schemaViewFormatVersion;
  view.setUint32(p, 39, true); p += 4; // stOffset
  for (const tag of [0x0A, 0x10, 0x20, 0x30, 0x31, 0x40]) {
    buf[p++] = tag;
    view.setUint32(p, 0, true); p += 4;
  }
  view.setUint32(p, 0, true); p += 4; // string table: count = 0
  return buf;
}

function makeManifest(...schemaNames: string[]): SchemaManifest {
  return new SchemaManifest(schemaNames.map((name) => ({ name, readVersion: 1, writeVersion: 0, minorVersion: 0, references: [] })));
}

/** A provider that reports the manifest and fragments under a schema-identity token the test can
 * flip between fetches, simulating a changeset pull changing schemas mid-load. */
function makeTokenFlippingProvider(state: { manifestToken: () => string, fragmentToken: () => string }) {
  const calls = { manifest: 0, fragment: 0 };
  const provider: SchemaViewDataProvider = {
    fetchFullBlob: async () => { throw new Error("full load attempted"); },
    fetchFragmentBlob: async () => {
      calls.fragment++;
      return { data: makeMinimalBlob(), schemaToken: state.fragmentToken() };
    },
    fetchManifest: async () => {
      calls.manifest++;
      return { manifest: makeManifest("SchemaA", "SchemaB"), schemaToken: state.manifestToken() };
    },
    fetchSchemaToken: async () => state.fragmentToken(),
  };
  return { provider, calls };
}

describe("SchemaViewManager schema-token binding", () => {
  it("discards and retries when schemas change between the manifest and fragment fetches", async () => {
    // The manifest is fetched at revision T1, but by the time the fragment arrives the schemas have
    // moved to T2. The manager must not merge T2 data under the T1 manifest; it retries from a fresh
    // manifest, which now also sees T2, and succeeds.
    let manifestCallToken = "T1";
    const { provider, calls } = makeTokenFlippingProvider({
      manifestToken: () => {
        const token = manifestCallToken;
        manifestCallToken = "T2"; // the retry's manifest fetch observes the new revision
        return token;
      },
      fragmentToken: () => "T2",
    });
    const manager = new SchemaViewManager(provider);

    const view = await manager.getSchemaView({ schemas: ["SchemaA"] });

    expect(calls.manifest).toBe(2);
    expect(calls.fragment).toBe(2);
    expect(view.schemaToken).toBe("T2");
    expect(view.isOutdated).toBe(false);
  });

  it("discards an accumulated view when schemas change before a later incremental load", async () => {
    // First load completes consistently at T1. Schemas then change; the next filtered request's
    // fragment carries T2 against the cached T1 manifest, so the old view (T1 data) is discarded
    // and a fresh one is built entirely at T2.
    let currentToken = "T1";
    const { provider } = makeTokenFlippingProvider({
      manifestToken: () => currentToken,
      fragmentToken: () => currentToken,
    });
    const manager = new SchemaViewManager(provider);

    const firstView = await manager.getSchemaView({ schemas: ["SchemaA"] });
    expect(firstView.schemaToken).toBe("T1");

    currentToken = "T2";
    const secondView = await manager.getSchemaView({ schemas: ["SchemaB"] });

    expect(firstView.isOutdated).toBe(true);
    expect(secondView).not.toBe(firstView);
    expect(secondView.schemaToken).toBe("T2");
    expect(secondView.isOutdated).toBe(false);
  });

  it("fails after one retry when the token keeps changing", async () => {
    // Fragments never match the manifest they were requested under - schemas are churning. The
    // manager retries exactly once, then surfaces the failure instead of looping.
    const { provider, calls } = makeTokenFlippingProvider({
      manifestToken: () => "M",
      fragmentToken: () => "X",
    });
    const manager = new SchemaViewManager(provider);

    await expect(manager.getSchemaView({ schemas: ["SchemaA"] })).rejects.toThrow(/schemas changed/i);
    expect(calls.manifest).toBe(2);

    // The manager recovers: once the revision is stable, the next request succeeds from scratch.
    const stable = makeTokenFlippingProvider({ manifestToken: () => "S", fragmentToken: () => "S" });
    const recovered = new SchemaViewManager(stable.provider);
    expect((await recovered.getSchemaView({ schemas: ["SchemaA"] })).schemaToken).toBe("S");
  });
});
