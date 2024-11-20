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
import { RealityModelTileTree, TileTreeLoadStatus, TileTreeReference } from "../tile/internal";
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
        dispose: () => undefined,
        loadTree: async () => Promise.resolve(undefined),
      };
    }
  }

  function createView(ranges: Range3d[]): SpatialViewState {
    const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const refs = ranges.map((range) => new TreeRef(range));
    view.forEachModelTreeRef = (func: (ref: TileTreeReference) => void) => {
      for (const ref of refs)
        func(ref);
    };

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
});
