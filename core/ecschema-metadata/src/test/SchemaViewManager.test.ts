/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { SchemaView, SchemaViewBuilder } from "../SchemaView/SchemaView";
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
