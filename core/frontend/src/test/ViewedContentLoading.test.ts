/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated -- Exercise the viewport APIs that exhibited the regressions. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CompressedId64Set, Id64 } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
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
        const query = vi.spyOn(other, "querySubCategories").mockImplementation(async () => { await gate.promise; return []; });
        if (phase === "queued") {
          vi.spyOn(vp.iModel, "isClosed", "get").mockReturnValue(false);
          vi.spyOn(vp.iModel, "querySubCategories").mockImplementation(async () => { await primaryGate.promise; return []; });
          refs.primary.viewedCategories.add("0x111");
          await Promise.resolve();
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
        expect(query).toHaveBeenCalledTimes(phase === "in flight" ? 1 : 0);
      } finally {
        primaryGate.resolve();
        gate.resolve();
        other.closeSync();
      }
    });
  }

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

      it("refreshes overrides when a concurrent category-info load wins the deferred load", async () => {
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
          const query = vi.spyOn(ref.iModel, "querySubCategories").mockResolvedValue([{ parentId: "0xabc", id: "0xabd", appearance: {} }]);
          const applied = vi.spyOn(vp.target, "overrideFeatureSymbology");
          const info = ref.iModel.categories.getCategoryInfo(["0xabc"]);
          await Promise.resolve();
          ref.viewedCategories.add("0xabc");
          const before = ref.getSymbologyOverrides();
          vp.renderFrame();
          expect(before.isSubCategoryIdVisible("0xabd")).toBe(false);
          await info;
          await vi.waitFor(() => expect(ref.isLoadingComplete).toBe(true));
          vp.renderFrame();
          expect(ref.getSymbologyOverrides().isSubCategoryIdVisible("0xabd")).toBe(true);
          if (!linked)
            expect(applied.mock.calls.at(-1)?.[0].isSubCategoryIdVisible("0xabd")).toBe(true);
          expect(query).toHaveBeenCalledOnce();
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
