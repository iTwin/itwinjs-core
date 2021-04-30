/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ByteStream } from "@bentley/bentleyjs-core";
import { Range3d, Range3dProps } from "@bentley/geometry-core";
import {
  BatchType, computeChildTileProps, computeTileChordTolerance, ContentIdProvider, defaultTileOptions, ImdlHeader, IModelTileRpcInterface, iModelTileTreeIdToString,
  TileMetadata, TileProps, TileTreeMetadata,
} from "@bentley/imodeljs-common";
import {
  GeometricModelState, IModelApp, IModelConnection, IModelTile, IModelTileTree, SnapshotConnection, Tile, TileTreeLoadStatus,
} from "@bentley/imodeljs-frontend";
import { fakeViewState } from "./TileIO.test";

describe("Tile tolerance", () => {
  let imodel: IModelConnection;
  const minimumSpatialTolerance = 0.02;
  const modelId = "0x1c";
  const treeId = iModelTileTreeIdToString(modelId, { type: BatchType.Primary, edgesRequired: false }, defaultTileOptions);

  before(async () => {
    await IModelApp.startup({ tileAdmin: { minimumSpatialTolerance } });
    imodel = await SnapshotConnection.openFile("CompatibilityTestSeed.bim");
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await IModelApp.shutdown();
  });

  function makeTile(props: TileProps): TileMetadata {
    const range = new Range3d();
    range.setFromJSON(props.range);
    return {
      ...props,
      isLeaf: true === props.isLeaf,
      range,
      contentRange: range,
      emptySubRangeMask: 0,
    };
  }

  function computeTolerance(rangeProps: Range3dProps, sizeMultiplier?: number): number {
    const range = new Range3d();
    range.setFromJSON(rangeProps);
    return computeTileChordTolerance({
      contentRange: range,
      isLeaf: false,
      sizeMultiplier,
      emptySubRangeMask: 0,
      contentId: "",
      range,
    }, true);
  }

  async function expectTolerance(contentId: string, expectedTolerance: number, epsilon = 0.000001): Promise<void> {
    const content = await IModelTileRpcInterface.getClient().generateTileContent(imodel.getRpcProps(), treeId, contentId, undefined);
    const stream = new ByteStream(content.buffer);
    const header = new ImdlHeader(stream);
    expect(header.isValid).to.be.true;
    expect(header.isReadableVersion).to.be.true;

    expect(Math.abs(expectedTolerance - header.tolerance)).most(epsilon);
  }

  it("should match between frontend and backend", async () => {
    const treeProps = await IModelApp.tileAdmin.requestTileTreeProps(imodel, treeId);
    const tree: TileTreeMetadata = { ...treeProps, modelId, is2d: false, contentRange: undefined };

    // treeProps.rootTile.contentId is a lie...must be computed on front-end.
    const contentIdProvider = ContentIdProvider.create(true, defaultTileOptions);
    const rootTile = makeTile({ ...treeProps.rootTile, contentId: contentIdProvider.rootContentId });
    expect(rootTile.sizeMultiplier).to.be.undefined;
    await expectTolerance(rootTile.contentId, computeTolerance(rootTile.range));

    const kidsProps = computeChildTileProps(rootTile, contentIdProvider, tree);
    expect(kidsProps.numEmpty).to.equal(0);
    expect(kidsProps.children.length).to.equal(8);

    // Sub-division.
    for (const kidProp of kidsProps.children) {
      const kid = makeTile(kidProp);
      const kidTolerance = computeTolerance(kid.range);
      expect(kid.sizeMultiplier).to.be.undefined;
      await expectTolerance(kid.contentId, kidTolerance);

      // Sub-division.
      const grandkids = computeChildTileProps(kid, contentIdProvider, tree);
      for (const grandkidProp of grandkids.children) {
        const grandkid = makeTile(grandkidProp);
        expect(grandkid.sizeMultiplier).to.be.undefined;
        await expectTolerance(grandkid.contentId, computeTolerance(grandkid.range));
      }

      // Refinement.
      let parent: TileMetadata = { ...kid, sizeMultiplier: 1 };
      const parentTolerance = computeTolerance(parent.range, parent.sizeMultiplier);
      expect(parentTolerance).to.equal(kidTolerance);

      for (let i = 0; i < 3; i++) {
        const props = computeChildTileProps(parent, contentIdProvider, tree);
        expect(props.children.length).to.equal(1);
        const child = makeTile(props.children[0]);
        expect(child.sizeMultiplier).to.equal(parent.sizeMultiplier! * 2);
        await expectTolerance(child.contentId, parentTolerance / child.sizeMultiplier!);
        parent = child;
      }
    }
  });

  it("should enforce minimum spatial tolerance for tile refinement", async () => {
    await imodel.models.load(modelId);
    const model = imodel.models.getLoaded(modelId) as GeometricModelState;
    expect(model).not.to.be.undefined;
    expect(model).instanceof(GeometricModelState);

    const view = fakeViewState(imodel);
    const treeRef = model.createTileTreeReference(view);
    const tree = (await treeRef.treeOwner.loadTree())!;
    expect(tree).not.to.be.undefined;

    // We know the tolerance we expect for the root tile...
    const knownRootTolerance = 0.14354; // approximate.
    const rootTile = (tree as IModelTileTree).staticBranch;
    const rootTolerance = computeTileChordTolerance(rootTile, true);
    expect(rootTolerance).least(knownRootTolerance);
    expect(rootTolerance).most(knownRootTolerance + 0.00001);
    await expectTolerance(rootTile.contentId, knownRootTolerance, 0.0001);

    // The root tile refines by magnification, not sub-division. Tolerance halves each time. Expect sub-division to cease when tolerance < minimum spatial tolerance.
    // root: 0.14354 => 0.07177 => 0.03588 => 0.01794
    const getChild = (parent: Tile) => {
      // iModel tiles load their children synchronously.
      const status = (parent as any).loadChildren(); // protected method.
      expect(status).to.equal(TileTreeLoadStatus.Loaded); // yes, "loaded", even if no children exist.
      if (parent.isLeaf) {
        expect(parent.children).to.be.undefined;
        return undefined;
      } else {
        expect(parent.children).not.to.be.undefined;
        expect(parent.children!.length).to.equal(1);
        return parent.children![0] as IModelTile;
      }
    };

    let tile = rootTile;
    let depth = 0;
    while (!tile.isLeaf) {
      ++depth;
      tile = getChild(tile)!;
      expect(tile).not.to.be.undefined;
      const tolerance = computeTileChordTolerance(tile, true);
      if (tile.isLeaf)
        expect(tolerance).most(minimumSpatialTolerance);
      else
        expect(tolerance).least(minimumSpatialTolerance);
    }

    expect(getChild(tile)).to.be.undefined;
    expect(depth).to.equal(3);
  });
});
