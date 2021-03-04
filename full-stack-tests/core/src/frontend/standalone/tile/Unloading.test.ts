/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BeDuration, BeTimePoint } from "@bentley/bentleyjs-core";
import {
  DisclosedTileTreeSet, IModelApp, IModelConnection, IModelTileTree, SnapshotConnection, Tile, TileLoadStatus,
  TileTree, TileUsageMarker, Viewport,
} from "@bentley/imodeljs-frontend";
import { createOnScreenTestViewport, testOffScreenViewport, testOnScreenViewport, TestViewport, testViewports } from "../../TestViewport";

describe("Tile unloading", async () => {
  let imodel: IModelConnection;
  const expirationSeconds = 0.1;
  const waitSeconds = 4 * expirationSeconds;
  const tileOpts = {
    ignoreMinimumExpirationTimes: true,
    tileExpirationTime: expirationSeconds,
    realityTileExpirationTime: expirationSeconds,
    tileTreeExpirationTime: expirationSeconds,
    disableMagnification: true,
    useProjectExtents: false,
  };

  before(async () => {
    await IModelApp.startup({ tileAdmin: tileOpts });
    imodel = await SnapshotConnection.openFile("CompatibilityTestSeed.bim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await IModelApp.shutdown();
  });

  function getTileTree(vp: Viewport): TileTree {
    const trees = new DisclosedTileTreeSet();
    vp.discloseTileTrees(trees);
    expect(trees.size).to.equal(1);
    let tree: TileTree | undefined;
    for (const t of trees)
      tree = t;

    return tree!;
  }

  async function waitForExpiration(vp: TestViewport): Promise<void> {
    const expiration = BeDuration.fromSeconds(waitSeconds);
    await expiration.wait();
    await vp.drawFrame(); // needed for off-screen viewports which don't participate in render loop
  }

  it("should mark usage", async () => {
    const vp1 = await createOnScreenTestViewport("0x41", imodel, 100, 100);
    const vp2 = await createOnScreenTestViewport("0x41", imodel, 100, 100);

    const now = BeTimePoint.now();
    const later = now.plus(BeDuration.fromSeconds(10));

    const marker = new TileUsageMarker();
    const admin = IModelApp.tileAdmin;
    expect(admin.isTileInUse(marker)).to.be.false;
    expect(marker.isExpired(now)).to.be.false;
    expect(marker.isExpired(later)).to.be.true;

    marker.mark(vp1, now);
    expect(admin.isTileInUse(marker)).to.be.true;
    expect(marker.isExpired(now)).to.be.false;
    expect(marker.isExpired(later)).to.be.false;

    admin.clearUsageForViewport(vp1);
    expect(admin.isTileInUse(marker)).to.be.false;
    expect(marker.isExpired(now)).to.be.false;
    expect(marker.isExpired(later)).to.be.true;

    marker.mark(vp1, now);
    marker.mark(vp2, now);
    expect(admin.isTileInUse(marker)).to.be.true;
    expect(marker.isExpired(now)).to.be.false;
    expect(marker.isExpired(later)).to.be.false;

    admin.clearUsageForViewport(vp1);
    expect(admin.isTileInUse(marker)).to.be.true;
    expect(marker.isExpired(now)).to.be.false;
    expect(marker.isExpired(later)).to.be.false;

    admin.clearUsageForViewport(vp2);
    expect(admin.isTileInUse(marker)).to.be.false;
    expect(marker.isExpired(now)).to.be.false;
    expect(marker.isExpired(later)).to.be.true;

    vp1.dispose();
    vp2.dispose();
  });

  it("should not dispose of displayed tiles", async () => {
    await testViewports("0x41", imodel, 1854, 931, async (vp) => {
      await vp.waitForAllTilesToRender();

      const tree = getTileTree(vp) as IModelTileTree;
      tree.debugMaxDepth = 1;
      expect(tree.isDisposed).to.be.false;

      vp.invalidateScene();
      await vp.waitForAllTilesToRender();

      const expectLoadedChildren = () => {
        let children = tree.rootTile.children!;
        expect(children).not.to.be.undefined;
        expect(children.length).to.equal(1);

        children = children[0].children!;
        expect(children).not.to.be.undefined;
        expect(children.length).to.equal(8);
        for (const child of children)
          expect(child.loadStatus).to.equal(TileLoadStatus.Ready);

        expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.false;
      };

      expectLoadedChildren();

      await waitForExpiration(vp);

      expect(tree.isDisposed).to.be.false;
      expectLoadedChildren();
    });
  });

  // This test sporadically fails on Linux during CI job, with no useful output.
  it.skip("should dispose of undisplayed tiles", async () => {
    await testOnScreenViewport("0x41", imodel, 1854, 931, async (vp) => {
      await vp.waitForAllTilesToRender();

      const tree = getTileTree(vp);
      (tree as IModelTileTree).debugMaxDepth = 1;
      expect(tree.isDisposed).to.be.false;

      vp.invalidateScene();
      await vp.waitForAllTilesToRender();

      expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.false;

      const children = tree.rootTile.children!;
      expect(children).not.to.be.undefined;
      expect(children.length).to.equal(8);
      for (const child of children)
        expect(child.loadStatus).to.equal(TileLoadStatus.Ready);

      vp.scroll({ x: -9999, y: -9999 }, { animateFrustumChange: false });

      await waitForExpiration(vp);

      expect(tree.isDisposed).to.be.false;
      expect(tree.rootTile.children).to.be.undefined;

      for (const child of children)
        expect(child.loadStatus).to.equal(TileLoadStatus.Abandoned);

      expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.true;
    });

    await testOffScreenViewport("0x41", imodel, 1854, 931, async (vp) => {
      await vp.waitForAllTilesToRender();

      const tree = getTileTree(vp);
      (tree as IModelTileTree).debugMaxDepth = 1;
      expect(tree.isDisposed).to.be.false;

      vp.invalidateScene();
      await vp.waitForAllTilesToRender();

      const children = tree.rootTile.children!;
      expect(children).not.to.be.undefined;
      expect(children.length).to.equal(8);
      for (const child of children)
        expect(child.loadStatus).to.equal(TileLoadStatus.Ready);

      expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.false;

      vp.scroll({ x: -9999, y: -9999 }, { animateFrustumChange: false });

      await waitForExpiration(vp);

      expect(tree.isDisposed).to.be.false;
      expect(tree.rootTile.children).to.be.undefined;

      for (const child of children)
        expect(child.loadStatus).to.equal(TileLoadStatus.Abandoned);

      expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.true;
    });
  });

  it("should not dispose of displayed tile trees", async () => {
    await testViewports("0x41", imodel, 1854, 931, async (vp) => {
      await vp.waitForAllTilesToRender();

      const tree = getTileTree(vp);
      expect(tree.isDisposed).to.be.false;

      await waitForExpiration(vp);

      expect(tree.isDisposed).to.be.false;
    });
  });

  it("should dispose of undisplayed tile trees", async () => {
    await testViewports("0x41", imodel, 1854, 931, async (vp) => {
      await vp.waitForAllTilesToRender();

      const tree = getTileTree(vp);
      expect(tree.isDisposed).to.be.false;

      vp.changeViewedModels([]);

      await waitForExpiration(vp);

      expect(tree.isDisposed).to.be.true;
    });
  });

  it("should not dispose of tile trees displayed in second viewport", async () => {
    await testViewports("0x41", imodel, 1854, 931, async (vp1: TestViewport) => {
      // vp1 loads+renders all tiles, then sits idle.
      await vp1.waitForAllTilesToRender();
      const tree = getTileTree(vp1);
      expect(tree.isDisposed).to.be.false;

      // vp2 renders continuously.
      await testOnScreenViewport("0x41", imodel, 1854, 931, async (vp2) => {
        await vp2.waitForAllTilesToRender();

        vp2.changeViewedModels([]);

        await waitForExpiration(vp2);

        // vp2 no longers views this tile tree, but vp1 still does.
        expect(tree.isDisposed).to.be.false;
        expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.false;
      });
    });
  });

  it("should not dispose of tiles displayed in second viewport", async () => {
    await testViewports("0x41", imodel, 1854, 931, async (vp1: TestViewport) => {
      // vp1 loads+renders all tiles, then sits idle.
      await vp1.waitForAllTilesToRender();
      const tree = getTileTree(vp1) as IModelTileTree;
      tree.debugMaxDepth = 1;

      // After changing max depth we must re-select tiles...
      vp1.invalidateScene();
      await vp1.waitForAllTilesToRender();

      // vp2 renders continuously, selecting tiles each frame.
      await testOnScreenViewport("0x41", imodel, 1854, 931, async (vp2) => {
        vp2.onRender.addListener((_) => vp2.invalidateScene());
        await vp2.waitForAllTilesToRender();

        const expectLoadedChildren = () => {
          let children = tree.rootTile.children!;
          expect(children).not.to.be.undefined;
          expect(children.length).to.equal(1);

          children = children[0].children!;
          expect(children).not.to.be.undefined;
          expect(children.length).to.equal(8);
          for (const child of children)
            expect(child.loadStatus).to.equal(TileLoadStatus.Ready);

          expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.false;
        };

        expectLoadedChildren();

        vp2.scroll({ x: -9999, y: -9999 }, { animateFrustumChange: false });

        await waitForExpiration(vp2);

        expectLoadedChildren();
      });
    });
  });

  function collectLoadedParents(tiles: Tile[]): Set<Tile> {
    const parents = new Set<Tile>();
    for (const tile of tiles) {
      let parent = tile.parent;
      while(parent) {
        if (parents.has(parent))
          break;

        if (parent.hasGraphics)
          parents.add(parent);

        parent = parent.parent;
      }
    }

    return parents;
  }

  function getSelectedTiles(vp: Viewport): Tile[] {
    const tiles = IModelApp.tileAdmin.getTilesForViewport(vp)!;
    expect(tiles).not.to.be.undefined;
    return Array.from(tiles.selected);
  }

  it("should not reload parent tile's content if children are selectable", async () => {
    await testOnScreenViewport("0x41", imodel, 1854, 931, async (vp) => {
      await vp.waitForAllTilesToRender();

      const selectedTiles = getSelectedTiles(vp);
      expect(selectedTiles.length).greaterThan(0);

      // Unload content for all parents.
      const parents = collectLoadedParents(selectedTiles);
      expect(parents.size).greaterThan(0);
      for (const parent of parents) {
        expect(parent.isReady).to.be.true;
        parent.disposeContents();
        expect(parent.isReady).to.be.false;
        expect(parent.hasGraphics).to.be.false;
      }

      // Recreate the scene.
      vp.invalidateScene();
      await vp.waitForAllTilesToRender();

      // Confirm we selected same tiles without reloading parent tiles' content.
      const reselectedTiles = getSelectedTiles(vp);
      expect(reselectedTiles.length).to.equal(selectedTiles.length);
      for (let i = 0; i < reselectedTiles.length; i++)
        expect(reselectedTiles[i].contentId).to.equal(selectedTiles[i].contentId);

      for (const parent of parents) {
        expect(parent.hasGraphics).to.be.false;
        expect(parent.isReady).to.be.false;
      }
    });
  });
});
