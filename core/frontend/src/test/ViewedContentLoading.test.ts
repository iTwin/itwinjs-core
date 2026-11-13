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
