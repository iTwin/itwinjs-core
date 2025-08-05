/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import sinon from "sinon";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ByteStream, Id64String } from "@itwin/core-bentley";
import { ElementAlignedBox3d, TileFormat } from "@itwin/core-common";
import { Point3d, PolyfaceBuilder, Range3d, StrokeOptions, Transform } from "@itwin/core-geometry";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { MockRender } from "../../internal/render/MockRender";
import { RenderMemory } from "../../render/RenderMemory";
import {
  B3dmReader, BatchedTileIdMap, LayerTileData, RealityTile, RealityTileLoader, RealityTileTree,
  ShouldAbortReadGltf, Tile, TileDrawArgs, TileLoadPriority, TileRequest, TileRequestChannel
} from "../../tile/internal";
import { createBlankConnection } from "../createBlankConnection";
import { RenderSystem } from "../../render/RenderSystem";

describe("RealityTile", () => {
  class TestRealityTile extends RealityTile {
    private readonly _contentSize: number;
    public visible = true;

    public constructor(tileTree: RealityTileTree, contentSize: number, reprojectionTransform?: Transform) {
      super({
        contentId: contentSize.toString(),
        range: new Range3d(0, 0, 0, 1, 1, 1),
        maximumSize: 42,
      }, tileTree);

      this._contentSize = contentSize;

      if (contentSize === 0)
        this.setIsReady();

      this._reprojectionTransform = reprojectionTransform;
    }

    protected override _loadChildren(resolve: (children: Tile[] | undefined) => void): void {
      resolve(undefined);
    }

    public override get channel() {
      return IModelApp.tileAdmin.channels.getForHttp("test-tile");
    }

    public override async requestContent(): Promise<TileRequest.Response> {
      return Promise.resolve("root tile content");
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

    public async requestTileContent(_tile: TestRealityTile, _isCanceled: () => boolean): Promise<TileRequest.Response> {
      if (_isCanceled())
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

    public constructor(contentSize: number, iModel: IModelConnection, loader: TestRealityTileLoader, reprojectGeometry: boolean, reprojectionTransform?: Transform) {
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
        reprojectGeometry
      });

      this.treeId = TestRealityTree._nextId;
      this.contentSize = contentSize;
      this._rootTile = new TestRealityTile(this, contentSize, reprojectionTransform);
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

  function expectPointToEqual(point: Point3d, x: number, y: number, z: number) {
    expect(point.x).to.equal(x);
    expect(point.y).to.equal(y);
    expect(point.z).to.equal(z);
  }

  let imodel: IModelConnection;
  let reader: TestRealityTileLoader;
  let transform: Transform;
  let streamBuffer: ByteStream;
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    await MockRender.App.startup();
    IModelApp.stopEventLoop();
    imodel = createBlankConnection("imodel");
    reader = new TestRealityTileLoader();
    transform = Transform.createTranslationXYZ(5, 5, 5);

    // Create a ByteStream with B3dm format header
    const buffer = new Uint8Array(16);
    const view = new DataView(buffer.buffer);
    view.setUint32(0, TileFormat.B3dm, true);
    streamBuffer = ByteStream.fromUint8Array(buffer);

    // Create mock geometry data with a simple polyface
    const options = StrokeOptions.createForFacets();
    const polyBuilder = PolyfaceBuilder.create(options);
    polyBuilder.addPolygon([
      Point3d.create(0, 0, 0),
      Point3d.create(1, 0, 0),
      Point3d.create(1, 1, 0)
    ]);
    const originalPolyface = polyBuilder.claimPolyface();
    const mockGeometry = { polyfaces: [originalPolyface] };

    // Mock B3dmReader.create to return a reader with test geometry
    const mockReader = {
      defaultWrapMode: undefined,
      readGltfAndCreateGeometry(this: void) { return mockGeometry; }
    } as any as B3dmReader;

    sandbox.stub(B3dmReader, "create").callsFake((_stream: ByteStream, _iModel: IModelConnection, _modelId: Id64String, _is3d: boolean,
      _range: ElementAlignedBox3d, _system: RenderSystem, _yAxisUp: boolean, _isLeaf: boolean, _tileCenter: Point3d, _transformToRoot?: Transform,
      _isCanceled?: ShouldAbortReadGltf, _idMap?: BatchedTileIdMap, _deduplicateVertices=false, _tileData?: LayerTileData) => {
      return mockReader;
    });
  });

  afterEach(async () => {
    await imodel.close();
    if (IModelApp.initialized)
      await MockRender.App.shutdown();

    sandbox.restore();
  });

  it("should apply reprojection transform to geometry in loadGeometryFromStream", async () => {
    // Create a test tree with reprojectGeometry = true
    const tree = new TestRealityTree(0, imodel, reader, true, transform);
    const tile = tree.rootTile;
    const result = await reader.loadGeometryFromStream(tile, streamBuffer, IModelApp.renderSystem);

    expect(result.geometry).to.not.be.undefined;
    expect(result.geometry?.polyfaces).to.have.length(1);

    if (result.geometry?.polyfaces) {
      const polyface = result.geometry.polyfaces[0];
      const points = polyface.data.point.getPoint3dArray();

      // Check that the points have been reprojected
      expectPointToEqual(points[0], 5, 5, 5);
      expectPointToEqual(points[1], 6, 5, 5);
      expectPointToEqual(points[2], 6, 6, 5);
    }
  });

  it("should not apply reprojection transform when reprojectGeometry is false", async () => {
    // Create a test tree with reprojectGeometry = false
    const tree = new TestRealityTree(0, imodel, reader, false, transform);
    const tile = tree.rootTile;
    const result = await reader.loadGeometryFromStream(tile, streamBuffer, IModelApp.renderSystem);

    expect(result.geometry).to.not.be.undefined;
    expect(result.geometry?.polyfaces).to.have.length(1);

    if (result.geometry?.polyfaces) {
      const polyface = result.geometry.polyfaces[0];
      const points = polyface.data.point.getPoint3dArray();

      // Check that the points have not been reprojected
      expectPointToEqual(points[0], 0, 0, 0);
      expectPointToEqual(points[1], 1, 0, 0);
      expectPointToEqual(points[2], 1, 1, 0);
    }
  });

  it("should not apply reprojection transform when no transform is present", async () => {
    // Create a test tree with reprojectGeometry = true but no reprojection transform
    const tree = new TestRealityTree(0, imodel, reader, true, undefined);
    const tile = tree.rootTile;
    const result = await reader.loadGeometryFromStream(tile, streamBuffer, IModelApp.renderSystem);

    expect(result.geometry).to.not.be.undefined;
    expect(result.geometry?.polyfaces).to.have.length(1);

    if (result.geometry?.polyfaces) {
      const polyface = result.geometry.polyfaces[0];
      const points = polyface.data.point.getPoint3dArray();

      // Check that the points have not been reprojected
      expectPointToEqual(points[0], 0, 0, 0);
      expectPointToEqual(points[1], 1, 0, 0);
      expectPointToEqual(points[2], 1, 1, 0);
    }
  });

  it("should not apply reprojection transform twice", async () => {
    // Create a test tree with reprojectGeometry = true
    const tree = new TestRealityTree(0, imodel, reader, true, transform);
    const tile = tree.rootTile;

    // Loop to call loadGeometryFromStream twice
    for (let i = 0; i < 2; i++) {
      const result = await reader.loadGeometryFromStream(tile, streamBuffer, IModelApp.renderSystem);

      expect(result.geometry).to.not.be.undefined;
      expect(result.geometry?.polyfaces).to.have.length(1);

      if (result.geometry?.polyfaces) {
        const polyface = result.geometry.polyfaces[0];
        const points = polyface.data.point.getPoint3dArray();

        // Check that the points have been reprojected only once
        expectPointToEqual(points[0], 5, 5, 5);
        expectPointToEqual(points[1], 6, 5, 5);
        expectPointToEqual(points[2], 6, 6, 5);
      }
    }
  });
});