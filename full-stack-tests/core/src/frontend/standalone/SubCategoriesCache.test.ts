/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BeDuration, Id64, Id64Arg, Id64Set, Id64String } from "@bentley/bentleyjs-core";
import { IModelConnection, MockRender, SnapshotConnection, SubCategoriesCache } from "@bentley/imodeljs-frontend";

describe("SubCategoriesCache", () => {
  // test.bim:
  //  3d views:
  //    view:           34
  //    model selector: 35
  //    models: 1c 1f 22 23 24 (all spatial models in file)
  //  All but 1 category has one subcategory (id = catId + 1)
  //  4 spatial categories:
  //    17
  //    2d
  //    2f: 2 subcategories: 30, 33
  //    31
  //  1 drawing category: 19
  let imodel: IModelConnection;

  before(async () => {
    await MockRender.App.startup();
    imodel = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    if (undefined !== imodel)
      await imodel.close();

    await MockRender.App.shutdown();
  });

  it("should not repeatedly request same categories", async () => {
    const catIds = new Set<string>();
    catIds.add("0x2f"); // contains 2 subcategories: 0x33 and 0x30
    catIds.add("0x17"); // contains 1 subcategory: 0x18

    // Request the categories and await the result
    const subcats = new SubCategoriesCache(imodel);
    const req1 = subcats.load(catIds);
    expect(req1).not.to.be.undefined;
    expect(req1!.missingCategoryIds.size).to.equal(catIds.size);
    for (const catId of catIds)
      expect(req1!.missingCategoryIds.has(catId)).to.be.true;

    const res1 = await req1!.promise;
    expect(res1).to.be.true; // indicates all info loaded

    // Request the same categories again - should be a no-op as they are already loaded.
    const req2 = subcats.load(catIds);
    expect(req2).to.be.undefined;

    // Now request some "categories" using Ids that do not identify category elements
    catIds.clear();
    catIds.add("0x1a"); // is a subcategory Id, not a category Id
    catIds.add("0x12345678"); // does not identify an existent element
    catIds.add("lalala"); // is an invalid Id64String

    const req3 = subcats.load(catIds);
    expect(req3).not.to.be.undefined;
    expect(req3!.missingCategoryIds.size).to.equal(catIds.size);
    for (const catId of catIds)
      expect(req3!.missingCategoryIds.has(catId)).to.be.true;

    const res3 = await req3!.promise;
    expect(res3).to.be.true;

    // Repeat the request - should be a no-op - we should cache the result even if the query returned no subcategory info
    const req4 = subcats.load(catIds);
    expect(req4).to.be.undefined;
  });

  function expectEqualIdSets(idSet: Id64Set, ids: Id64Arg): void {
    expect(idSet.size).to.equal(Id64.sizeOf(ids));
    for (const id of Id64.iterable(ids))
      expect(idSet.has(id)).to.be.true;
  }

  class Queue extends SubCategoriesCache.Queue {
    // Note: it doesn't use IModelConnection's cache, so it always starts out empty.
    public readonly cache: SubCategoriesCache;

    public constructor(iModel: IModelConnection) {
      super();
      this.cache = new SubCategoriesCache(iModel);
    }

    public q(catIds: Id64Arg, func: SubCategoriesCache.QueueFunc = () => undefined): void {
      this.push(this.cache, catIds, func);
    }

    public expectMembers(current: boolean, next: boolean, request: boolean, disposed = false): void {
      expect(this.current !== undefined).to.equal(current);
      expect(this.next !== undefined).to.equal(next);
      expect(this.request !== undefined).to.equal(request);
      expect(this.disposed).to.equal(disposed);
    }

    public expectNotLoaded(catIds: Id64Arg): void {
      for (const catId of Id64.iterable(catIds))
        expect(this.cache.getSubCategories(catId)).to.be.undefined;
    }

    public expectLoaded(catId: Id64String, subcatIds: Id64Arg): void {
      const subcats = this.cache.getSubCategories(catId);
      expect(subcats).not.to.be.undefined;
      expectEqualIdSets(subcats!, subcatIds);
    }

    public get current() { return this._current; }
    public get next() { return this._next; }
    public get request() { return this._request; }
    public get disposed() { return this._disposed; }

    public async waitUntilEmpty(): Promise<void> {
      while (!this.isEmpty)
        await BeDuration.wait(1);
    }

    public expectEmpty(disposed = false): void {
      this.expectMembers(false, false, false, disposed);
      expect(this.isEmpty).to.be.true;
    }

    public expectFull(): void {
      this.expectMembers(true, true, true);
      expect(this.isEmpty).to.be.false;
    }
  }

  it("should have expected members", () => {
    const q = new Queue(imodel);
    q.expectEmpty();

    q.dispose();
    q.expectEmpty(true);
  });

  it("should execute empty request immediately", () => {
    const q = new Queue(imodel);
    let proc = 0;
    q.q(new Set<string>(), () => ++proc);

    expect(proc).to.equal(1);
    expect(q.request).to.be.undefined;

    q.expectEmpty();
  });

  it("should execute request for unloaded categories asynchronously", async () => {
    const q = new Queue(imodel);
    q.expectNotLoaded("0x2f");
    q.q("0x2f");
    q.expectNotLoaded("02f");
    await q.waitUntilEmpty();
    q.expectLoaded("0x2f", ["0x30", "0x33"]);
  });

  it("should process category asynchronously, then same category synchronously", async () => {
    const q = new Queue(imodel);
    q.expectNotLoaded("0x17");

    let processedFirst = 0;
    let processedSecond = 0;
    q.q("0x17", () => ++processedFirst); // becomes current
    q.q("0x17", () => ++processedSecond); // becomes next

    q.expectFull();

    expectEqualIdSets(q.current!.categoryIds, q.request!.missingCategoryIds);
    expectEqualIdSets(q.current!.categoryIds, "0x17");
    expectEqualIdSets(q.current!.categoryIds, q.next!.categoryIds);

    // First request will load 0x17 asynchronously. As soon as that occurs, it will process second request immediately and the queue will become empty again.
    q.expectNotLoaded("0x17");
    await q.waitUntilEmpty();
    q.expectLoaded("0x17", "0x18");
    q.expectEmpty();

    expect(processedFirst).to.equal(1);
    expect(processedSecond).to.equal(1);
  });

  it("should process consecutive requests asynchronously", async () => {
    const q = new Queue(imodel);
    q.expectNotLoaded(["0x17", "0x2f", "0x2d"]);

    let lastProcessed = 0;

    // becomes current
    q.q("0x17", () => {
      expect(lastProcessed++).to.equal(0);

      // Only the first request has been processed so far.
      q.expectLoaded("0x17", "0x18");
      q.expectNotLoaded(["0x2f", "0x2d"]);
    });

    // becomes next
    q.q("0x2f", () => {
      expect(lastProcessed++).to.equal(1);

      // The second and third requests were processed together
      q.expectLoaded("0x2f", ["0x30", "0x33"]);
      q.expectLoaded("0x2d", "0x2e");
    });

    // categories are merged with next; function is appended to next
    q.q("0x2d", () => {
      expect(lastProcessed++).to.equal(2);
    });

    q.expectFull();

    expectEqualIdSets(q.current!.categoryIds, q.request!.missingCategoryIds);
    expectEqualIdSets(q.current!.categoryIds, "0x17");
    expectEqualIdSets(q.next!.categoryIds, ["0x2f", "0x2d"]);

    // First request will load 0x17 asynchronously. Second will load 0x2f and 0x2d asynchronously.
    q.expectNotLoaded(["0x17", "0x2f", "0x2d"]);
    await q.waitUntilEmpty();

    // Requesting already-loaded categories should be processed immediately
    q.q(["0x17", "0x2f", "0x2d"], () => {
      expect(lastProcessed++).to.equal(3);
    });

    q.expectEmpty();
    expect(lastProcessed).to.equal(4);

    // Requesting same 3 categories individually also processes immediately, in order.
    lastProcessed = 0;
    q.q("0x17", () => {
      expect(lastProcessed++).to.equal(0);
    });
    q.q("0x2f", () => {
      expect(lastProcessed++).to.equal(1);
    });
    q.q("0x2d", () => {
      expect(lastProcessed++).to.equal(2);
    });

    q.expectEmpty();
    expect(lastProcessed).to.equal(3);
  });

  it("should process loaded categories immediately, then unloaded categories asynchronously", async () => {
    const q = new Queue(imodel);

    const load = q.cache.load("0x17");
    expect(load).not.to.be.undefined;
    await load!.promise;

    q.expectLoaded("0x17", "0x18");

    // Request a loaded category, then an unloaded category.
    let lastProcessed = 0;
    q.q("0x17", () => {
      expect(lastProcessed++).to.equal(0);
      q.expectNotLoaded("0x2d");
    });

    q.q("0x2d", () => {
      expect(lastProcessed++).to.equal(1);
      q.expectLoaded("0x2d", "0x2e");
    });

    q.expectMembers(true, false, true);
    expect(lastProcessed).to.equal(1);
    q.expectNotLoaded("0x2d");

    await q.waitUntilEmpty();
    expect(lastProcessed).to.equal(2);
    q.expectLoaded("0x2d", "0x2e");
  });

  it("should not process requests fulfilled after disposal", async () => {
    const q = new Queue(imodel);

    // Request a category that is not yet loaded.
    let processed = false;
    q.q("0x17", () => processed = true);

    expect(q.request).not.to.be.undefined;
    const promise = q.request!.promise;
    let promiseFulfilled = false;

    // I'm going to handle it further down the function, geez...
    promise.then(() => promiseFulfilled = true); // eslint-disable-line @typescript-eslint/no-floating-promises

    q.expectMembers(true, false, true);
    q.dispose();
    q.expectEmpty(true);

    // The promise will fulfill. The results will be added to the cache, but our processing function will not execute.
    await promise;
    expect(promiseFulfilled).to.be.true;
    expect(processed).to.be.false;
    q.expectNotLoaded("0x17");
  });

  it("should not process synchronous requests after disposal", async () => {
    // Load a category
    const q = new Queue(imodel);
    q.q("0x17");
    await q.waitUntilEmpty();

    q.expectLoaded("0x17", "0x18");

    // Dispose, then request same category. Should be ignored.
    let processed = false;
    q.dispose();
    q.q("0x17", () => processed = true);
    q.expectEmpty(true);
    expect(processed).to.be.false;
  });

  it("should not process pending asynchronous requests after disposal", async () => {
    const q = new Queue(imodel);
    q.q("0x17", () => q.dispose());

    let processedPending = false;
    q.q("0x2d", () => processedPending = true);

    await q.waitUntilEmpty();
    expect(processedPending).to.be.false;
    q.expectLoaded("0x17", "0x18");
    q.expectNotLoaded("0x2d");
  });

  it("should not process pending synchronous requests after disposal", async () => {
    const q = new Queue(imodel);

    // Asynchronous request to load category.
    q.q("0x17", () => q.dispose());

    // Request same category, which would normally be processed synchronously as soon as first request completes.
    let processedPending = false;
    q.q("0x17", () => processedPending = true);

    await q.waitUntilEmpty();

    // Should not process second request after disposal.
    expect(processedPending).to.be.false;
    q.expectLoaded("0x17", "0x18");
  });

  it("should not create requests after disposal", () => {
    const q = new Queue(imodel);
    q.dispose();
    q.q("0x17");
    q.expectEmpty(true);
  });
});
