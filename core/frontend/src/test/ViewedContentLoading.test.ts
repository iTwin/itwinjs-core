/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated -- Exercise the viewport APIs that exhibited the regressions. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CompressedId64Set, Id64 } from "@itwin/core-bentley";
import { EmptyLocalization, IModelReadRpcInterface, RelatedElement, SubCategoryAppearance } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { PerModelCategoryVisibility } from "../PerModelCategoryVisibility";
import { SpatialViewState } from "../SpatialViewState";
import { openBlankViewport } from "./openBlankViewport";
import { createBlankConnection } from "./createBlankConnection";

function createIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => Id64.fromLocalAndBriefcaseIds(i + 100, 0));
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => resolve = done);
  return { promise, resolve };
}

describe("Viewed content loading", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());
  afterEach(() => vi.restoreAllMocks());

  it.each([false, true])("loads initially selected content for an in-memory primary reference (attached: %s)", async (attach) => {
    using vp = openBlankViewport();
    const db = vp.iModel;
    const props = vp.view.toProps();
    props.categorySelectorProps.categories = ["0x10"];
    props.modelSelectorProps!.models = ["0x20"];
    vi.spyOn(db, "isClosed", "get").mockReturnValue(false);
    const categories = vi.spyOn(db, "querySubCategories").mockResolvedValue([{ parentId: "0x10", id: "0x11", appearance: {} }]);
    const models = vi.spyOn(db.models, "getProps").mockResolvedValue([{ id: "0x20", classFullName: "BisCore:PhysicalModel", modeledElement: { id: "0x20" } }]);
    const view = SpatialViewState.createFromProps(props, db);
    if (attach)
      vp.changeView(view);
    const ref = view.iModelRefs.primary;
    await vi.waitFor(() => {
      expect(ref.isSubCategoryVisible("0x11")).toBe(true);
      expect(db.models.getLoaded("0x20")).toBeDefined();
    });
    expect(categories).toHaveBeenCalledOnce();
    expect(models).toHaveBeenCalledOnce();
  });

  it("stays loading-complete without dispatching a model load when all viewed models are already loaded", async () => {
    using vp = openBlankViewport();
    const db = vp.iModel;
    await db.models.updateLoadedWithModelProps([{ id: "0x20", classFullName: "BisCore:PhysicalModel", modeledElement: { id: "0x20" } }]);
    const props = vp.view.toProps();
    props.modelSelectorProps!.models = ["0x20"];
    const loadModels = vi.spyOn(db.models, "load");
    const view = SpatialViewState.createFromProps(props, db);
    vp.changeView(view);
    const ref = view.iModelRefs.primary;
    // The mock model has no tile tree, so only check model/category metadata readiness before any tile tree load starts.
    const tileTreeRefs = [...ref.tileTreeRefs];
    for (const ttRef of tileTreeRefs)
      vi.spyOn(ttRef, "isLoadingComplete", "get").mockReturnValue(true);
    expect(ref.isLoadingComplete).toBe(true);
    const loaded = vi.fn();
    ref.onViewedModelsLoaded.addListener(loaded);
    await Promise.resolve();
    expect(ref.isLoadingComplete).toBe(true);
    expect(loadModels).not.toHaveBeenCalled();
    expect(loaded).not.toHaveBeenCalled();

    // Toggling an already-loaded model off/on must not schedule a model load or mark the reference incomplete.
    vp.changeModelDisplay("0x20", false);
    vp.changeModelDisplay("0x20", true);
    expect(ref.isLoadingComplete).toBe(true);
    await Promise.resolve();
    expect(loadModels).not.toHaveBeenCalled();
    expect(loaded).not.toHaveBeenCalled();

    // If a scheduled selector load has its model dropped before dispatch, it must finish quietly without calling models.load([]).
    vp.changeModelDisplay("0x21", true);
    expect(ref.isLoadingComplete).toBe(false);
    vp.changeModelDisplay("0x21", false);
    await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
    expect(loadModels).not.toHaveBeenCalled();
    expect(loaded).not.toHaveBeenCalled();
  });

  it.each([false, true])("shares connection and viewport model loads without blocking disjoint IDs (select A first: %s)", async (selectFirst) => {
    using vp = openBlankViewport();
    await vi.waitFor(() => expect(vp.primaryIModelRef.isLoadingComplete).toBe(true));
    const models = vp.iModel.models;
    const ref = vp.primaryIModelRef;
    if (!ref.isSpatial())
      throw new Error("Expected a spatial reference");
    const loaded = vi.fn();
    ref.onViewedModelsLoaded.addListener(loaded);
    const first = deferred();
    const second = deferred();
    const calls: string[][] = [];
    vi.spyOn(models, "getProps").mockImplementation(async (ids) => {
      const batch = [...Id64.iterable(ids)];
      calls.push(batch);
      await (batch.includes("0x30") ? first : second).promise;
      return batch.map((id) => ({ id, classFullName: "BisCore:Model", modeledElement: { id } }));
    });
    try {
      if (selectFirst)
        vp.changeModelDisplay("0x30", true);
      const directA = models.load("0x30");
      await vi.waitFor(() => expect(calls).toEqual([["0x30"]]));
      const bothReady = vi.fn();
      const mixed = vp.addViewedModels(["0x30", "0x31"]).then(bothReady);
      await vi.waitFor(() => expect(calls).toEqual([["0x30"], ["0x31"]]));
      const bReady = vi.fn();
      const directB = Promise.all([models.load("0x31"), vp.addViewedModels("0x31")]).then(bReady);
      second.resolve();
      await vi.waitFor(() => expect(bReady).toHaveBeenCalledOnce());
      expect(bothReady).not.toHaveBeenCalled();
      expect(loaded).toHaveBeenCalledOnce();
      expect(vp.primaryIModelRef.isLoadingComplete).toBe(false);
      expect(models.getLoaded("0x31")).toBeDefined();
      first.resolve();
      await Promise.all([directA, mixed, directB]);
      expect(loaded).toHaveBeenCalledTimes(2);
      expect(models.getLoaded("0x30")).toBeDefined();
      expect(calls).toEqual([["0x30"], ["0x31"]]);
    } finally {
      first.resolve();
      second.resolve();
    }
  });

  it("shares a model between viewports of one connection but not another connection", async () => {
    const db = createBlankConnection();
    const gate = deferred();
    const id = "0x30";
    const row = (name: string) => ({ id, classFullName: "BisCore:Model", modeledElement: { id }, name });
    try {
      using first = openBlankViewport({ iModel: db });
      using second = openBlankViewport({ iModel: db });
      using other = openBlankViewport();
      const shared = vi.spyOn(db.models, "getProps").mockImplementation(async () => { await gate.promise; return [row("shared")]; });
      vi.spyOn(other.iModel.models, "getProps").mockResolvedValue([row("independent")]);
      const a = first.addViewedModels(id);
      const b = second.addViewedModels(id);
      await vi.waitFor(() => expect(shared).toHaveBeenCalledOnce());
      await other.addViewedModels(id);
      expect(other.iModel.models.getLoaded(id)?.name).toBe("independent");
      expect(db.models.getLoaded(id)).toBeUndefined();
      gate.resolve();
      await Promise.all([a, b]);
      expect(db.models.getLoaded(id)?.name).toBe("shared");
      expect(shared).toHaveBeenCalledOnce();
    } finally {
      gate.resolve();
      db.closeSync();
    }
  });

  it.each(["replace", "remove", "public"] as const)("retires only a removed reference's model request, without canceling its promise (%s)", async (mode) => {
    using vp = openBlankViewport();
    const refs = vp.iModelRefs;
    if (!refs.isSpatial)
      throw new Error("Expected spatial references");
    const db = createBlankConnection();
    const gate = deferred();
    const id = "0x30";
    const row = (name: string) => ({ id, classFullName: "BisCore:Model", modeledElement: { id }, name });
    try {
      const old = refs.link({ iModel: db });
      const query = vi.spyOn(db.models, "getProps").mockImplementationOnce(async () => { await gate.promise; return [row("old")]; })
        .mockResolvedValueOnce([row("replacement")]);
      const direct = mode === "public" ? db.models.load(id) : undefined;
      const oldLoad = old.addAndLoadViewedModels([id]);
      await vi.waitFor(() => expect(query).toHaveBeenCalledOnce());
      refs.unlink(old);
      const replacement = mode === "remove" ? undefined : refs.link({ iModel: db }).addAndLoadViewedModels([id]);
      if (mode === "replace")
        await vi.waitFor(() => expect(db.models.getLoaded(id)?.name).toBe("replacement"));
      await Promise.resolve();
      gate.resolve();
      await Promise.all([direct, oldLoad, replacement]);
      expect(query).toHaveBeenCalledTimes(mode === "replace" ? 2 : 1);
      expect(db.models.getLoaded(id)?.name).toBe(mode === "replace" ? "replacement" : "old");
    } finally {
      gate.resolve();
      db.closeSync();
    }
  });

  it("still constructs the next model of the same class when one model's constructor fails", async () => {
    using vp = openBlankViewport();
    const models = vp.iModel.models;
    const rows = ["0x30", "0x31"].map((id) => ({ id, classFullName: "BisCore:Model", modeledElement: { id } }));
    vi.spyOn(RelatedElement, "fromJSON").mockReturnValueOnce(undefined);
    await models.updateLoadedWithModelProps(rows);
    expect(models.getLoaded("0x30")).toBeUndefined();
    expect(models.getLoaded("0x31")).toBeDefined();
  });

  it("shares failed and incomplete model responses without preventing a later retry", async () => {
    using vp = openBlankViewport();
    const models = vp.iModel.models;
    const row = (id: string) => ({ id, classFullName: "BisCore:Model", modeledElement: { id } });
    const query = vi.spyOn(models, "getProps").mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce([row("0x30")]).mockResolvedValueOnce([row("0x31")]);
    await Promise.all([models.load("0x30"), models.load("0x30")]);
    expect(models.getLoaded("0x30")).toBeUndefined();
    await Promise.all([models.load(["0x30", "0x31"]), models.load("0x31")]);
    expect(models.getLoaded("0x30")).toBeDefined();
    expect(models.getLoaded("0x31")).toBeUndefined();
    await models.load(["0x30", "0x31"]);
    expect(models.getLoaded("0x31")).toBeDefined();
    expect(query.mock.calls.map(([ids]) => [...Id64.iterable(ids)])).toEqual([["0x30"], ["0x30", "0x31"], ["0x31"]]);
  });

  it("does not publish pre-unload model data or evict a newer request while resolving a class", async () => {
    using vp = openBlankViewport();
    const db = vp.iModel;
    const resolveClass = deferred();
    const newProps = deferred();
    const id = "0x30";
    const row = (name: string) => ({ id, classFullName: "BisCore:Model", modeledElement: { id }, name });
    const query = vi.spyOn(db.models, "getProps").mockResolvedValueOnce([row("old")])
      .mockImplementationOnce(async () => { await newProps.promise; return [row("new")]; });
    const findClass = db.findClassFor.bind(db);
    const lookup = vi.spyOn(db, "findClassFor").mockImplementationOnce(async (name, fallback) => {
      await resolveClass.promise;
      return findClass(name, fallback);
    });
    try {
      const old = db.models.load(id);
      await vi.waitFor(() => expect(lookup).toHaveBeenCalledOnce());
      db.models.unload(id);
      const fresh = db.models.load(id);
      await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(2));
      resolveClass.resolve();
      await old;
      expect(db.models.getLoaded(id)).toBeUndefined();
      const alsoFresh = db.models.load(id);
      newProps.resolve();
      await Promise.all([fresh, alsoFresh]);
      expect(db.models.getLoaded(id)?.name).toBe("new");
      expect(query).toHaveBeenCalledTimes(2);
    } finally {
      resolveClass.resolve();
      newProps.resolve();
    }
  });

  it("does not cancel a replacement reference linked by an earlier unlink listener", async () => {
    using vp = openBlankViewport();
    const refs = vp.iModelRefs;
    if (!refs.isSpatial)
      throw new Error("Expected spatial references");
    const other = createBlankConnection();
    const gate = deferred();
    try {
      vi.spyOn(other, "isClosed", "get").mockReturnValue(false);
      vi.spyOn(other, "querySubCategories").mockImplementation(async () => { await gate.promise; return []; });
      other.subcategories.add("0x200", "0x201", new SubCategoryAppearance({ invisible: true }), true);
      const remove = refs.onUnlinked.addListener(() => {
        const next = refs.link({ iModel: other });
        next.changeCategoryDisplay({ categories: ["0x200"], display: true, enableAllSubCategories: true });
      });
      const old = refs.link({ iModel: other, viewedCategories: ["0x100"] });
      await Promise.resolve();
      refs.unlink(old);
      remove();
      const [replacement] = refs.linked;
      await vi.waitFor(() => expect(replacement.isLoadingComplete).toBe(true));
      expect(replacement.isSubCategoryVisible("0x201")).toBe(true);
      refs.unlink(replacement);
    } finally {
      gate.resolve();
      other.closeSync();
    }
  });

  it("does not leave category work submitted by an unlink listener ahead of the replacement", async () => {
    using vp = openBlankViewport();
    const refs = vp.iModelRefs;
    if (!refs.isSpatial)
      throw new Error("Expected spatial references");
    const db = createBlankConnection();
    const gate = deferred();
    try {
      vi.spyOn(db, "isClosed", "get").mockReturnValue(false);
      vi.spyOn(db, "querySubCategories").mockImplementation(async (ids) => {
        if ([...CompressedId64Set.iterable(ids)].includes("0x10")) {
          await gate.promise;
          return [{ parentId: "0x10", id: "0x11", appearance: {} }];
        }
        return [{ parentId: "0x20", id: "0x21", appearance: {} }];
      });
      refs.onUnlinked.addOnce((removed) => removed.perModelCategoryVisibility.setOverride("0x2", "0x10", PerModelCategoryVisibility.Override.Show));
      const old = refs.link({ iModel: db });
      await vi.waitFor(() => expect(old.isLoadingComplete).toBe(true));
      refs.unlink(old);
      const replacement = refs.link({ iModel: db, viewedCategories: ["0x20"] });
      await vi.waitFor(() => expect(replacement.isSubCategoryVisible("0x21")).toBe(true));
      expect(refs.subcategories.isEmpty).toBe(true);
      gate.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(db.subcategories.getSubCategories("0x10")).toBeUndefined();
    } finally {
      gate.resolve();
      db.closeSync();
    }
  });

  it("does not submit orphan work after a synchronous selector listener unlinks its reference", async () => {
    using vp = openBlankViewport();
    const refs = vp.iModelRefs;
    if (!refs.isSpatial)
      throw new Error("Expected spatial references");
    const other = createBlankConnection();
    try {
      const ref = refs.link({ iModel: other });
      await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
      vi.spyOn(other, "isClosed", "get").mockReturnValue(false);
      const query = vi.spyOn(other, "querySubCategories").mockResolvedValue([]);
      ref.viewedCategories.onBatchAdded.addOnce(() => refs.unlink(ref));
      ref.changeCategoryDisplay({ categories: ["0x100"], display: true });
      await Promise.resolve();
      expect(query).not.toHaveBeenCalled();
      expect(refs.primary.isLoadingComplete).toBe(true);
    } finally {
      other.closeSync();
    }
  });

  it("cancels a per-model category load when its change listener unlinks the owner", async () => {
    using vp = openBlankViewport();
    const refs = vp.iModelRefs;
    if (!refs.isSpatial)
      throw new Error("Expected spatial references");
    const other = createBlankConnection();
    const gate = deferred();
    try {
      const ref = refs.link({ iModel: other });
      await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
      vi.spyOn(other, "isClosed", "get").mockReturnValue(false);
      vi.spyOn(other, "querySubCategories").mockImplementation(async () => { await gate.promise; return []; });
      ref.perModelCategoryVisibility.onChanged.addOnce(() => refs.unlink(ref));
      ref.perModelCategoryVisibility.setOverride("0x11", "0x12", PerModelCategoryVisibility.Override.Show);
      expect(refs.subcategories.isEmpty).toBe(true);
    } finally {
      gate.resolve();
      other.closeSync();
    }
  });

  it("cancels a reference's per-model work even when the deprecated overload uses another cache", async () => {
    using vp = openBlankViewport();
    const refs = vp.iModelRefs;
    if (!refs.isSpatial)
      throw new Error("Expected spatial references");
    const other = createBlankConnection();
    const gate = deferred();
    try {
      const linked = refs.link({ iModel: other });
      await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
      vi.spyOn(vp.iModel, "isClosed", "get").mockReturnValue(false);
      vi.spyOn(vp.iModel, "querySubCategories").mockImplementation(async () => { await gate.promise; return []; });
      await linked.perModelCategoryVisibility.setOverrides([{ modelId: "0x11", categoryIds: ["0x12"], visOverride: PerModelCategoryVisibility.Override.Show }], vp.iModel);
      expect(refs.primary.isLoadingComplete).toBe(true);
      expect(linked.isLoadingComplete).toBe(false);
      refs.unlink(linked);
      expect(refs.subcategories.isEmpty).toBe(true);
      expect(vp.areAllTileTreesLoaded).toBe(true);
    } finally {
      gate.resolve();
      other.closeSync();
    }
  });

  it.each([false, true])("loads independent category selectors while another connection is stalled (explicit blocker: %s)", async (explicit) => {
    using vp = openBlankViewport();
    const refs = vp.iModelRefs;
    if (!refs.isSpatial)
      throw new Error("Expected spatial references");
    const stalledDb = createBlankConnection();
    const otherDb = createBlankConnection();
    const gate = deferred();
    try {
      const stalled = refs.link({ iModel: stalledDb });
      const other = refs.link({ iModel: otherDb });
      await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
      const category = "0x10";
      for (const db of [vp.iModel, stalledDb, otherDb])
        vi.spyOn(db, "isClosed", "get").mockReturnValue(false);
      const held = vi.spyOn(stalledDb, "querySubCategories").mockImplementation(async () => {
        await gate.promise;
        return [{ parentId: category, id: "0x11", appearance: { invisible: true } }];
      });
      const primaryQuery = vi.spyOn(vp.iModel, "querySubCategories").mockResolvedValue([{ parentId: category, id: "0x12", appearance: {} }]);
      const otherQuery = vi.spyOn(otherDb, "querySubCategories").mockResolvedValue([{ parentId: category, id: "0x13", appearance: {} }]);
      const drained = vi.fn();
      refs.subcategories.onDrained.addListener(drained);
      if (explicit)
        stalled.changeCategoryDisplay({ categories: category, display: true });
      else
        stalled.viewedCategories.add(category);
      await vi.waitFor(() => expect(held).toHaveBeenCalledOnce());
      stalled.changeCategoryDisplay({ categories: category, display: true, enableAllSubCategories: true });
      refs.primary.viewedCategories.add(category);
      other.viewedCategories.add(category);
      await vi.waitFor(() => {
        expect(refs.primary.isLoadingComplete && other.isLoadingComplete).toBe(true);
        expect(refs.primary.isSubCategoryVisible("0x12")).toBe(true);
        expect(other.isSubCategoryVisible("0x13")).toBe(true);
      });
      expect(stalled.isLoadingComplete).toBe(false);
      expect(refs.subcategories.isEmpty).toBe(false);
      expect(drained).not.toHaveBeenCalled();
      gate.resolve();
      await vi.waitFor(() => expect(drained).toHaveBeenCalledOnce());
      expect(stalled.isSubCategoryVisible("0x11")).toBe(true);
      expect(refs.subcategories.isEmpty).toBe(true);
      for (const query of [held, primaryQuery, otherQuery])
        expect(query).toHaveBeenCalledOnce();
    } finally {
      gate.resolve();
      stalledDb.closeSync();
      otherDb.closeSync();
    }
  });

  it("does not report another connection's load as pending or newly loaded", async () => {
    using vp = openBlankViewport();
    const refs = vp.iModelRefs;
    if (!refs.isSpatial)
      throw new Error("Expected spatial references");
    const other = createBlankConnection();
    const gate = deferred();
    try {
      const ref = refs.link({ iModel: other });
      await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
      other.subcategories.add("0x200", "0x201", new SubCategoryAppearance(), true);
      vi.spyOn(vp.iModel, "isClosed", "get").mockReturnValue(false);
      vi.spyOn(vp.iModel, "querySubCategories").mockImplementation(async () => { await gate.promise; return []; });
      refs.primary.viewedCategories.add("0x100");
      await Promise.resolve();
      expect(refs.primary.isLoadingComplete).toBe(false);
      expect(ref.isLoadingComplete).toBe(true);
      const loaded = vi.fn();
      ref.onViewedCategoriesLoaded.addListener(loaded);
      ref.viewedCategories.add("0x200");
      await Promise.resolve();
      gate.resolve();
      await vi.waitFor(() => expect(refs.subcategories.isEmpty).toBe(true));
      expect(loaded).not.toHaveBeenCalled();
      refs.unlink(ref);
    } finally {
      gate.resolve();
      other.closeSync();
    }
  });

  for (const phase of ["scheduled", "in flight", "queued"] as const) {
    it(`does not wait for an unlinked reference's ${phase} category work`, async () => {
      using vp = openBlankViewport();
      const other = createBlankConnection();
      const gate = deferred();
      const primaryGate = deferred();
      try {
        const refs = vp.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected spatial references");
        await vi.waitFor(() => expect(refs.primary.isLoadingComplete).toBe(true));
        vi.spyOn(other, "isClosed", "get").mockReturnValue(false);
        const query = vi.spyOn(other, "querySubCategories").mockImplementation(async (ids) => {
          await ([...CompressedId64Set.iterable(ids)].includes("0x111") ? primaryGate : gate).promise;
          return [];
        });
        if (phase === "queued") {
          // An ordered operation on the same cache blocks the selector; a different connection no longer does.
          await refs.primary.perModelCategoryVisibility.setOverrides([{ modelId: "0x1", categoryIds: ["0x111"], visOverride: PerModelCategoryVisibility.Override.Show }], other);
        }
        const ref = refs.link({ iModel: other, viewedCategories: ["0xabc"] });
        if (phase !== "scheduled")
          await Promise.resolve();
        refs.unlink(ref);
        await Promise.resolve();
        primaryGate.resolve();
        await vi.waitFor(() => expect(refs.primary.isLoadingComplete).toBe(true));
        expect([...refs.linked]).toHaveLength(0);
        expect(vp.areAllTileTreesLoaded).toBe(true);
        expect(refs.subcategories.isEmpty).toBe(true);
        expect(query.mock.calls.filter(([ids]) => [...CompressedId64Set.iterable(ids)].includes("0xabc"))).toHaveLength(phase === "in flight" ? 1 : 0);
      } finally {
        primaryGate.resolve();
        gate.resolve();
        other.closeSync();
      }
    });
  }

  it("does not report an explicit category twice after unrelated data is published to its cache", async () => {
    using vp = openBlankViewport();
    const other = createBlankConnection();
    const gate = deferred();
    try {
      const refs = vp.iModelRefs;
      if (!refs.isSpatial)
        throw new Error("Expected spatial references");
      const linked = refs.link({ iModel: other });
      await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
      vi.spyOn(vp.iModel, "isClosed", "get").mockReturnValue(false);
      vi.spyOn(other, "isClosed", "get").mockReturnValue(false);
      vi.spyOn(vp.iModel, "querySubCategories").mockResolvedValue([]);
      const blocked = vi.spyOn(other, "querySubCategories").mockImplementation(async () => { await gate.promise; return []; });
      const loaded = vi.fn();
      refs.primary.onViewedCategoriesLoaded.addListener(loaded);
      refs.primary.changeCategoryDisplay({ categories: "0x10", display: true });
      linked.changeCategoryDisplay({ categories: "0x20", display: true });
      await vi.waitFor(() => expect(blocked).toHaveBeenCalledOnce());
      expect(loaded).toHaveBeenCalledOnce();
      await vp.iModel.categories.getCategoryInfo(["0x30"]);
      gate.resolve();
      await vi.waitFor(() => expect(refs.subcategories.isEmpty).toBe(true));
      expect(loaded).toHaveBeenCalledOnce();
    } finally {
      gate.resolve();
      other.closeSync();
    }
  });

  it("replays an explicit category operation on a covering retry beyond a noncovering batch", async () => {
    using vp = openBlankViewport();
    const other = createBlankConnection();
    const gate = deferred();
    try {
      const refs = vp.iModelRefs;
      if (!refs.isSpatial)
        throw new Error("Expected spatial references");
      const linked = refs.link({ iModel: other });
      await vi.waitFor(() => expect(vp.areAllTileTreesLoaded).toBe(true));
      vi.spyOn(vp.iModel, "isClosed", "get").mockReturnValue(false);
      const query = vi.spyOn(vp.iModel, "querySubCategories").mockImplementationOnce(async () => { await gate.promise; throw new Error("query failed"); })
        .mockImplementation(async (ids) => [...CompressedId64Set.iterable(ids)].map((id) => ({ id: id === "0x10" ? "0x11" : "0x21", parentId: id, appearance: { invisible: true } })));
      refs.primary.changeCategoryDisplay({ categories: ["0x10"], display: true, enableAllSubCategories: true });
      refs.primary.changeCategoryDisplay({ categories: ["0x20"], display: true });
      linked.changeCategoryDisplay({ categories: ["0x30"], display: true });
      await Promise.resolve();
      gate.resolve();
      await vi.waitFor(() => expect(refs.subcategories.isEmpty).toBe(true));
      expect(query.mock.calls.map(([ids]) => [...CompressedId64Set.iterable(ids)])).toEqual([["0x10"], ["0x20"], ["0x10"]]);
      expect(refs.primary.isSubCategoryVisible("0x11")).toBe(true);
    } finally {
      gate.resolve();
      other.closeSync();
    }
  });

  for (const linked of [false, true]) {
    describe(linked ? "linked reference" : "primary reference", () => {
      for (const count of [10, 100, 500]) {
        for (const mode of ["individual notifications", "batch notification", "selector"] as const) {
          it(`loads ${count} categories once using ${mode}`, async () => {
            using vp = openBlankViewport();
            const other = createBlankConnection();
            try {
              const refs = vp.iModelRefs;
              if (!refs.isSpatial)
                throw new Error("Expected spatial references");

              const ref = linked ? refs.link({ iModel: other }) : refs.primary;
              await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
              // Blank connections otherwise cancel real SubCategoriesCache requests.
              vi.spyOn(ref.iModel, "isClosed", "get").mockReturnValue(false);
              const gate = deferred();
              const requested: string[] = [];
              const query = vi.spyOn(ref.iModel, "querySubCategories").mockImplementation(async (compressed) => {
                const categoryIds = [...CompressedId64Set.iterable(compressed)];
                requested.push(...categoryIds);
                await gate.promise;
                return categoryIds.map((id) => ({ parentId: id, id: Id64.fromLocalAndBriefcaseIds(Id64.getLocalId(id) + 1000, 0), appearance: {} }));
              });
              const loaded = vi.fn();
              ref.onViewedCategoriesLoaded.addListener(loaded);
              const ids = createIds(count);
              if (mode === "selector") {
                for (const id of ids)
                  ref.viewedCategories.add(id);
              } else if (linked) {
                ref.changeCategoryDisplay({ categories: ids, display: true, noBatchNotify: mode === "individual notifications" });
              } else {
                vp.changeCategoryDisplay(ids, true, undefined, mode === "batch notification");
              }

              await Promise.resolve();
              expect(ref.isLoadingComplete).toBe(false);
              gate.resolve();
              await vi.waitFor(() => {
                expect(refs.subcategories.isEmpty).toBe(true);
                expect(ref.isLoadingComplete).toBe(true);
                expect(ref.iModel.subcategories.getSubCategories(ids[count - 1])).toBeDefined();
              });
              expect(query).toHaveBeenCalledTimes(1);
              expect(loaded).toHaveBeenCalledTimes(1);
              expect(requested.sort()).toEqual([...ids].sort());
              for (const id of ids) {
                const subcategories = ref.iModel.subcategories.getSubCategories(id)!;
                for (const subcategory of subcategories)
                  expect(ref.getSymbologyOverrides().isSubCategoryIdVisible(subcategory)).toBe(true);
              }
            } finally {
              other.closeSync();
            }
          });
        }
      }

      it("does not re-enable a subcategory hidden by the user while another category retries", async () => {
        using vp = openBlankViewport();
        const other = createBlankConnection();
        const retry = deferred();
        try {
          const refs = vp.iModelRefs;
          if (!refs.isSpatial)
            throw new Error("Expected spatial references");
          const ref = linked ? refs.link({ iModel: other }) : refs.primary;
          await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
          vi.spyOn(ref.iModel, "isClosed", "get").mockReturnValue(false);
          const a = { parentId: "0x10", id: "0x11", appearance: { invisible: true } };
          const b = { parentId: "0x20", id: "0x21", appearance: { invisible: true } };
          const query = vi.spyOn(ref.iModel, "querySubCategories")
            // @ts-expect-error -- ECSQL can return malformed JSON text instead of decoded appearance props.
            .mockResolvedValueOnce([a, { ...b, appearance: "{" }])
            .mockImplementationOnce(async () => { await retry.promise; return [b]; });
          const ids = new Set([a.parentId, b.parentId]);
          if (linked)
            ref.changeCategoryDisplay({ categories: ids, display: true, enableAllSubCategories: true });
          else
            vp.changeCategoryDisplay(ids, true, true);
          await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(2));
          expect(ref.isSubCategoryVisible(a.id)).toBe(true);
          expect(ref.changeSubCategoryDisplay(a.id, false)).toBe(true);
          retry.resolve();
          await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
          expect(ref.isSubCategoryVisible(a.id)).toBe(false);
          expect(ref.isSubCategoryVisible(b.id)).toBe(true);
          expect([...ids]).toEqual([a.parentId, b.parentId]);
          expect(query.mock.calls.map(([packed]) => [...CompressedId64Set.iterable(packed)])).toEqual([[a.parentId, b.parentId], [b.parentId]]);
        } finally {
          retry.resolve();
          other.closeSync();
        }
      });

      it("applies enableAllSubCategories when a queued retry loads the metadata", async () => {
        using vp = openBlankViewport();
        const other = createBlankConnection();
        try {
          const refs = vp.iModelRefs;
          if (!refs.isSpatial)
            throw new Error("Expected spatial references");
          const ref = linked ? refs.link({ iModel: other }) : refs.primary;
          await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
          vi.spyOn(ref.iModel, "isClosed", "get").mockReturnValue(false);
          const query = vi.spyOn(ref.iModel, "querySubCategories").mockRejectedValueOnce(new Error("query failed")).mockResolvedValue([{ id: "0xac", parentId: "0xab", appearance: { invisible: true } }]);
          ref.changeCategoryDisplay({ categories: ["0xab"], display: true, enableAllSubCategories: true });
          await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
          expect(query).toHaveBeenCalledTimes(2);
          expect(ref.iModel.subcategories.getSubCategoryAppearance("0xac")?.invisible).toBe(true);
          expect(ref.isSubCategoryVisible("0xac")).toBe(true);
        } finally {
          other.closeSync();
        }
      });

      it.each([true, false])("bounds retries for an explicit operation coalesced behind another category (retry succeeds: %s)", async (succeeds) => {
        using vp = openBlankViewport();
        const other = createBlankConnection();
        const gate = deferred();
        try {
          const refs = vp.iModelRefs;
          if (!refs.isSpatial)
            throw new Error("Expected spatial references");
          const ref = linked ? refs.link({ iModel: other }) : refs.primary;
          await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
          vi.spyOn(ref.iModel, "isClosed", "get").mockReturnValue(false);
          const query = vi.spyOn(ref.iModel, "querySubCategories").mockImplementationOnce(async () => { await gate.promise; return []; })
            .mockRejectedValueOnce(new Error("first B load failed"));
          if (succeeds)
            query.mockResolvedValue([{ parentId: "0x20", id: "0x21", appearance: { invisible: true } }]);
          else
            query.mockRejectedValue(new Error("unavailable"));
          ref.perModelCategoryVisibility.setOverride("0x1", "0x10", PerModelCategoryVisibility.Override.Show);
          const published: boolean[] = [];
          ref.onViewedCategoriesLoaded.addListener(() => published.push(ref.isSubCategoryVisible("0x21")));
          ref.changeCategoryDisplay({ categories: ["0x20"], display: true, enableAllSubCategories: true });
          await Promise.resolve();
          gate.resolve();
          await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
          expect(ref.isSubCategoryVisible("0x21")).toBe(succeeds);
          expect(published.filter((visible) => visible)).toHaveLength(succeeds ? 1 : 0);
          expect(query.mock.calls.map(([ids]) => [...CompressedId64Set.iterable(ids)])).toEqual([["0x10"], ["0x20"], ["0x20"]]);
        } finally {
          gate.resolve();
          other.closeSync();
        }
      });

      it("only queries a failing class hierarchy once per batch and still loads unrelated models", async () => {
        using vp = openBlankViewport();
        const other = createBlankConnection();
        try {
          const refs = vp.iModelRefs;
          if (!refs.isSpatial)
            throw new Error("Expected spatial references");
          const ref = linked ? refs.link({ iModel: other }) : refs.primary;
          await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
          const ids = createIds(25);
          const unknown = ids.map((id, i) => ({ id, classFullName: i % 2 ? "Test:Unknown" : "test:unknown", modeledElement: { id } }));
          const good = { id: "0x32", classFullName: "BisCore:PhysicalModel", modeledElement: { id: "0x32" } };
          const query = vi.spyOn(ref.iModel.models, "getProps").mockResolvedValueOnce([...unknown, good]).mockResolvedValueOnce([unknown[0]]);
          vi.spyOn(ref.iModel, "isOpen", "get").mockReturnValue(true);
          const hierarchy = vi.fn<IModelReadRpcInterface["getClassHierarchy"]>().mockRejectedValue(new Error("class hierarchy unavailable"));
          vi.spyOn(IModelReadRpcInterface, "getClientForRouting").mockReturnValue({ getClassHierarchy: hierarchy } as unknown as IModelReadRpcInterface);
          ref.viewedModels.addAll(ids);
          await ref.addAndLoadViewedModels([good.id]);
          expect(hierarchy).toHaveBeenCalledOnce();
          expect(query).toHaveBeenCalledOnce();
          expect(ids.every((id) => !ref.iModel.models.getLoaded(id))).toBe(true);
          expect(ref.iModel.models.getLoaded(good.id)).toBeDefined();

          hierarchy.mockResolvedValueOnce([]); // A later batch can resolve the class using the default ModelState.
          await ref.addAndLoadViewedModels([ids[0]]);
          expect(hierarchy).toHaveBeenCalledTimes(2);
          expect(ref.iModel.models.getLoaded(ids[0])).toBeDefined();
        } finally {
          other.closeSync();
        }
      });

      it.each([false, true])("publishes concurrent category info even if another selected category fails (%s)", async (otherFails) => {
        using vp = openBlankViewport();
        const other = createBlankConnection();
        try {
          const refs = vp.iModelRefs;
          if (!refs.isSpatial)
            throw new Error("Expected spatial references");
          const ref = linked ? refs.link({ iModel: other }) : refs.primary;
          await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
          vp.renderFrame();
          vi.spyOn(ref.iModel, "isClosed", "get").mockReturnValue(false);
          const query = vi.spyOn(ref.iModel, "querySubCategories").mockResolvedValueOnce([{ parentId: "0xabc", id: "0xabd", appearance: {} }]).mockRejectedValue(new Error("other category unavailable"));
          const applied = vi.spyOn(vp.target, "overrideFeatureSymbology");
          const loaded = vi.fn();
          ref.onViewedCategoriesLoaded.addListener(loaded);
          const info = ref.iModel.categories.getCategoryInfo(["0xabc"]);
          await Promise.resolve();
          ref.viewedCategories.add("0xabc");
          if (otherFails)
            ref.viewedCategories.add("0xace");
          const before = ref.getSymbologyOverrides();
          vp.renderFrame();
          expect(before.isSubCategoryIdVisible("0xabd")).toBe(false);
          await info;
          await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
          vp.renderFrame();
          expect(ref.getSymbologyOverrides().isSubCategoryIdVisible("0xabd")).toBe(true);
          if (!linked)
            expect(applied.mock.calls.at(-1)?.[0].isSubCategoryIdVisible("0xabd")).toBe(true);
          expect(query).toHaveBeenCalledTimes(otherFails ? 2 : 1);
          expect(loaded).toHaveBeenCalledOnce();
        } finally {
          other.closeSync();
        }
      });

      for (const queued of [false, true]) {
        it(`loads explicitly requested models removed ${queued ? "while queued" : "before dispatch"}`, async () => {
          using vp = openBlankViewport();
          const other = createBlankConnection();
          const gate = deferred();
          try {
            const refs = vp.iModelRefs;
            if (!refs.isSpatial)
              throw new Error("Expected spatial references");
            const ref = linked ? refs.link({ iModel: other }) : refs.primary;
            await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
            const getProps = vi.spyOn(ref.iModel.models, "getProps").mockImplementation(async (ids) => {
              const snapshot = [...Id64.iterable(ids)];
              await gate.promise;
              return snapshot.map((id) => ({ id, classFullName: "BisCore:PhysicalModel", modeledElement: { id } }));
            });
            let first: Promise<void> | undefined;
            if (queued) {
              first = ref.addAndLoadViewedModels(["0x123"]);
              await vi.waitFor(() => expect(getProps).toHaveBeenCalledOnce());
            }
            const load = ref.addAndLoadViewedModels(["0x124"]);
            ref.viewedModels.delete("0x124");
            gate.resolve();
            await first;
            await load;
            expect(ref.iModel.models.getLoaded("0x124")).toBeDefined();
            expect(ref.viewedModels.has("0x124")).toBe(false);
            expect(getProps).toHaveBeenCalledTimes(queued ? 2 : 1);
            expect(getProps.mock.calls.flatMap(([ids]) => [...Id64.iterable(ids)])).toEqual(queued ? ["0x123", "0x124"] : ["0x124"]);
          } finally {
            gate.resolve();
            other.closeSync();
          }
        });
      }

      for (const mode of ["individual toggles", "selector", "add and load"] as const) {
        it(`coalesces model requests using ${mode}`, async () => {
          using vp = openBlankViewport();
          const other = createBlankConnection();
          try {
            const refs = vp.iModelRefs;
            if (!refs.isSpatial)
              throw new Error("Expected spatial references");

            const ref = linked ? refs.link({ iModel: other }) : refs.primary;
            await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
            const gate = deferred();
            const getProps = vi.spyOn(ref.iModel.models, "getProps").mockImplementation(async (modelIds) => {
              await gate.promise;
              return [...Id64.iterable(modelIds)].map((id) => ({ id, classFullName: "BisCore:PhysicalModel", modeledElement: { id } }));
            });
            const loaded = vi.fn();
            ref.onViewedModelsLoaded.addListener(loaded);
            const ids = createIds(100);
            let load: Promise<void> | undefined;
            if (mode === "add and load") {
              load = linked ? ref.addAndLoadViewedModels(ids) : vp.addViewedModels(ids);
            } else {
              for (const id of ids) {
                if (mode === "individual toggles" && !linked)
                  vp.changeModelDisplay(id, true);
                else
                  ref.viewedModels.add(id);
              }
            }

            await Promise.resolve();
            expect(ref.isLoadingComplete).toBe(false);
            gate.resolve();
            await load;
            await vi.waitFor(() => expect(ref.iModel.models.getLoaded(ids[99])).toBeDefined());
            await vi.waitFor(() => expect(loaded).toHaveBeenCalledTimes(1));
            expect(getProps).toHaveBeenCalledTimes(1);
            expect([...Id64.iterable(getProps.mock.calls[0][0])].sort()).toEqual([...ids].sort());
            expect(loaded).toHaveBeenCalledTimes(1);
          } finally {
            other.closeSync();
          }
        });
      }

      it.each([false, true])("finishes disjoint model requests without refetching overlapping IDs (first model hidden: %s)", async (hideFirst) => {
        using vp = openBlankViewport();
        const other = createBlankConnection();
        const first = deferred();
        const second = deferred();
        try {
          const refs = vp.iModelRefs;
          if (!refs.isSpatial)
            throw new Error("Expected spatial references");
          const ref = linked ? refs.link({ iModel: other }) : refs.primary;
          await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
          const requested: string[][] = [];
          vi.spyOn(ref.iModel.models, "getProps").mockImplementation(async (ids) => {
            const batch = [...Id64.iterable(ids)];
            requested.push(batch);
            await (batch.includes("0x30") ? first : second).promise;
            return batch.map((id) => ({ id, classFullName: "BisCore:Model", modeledElement: { id } }));
          });
          const load = async (ids: string[]) => linked ? ref.addAndLoadViewedModels(ids) : vp.addViewedModels(ids);
          const loaded = vi.fn();
          ref.onViewedModelsLoaded.addListener(loaded);
          const loadA = load(["0x30"]);
          await vi.waitFor(() => expect(requested).toEqual([["0x30"]]));
          if (hideFirst)
            ref.viewedModels.delete("0x30");
          const bothReady = vi.fn();
          const loadBoth = hideFirst ? undefined : load(["0x30", "0x31"]).then(bothReady);
          const expectBothRequests = () => expect(requested).toEqual([["0x30"], ["0x31"]]);
          if (loadBoth)
            await vi.waitFor(expectBothRequests); // The mixed request must dispatch B independently of A.
          const bReady = vi.fn();
          const loadB = load(["0x31"]).then(bReady);
          await vi.waitFor(expectBothRequests);
          second.resolve();
          await vi.waitFor(() => expect(bReady).toHaveBeenCalledOnce());
          expect(loaded).toHaveBeenCalledOnce();
          expect(ref.iModel.models.getLoaded("0x31")).toBeDefined();
          expect(ref.iModel.models.getLoaded("0x30")).toBeUndefined();
          expect(bothReady).not.toHaveBeenCalled();
          expect(ref.isLoadingComplete).toBe(false);
          first.resolve();
          await Promise.all([loadA, loadB, loadBoth]);
          await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
          expect(loaded).toHaveBeenCalledTimes(2);
          expect(bothReady).toHaveBeenCalledTimes(hideFirst ? 0 : 1);
          expect(ref.iModel.models.getLoaded("0x30")).toBeDefined();
          expect(requested).toEqual([["0x30"], ["0x31"]]);
        } finally {
          first.resolve();
          second.resolve();
          other.closeSync();
        }
      });

      it("serializes additions made while a model request is in flight", async () => {
        using vp = openBlankViewport();
        const other = createBlankConnection();
        try {
          const refs = vp.iModelRefs;
          if (!refs.isSpatial)
            throw new Error("Expected spatial references");

          const ref = linked ? refs.link({ iModel: other }) : refs.primary;
          await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
          const gate = deferred();
          const getProps = vi.spyOn(ref.iModel.models, "getProps").mockImplementation(async (modelIds) => {
            await gate.promise;
            return [...Id64.iterable(modelIds)].map((id) => ({ id, classFullName: "BisCore:PhysicalModel", modeledElement: { id } }));
          });
          ref.viewedModels.add("0x100");
          await vi.waitFor(() => expect(getProps).toHaveBeenCalledTimes(1));
          for (const id of createIds(100))
            ref.viewedModels.add(id);

          await Promise.resolve();
          expect(getProps).toHaveBeenCalledTimes(1);
          gate.resolve();
          await vi.waitFor(() => expect(ref.iModel.models.getLoaded(createIds(100)[99])).toBeDefined());
          expect(getProps).toHaveBeenCalledTimes(2);
          const requested = getProps.mock.calls.flatMap(([ids]) => [...Id64.iterable(ids)]);
          expect(requested.length).toBe(101);
          expect(new Set(requested).size).toBe(101);
        } finally {
          other.closeSync();
        }
      });
    });
  }
});
