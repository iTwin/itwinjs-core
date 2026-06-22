/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import { BeEvent, CompressedId64Set } from "@itwin/core-bentley";
import { FeatureOverrides, NotifyEntitiesChangedArgs, SubCategoryAppearance, SubCategoryResultRow } from "@itwin/core-common";
import type { IModelConnection } from "../IModelConnection";
import { SubCategoriesCache } from "../SubCategoriesCache";
import { EntityChanges, TxnEntityChanges } from "../TxnEntityChanges";

function createChanges(args: NotifyEntitiesChangedArgs): TxnEntityChanges {
  return new EntityChanges(args);
}

function createSubCategoryChange(id: string, type: "inserted" | "deleted" | "updated"): NotifyEntitiesChangedArgs {
  const changedIds = CompressedId64Set.compressIds([id]);
  return {
    inserted: type === "inserted" ? changedIds : undefined,
    deleted: type === "deleted" ? changedIds : undefined,
    updated: type === "updated" ? changedIds : undefined,
    insertedMeta: type === "inserted" ? [0] : [],
    deletedMeta: type === "deleted" ? [0] : [],
    updatedMeta: type === "updated" ? [0] : [],
    meta: [{ name: "BisCore:SubCategory", bases: [] }],
  };
}

function createCategoryChange(id: string, type: "inserted" | "deleted" | "updated"): NotifyEntitiesChangedArgs {
  const changedIds = CompressedId64Set.compressIds([id]);
  return {
    inserted: type === "inserted" ? changedIds : undefined,
    deleted: type === "deleted" ? changedIds : undefined,
    updated: type === "updated" ? changedIds : undefined,
    insertedMeta: type === "inserted" ? [0] : [],
    deletedMeta: type === "deleted" ? [0] : [],
    updatedMeta: type === "updated" ? [0] : [],
    meta: [{ name: "BisCore:Category", bases: [] }],
  };
}

