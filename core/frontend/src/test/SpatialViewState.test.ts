/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Range3d } from "@itwin/core-geometry";
import { EmptyLocalization } from "@itwin/core-common";
import { SpatialViewState } from "../SpatialViewState";
import type { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { RealityModelTileTree, TileTree, TileTreeLoadStatus, TileTreeReference } from "../tile/internal";
import type { ViewRealityModel } from "../ViewState";
import { createBlankConnection } from "./createBlankConnection";

describe("SpatialViewState", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const projectExtents = new Range3d(-100, -50, -25, 25, 50, 100);
  let iModel: IModelConnection;

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    iModel = createBlankConnection(undefined, undefined, projectExtents);
  });

  afterAll(async () => IModelApp.shutdown());

  class TreeRef extends TileTreeReference {
    public constructor(private readonly _range: Range3d) {
      super();
    }

    public override unionFitRange(union: Range3d): void {
      union.extendRange(this._range);
    }

    public override get treeOwner() {
      return {
        iModel,
        tileTree: undefined,
        loadStatus: TileTreeLoadStatus.NotLoaded,
        load: () => undefined,
        [Symbol.dispose]: () => undefined,
        loadTree: async () => Promise.resolve(undefined),
      };
    }
  }

  function createView(ranges: Range3d[]): SpatialViewState {
    const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const refs = ranges.map((range) => new TreeRef(range));
    view.getModelTreeRefs = () => refs;

    return view;
  }

  function expectFitRange(view: SpatialViewState, expected: Range3d, baseExtents?: Range3d): void {
    const actual = view.computeFitRange({ baseExtents });
    expect(actual.low.x).toEqual(expected.low.x);
    expect(actual.low.y).toEqual(expected.low.y);
    expect(actual.low.z).toEqual(expected.low.z);
    expect(actual.high.x).toEqual(expected.high.x);
    expect(actual.high.y).toEqual(expected.high.y);
    expect(actual.high.z).toEqual(expected.high.z);
  }

  describe("computeFitRange", () => {
    it("unions ranges of all tile trees", () => {
      expectFitRange(createView([new Range3d(0, 1, 2, 3, 4, 5)]), new Range3d(0, 1, 2, 3, 4, 5));
      expectFitRange(createView([new Range3d(0, 1, 2, 3, 4, 5), new Range3d(-1, 2, 2, 2, 5, 7)]), new Range3d(-1, 1, 2, 3, 5, 7));
    });

    it("falls back to slightly-expanded project extents upon null range", () => {
      const expanded = projectExtents.clone();
      expanded.scaleAboutCenterInPlace(1.0001);
      expectFitRange(createView([]), expanded);
    });

    it("unions with base extents if provided", () => {
      const baseExtents = new Range3d(0, 1, 2, 3, 4, 5);
      expectFitRange(createView([]), baseExtents, baseExtents);
      expectFitRange(createView([new Range3d(-1, 2, 2, 2, 5, 7)]), new Range3d(-1, 1, 2, 3, 5, 7), baseExtents);
    });

    it("does not modify input baseExtents", () => {
      const baseExtents = new Range3d(0, 1, 2, 3, 4, 5);
      expectFitRange(createView([new Range3d(-1, 2, 2, 2, 5, 7)]), new Range3d(-1, 1, 2, 3, 5, 7), baseExtents);
      expect(baseExtents.low.x).toEqual(0);
      expect(baseExtents.low.y).toEqual(1);
      expect(baseExtents.low.z).toEqual(2);
      expect(baseExtents.high.x).toEqual(3);
      expect(baseExtents.high.y).toEqual(4);
      expect(baseExtents.high.z).toEqual(5);
    });

    it("does not include invisible context reality models when computing range", () => {
      const view = createView([new Range3d(-1, 2, 2, 2, 5, 7)]);

      const state = view.displayStyle.attachRealityModel({tilesetUrl: "https://fake.com"});

      state.invisible = true;
      const unionFitRangeSpy = vi.spyOn(RealityModelTileTree.Reference.prototype, "unionFitRange");
      view.computeFitRange();
      expect(unionFitRangeSpy).not.toHaveBeenCalled();

      // Make sure it's still being called when not 'invisible'
      state.invisible = false;
      view.computeFitRange();
      expect(unionFitRangeSpy).toHaveBeenCalled();
    });
  });

  describe("getRealityModelTreeRefs", () => {
    class RealityTreeRef extends TileTreeReference {
      public constructor(private readonly _modelId: string, private readonly _iModel: IModelConnection) {
        super();
      }

      public override get treeOwner() {
        const modelId = this._modelId;
        return {
          iModel: this._iModel,
          tileTree: { modelId } as unknown as TileTree,
          loadStatus: TileTreeLoadStatus.Loaded,
          load: () => undefined as unknown as TileTree,
          [Symbol.dispose]: () => undefined,
          loadTree: async () => Promise.resolve(undefined),
        };
      }
    }

    class UnloadedTreeRef extends TileTreeReference {
      public override get treeOwner() {
        return {
          iModel,
          tileTree: undefined,
          loadStatus: TileTreeLoadStatus.NotLoaded,
          load: () => undefined,
          [Symbol.dispose]: () => undefined,
          loadTree: async () => Promise.resolve(undefined),
        };
      }
    }

    function collectRefs(view: SpatialViewState): ViewRealityModel[] {
      return Array.from(view.getRealityModelTreeRefs());
    }

    it("yields visible context and persistent reality models", () => {
      const realityModelId = "0x28";
      const nonRealityModelId = "0x30";
      const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      const persistedRef = new RealityTreeRef(realityModelId, iModel);
      const nonRealityRef = new RealityTreeRef(nonRealityModelId, iModel);
      view.getModelTreeRefs = () => [persistedRef, nonRealityRef];

      vi.spyOn(iModel.models, "getLoaded").mockImplementation((id) => {
        if (id === realityModelId)
          return { asSpatialModel: { isRealityModel: true }, name: "Persistent reality" } as any;
        if (id === nonRealityModelId)
          return { asSpatialModel: { isRealityModel: false }, name: "Not Reality" } as any;
        return undefined;
      });

      const contextState = view.displayStyle.attachRealityModel({ tilesetUrl: "https://fake.com/tileset.json", name: "Context Reality", description: "A context model" });

      const refs = collectRefs(view);
      expect(refs).toHaveLength(2);
      expect(refs[0].treeRef).toBe(contextState.treeRef);
      expect(refs[0].name).toBe("Context Reality");
      expect(refs[0].description).toBe("A context model");
      expect(refs[1].treeRef).toBe(persistedRef);
      expect(refs[1].name).toBe("Persistent reality");
      expect(refs[1].description).toBeUndefined();
    });

    it("excludes invisible context reality models", () => {
      const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      view.getModelTreeRefs = () => [];

      const state = view.displayStyle.attachRealityModel({ tilesetUrl: "https://fake.com/tileset.json" });
      state.invisible = true;
      expect(collectRefs(view)).toHaveLength(0);
    });

    it("yields only visible context models when some are invisible", () => {
      const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      view.getModelTreeRefs = () => [];

      const visible = view.displayStyle.attachRealityModel({ tilesetUrl: "https://fake.com/a.json", name: "Visible" });
      const invisible = view.displayStyle.attachRealityModel({ tilesetUrl: "https://fake.com/b.json", name: "Invisible" });
      invisible.invisible = true;
      const alsoVisible = view.displayStyle.attachRealityModel({ tilesetUrl: "https://fake.com/c.json", name: "Also Visible" });

      const refs = collectRefs(view);
      expect(refs).toHaveLength(2);
      expect(refs[0].treeRef).toBe(visible.treeRef);
      expect(refs[0].name).toBe("Visible");
      expect(refs[0].description).toBe("");
      expect(refs[1].treeRef).toBe(alsoVisible.treeRef);
      expect(refs[1].name).toBe("Also Visible");
      expect(refs[1].description).toBe("");
    });

    it("excludes refs whose tile trees have not loaded", () => {
      const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      view.getModelTreeRefs = () => [new UnloadedTreeRef()];

      expect(collectRefs(view)).toHaveLength(0);
    });

    it("excludes persisted models whose model is not in cache", () => {
      const modelId = "0x50";
      const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      const ref = new RealityTreeRef(modelId, iModel);
      view.getModelTreeRefs = () => [ref];

      vi.spyOn(iModel.models, "getLoaded").mockReturnValue(undefined);

      expect(collectRefs(view)).toHaveLength(0);
    });

    it("excludes persisted models with no asSpatialModel", () => {
      const modelId = "0x51";
      const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      const ref = new RealityTreeRef(modelId, iModel);
      view.getModelTreeRefs = () => [ref];

      vi.spyOn(iModel.models, "getLoaded").mockImplementation((id) => {
        if (id === modelId)
          return { asSpatialModel: undefined } as any;
        return undefined;
      });

      expect(collectRefs(view)).toHaveLength(0);
    });
  });
});
