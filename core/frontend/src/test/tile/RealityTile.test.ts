/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Range3d, Transform } from "@itwin/core-geometry";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { MockRender } from "../../internal/render/MockRender";
import { RenderGraphic } from "../../render/RenderGraphic";
import { RenderMemory } from "../../render/RenderMemory";
import {
  RealityTile, RealityTileLoader, RealityTileTree, Tile, TileContent, TileDrawArgs, TileGeometryCollector, TileLoadPriority,
  TileRequest,
  TileRequestChannel,
  TileTree,
  TileTreeOwner,
  TileTreeSupplier,
  TileUser
} from "../../tile/internal";
import { createBlankConnection } from "../createBlankConnection";

describe("RealityTile", () => {

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

  class TestRealityTile extends RealityTile {
    private readonly _contentSize: number;
    public retainMemory = false;
    public visible = true;

    public constructor(tileTree: RealityTileTree, contentSize: number, retainMemory = false) {
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

    protected override _loadChildren(resolve: (children: Tile[] | undefined) => void): void {
      resolve(undefined);
    }

    public override get channel() {
      return IModelApp.tileAdmin.channels.getForHttp("test-tile");
    }

    public override async requestContent(): Promise<TileRequest.Response> {
      return Promise.resolve("content");
    }

    public override async readContent(): Promise<TileContent> {
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

  class TestRealityTileLoader extends RealityTileLoader {
    public get priority(): TileLoadPriority { return TileLoadPriority.Primary; }
    public get clipLowResolutionTiles(): boolean { return true; }
    protected _applyLights = false;

    public constructor() {
      super();
    }

    public get maxDepth(): number { return 1; }
    public get minDepth(): number { return 0; }

    public isTileAvailable(_tile: RealityTile): boolean {
      return true; // For testing, assume all tiles are available
    }

    public async requestTileContent(_tile: RealityTile, isCanceled: () => boolean): Promise<TileRequest.Response> {
      if (isCanceled())
        return undefined;
      return Promise.resolve("content");
    }

    public override async loadChildren(_tile: RealityTile): Promise<Tile[] | undefined> {
      return new Promise((resolve) => {
        // Simulate loading children by resolving with an empty array
        resolve([]);
      });
    }

    public override getRequestChannel(_tile: Tile): TileRequestChannel {
      // For testing, return a channel that does not require any special handling
      return IModelApp.tileAdmin.channels.getForHttp("test-tile");
    }
  }

  class TestRealityTree extends RealityTileTree {
    private static _nextId = 0;
    public readonly treeId: number;
    public readonly contentSize: number;
    protected override readonly _rootTile: TestRealityTile;

    public constructor(contentSize: number, iModel: IModelConnection, loader: TestRealityTileLoader, retainMemory = false) {
      super({
        loader,
        rootTile: {
          contentId: contentSize.toString(),
          range: new Range3d(0, 0, 0, 1, 1, 1),
          maximumSize: 42,
        },
        id: (++TestRealityTree._nextId).toString(),
        modelId: "0",
        location: Transform.createIdentity(),
        priority: TileLoadPriority.Primary,
        iModel,
        gcsConverterAvailable: false,
      });

      this.treeId = TestRealityTree._nextId;
      this.contentSize = contentSize;
      this._rootTile = new TestRealityTile(this, contentSize, retainMemory);
    }

    public override get rootTile(): TestRealityTile { return this._rootTile; }
    public override get is3d() { return true; }
    public override get maxDepth() { return 1; }
    public override get viewFlagOverrides() { return { }; }

    protected override _selectTiles(args: TileDrawArgs): Tile[] {
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

    public override draw(args: TileDrawArgs) {
      const tiles = this.selectTiles(args);
      for (const tile of tiles)
        tile.drawGraphics(args);

      args.drawGraphics();
    }

    public override prune() { }
  }

  const createOnTileTreeLoadPromise: (treeOwner: TileTreeOwner) => Promise<void> = async (treeOwner: TileTreeOwner) => {
    return new Promise((resolve) => {
      IModelApp.tileAdmin.onTileTreeLoad.addListener((tileTreeOwner) => {
        if (treeOwner === tileTreeOwner)
          resolve();
      });
    });
  };

  class Supplier implements TileTreeSupplier {
    public compareTileTreeIds(lhs: TestRealityTree, rhs: TestRealityTree): number {
      return lhs.treeId - rhs.treeId;
    }

    public async createTileTree(tree: TestRealityTree): Promise<TileTree | undefined> {
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

  it("Test", async () => {
    const reader = new TestRealityTileLoader();
    const contentSize = 100;
    const tree1 = new TestRealityTree(contentSize, imodel, reader);
    const treeOwner1 = imodel.tiles.getTileTreeOwner(tree1, supplier);

    const collector = new TileGeometryCollector({
      chordTolerance: 0.1,
      range: new Range3d(0, 0, 0, 1, 1, 1),
      user: {
        tileUserId: TileUser.generateId(),
        iModel: imodel,
        discloseTileTrees: () => {
          return undefined;
        },
      },
      reprojectGeometry: true,
    });

    // We need to call 'TileTreeOwner.load()' in order check 'isDisposed' later on (i.e only loaded tiletree can be truly disposed)
    // Unfortunately 'TileTreeOwner.load()' doesn't return a promise this test can await.
    // To workaround this, we create our own Promise hooked to the 'onTileTreeLoad' event.
    const promises = [createOnTileTreeLoadPromise(treeOwner1)];

    treeOwner1.load();
    await Promise.all(promises);

    tree1.collectTileGeometry(collector);
    console.log("collector", collector);

    let nbItems = 0;
    for ( const _item of imodel.tiles) {
      // console.log("item", _item);
      nbItems++;
    }
    expect(nbItems).toEqual(1);
  });
});