async function waitForPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createDeferred<T>(): { promise: Promise<T>, resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createRenderOverrides(cache: SubCategoriesCache, categoryIds: Iterable<string>): FeatureOverrides {
  const overrides = new FeatureOverrides();
  for (const categoryId of categoryIds) {
    const subCategoryIds = cache.getSubCategories(categoryId);
    if (undefined === subCategoryIds)
      continue;

    for (const subCategoryId of subCategoryIds)
      overrides.setVisibleSubCategory(subCategoryId);
  }

  return overrides;
}

describe("SubCategoriesCache", () => {
  it("raises onChanged when an inserted subcategory invalidates cached category data", () => {
    const onElementsChanged = new BeEvent<(changes: TxnEntityChanges) => void>();
    const iModel = {
      isBriefcaseConnection: () => true,
      txns: { onElementsChanged },
    } as unknown as IModelConnection;

    const cache = new SubCategoriesCache(iModel);
    cache.add("0x1", "0x2", new SubCategoryAppearance(), true);
    cache.attachToBriefcase(iModel);

    let numChanges = 0;
    cache.addChangedListener(() => numChanges++);

    onElementsChanged.raiseEvent(createChanges(createSubCategoryChange("0x20", "inserted")));

    expect(numChanges).toBe(1);
    expect(cache.getSubCategories("0x1")?.has("0x2")).toBe(true);
  });

  it("supports reloading viewed categories after cache invalidation", async () => {
    const querySubCategories = vi.fn(async (compressedCategoryIds: string) => {
      return Array.from(CompressedId64Set.iterable(compressedCategoryIds)).map((parentId): SubCategoryResultRow => ({
        parentId,
        id: "0x2",
        appearance: {},
      }));
    });
    const onElementsChanged = new BeEvent<(changes: TxnEntityChanges) => void>();

    const iModel = {
      isClosed: false,
      isBriefcaseConnection: () => true,
      querySubCategories,
      txns: { onElementsChanged },
    } as unknown as IModelConnection;

    const cache = new SubCategoriesCache(iModel);
    const queue = new SubCategoriesCache.Queue();
    const viewedCategories = new Set(["0x1"]);
    const reloaded = vi.fn();

    cache.add("0x1", "0x2", new SubCategoryAppearance(), true);
    cache.attachToBriefcase(iModel);
    cache.addChangedListener(() => queue.push(cache, viewedCategories, reloaded));

    onElementsChanged.raiseEvent(createChanges(createSubCategoryChange("0x20", "inserted")));
    await waitForPromises();

    expect(querySubCategories).toHaveBeenCalledTimes(1);
    expect([...CompressedId64Set.iterable(querySubCategories.mock.calls[0][0])]).toEqual(["0x1"]);
    expect(reloaded).toHaveBeenCalledWith(true);
    queue[Symbol.dispose]();
  });

  it("preserves render visibility while viewed categories reload after subcategory cache invalidation", async () => {
    const categoryId = "0x1";
    const subCategoryId = "0x2";
    const otherCategoryId = "0x3";
    const otherSubCategoryId = "0x4";
    const querySubCategories = vi.fn(async (compressedCategoryIds: string) => {
      return Array.from(CompressedId64Set.iterable(compressedCategoryIds)).map((parentId): SubCategoryResultRow => ({
        parentId,
        id: parentId === categoryId ? subCategoryId : otherSubCategoryId,
        appearance: {},
      }));
    });
    const onElementsChanged = new BeEvent<(changes: TxnEntityChanges) => void>();

    const iModel = {
      isClosed: false,
      isBriefcaseConnection: () => true,
      querySubCategories,
      txns: { onElementsChanged },
    } as unknown as IModelConnection;
    const cache = new SubCategoriesCache(iModel);
    const queue = new SubCategoriesCache.Queue();
    const viewedCategories = new Set([categoryId, otherCategoryId]);
    cache.add(categoryId, subCategoryId, new SubCategoryAppearance(), true);
    cache.add(otherCategoryId, otherSubCategoryId, new SubCategoryAppearance(), true);
    cache.attachToBriefcase(iModel);

    const beforeInvalidation = createRenderOverrides(cache, viewedCategories);
    expect(beforeInvalidation.isSubCategoryIdVisible(subCategoryId)).toBe(true);
    expect(beforeInvalidation.isSubCategoryIdVisible(otherSubCategoryId)).toBe(true);

    cache.addChangedListener(() => queue.push(cache, viewedCategories, () => {}));
    onElementsChanged.raiseEvent(createChanges(createSubCategoryChange("0x20", "inserted")));
    const whileReloading = createRenderOverrides(cache, viewedCategories);
    expect(whileReloading.isSubCategoryIdVisible(subCategoryId)).toBe(true);
    expect(whileReloading.isSubCategoryIdVisible(otherSubCategoryId)).toBe(true);

    await waitForPromises();

    const afterReload = createRenderOverrides(cache, viewedCategories);
    expect(querySubCategories).toHaveBeenCalledTimes(1);
    expect(afterReload.isSubCategoryIdVisible(subCategoryId)).toBe(true);
    expect(afterReload.isSubCategoryIdVisible(otherSubCategoryId)).toBe(true);

    queue[Symbol.dispose]();
  });

  it("does not satisfy a post-invalidation reload from an in-flight stale request", async () => {
    const categoryId = "0x1";
    const oldSubCategoryId = "0x2";
    const staleSubCategoryId = "0x3";
    const freshSubCategoryId = "0x4";
    const staleResult = createDeferred<SubCategoryResultRow[]>();
    const freshResult = createDeferred<SubCategoryResultRow[]>();
    const querySubCategories = vi.fn()
      .mockReturnValueOnce(staleResult.promise)
      .mockReturnValueOnce(freshResult.promise);
    const onElementsChanged = new BeEvent<(changes: TxnEntityChanges) => void>();

    const iModel = {
      isClosed: false,
      isBriefcaseConnection: () => true,
      querySubCategories,
      txns: { onElementsChanged },
    } as unknown as IModelConnection;
    const cache = new SubCategoriesCache(iModel);
    const queue = new SubCategoriesCache.Queue();
    const viewedCategories = new Set([categoryId]);
    const reloaded = vi.fn();
    cache.add(categoryId, oldSubCategoryId, new SubCategoryAppearance(), true);
    cache.attachToBriefcase(iModel);
    cache.addChangedListener(() => queue.push(cache, viewedCategories, reloaded));

    onElementsChanged.raiseEvent(createChanges(createSubCategoryChange("0x10", "inserted")));
    expect(querySubCategories).toHaveBeenCalledTimes(1);

    onElementsChanged.raiseEvent(createChanges(createSubCategoryChange("0x11", "inserted")));
    expect(querySubCategories).toHaveBeenCalledTimes(1);

    staleResult.resolve([{ parentId: categoryId, id: staleSubCategoryId, appearance: {} }]);
    await waitForPromises();

    expect(querySubCategories).toHaveBeenCalledTimes(2);
    let overrides = createRenderOverrides(cache, viewedCategories);
    expect(overrides.isSubCategoryIdVisible(oldSubCategoryId)).toBe(true);
    expect(overrides.isSubCategoryIdVisible(staleSubCategoryId)).toBe(false);

    freshResult.resolve([{ parentId: categoryId, id: freshSubCategoryId, appearance: {} }]);
    await waitForPromises();

    expect(reloaded).toHaveBeenCalledTimes(1);
    overrides = createRenderOverrides(cache, viewedCategories);
    expect(overrides.isSubCategoryIdVisible(oldSubCategoryId)).toBe(false);
    expect(overrides.isSubCategoryIdVisible(freshSubCategoryId)).toBe(true);

    queue[Symbol.dispose]();
  });

  it("preserves stale category data when a reload fails", async () => {
    const categoryId = "0x1";
    const oldSubCategoryId = "0x2";
    const freshSubCategoryId = "0x3";
    const querySubCategories = vi.fn()
      .mockRejectedValueOnce(new Error("query failed"))
      .mockResolvedValueOnce([{ parentId: categoryId, id: freshSubCategoryId, appearance: {} }]);
    const onElementsChanged = new BeEvent<(changes: TxnEntityChanges) => void>();

    const iModel = {
      isClosed: false,
      isBriefcaseConnection: () => true,
      querySubCategories,
      txns: { onElementsChanged },
    } as unknown as IModelConnection;
    const cache = new SubCategoriesCache(iModel);
    cache.add(categoryId, oldSubCategoryId, new SubCategoryAppearance(), true);
    cache.attachToBriefcase(iModel);

    onElementsChanged.raiseEvent(createChanges(createSubCategoryChange("0x20", "inserted")));

    const failedRequest = cache.load([categoryId]);
    expect(failedRequest).not.toBeUndefined();
    expect(await failedRequest!.promise).toBe(false);
    expect(cache.getSubCategories(categoryId)?.has(oldSubCategoryId)).toBe(true);
    expect(cache.getSubCategoryAppearance(oldSubCategoryId)).not.toBeUndefined();

    const retryRequest = cache.load([categoryId]);
    expect(retryRequest).not.toBeUndefined();
    expect(await retryRequest!.promise).toBe(true);
    expect(cache.getSubCategories(categoryId)?.has(oldSubCategoryId)).toBe(false);
    expect(cache.getSubCategories(categoryId)?.has(freshSubCategoryId)).toBe(true);
    expect(cache.getSubCategoryAppearance(oldSubCategoryId)).toBeUndefined();
  });

  it("reconciles subcategory membership and appearances after a stale category reload", async () => {
    const categoryId = "0x1";
    const oldSubCategoryId = "0x2";
    const freshSubCategoryId = "0x3";
    const querySubCategories = vi.fn(async () => [{ parentId: categoryId, id: freshSubCategoryId, appearance: {} }]);
    const onElementsChanged = new BeEvent<(changes: TxnEntityChanges) => void>();

    const iModel = {
      isClosed: false,
      isBriefcaseConnection: () => true,
      querySubCategories,
      txns: { onElementsChanged },
    } as unknown as IModelConnection;
    const cache = new SubCategoriesCache(iModel);
    cache.add(categoryId, oldSubCategoryId, new SubCategoryAppearance(), true);
    cache.attachToBriefcase(iModel);

    onElementsChanged.raiseEvent(createChanges(createSubCategoryChange(oldSubCategoryId, "deleted")));

    const request = cache.load([categoryId]);
    expect(request).not.toBeUndefined();
    expect(await request!.promise).toBe(true);

    expect(cache.getSubCategories(categoryId)?.has(oldSubCategoryId)).toBe(false);
    expect(cache.getSubCategories(categoryId)?.has(freshSubCategoryId)).toBe(true);
    expect(cache.getSubCategoryAppearance(oldSubCategoryId)).toBeUndefined();
    expect((await cache.getSubCategoryInfo(categoryId, oldSubCategoryId)).has(oldSubCategoryId)).toBe(false);
  });

  it("reconciles stale categories loaded by the used spatial subcategory preload", async () => {
    const categoryId = "0x1";
    const oldSubCategoryId = "0x2";
    const freshSubCategoryId = "0x3";
    const queryAllUsedSpatialSubCategories = vi.fn(async () => [{ parentId: categoryId, id: freshSubCategoryId, appearance: {} }]);
    const onElementsChanged = new BeEvent<(changes: TxnEntityChanges) => void>();

    const iModel = {
      isClosed: false,
      isBriefcaseConnection: () => true,
      queryAllUsedSpatialSubCategories,
      txns: { onElementsChanged },
    } as unknown as IModelConnection;
    const cache = new SubCategoriesCache(iModel);
    cache.add(categoryId, oldSubCategoryId, new SubCategoryAppearance(), true);
    cache.attachToBriefcase(iModel);

    onElementsChanged.raiseEvent(createChanges(createSubCategoryChange("0x20", "inserted")));
    await cache.loadAllUsedSpatialSubCategories();

    expect(queryAllUsedSpatialSubCategories).toHaveBeenCalledTimes(1);
    expect(cache.getSubCategories(categoryId)?.has(oldSubCategoryId)).toBe(false);
    expect(cache.getSubCategories(categoryId)?.has(freshSubCategoryId)).toBe(true);
    expect(cache.getSubCategoryAppearance(oldSubCategoryId)).toBeUndefined();
  });

  it("removes cached subcategory appearances when a category is deleted", async () => {
    const categoryId = "0x1";
    const subCategoryId = "0x2";
    const querySubCategories = vi.fn(async () => []);
    const onElementsChanged = new BeEvent<(changes: TxnEntityChanges) => void>();

    const iModel = {
      isClosed: false,
      isBriefcaseConnection: () => true,
      querySubCategories,
      txns: { onElementsChanged },
    } as unknown as IModelConnection;
    const cache = new SubCategoriesCache(iModel);
    cache.add(categoryId, subCategoryId, new SubCategoryAppearance(), true);
    cache.attachToBriefcase(iModel);

    onElementsChanged.raiseEvent(createChanges(createCategoryChange(categoryId, "deleted")));

    expect(cache.getSubCategories(categoryId)).toBeUndefined();
    expect(cache.getSubCategoryAppearance(subCategoryId)).toBeUndefined();
    expect((await cache.getSubCategoryInfo(categoryId, subCategoryId)).has(subCategoryId)).toBe(false);
  });

  it("does not cache empty sets on failed cold load, allowing retry to succeed", async () => {
    const categoryId = "0x1";
    const subCategoryId = "0x2";
    const querySubCategories = vi.fn()
      .mockRejectedValueOnce(new Error("backend error"))
      .mockResolvedValueOnce([{ parentId: categoryId, id: subCategoryId, appearance: {} }]);

    const iModel = {
      isClosed: false,
      isBriefcaseConnection: () => true,
      querySubCategories,
    } as unknown as IModelConnection;
    const cache = new SubCategoriesCache(iModel);

    // First load fails - category should remain absent from cache (not cached as empty).
    const failedRequest = cache.load([categoryId]);
    expect(failedRequest).not.toBeUndefined();
    expect(await failedRequest!.promise).toBe(false);
    // getMissing should still report this category since it was never successfully loaded.
    expect(cache.getSubCategories(categoryId)).toBeUndefined();

    // Second load retries and succeeds.
    const retryRequest = cache.load([categoryId]);
    expect(retryRequest).not.toBeUndefined();
    expect(await retryRequest!.promise).toBe(true);
    expect(cache.getSubCategories(categoryId)?.has(subCategoryId)).toBe(true);
  });

  it("bumps generation on update/delete of subcategory not in cache when categories are stale", async () => {
    const categoryId = "0x1";
    const oldSubCategoryId = "0x2";
    const newSubCategoryId = "0x10";
    const freshSubCategoryId = "0x5";
    const staleResult = createDeferred<SubCategoryResultRow[]>();
    const freshResult = createDeferred<SubCategoryResultRow[]>();
    const querySubCategories = vi.fn()
      .mockReturnValueOnce(staleResult.promise)
      .mockReturnValueOnce(freshResult.promise);
    const onElementsChanged = new BeEvent<(changes: TxnEntityChanges) => void>();

    const iModel = {
      isClosed: false,
      isBriefcaseConnection: () => true,
      querySubCategories,
      txns: { onElementsChanged },
    } as unknown as IModelConnection;
    const cache = new SubCategoriesCache(iModel);
    const queue = new SubCategoriesCache.Queue();
    const viewedCategories = new Set([categoryId]);
    const reloaded = vi.fn();
    cache.add(categoryId, oldSubCategoryId, new SubCategoryAppearance(), true);
    cache.attachToBriefcase(iModel);
    cache.addChangedListener(() => queue.push(cache, viewedCategories, reloaded));

    // Insert event marks all stale, starts reload (query 1).
    onElementsChanged.raiseEvent(createChanges(createSubCategoryChange(newSubCategoryId, "inserted")));
    expect(querySubCategories).toHaveBeenCalledTimes(1);

    // Update event for the newly inserted subcategory (not in old cache) fires before query 1 resolves.
    // This must bump generation so the in-flight stale result is rejected.
    onElementsChanged.raiseEvent(createChanges(createSubCategoryChange(newSubCategoryId, "updated")));

    // Stale query resolves - should be rejected due to generation bump.
    staleResult.resolve([{ parentId: categoryId, id: oldSubCategoryId, appearance: {} }]);
    await waitForPromises();

    // A second query should have been triggered (queue re-pushes on changed event).
    expect(querySubCategories).toHaveBeenCalledTimes(2);

    // Fresh query resolves with updated data.
    freshResult.resolve([{ parentId: categoryId, id: freshSubCategoryId, appearance: {} }]);
    await waitForPromises();

    expect(cache.getSubCategories(categoryId)?.has(freshSubCategoryId)).toBe(true);
    expect(cache.getSubCategories(categoryId)?.has(oldSubCategoryId)).toBe(false);

    queue[Symbol.dispose]();
  });
});
