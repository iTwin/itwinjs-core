/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Cartographic } from "@itwin/core-common";
import {
  BlankConnection, CategorySelectorState, DisplayStyle3dState, IModelApp, IModelConnection, ModelSelectorState, SpatialTileTreeReferences, SpatialViewState, TileTreeReference,
} from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";
import { expect } from "chai";
import sinon from "sinon";
import { BatchedTileTree } from "../BatchedTileTree.js";
import { BatchedTileTreeReference } from "../BatchedTileTreeReference.js";
import { initializeFrontendTiles } from "../FrontendTiles.js";

const createDefaultSpatialTileTreeReferences = SpatialTileTreeReferences.create;

function createTileset(modelId: string): object {
  return {
    asset: { version: "1.0" },
    geometricError: 0,
    root: {
      boundingVolume: { box: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1] },
      geometricError: 0,
    },
    extensions: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      BENTLEY_BatchedTileSet: {
        models: {
          [modelId]: {
            extents: {
              low: { x: 0, y: 0, z: 0 },
              high: { x: 1, y: 1, z: 1 },
            },
          },
        },
      },
    },
  };
}

async function getBatchedReferences(refs: Iterable<TileTreeReference>, count: number): Promise<BatchedTileTreeReference[]> {
  let actual: BatchedTileTreeReference[] = [];
  for (let attempt = 0; attempt < 50; attempt++) {
    actual = Array.from(refs).filter((ref): ref is BatchedTileTreeReference => ref instanceof BatchedTileTreeReference);
    if (actual.length === count)
      return actual;

    await new Promise<void>((resolve) => window.setTimeout(resolve, 10));
  }

  expect(actual).to.have.lengthOf(count);
  return actual;
}

describe("Batched schedule scripts", () => {
  before(async () => IModelApp.startup({ tileAdmin: { decodeImdlInWorker: false } }));
  after(async () => IModelApp.shutdown());

  it("applies the script to the primary batched tree but not linked iModels", async () => {
    const primaryIModel = BlankConnection.create({
      name: "primary",
      location: Cartographic.fromDegrees({ longitude: 0, latitude: 0, height: 0 }),
      extents: new Range3d(0, 0, 0, 1, 1, 1),
    });
    const linkedIModel = BlankConnection.create({
      name: "linked",
      location: Cartographic.fromDegrees({ longitude: 0, latitude: 0, height: 0 }),
      extents: new Range3d(0, 0, 0, 1, 1, 1),
    });
    const primaryUrl = new URL("https://tiles.test/scheduled/");
    const linkedUrl = new URL("https://tiles.test/static/");
    const tilesets = new Map([
      [`${primaryUrl}tileset.json`, createTileset("0x1")],
      [`${linkedUrl}tileset.json`, createTileset("0x2")],
    ]);

    sinon.stub(window, "fetch").callsFake(async (input) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
      const tileset = tilesets.get(url);
      if (!tileset)
        throw new Error(`Unexpected tileset request: ${url}`);

      return new Response(JSON.stringify(tileset), { headers: { "Content-Type": "application/json" } });
    });

    let view: SpatialViewState | undefined;
    let linkedRef: ReturnType<SpatialViewState["iModelRefs"]["link"]> | undefined;
    try {
      SpatialTileTreeReferences.create = createDefaultSpatialTileTreeReferences;
      initializeFrontendTiles({
        computeSpatialTilesetBaseUrl: async (iModel: IModelConnection) => {
          if (iModel === primaryIModel)
            return primaryUrl;
          if (iModel === linkedIModel)
            return linkedUrl;
          throw new Error("Unexpected iModel");
        },
      });

      const emptyProps = {} as any;
      const displayStyle = new DisplayStyle3dState(emptyProps, primaryIModel);
      displayStyle.settings.scheduleScriptProps = [{
        modelId: "0x1",
        elementTimelines: [{
          batchId: 1,
          elementIds: [],
          transformTimeline: [
            { time: 0, value: { transform: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]] } },
            { time: 10, value: { transform: [[1, 0, 0, 10], [0, 1, 0, 0], [0, 0, 1, 0]] } },
          ],
        }],
      }];
      const script = displayStyle.scheduleScript;
      expect(script?.requiresBatching).to.equal(true);
      expect(script?.getTransform("0x1", 1, 0)?.origin.x).to.equal(0);
      expect(script?.getTransform("0x1", 1, 10)?.origin.x).to.equal(10);

      view = new SpatialViewState(
        emptyProps,
        primaryIModel,
        new CategorySelectorState(emptyProps, primaryIModel),
        displayStyle,
        new ModelSelectorState(emptyProps, primaryIModel),
      );
      view.setOrigin({ x: 0, y: 0, z: 0 });
      view.setExtents({ x: 1, y: 1, z: 1 });
      linkedRef = view.iModelRefs.link({ iModel: linkedIModel });

      const [primaryRefs, linkedRefs] = await Promise.all([
        getBatchedReferences(view.iModelRefs.primary.tileTreeRefs, 2),
        getBatchedReferences(linkedRef.tileTreeRefs, 1),
      ]);
      const [primaryTree, linkedTree] = await Promise.all([
        primaryRefs[0].treeOwner.loadTree(),
        linkedRefs[0].treeOwner.loadTree(),
      ]);

      expect(primaryTree).to.be.instanceOf(BatchedTileTree);
      expect(linkedTree).to.be.instanceOf(BatchedTileTree);
      expect((primaryTree as BatchedTileTree).scheduleScript).to.equal(script);
      expect((linkedTree as BatchedTileTree).scheduleScript).to.be.undefined;

      const getPrimaryTransforms = () => primaryRefs.map((ref) => ref.getLocation()?.origin.x);
      expect(getPrimaryTransforms()).to.deep.equal([0, 0]);

      displayStyle.settings.timePoint = 10;
      expect(getPrimaryTransforms()).to.deep.equal([0, 10]);
      expect(linkedRefs[0].getLocation()?.origin.x).to.equal(0);
    } finally {
      sinon.restore();
      SpatialTileTreeReferences.create = createDefaultSpatialTileTreeReferences;
      if (view && linkedRef)
        view.iModelRefs.unlink(linkedRef);
      primaryIModel.closeSync();
      linkedIModel.closeSync();
    }
  });
});
