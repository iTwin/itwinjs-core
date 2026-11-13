/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BatchType, Cartographic, FeatureAppearance, FeatureAppearanceSource, GeometryClass, SubCategoryAppearance } from "@itwin/core-common";
import { BlankConnection, FeatureSymbology, IModelApp, IModelConnection, SpatialTileTreeReferences, SpatialViewState, TileTreeReference } from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";
import { Id64 } from "@itwin/core-bentley";
import { expect } from "chai";
import sinon from "sinon";
import { BatchedTileTreeReference } from "../BatchedTileTreeReference.js";
import { initializeFrontendTiles } from "../FrontendTiles.js";
import { BatchedTilesetSpec } from "../BatchedTilesetReader.js";

const createDefaultSpatialTileTreeReferences = SpatialTileTreeReferences.create;

interface TilesetModelExtents {
  low: { x: number, y: number, z: number };
  high: { x: number, y: number, z: number };
}

const unitExtents: TilesetModelExtents = { low: { x: 0, y: 0, z: 0 }, high: { x: 1, y: 1, z: 1 } };

function createTileset(models: Array<[string, TilesetModelExtents]>): object {
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
        models: Object.fromEntries(models.map(([modelId, extents]) => [modelId, { extents }])),
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
      extents: new Range3d(0, 0, 0, 3, 3, 3),
    });
    const primaryUrl = new URL("https://tiles.test/primary/");
    const linkedUrl = new URL("https://tiles.test/linked/");
    const secondLinkedModelExtents: TilesetModelExtents = { low: { x: 1, y: 1, z: 1 }, high: { x: 2, y: 2, z: 2 } };
    const tilesets = new Map([
      [`${primaryUrl}tileset.json`, createTileset([["0x1", unitExtents]])],
      [`${linkedUrl}tileset.json`, createTileset([["0x2", unitExtents], ["0x3", secondLinkedModelExtents]])],
    ]);
    expect(BatchedTilesetSpec.create(primaryUrl, createTileset([["0x1", unitExtents]])).models.size).to.equal(1);
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
      view.modelSelector.models.add("0x1");
      linkedRef = view.iModelRefs.link({ iModel: linkedIModel, viewedModels: ["0x2"] });
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

      // Tile locations: the linked reference's tiles must be placed into the primary's coordinate space, while the
      // primary's remain in its own.
      const primaryLocation = primaryBatchedRef.getLocation();
      expect(primaryLocation).not.to.be.undefined;
      expect(primaryLocation!.isAlmostEqual(primaryTree!.iModelTransform)).to.be.true;

      const linkedLocation = linkedBatchedRef.getLocation();
      expect(linkedLocation).not.to.be.undefined;
      const expectedLinkedLocation = linkedRef.linearTransformToParent.multiplyTransformTransform(linkedTree!.iModelTransform);
      expect(linkedLocation!.isAlmostEqual(expectedLinkedLocation)).to.be.true;
      expect(linkedLocation!.isAlmostEqual(linkedTree!.iModelTransform)).to.be.false;

      // Fit ranges: the linked reference's model extents must likewise be transformed into the primary's coordinate space.
      const modelExtents = new Range3d(0, 0, 0, 1, 1, 1);
      const primaryFit = Range3d.createNull();
      primaryBatchedRef.unionFitRange(primaryFit);
      expect(primaryFit.isAlmostEqual(modelExtents)).to.be.true;

      const linkedFit = Range3d.createNull();
      linkedBatchedRef.unionFitRange(linkedFit);
      const expectedLinkedFit = Range3d.createNull();
      linkedRef.linearTransformToParent.multiplyRange(modelExtents, expectedLinkedFit);
      expect(linkedFit.isAlmostEqual(expectedLinkedFit)).to.be.true;
      expect(linkedFit.isAlmostEqual(modelExtents)).to.be.false;

      // Primary branches inherit the target's overrides; linked branches supply their own. Give the references
      // different viewed categories (with pre-populated subcategory caches) and different default appearances.
      primaryIModel.subcategories.add("0x10", "0x11", new SubCategoryAppearance(), true);
      linkedIModel.subcategories.add("0x20", "0x21", new SubCategoryAppearance(), true);
      view.iModelRefs.primary.viewedCategories.add("0x10");
      linkedRef.viewedCategories.add("0x20");
      const linkedAppearance = FeatureAppearance.fromJSON({ transparency: 0.5 });
      linkedRef.overrides.defaultFeatureAppearance = linkedAppearance;

      const getSymbology = (ref: BatchedTileTreeReference): FeatureSymbology.Overrides | undefined =>
        (ref as unknown as { getSymbologyOverrides(): FeatureSymbology.Overrides | undefined }).getSymbologyOverrides();
      expect(getSymbology(primaryBatchedRef)).to.be.undefined;
      const primarySymbology = view.iModelRefs.primary.getSymbologyOverrides();
      const linkedSymbology = getSymbology(linkedBatchedRef);
      expect(primarySymbology).not.to.be.undefined;
      expect(linkedSymbology).not.to.be.undefined;

      expect(primarySymbology.isSubCategoryIdVisible("0x11")).to.be.true;
      expect(primarySymbology.isSubCategoryIdVisible("0x21")).to.be.false;
      expect(linkedSymbology!.isSubCategoryIdVisible("0x21")).to.be.true;
      expect(linkedSymbology!.isSubCategoryIdVisible("0x11")).to.be.false;

      expect(primarySymbology.defaultOverrides).to.equal(FeatureAppearance.defaults);
      expect(linkedSymbology!.defaultOverrides).to.equal(linkedAppearance);

      // Changing the linked reference's viewed models after the batched tileset has loaded must refresh the batched
      // collection's model visibility and fit ranges.
      const isModelViewed = (batchedRef: BatchedTileTreeReference, modelId: string): boolean => {
        const source = { getAppearance: () => FeatureAppearance.defaults } as unknown as FeatureAppearanceSource;
        const appearance = batchedRef.getFeatureAppearance(
          source, 0, 0, 0, 0, GeometryClass.Primary, Id64.getLowerUint32(modelId), Id64.getUpperUint32(modelId), BatchType.Primary, 0,
        );
        return undefined !== appearance;
      };

      expect(isModelViewed(linkedBatchedRef, "0x2")).to.be.true;
      expect(isModelViewed(linkedBatchedRef, "0x3")).to.be.false;

      linkedRef.viewedModels.add("0x3");
      expect(isModelViewed(linkedBatchedRef, "0x3")).to.be.true;
      const secondModelRange = new Range3d(1, 1, 1, 2, 2, 2);
      const expandedFit = Range3d.createNull();
      linkedBatchedRef.unionFitRange(expandedFit);
      const expectedExpandedFit = Range3d.createNull();
      linkedRef.linearTransformToParent.multiplyRange(modelExtents.union(secondModelRange), expectedExpandedFit);
      expect(expandedFit.isAlmostEqual(expectedExpandedFit)).to.be.true;

      linkedRef.viewedModels.delete("0x2");
      expect(isModelViewed(linkedBatchedRef, "0x2")).to.be.false;
      expect(isModelViewed(linkedBatchedRef, "0x3")).to.be.true;
      const shrunkFit = Range3d.createNull();
      linkedBatchedRef.unionFitRange(shrunkFit);
      const expectedShrunkFit = Range3d.createNull();
      linkedRef.linearTransformToParent.multiplyRange(secondModelRange, expectedShrunkFit);
      expect(shrunkFit.isAlmostEqual(expectedShrunkFit)).to.be.true;

      // Unlink and relink the same iModel: the relinked reference reuses the cached tileset spec, views its own set of
      // models, and subsequent mutations refresh the new batched collection.
      view.iModelRefs.unlink(linkedRef);
      linkedRef = view.iModelRefs.link({ iModel: linkedIModel, viewedModels: ["0x3"] });
      const relinkedBatchedRef = await getBatchedRef(linkedRef.tileTreeRefs);
      expect(isModelViewed(relinkedBatchedRef, "0x3")).to.be.true;
      expect(isModelViewed(relinkedBatchedRef, "0x2")).to.be.false;
      linkedRef.viewedModels.add("0x2");
      expect(isModelViewed(relinkedBatchedRef, "0x2")).to.be.true;
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
