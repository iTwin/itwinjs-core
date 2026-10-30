/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Cartographic } from "@itwin/core-common";
import { BlankConnection, IModelApp, IModelConnection, SpatialTileTreeReferences, SpatialViewState, TileTreeReference } from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";
import { expect } from "chai";
import sinon from "sinon";
import { BatchedTileTreeReference } from "../BatchedTileTreeReference.js";
import { initializeFrontendTiles } from "../FrontendTiles.js";
import { BatchedTilesetSpec } from "../BatchedTilesetReader.js";

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

describe("BatchedSpatialTileTreeReferences", () => {
  before(async () => IModelApp.startup({ tileAdmin: { decodeImdlInWorker: false } }));
  after(async () => IModelApp.shutdown());

  it("loads separate batched tilesets for the primary and linked iModels", async () => {
    const primaryIModel = BlankConnection.create({
      name: "primary",
      location: Cartographic.fromDegrees({ longitude: 0, latitude: 0, height: 0 }),
      extents: new Range3d(0, 0, 0, 1, 1, 1),
    });
    const linkedIModel = BlankConnection.create({
      name: "linked",
      location: Cartographic.fromDegrees({ longitude: 1, latitude: 1, height: 0 }),
      extents: new Range3d(0, 0, 0, 1, 1, 1),
    });
    const primaryUrl = new URL("https://tiles.test/primary/");
    const linkedUrl = new URL("https://tiles.test/linked/");
    const tilesets = new Map([
      [`${primaryUrl}tileset.json`, createTileset("0x1")],
      [`${linkedUrl}tileset.json`, createTileset("0x2")],
    ]);
    expect(BatchedTilesetSpec.create(primaryUrl, createTileset("0x1")).models.size).to.equal(1);
    const requestedUrls: string[] = [];

    sinon.stub(window, "fetch").callsFake(async (input) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
      requestedUrls.push(url);
      const tileset = tilesets.get(url);
      if (!tileset)
        throw new Error(`Unexpected tileset request: ${url}`);

      return new Response(JSON.stringify(tileset), { headers: { "Content-Type": "application/json" } });
    });

    let view: SpatialViewState | undefined;
    let linkedRef: ReturnType<SpatialViewState["iModelRefs"]["link"]> | undefined;
    try {
      // Other tests may initialize the package, which replaces this global factory.
      SpatialTileTreeReferences.create = createDefaultSpatialTileTreeReferences;
      const baseUrlFor = async (iModel: IModelConnection): Promise<URL | undefined> => {
        if (iModel === primaryIModel)
          return primaryUrl;
        if (iModel === linkedIModel)
          return linkedUrl;
        throw new Error("Unexpected iModel");
      };

      initializeFrontendTiles({ computeSpatialTilesetBaseUrl: baseUrlFor });
      view = SpatialViewState.createBlank(primaryIModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      linkedRef = view.iModelRefs.link({ iModel: linkedIModel });
      const ecefToPrimary = primaryIModel.getEcefTransform().inverse();
      expect(ecefToPrimary).not.to.be.undefined;
      const linkedToPrimary = ecefToPrimary!.multiplyTransformTransform(linkedIModel.ecefLocation!.getTransform());
      expect(linkedRef.linearTransformToParent.isAlmostEqual(linkedToPrimary)).to.be.true;

      const getBatchedRef = async (refs: Iterable<TileTreeReference>): Promise<BatchedTileTreeReference> => {
        let allRefs: TileTreeReference[] = [];
        for (let attempt = 0; attempt < 50; attempt++) {
          allRefs = Array.from(refs);
          const batchedRefs = allRefs.filter((ref): ref is BatchedTileTreeReference => ref instanceof BatchedTileTreeReference);
          if (batchedRefs.length === 1)
            return batchedRefs[0];

          await new Promise<void>((resolve) => window.setTimeout(resolve, 10));
        }

        expect(allRefs.map((ref) => ref.constructor.name).join(", ")).to.equal("BatchedTileTreeReference");
        throw new Error("Batched tile reference did not load");
      };

      const [primaryBatchedRef, linkedBatchedRef] = await Promise.all([
        getBatchedRef(view.iModelRefs.primary.tileTreeRefs),
        getBatchedRef(linkedRef.tileTreeRefs),
      ]);
      expect(primaryBatchedRef.groupModelIds?.has("0x1")).to.equal(true);
      expect(linkedBatchedRef.groupModelIds?.has("0x2")).to.equal(true);

      const [primaryTree, linkedTree] = await Promise.all([
        primaryBatchedRef.treeOwner.loadTree(),
        linkedBatchedRef.treeOwner.loadTree(),
      ]);
      expect(primaryTree?.iModel).to.equal(primaryIModel);
      expect(linkedTree?.iModel).to.equal(linkedIModel);
      expect(requestedUrls).to.have.members([`${primaryUrl}tileset.json`, `${linkedUrl}tileset.json`]);
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
