/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BeDuration, BeEvent } from "@itwin/core-bentley";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { IModelConnection } from "../../IModelConnection";
import { SpatialViewState } from "../../SpatialViewState";
import { ScreenViewport, Viewport } from "../../Viewport";
import { IModelApp } from "../../IModelApp";
import { Tile, TileContent, TiledGraphicsProvider, TileLoadPriority, TileRequest, TileTree, TileTreeOwner, TileTreeReference, TileTreeSupplier } from "../../tile/internal";
import { createBlankConnection } from "../createBlankConnection";
import { EmptyLocalization } from "@itwin/core-common";

class TestTile extends Tile {
  public constructor(tree: TileTree) {
    super(
      {
        contentId: "test",
        range: new Range3d(0, 0, 0, 1, 1, 1),
        maximumSize: 5,
      },
      tree,
    );
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
    return {};
  }
}

class TestTree extends TileTree {
  private readonly _rootTile: TestTile;
  public readonly onReady = new BeEvent<() => void>();

  public constructor(iModel: IModelConnection) {
    super({
      iModel,
      id: "test",
      modelId: "0",
      location: Transform.createIdentity(),
      priority: TileLoadPriority.Primary,
    });

    this._rootTile = new TestTile(this);
  }

  public async setReady(): Promise<void> {
    this.onReady.raiseEvent();
    return BeDuration.wait(1);
  }

  public get rootTile(): TestTile {
    return this._rootTile;
  }
  public get is3d() {
    return true;
  }
  public get maxDepth() {
    return undefined;
  }
  public get viewFlagOverrides() {
    return {};
  }

  protected _selectTiles(): Tile[] {
    return [this.rootTile];
  }

  public draw() {}
  public prune() {}
}

class TestSupplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: TestTree, rhs: TestTree) {
    expect(lhs).toEqual(rhs);
    return 0;
  }

  public async createTileTree(tree: TestTree): Promise<TileTree | undefined> {
    return new Promise((resolve) => {
      tree.onReady.addOnce(() => resolve(tree));
    });
  }
}

class TestRef extends TileTreeReference {
  private readonly _owner: TileTreeOwner;
  public loadingComplete = false;
  public extents?: Range3d;

  public constructor(tree: TestTree) {
    super();
    const supplier = new TestSupplier();
    this._owner = tree.iModel.tiles.getTileTreeOwner(tree, supplier);
    this._owner.load();
  }

  public get treeOwner() {
    return this._owner;
  }

  protected override get _isLoadingComplete(): boolean {
    return this.loadingComplete;
  }

  public override unionFitRange(range: Range3d): void {
    if (this.extents) {
      range.extendRange(this.extents);
    }
  }
}

class TestProvider implements TiledGraphicsProvider {
  public readonly refs: TestRef[] = [];
  public isLoadingComplete?: (viewport: Viewport) => boolean;

  public constructor(ref?: TestRef) {
    if (ref)
      this.refs.push(ref);
  }

  public forEachTileTreeRef(_viewport: Viewport, func: (ref: TileTreeReference) => void) {
    for (const ref of this.refs)
      func(ref);
  }

  public set loadingComplete(loadingComplete: boolean | undefined) {
    if (undefined === loadingComplete)
      this.isLoadingComplete = undefined;
    else
      this.isLoadingComplete = () => loadingComplete;
  }
}

describe("TiledGraphicsProvider", () => {
  let imodel: IModelConnection;
  let viewport: ScreenViewport;
  let viewDiv: HTMLDivElement;

  beforeAll(async () => {
    viewDiv = document.createElement("div");
    viewDiv.style.width = viewDiv.style.height = "100px";
    document.body.appendChild(viewDiv);

    await IModelApp.startup({ localization: new EmptyLocalization() });
    imodel = createBlankConnection();
  });

  beforeEach(() => {
    const view = SpatialViewState.createBlank(imodel, new Point3d(0, 0, 0), new Point3d(1, 1, 1));
    viewport = ScreenViewport.create(viewDiv, view);
  });

  afterEach(() => {
    viewport.dispose();
  });

  afterAll(async () => {
    await imodel.close();
    await IModelApp.shutdown();
    document.body.removeChild(viewDiv);
  });

  it("reports when tile trees are loaded", async () => {
    expect(viewport.areAllTileTreesLoaded).toBe(true);

    const provider = new TestProvider();
    viewport.addTiledGraphicsProvider(provider);
    expect(viewport.areAllTileTreesLoaded).toBe(true);

    const tree = new TestTree(imodel);
    const ref = new TestRef(tree);
    provider.refs.push(ref);
    expect(viewport.areAllTileTreesLoaded).toBe(false);

    expect(ref.treeOwner.tileTree).toBeUndefined();
    await tree.setReady();
    expect(ref.treeOwner.tileTree).toBeDefined();
    expect(viewport.areAllTileTreesLoaded).toBe(false);

    ref.loadingComplete = true;
    expect(viewport.areAllTileTreesLoaded).toBe(true);

    provider.loadingComplete = false;
    expect(viewport.areAllTileTreesLoaded).toBe(false);

    provider.loadingComplete = true;
    expect(viewport.areAllTileTreesLoaded).toBe(true);

    const tree2 = new TestTree(imodel);
    const ref2 = new TestRef(tree2);
    await tree2.setReady();
    const provider2 = new TestProvider(ref2);
    viewport.addTiledGraphicsProvider(provider2);
    expect(viewport.areAllTileTreesLoaded).toBe(false);

    ref2.loadingComplete = true;
    expect(viewport.areAllTileTreesLoaded).toBe(true);
  });

  it("is included in ViewingSpace extents", async () => {
    function expectExtents(expected: Range3d): void {
      const actual = viewport.viewingSpace.getViewedExtents();

      expect(Math.round(actual.low.x)).toEqual(Math.round(expected.low.x));
      expect(Math.round(actual.low.y)).toEqual(Math.round(expected.low.y));
      expect(Math.round(actual.low.y)).toEqual(Math.round(expected.low.y));
      expect(Math.round(actual.high.x)).toEqual(Math.round(expected.high.x));
      expect(Math.round(actual.high.y)).toEqual(Math.round(expected.high.y));
      expect(Math.round(actual.high.y)).toEqual(Math.round(expected.high.y));
    }

    const projExtents = viewport.iModel.projectExtents;
    expectExtents(projExtents);

    const provider = new TestProvider();
    viewport.addTiledGraphicsProvider(provider);
    expectExtents(projExtents);

    const tree = new TestTree(imodel);
    const ref = new TestRef(tree);
    provider.refs.push(ref);
    expect(viewport.areAllTileTreesLoaded).toBe(false);
    expectExtents(projExtents);

    await tree.setReady();
    ref.loadingComplete = true;
    expect(viewport.areAllTileTreesLoaded).toBe(true);
    expectExtents(projExtents);

    ref.extents = projExtents.clone();
    ref.extents.scaleAboutCenterInPlace(0.5);
    expectExtents(projExtents);

    ref.extents = projExtents.clone();
    ref.extents.scaleAboutCenterInPlace(2.0);
    expectExtents(ref.extents);

    ref.extents = new Range3d(projExtents.low.x - 10, projExtents.low.y + 20, projExtents.low.z, projExtents.high.x + 30, projExtents.high.y - 40, projExtents.high.z * 50);

    expectExtents(new Range3d(projExtents.low.x - 10, projExtents.low.y, projExtents.low.z, projExtents.high.x + 30, projExtents.high.y, projExtents.high.z * 50));
  });
});
