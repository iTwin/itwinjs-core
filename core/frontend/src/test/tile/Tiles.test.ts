/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Range3d, Transform } from "@itwin/core-geometry";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { MockRender } from "../../render/MockRender";
import { RenderGraphic } from "../../render/RenderGraphic";
import { RenderMemory } from "../../render/RenderMemory";
import {
  Tile, TileContent, TileDrawArgs, TileLoadPriority, TileRequest, TileTree,
  TileTreeOwner,
  TileTreeSupplier,
} from "../../tile/internal";
import { createBlankConnection } from "../createBlankConnection";

describe("Tiles", () => {

  class TestGraphic extends RenderGraphic {
    public constructor(private _size: number) {
      super();
    }

    public dispose() {
      this._size = 0;
    }

    public collectStatistics(stats: RenderMemory.Statistics) {
      if (this._size > 0)
        stats.addTexture(this._size);
    }

    public unionRange() { }
  }

  class TestTile extends Tile {
    private readonly _contentSize: number;
    public retainMemory = false;
    public visible = true;

    public constructor(tileTree: TileTree, contentSize: number, retainMemory = false) {
      super({
        contentId: contentSize.toString(),
        range: new Range3d(0, 0, 0, 1, 1, 1),
        maximumSize: 42,
      }, tileTree);

      this._contentSize = contentSize;
      this.retainMemory = retainMemory;

      if (contentSize === 0)
        this.setIsReady();
    }

    protected _loadChildren(resolve: (children: Tile[] | undefined) => void): void {
      resolve(undefined);
    }

    public get channel() {
      return IModelApp.tileAdmin.channels.getForHttp("test-tile");
    }

    public async requestContent(): Promise<TileRequest.Response> {
      return Promise.resolve("content");
    }

    public async readContent(): Promise<TileContent> {
      return { graphic: new TestGraphic(this._contentSize), isLeaf: true };
    }

    public override freeMemory(): void {
      if (!this.retainMemory)
        super.freeMemory();
    }

    public computeBytesUsed(): number {
      const stats = new RenderMemory.Statistics();
      this.collectStatistics(stats);
      return stats.totalBytes;
    }
  }

  class TestTree extends TileTree {
    private static _nextId = 0;
    public readonly treeId: number;
    public readonly contentSize: number;
    private readonly _rootTile: TestTile;

    public constructor(contentSize: number, iModel: IModelConnection, retainMemory = false) {
      super({
        iModel,
        id: (++TestTree._nextId).toString(),
        modelId: "0",
        location: Transform.createIdentity(),
        priority: TileLoadPriority.Primary,
      });

      this.treeId = TestTree._nextId;
      this.contentSize = contentSize;
      this._rootTile = new TestTile(this, contentSize, retainMemory);
    }

    public get rootTile(): TestTile { return this._rootTile; }
    public get is3d() { return true; }
    public get maxDepth() { return undefined; }
    public get viewFlagOverrides() { return { }; }

    protected _selectTiles(args: TileDrawArgs): Tile[] {
      const tiles = [];
      const tile = this.rootTile;
      if (tile.visible) {
        if (tile.isReady)
          tiles.push(tile);
        else
          args.insertMissing(tile);
      }

      return tiles;
    }

    public draw(args: TileDrawArgs) {
      const tiles = this.selectTiles(args);
      for (const tile of tiles)
        tile.drawGraphics(args);

      args.drawGraphics();
    }

    public prune() { }
  }

  const createOnTileTreeLoadPromise: (treeOwner: TileTreeOwner) => Promise<void> =  async (treeOwner: TileTreeOwner)  => {
    return new Promise((resolve) => {
      IModelApp.tileAdmin.onTileTreeLoad.addListener((tileTreeOwner) => {
        if (treeOwner === tileTreeOwner)
          resolve();
      });
    });
  };

  class Supplier implements TileTreeSupplier {
    public compareTileTreeIds(lhs: TestTree, rhs: TestTree): number {
      return lhs.treeId - rhs.treeId;
    }

    public async createTileTree(tree: TestTree): Promise<TileTree | undefined> {
      return Promise.resolve(tree);
    }
  }

  const supplier = new Supplier();

  let imodel: IModelConnection;

  beforeEach(async () => {
    await MockRender.App.startup();
    IModelApp.stopEventLoop();
    imodel = createBlankConnection("imodel");
  });

  afterEach(async () => {
    await imodel.close();
    if (IModelApp.initialized)
      await MockRender.App.shutdown();
  });

  it("resetTileTreeOwner should remove the tiletree", async () => {

    const contentSize = 100;
    const tree1 = new TestTree(contentSize, imodel);
    const tree2 = new TestTree(contentSize, imodel);
    const treeOwner1 = imodel.tiles.getTileTreeOwner(tree1, supplier);
    const treeOwner2 = imodel.tiles.getTileTreeOwner(tree2, supplier);

    // We need to call 'TileTreeOwner.load()' in order check 'isDisposed' later on (i.e only loaded tiletree can be truly disposed)
    // Unfortunately 'TileTreeOwner.load()' doesn't return a promise this test can await.
    // To workaround this, we create our own Promise hooked to the 'onTileTreeLoad' event.
    const promises = [createOnTileTreeLoadPromise(treeOwner1), createOnTileTreeLoadPromise(treeOwner2)];

    treeOwner1.load();
    treeOwner2.load();
    await Promise.all(promises);

    let nbItems = 0;
    for ( const _item of imodel.tiles) {
      nbItems++;
    }
    expect(nbItems).to.equals(2);

    // Make sure the right tree is removed / disposed
    expect(tree1.isDisposed).to.be.false;
    expect(tree2.isDisposed).to.be.false;
    imodel.tiles.resetTileTreeOwner(tree1, supplier);
    expect(tree1.isDisposed).to.be.true;
    expect(tree2.isDisposed).to.be.false;

    nbItems = 0;
    for ( const item of imodel.tiles) {
      expect(item.id.id).to.equals(tree2.id);
      nbItems++;
    }
    expect(nbItems).to.equals(1);

    // Removing an invalid tree should be no-op
    imodel.tiles.resetTileTreeOwner(tree1, supplier);
    expect(nbItems).to.equals(1);
  });
});
