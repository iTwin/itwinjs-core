/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Cartographic, PlanProjectionSettings } from "@itwin/core-common";
import {
  BlankConnection, IModelApp, OffScreenViewport, SpatialTileTreeReferences, SpatialViewState, TileTreeReference, ViewRect,
} from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";
import { expect } from "chai";
import sinon from "sinon";
import { BatchedTileTreeReference } from "../BatchedTileTreeReference.js";
import { initializeFrontendTiles } from "../FrontendTiles.js";

const createDefaultSpatialTileTreeReferences = SpatialTileTreeReferences.create;

function createTileset(modelIds: string[]): object {
  const models: { [id: string]: object } = {};
  for (const modelId of modelIds) {
    models[modelId] = {
      extents: {
        low: { x: 0, y: 0, z: 0 },
        high: { x: 1, y: 1, z: 1 },
      },
    };
  }

  return {
    asset: { version: "1.0" },
    geometricError: 0,
    root: {
      boundingVolume: { box: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1] },
      geometricError: 0,
    },
    extensions: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      BENTLEY_BatchedTileSet: { models },
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

describe("Batched model groups display style replacement", () => {
  before(async () => IModelApp.startup({ tileAdmin: { decodeImdlInWorker: false } }));
  after(async () => IModelApp.shutdown());

  it("regroups batched tiles based on the replacement style's plan projection settings", async () => {
    const iModel = BlankConnection.create({
      name: "primary",
      location: Cartographic.fromDegrees({ longitude: 0, latitude: 0, height: 0 }),
      extents: new Range3d(0, 0, 0, 1, 1, 1),
    });
    const url = new URL("https://tiles.test/replacement/");
    const tileset = createTileset(["0x1", "0x2"]);

    sinon.stub(window, "fetch").callsFake(async (input) => {
      const requested = typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
      if (requested !== `${url}tileset.json`)
        throw new Error(`Unexpected tileset request: ${requested}`);

      return new Response(JSON.stringify(tileset), { headers: { "Content-Type": "application/json" } });
    });

    let vp: OffScreenViewport | undefined;
    try {
      SpatialTileTreeReferences.create = createDefaultSpatialTileTreeReferences;
      initializeFrontendTiles({ computeSpatialTilesetBaseUrl: async () => url });

      const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      vp = OffScreenViewport.create({ view, viewRect: new ViewRect(0, 0, 32, 32) });

      // Both models share display settings - a single group.
      await getBatchedReferences(view.iModelRefs.primary.tileTreeRefs, 1);

      // Replacing the display style with one assigning plan projection settings to one model must split the groups.
      const oldStyle = view.getDisplayStyle3d();
      const newStyle = oldStyle.clone();
      newStyle.settings.setPlanProjectionSettings("0x1", PlanProjectionSettings.fromJSON({ elevation: 10 }));
      vp.displayStyle = newStyle;
      await getBatchedReferences(view.iModelRefs.primary.tileTreeRefs, 2);

      // Groups must track subsequent changes on the replacement style - identical settings merge the groups again.
      newStyle.settings.setPlanProjectionSettings("0x2", PlanProjectionSettings.fromJSON({ elevation: 10 }));
      await getBatchedReferences(view.iModelRefs.primary.tileTreeRefs, 1);

      // ...and must ignore changes to the replaced (old) style.
      oldStyle.settings.setPlanProjectionSettings("0x2", PlanProjectionSettings.fromJSON({ elevation: 99 }));
      const refs = Array.from(view.iModelRefs.primary.tileTreeRefs).filter((ref) => ref instanceof BatchedTileTreeReference);
      expect(refs).to.have.lengthOf(1);
    } finally {
      sinon.restore();
      SpatialTileTreeReferences.create = createDefaultSpatialTileTreeReferences;
      if (vp)
        vp[Symbol.dispose]();

      iModel.closeSync();
    }
  });
});
