/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ByteStream } from "@itwin/core-bentley";
import { TileFormat } from "@itwin/core-common";
import { Point3d, PolyfaceBuilder, Range3d, StrokeOptions, Transform } from "@itwin/core-geometry";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { MockRender } from "../../internal/render/MockRender";
import { RenderMemory } from "../../render/RenderMemory";
import {
  RealityTile, RealityTileLoader, RealityTileTree, Tile, TileDrawArgs, TileLoadPriority,
  TileRequest, TileRequestChannel
} from "../../tile/internal";
import { createBlankConnection } from "../createBlankConnection";

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

      // const options = StrokeOptions.createForFacets();
      // const polyBuilder = PolyfaceBuilder.create(options);
      // polyBuilder.addPolygon([
      //   Point3d.create(0, 0, 0),
      //   Point3d.create(1, 0, 0),
      //   Point3d.create(1, 1, 0)
      // ]);

      // this._geometry = { polyfaces: [polyBuilder.claimPolyface()] };
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

  let imodel: IModelConnection;
  let reader: TestRealityTileLoader;
  let transform: Transform;

  beforeEach(async () => {
    await MockRender.App.startup();
    IModelApp.stopEventLoop();
    imodel = createBlankConnection("imodel");
    reader = new TestRealityTileLoader();
    transform = Transform.createTranslationXYZ(5, 5, 5);
  });

  afterEach(async () => {
    await imodel.close();
    if (IModelApp.initialized)
      await MockRender.App.shutdown();
  });

  it.only("should apply reprojection transform to geometry in loadGeometryFromStream", async () => {
    // Create a test tree with reprojection enabled
    const tree = new TestRealityTree(0, imodel, reader, true, transform);
    const tile = tree.rootTile;

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

    // Mock B3dmReader.create to return a reader with mocked readGltfAndCreateGeometry
    const mockReader = {
      defaultWrapMode: undefined,
      readGltfAndCreateGeometry: () => mockGeometry
    };

    // Mock B3dmReader.create
    const b3dmReader = await import("../../internal/tile/B3dmReader");
    const originalB3dmCreate = b3dmReader.B3dmReader.create;
    const mockCreate = () => mockReader;
    Object.defineProperty(b3dmReader.B3dmReader, 'create', { value: mockCreate, writable: true, configurable: true });

    try {
      // Create a ByteStream with B3dm format header
      const buffer = new Uint8Array(16);
      const view = new DataView(buffer.buffer);
      view.setUint32(0, TileFormat.B3dm, true);
      const streamBuffer = ByteStream.fromUint8Array(buffer);

      // Call the actual loadGeometryFromStream method from RealityTileLoader
      const result = await reader.loadGeometryFromStream(tile, streamBuffer, IModelApp.renderSystem);

      // Verify that geometry was returned
      expect(result.geometry).to.not.be.undefined;
      expect(result.geometry?.polyfaces).to.have.length(1);

      // Verify that the reprojection transform was applied
      if (result.geometry?.polyfaces) {
        const transformedPolyface = result.geometry.polyfaces[0];
        const transformedPoints = transformedPolyface.data.point.getPoint3dArray();

        // Check that the points have been transformed by the reprojection transform
        expect(transformedPoints[0].isExactEqual(Point3d.create(5, 5, 5))).to.be.true;
        expect(transformedPoints[1].isExactEqual(Point3d.create(6, 5, 5))).to.be.true;
        expect(transformedPoints[2].isExactEqual(Point3d.create(6, 6, 5))).to.be.true;
      }
    } finally {
      // Restore original B3dmReader.create
      if (originalB3dmCreate) {
        Object.defineProperty(b3dmReader.B3dmReader, 'create', { value: originalB3dmCreate, writable: true, configurable: true });
      }
    }
  });

  it("should not apply reprojection transform when reprojectGeometry is false", async () => {
    // Create a test tree with reprojection disabled
    const tree = new TestRealityTree(0, imodel, reader, false, transform);
    const tile = tree.rootTile;

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

    // Mock B3dmReader.create to return a reader with mocked readGltfAndCreateGeometry
    const mockReader = {
      defaultWrapMode: undefined,
      readGltfAndCreateGeometry: () => mockGeometry
    };    // Mock B3dmReader.create
    const b3dmReader = await import("../../internal/tile/B3dmReader");
    const originalB3dmCreate = b3dmReader.B3dmReader.create;
    const mockCreate = () => mockReader;
    Object.defineProperty(b3dmReader.B3dmReader, 'create', { value: mockCreate, writable: true, configurable: true });

    try {
      // Create a ByteStream with B3dm format header
      const buffer = new Uint8Array(16);
      const view = new DataView(buffer.buffer);
      view.setUint32(0, TileFormat.B3dm, true);
      const streamBuffer = ByteStream.fromUint8Array(buffer);

      // Call the actual loadGeometryFromStream method from RealityTileLoader
      const result = await reader.loadGeometryFromStream(tile, streamBuffer, IModelApp.renderSystem);

      // Verify that geometry was returned
      expect(result.geometry).to.not.be.undefined;
      expect(result.geometry?.polyfaces).to.have.length(1);

      // Verify that the reprojection transform was NOT applied (points should be unchanged)
      if (result.geometry?.polyfaces) {
        const untransformedPolyface = result.geometry.polyfaces[0];
        const untransformedPoints = untransformedPolyface.data.point.getPoint3dArray();

        // Check that the points are still in their original positions
        expect(untransformedPoints[0].isExactEqual(Point3d.create(0, 0, 0))).to.be.true;
        expect(untransformedPoints[1].isExactEqual(Point3d.create(1, 0, 0))).to.be.true;
        expect(untransformedPoints[2].isExactEqual(Point3d.create(1, 1, 0))).to.be.true;
      }
    } finally {
      // Restore original B3dmReader.create
      if (originalB3dmCreate) {
        Object.defineProperty(b3dmReader.B3dmReader, 'create', { value: originalB3dmCreate, writable: true, configurable: true });
      }
    }
  });

  it("should not apply reprojection transform when no transform is present", async () => {
    // Create a test tree with reprojection enabled and no reprojection transform
    const tree = new TestRealityTree(0, imodel, reader, true, undefined);
    const tile = tree.rootTile;

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

    // Mock B3dmReader.create to return a reader with mocked readGltfAndCreateGeometry
    const mockReader = {
      defaultWrapMode: undefined,
      readGltfAndCreateGeometry: () => mockGeometry
    };

    // Mock B3dmReader.create
    const b3dmReader = await import("../../internal/tile/B3dmReader");
    const originalB3dmCreate = b3dmReader.B3dmReader.create;
    const mockCreate = () => mockReader;
    Object.defineProperty(b3dmReader.B3dmReader, 'create', { value: mockCreate, writable: true, configurable: true });

    try {
      // Create a ByteStream with B3dm format header
      const buffer = new Uint8Array(16);
      const view = new DataView(buffer.buffer);
      view.setUint32(0, TileFormat.B3dm, true);
      const streamBuffer = ByteStream.fromUint8Array(buffer);

      // Call the actual loadGeometryFromStream method from RealityTileLoader
      const result = await reader.loadGeometryFromStream(tile, streamBuffer, IModelApp.renderSystem);

      // Verify that geometry was returned
      expect(result.geometry).to.not.be.undefined;
      expect(result.geometry?.polyfaces).to.have.length(1);

      // Verify that the reprojection transform was NOT applied (points should be unchanged)
      if (result.geometry?.polyfaces) {
        const untransformedPolyface = result.geometry.polyfaces[0];
        const untransformedPoints = untransformedPolyface.data.point.getPoint3dArray();

        // Check that the points are still in their original positions
        expect(untransformedPoints[0].isExactEqual(Point3d.create(0, 0, 0))).to.be.true;
        expect(untransformedPoints[1].isExactEqual(Point3d.create(1, 0, 0))).to.be.true;
        expect(untransformedPoints[2].isExactEqual(Point3d.create(1, 1, 0))).to.be.true;
      }
    } finally {
      // Restore original B3dmReader.create
      if (originalB3dmCreate) {
        Object.defineProperty(b3dmReader.B3dmReader, 'create', { value: originalB3dmCreate, writable: true, configurable: true });
      }
    }
  });
});