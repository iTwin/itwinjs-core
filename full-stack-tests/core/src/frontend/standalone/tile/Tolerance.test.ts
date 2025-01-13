/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ByteStream } from "@itwin/core-bentley";
import {
  BatchType, computeChildTileProps, computeTileChordTolerance, ContentIdProvider, defaultTileOptions, ImdlHeader, iModelTileTreeIdToString,
  TileMetadata, TileProps, TileTreeMetadata,
} from "@itwin/core-common";
import {
  GeometricModelState, IModelApp, IModelConnection, IModelTile, IModelTileTree, Tile, TileTreeLoadStatus,
} from "@itwin/core-frontend";
import { Range3d, Range3dProps } from "@itwin/core-geometry";
import { TestUtility } from "../../TestUtility";
import { fakeViewState } from "./TileIO.test";
import { TestSnapshotConnection } from "../../TestSnapshotConnection";

describe("Tile tolerance", () => {
  let imodel: IModelConnection;
  const minimumSpatialTolerance = 0.02;
  const modelId = "0x1c";
  const treeId = iModelTileTreeIdToString(modelId, { type: BatchType.Primary, edges: false }, { ...defaultTileOptions, expandProjectExtents: false, useLargerTiles: false });

  before(async () => {
    await TestUtility.startFrontend({ tileAdmin: { expandProjectExtents: false, minimumSpatialTolerance, useLargerTiles: false } });
    imodel = await TestSnapshotConnection.openFile("CompatibilityTestSeed.bim");
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
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

  function computeTolerance(rangeProps: Range3dProps, arg: { tileScreenSize: number }, sizeMultiplier?: number ): number {
    const range = new Range3d();
    range.setFromJSON(rangeProps);
    return computeTileChordTolerance({
      contentRange: range,
      isLeaf: false,
      sizeMultiplier,
      emptySubRangeMask: 0,
      contentId: "",
      range,
    }, true, arg.tileScreenSize);
  }

  async function expectTolerance(contentId: string, expectedTolerance: number, epsilon = 0.000001): Promise<void> {
    const tile = {
      iModelTree: {
        iModel: imodel,
        geometryGuid: undefined,
        contentIdQualifier: undefined,
        id: treeId,
      },
      contentId,
    } as IModelTile;
    const stream = ByteStream.fromUint8Array(await IModelApp.tileAdmin.generateTileContent(tile));
    const header = new ImdlHeader(stream);
    expect(header.isValid).to.be.true;
    expect(header.isReadableVersion).to.be.true;

    expect(Math.abs(expectedTolerance - header.tolerance)).most(epsilon);
  }

  it("should match between frontend and backend", async () => {
    const treeProps = await IModelApp.tileAdmin.requestTileTreeProps(imodel, treeId);
    const tree: TileTreeMetadata = { ...treeProps, modelId, is2d: false, contentRange: undefined, tileScreenSize: treeProps.tileScreenSize ?? 512 };

    // treeProps.rootTile.contentId is a lie...must be computed on front-end.
    const contentIdProvider = ContentIdProvider.create(true, defaultTileOptions);
    const rootTile = makeTile({ ...treeProps.rootTile, contentId: contentIdProvider.rootContentId });
    expect(rootTile.sizeMultiplier).to.be.undefined;
    await expectTolerance(rootTile.contentId, computeTolerance(rootTile.range, tree));

    const kidsProps = computeChildTileProps(rootTile, contentIdProvider, tree);
    expect(kidsProps.numEmpty).to.equal(0);
    expect(kidsProps.children.length).to.equal(8);

    // Sub-division.
    for (const kidProp of kidsProps.children) {
      const kid = makeTile(kidProp);
      const kidTolerance = computeTolerance(kid.range, tree);
      expect(kid.sizeMultiplier).to.be.undefined;
      await expectTolerance(kid.contentId, kidTolerance);

      // Sub-division.
      const grandkids = computeChildTileProps(kid, contentIdProvider, tree);
      for (const grandkidProp of grandkids.children) {
        const grandkid = makeTile(grandkidProp);
        expect(grandkid.sizeMultiplier).to.be.undefined;
        await expectTolerance(grandkid.contentId, computeTolerance(grandkid.range, tree));
      }

      // Refinement.
      let parent: TileMetadata = { ...kid, sizeMultiplier: 1 };
      const parentTolerance = computeTolerance(parent.range, tree, parent.sizeMultiplier);
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
    const iModelTree = tree as IModelTileTree;
    const rootTile = iModelTree.staticBranch;
    expect(iModelTree.tileScreenSize).to.equal(512);
    const rootTolerance = computeTileChordTolerance(rootTile, true, iModelTree.tileScreenSize);
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
      const tolerance = computeTileChordTolerance(tile, true, iModelTree.tileScreenSize);
      if (tile.isLeaf)
        expect(tolerance).most(minimumSpatialTolerance);
      else
        expect(tolerance).least(minimumSpatialTolerance);
    }

    expect(getChild(tile)).to.be.undefined;
    expect(depth).to.equal(3);
  });
});
