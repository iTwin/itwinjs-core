/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ClipStyle } from "@itwin/core-common";
import type { IModelConnection, ViewState } from "@itwin/core-frontend";
import { SnapshotConnection, SpatialViewState } from "@itwin/core-frontend";
import { ClipPrimitive, ClipVector, ConvexClipPlaneSet } from "@itwin/core-geometry";
import { TestUtility } from "../../TestUtility";

function countTileTrees(view: ViewState): number {
  let numTrees = 0;
  view.forEachModelTreeRef((_) => ++numTrees);
  return numTrees;
}

function expectNumTreesPerModel(numTreesPerModel: number, view: SpatialViewState): void {
  expect(countTileTrees(view)).to.equal(view.modelSelector.models.size * numTreesPerModel);
}

describe("Section-cut tile tree", () => {
  interface TestCase {
    imodel: IModelConnection;
    viewId: string;
  }

  const testCases: TestCase[] = [];

  before(async () => {
    await TestUtility.startFrontend();
    const imodels = await Promise.all([ SnapshotConnection.openFile("mirukuru.ibim"), SnapshotConnection.openFile("planprojection.bim") ]);
    testCases.push({ imodel: imodels[0], viewId: "0x24" });
    testCases.push({ imodel: imodels[1], viewId: "0x29" });
  });

  after(async () => {
    await Promise.all(testCases.map(async (x) => x.imodel.close()));
    testCases.length = 0;
    await TestUtility.shutdownFrontend();
  });

  async function test(setup: (view: SpatialViewState) => void, verify: (view: SpatialViewState) => void): Promise<void> {
    for (const testCase of testCases) {
      const view = await testCase.imodel.views.load(testCase.viewId) as SpatialViewState;
      expect(view instanceof SpatialViewState).to.be.true;
      if (setup)
        setup(view);

      verify(view);
    }
  }

  const defaultClip = ClipVector.createCapture([ClipPrimitive.createCapture(ConvexClipPlaneSet.createPlanes([]), false)]);

  function enableClip(view: ViewState, produceCutGeometry: boolean, clip: ClipVector | undefined): void {
    view.viewFlags = view.viewFlags.with("clipVolume", true);
    view.displayStyle.settings.clipStyle = ClipStyle.fromJSON({ produceCutGeometry });
    view.setViewClip(clip);
  }

  it("creates an additional tile tree reference for section-cut graphics", async () => {
    await test((_) => undefined, (view) => {
      expectNumTreesPerModel(1, view);
    });

    await test((view) => enableClip(view, false, defaultClip), (view) => {
      expectNumTreesPerModel(1, view);
    });

    await test((view) => enableClip(view, true, defaultClip), (view) => {
      expectNumTreesPerModel(2, view);
    });
  });

  it("updates when clip vector changes", async () => {
    await test((view) => enableClip(view, true, defaultClip), (view) => {
      expectNumTreesPerModel(2, view);

      view.setViewClip(undefined);
      expectNumTreesPerModel(1, view);

      view.setViewClip(defaultClip);
      expectNumTreesPerModel(2, view);
    });
  });

  it("updates when clip style changes", async () => {
    await test((view) => enableClip(view, true, defaultClip), (view) => {
      expectNumTreesPerModel(2, view);

      view.displayStyle.settings.clipStyle = ClipStyle.fromJSON({ produceCutGeometry: false });
      expectNumTreesPerModel(1, view);

      view.displayStyle.settings.clipStyle = ClipStyle.fromJSON({ produceCutGeometry: true });
      expectNumTreesPerModel(2, view);
    });
  });

  it("updates when view flag changes", async () => {
    await test((view) => enableClip(view, true, defaultClip), (view) => {
      expectNumTreesPerModel(2, view);

      view.viewFlags = view.viewFlags.with("clipVolume", false);
      expectNumTreesPerModel(1, view);

      view.viewFlags = view.viewFlags.with("clipVolume", true);
      expectNumTreesPerModel(2, view);
    });
  });

  it("applies current section cut to newly-added tile tree references", async () => {
    const modelIds: string[] = [];
    await test((view) => {
      modelIds.length = 0; // because this test runs multiple times.
      enableClip(view, true, defaultClip);
      for (const model of view.modelSelector.models)
        modelIds.push(model);

      view.modelSelector.models.clear();
    }, (view) => {
      expect(view.modelSelector.models.size).to.equal(0);
      expect(countTileTrees(view)).to.equal(0);

      view.modelSelector.addModels(modelIds);
      view.markModelSelectorChanged();
      expectNumTreesPerModel(2, view);
    });
  });

  it("does not apply section cut if model ignores clip volume", async () => {
    await test((view) => {
      enableClip(view, true, defaultClip);
      for (const modelId of view.modelSelector.models) {
        const model = view.iModel.models.getLoaded(modelId)!;
        expect(model).not.to.be.undefined;
        model.jsonProperties.viewFlagOverrides = { clipVolume: false };
        break;
      }
    }, (view) => {
      // We overrode one model to ignore clip volume.
      const expectedCount = 1 + 2 * (view.modelSelector.models.size - 1);
      expect(countTileTrees(view)).to.equal(expectedCount);
    });
  });

  it("does not apply section cut for empty clip vector", async () => {
    await test((view) => enableClip(view, true, ClipVector.createEmpty()), (view) => {
      expectNumTreesPerModel(1, view);
    });
  });
});
