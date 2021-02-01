/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid } from "@bentley/bentleyjs-core";
import { Point3d, Range3d, Transform, Vector3d } from "@bentley/geometry-core";
import { Cartographic, ViewFlagOverrides } from "@bentley/imodeljs-common";
import { BlankConnection, IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { SpatialViewState } from "../../SpatialViewState";
import { ScreenViewport, Viewport } from "../../Viewport";
import { MockRender } from "../../render/MockRender";
import { RenderGraphic } from "../../render/RenderGraphic";
import { RenderMemory } from "../../render/RenderMemory";
import {
  Tile, TileContent, TiledGraphicsProvider, TileDrawArgs, TileLoadPriority, TileRequest, TileTree, TileTreeOwner, TileTreeReference, TileTreeSupplier,
} from "../../tile/internal";


class TestGraphic extends RenderGraphic {
  public constructor(private _size: number, private _disposedSize: number) {
    super();
  }

  public dispose() {
    this._size = this._disposedSize;
  }

  public collectStatistics(stats: RenderMemory.Statistics) {
    if (this._size > 0)
      stats.addTexture(this._size);
  }
}

class TestTile extends Tile {
  private readonly _contentSize: number;
  private readonly _disposedSize: number;

  public constructor(tileTree: TileTree, contentSize: number, disposedSize = 0) {
    super({
      contentId: contentSize.toString(),
      range: new Range3d(0, 0, 0, 1, 1, 1),
      maximumSize: 42,
    }, tileTree);

    this._contentSize = contentSize;
    this._disposedSize = disposedSize;

    if (contentSize === 0)
      this.setIsReady();
  }

  protected _loadChildren(resolve: (children: Tile[] | undefined) => void): void {
    resolve(undefined);
  }

  public async requestContent(): Promise<TileRequest.Response> {
    return Promise.resolve("content");
  }

  public async readContent(): Promise<TileContent> {
    return { graphic: new TestGraphic(this._contentSize, this._disposedSize), isLeaf: true };
  }
}

class TestTree extends TileTree {
  private static _nextId = 0;
  public readonly treeId: number;
  public visible = true;
  public readonly contentSize: number;
  private readonly _rootTile: TestTile;

  public constructor(contentSize: number, iModel: IModelConnection, disposedContentSize = 0) {
    super({
      iModel,
      id: (++TestTree._nextId).toString(),
      modelId: "0",
      location: Transform.createIdentity(),
      priority: TileLoadPriority.Primary,
    });

    this.treeId = TestTree._nextId;
    this.contentSize = contentSize;
    this._rootTile = new TestTile(this, contentSize, disposedContentSize);
  }

  public get rootTile(): Tile { return this._rootTile; }
  public get is3d() { return true; }
  public get maxDepth() { return undefined; }
  public get viewFlagOverrides() { return new ViewFlagOverrides(); }
  public get isContentUnbounded() { return false; }

  public _selectTiles(args: TileDrawArgs): Tile[] {
    const tiles = [];
    const tile = this.rootTile;
    if (this.visible) {
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
  public forcePrune() { }
}

class Supplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: TestTree, rhs: TestTree): number {
    return lhs.treeId - rhs.treeId;
  }

  public async createTileTree(tree: TestTree): Promise<TileTree | undefined> {
    return Promise.resolve(tree);
  }
}

const supplier = new Supplier();

class TestRef extends TileTreeReference {
  private readonly _owner: TileTreeOwner;

  public constructor(tree: TestTree) {
    super();
    this._owner = tree.iModel.tiles.getTileTreeOwner(tree, supplier);
  }

  public get treeOwner() { return this._owner; }
  public get castsShadows() { return true; }
}

class Provider implements TiledGraphicsProvider {
  public readonly refs: TileTreeReference[] = [];

  public forEachTileTreeRef(_vp: Viewport, func: (ref: TileTreeReference) => void): void {
    for (const ref of this.refs)
      func(ref);
  }

  public async loadAllTrees(): Promise<void> {
    let allLoaded = true;
    for (const ref of this.refs) {
      if (undefined === ref.treeOwner.load()) {
        allLoaded = false;
        break;
      }
    }

    if (allLoaded)
      return;

  await new Promise<void>((resolve: any) => setTimeout(resolve, 10));
  return this.loadAllTrees();
  }
}

function isLinked(tile: Tile): boolean {
  return undefined !== tile.previous || undefined !== tile.next;
}

describe.only("TileAdmin", () => {
  let imodel: BlankConnection;

  beforeEach(async () => {
    await MockRender.App.startup();
    IModelApp.stopEventLoop();

    const exton = Cartographic.fromDegrees(-75.686694, 40.065757, 0);
    imodel = BlankConnection.create({
      name: "test",
      location: exton,
      extents: new Range3d(-1000, -1000, -100, 1000, 1000, 100),
      contextId: Guid.createValue(),
    });
  });

  afterEach(async () => {
    await imodel.close();
    await MockRender.App.shutdown();
  });

  const viewDiv = document.createElement("div");
  viewDiv.style.width = viewDiv.style.height = "100px";
  document.body.appendChild(viewDiv);

  function createViewport(): Viewport {
    const view = SpatialViewState.createBlank(imodel, new Point3d(), new Vector3d(1, 1, 1));
    return ScreenViewport.create(viewDiv, view);
  }

  async function render(...viewports: Viewport[]): Promise<void> {
    const loadTrees = new Array<Promise<void>>();
    for (const viewport of viewports)
      viewport.forEachTiledGraphicsProvider((p) => loadTrees.push((p as Provider).loadAllTrees()));

    await Promise.all(loadTrees);

    const loadTiles = async (): Promise<void> => {
      for (const viewport of viewports) {
        viewport.invalidateScene();
        viewport.renderFrame();
      }

      IModelApp.tileAdmin.process();

      for (const viewport of viewports) {
        if (viewport.numRequestedTiles > 0) {
          await new Promise<void>((resolve: any) => setTimeout(resolve, 10));
          return loadTiles();
        }
      }
    };

    return loadTiles();
  }

  function expectSelectedTiles(viewport: Viewport, tiles: Tile[]): void {
    const selected = IModelApp.tileAdmin.getTilesForViewport(viewport)?.selected;
    expect(undefined === selected).to.equal(tiles.length === 0);
    if (selected)
      for (const tile of tiles)
        expect(selected.has(tile)).to.be.true;
  }

  it("updates LRU list as tile contents are loaded and unloaded", async () => {
    const trees = [];
    const provider = new Provider();
    for (let i = 0; i < 5; i++) {
      trees[i] = new TestTree(i, imodel);
      provider.refs.push(new TestRef(trees[i]));
    }

    const tiles = trees.map((x) => x.rootTile);
    for (const tile of tiles) {
      expect(tile.isReady).to.equal((tile.tree as TestTree).contentSize === 0);
      expect(tile.hasGraphics).to.be.false;
      expect(isLinked(tile)).to.be.false;
    }

    const viewport = createViewport();
    viewport.addTiledGraphicsProvider(provider);
    await render(viewport);

    expectSelectedTiles(viewport, tiles);
    const admin = IModelApp.tileAdmin;
    expect(admin.totalTileContentBytes).to.equal(1 + 2 + 3 + 4);

    for (let i = 0; i < 5; i++) {
      const tile = tiles[i];
      const expectGraphics = 0 !== i;
      expect(tile.isReady).to.be.true;
      expect(tile.hasGraphics).to.equal(expectGraphics);
      expect(isLinked(tile)).to.equal(expectGraphics);
    }

    trees[1].visible = trees[4].visible = false;
    await render(viewport);

    expectSelectedTiles(viewport, [ tiles[0], tiles[2], tiles[3] ]);
    expect(admin.totalTileContentBytes).to.equal(1 + 2 + 3 + 4);
    admin.freeMemory();
    expect(admin.totalTileContentBytes).to.equal(1 + 2 + 3 + 4);

    admin.maxTotalTileContentBytes = 0;
    admin.freeMemory();
    expect(admin.totalTileContentBytes).to.equal(2 + 3);

    tiles[2].disposeContents();
    expect(isLinked(tiles[2])).to.be.false;
    expect(admin.totalTileContentBytes).to.equal(3);

    trees[3].dispose();
    expect(isLinked(tiles[3])).to.be.false;
    expect(admin.totalTileContentBytes).to.equal(0);
  });
});
