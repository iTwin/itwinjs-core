/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Range3d } from "@itwin/core-geometry";
import { ImageMapLayerProps, ImageMapLayerSettings } from "@itwin/core-common";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MockRender } from "../../../internal/render/MockRender";
import { createBlankConnection } from "../../createBlankConnection";
import { ImageryMapTile, ImageryMapTileTree, ImageryMapLayerTreeReference } from "../../../tile/map/ImageryTileTree";
import { IModelConnection } from "../../../IModelConnection";
import { ImageryMapLayerFormat } from "../../../tile/map/MapLayerImageryFormats";
import { MapLayerImageryProvider } from "../../../tile/map/MapLayerImageryProvider";
import { IModelApp } from "../../../IModelApp";
import { MapCartoRectangle, QuadId, TileTreeLoadStatus } from "../../../tile/internal";
import { TileDrawArgs } from "../../../tile/TileDrawArgs";

class CustomProvider extends MapLayerImageryProvider {
  public override async constructUrl(_row: number, _column: number, _zoomLevel: number) { return this._settings.url;}
  public override async  initialize(): Promise<void> {return;}
}

class BaseCustomFormat extends ImageryMapLayerFormat {
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined {
    return new CustomProvider(settings, true);
  }
}

class CustomFormat1 extends BaseCustomFormat {
  public static override formatId = "Custom1";
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined {
    return new CustomProvider(settings, true);
  }
}

class CustomFormat2 extends BaseCustomFormat {
  public static override formatId = "Custom2";
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined {
    return new CustomProvider(settings, true);
  }
}

interface DatasetEntry {
  lhs: ImageMapLayerProps;
  rhs: ImageMapLayerProps;
  expectSameTileTree: boolean;
}

describe("ImageryTileTree", () => {
  let imodel: IModelConnection;

  beforeAll(async () => {   // Create a ViewState to load into a Viewport
    await MockRender.App.startup();
    imodel = createBlankConnection();
    IModelApp.mapLayerFormatRegistry.register(CustomFormat1);
    IModelApp.mapLayerFormatRegistry.register(CustomFormat2);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("tree supplier", async () => {
    const baseProps: ImageMapLayerProps = { formatId: "Custom1", url: "https://dummy.com", name: "CustomLayer", subLayers: [{name: "sub0", visible: true}]};
    const dataset: DatasetEntry[] = [
      {lhs: {...baseProps}, rhs: {...baseProps}, expectSameTileTree:true},
      {lhs: {...baseProps, name: "someName"}, rhs: {...baseProps}, expectSameTileTree:true},
      {lhs: {...baseProps, url: "https://someUrl.com"}, rhs: {...baseProps}, expectSameTileTree:false},
      {lhs: {...baseProps, formatId:"Custom2"}, rhs: {...baseProps}, expectSameTileTree:false},
      {lhs: {...baseProps, subLayers: [{name: "sub0", visible: false}]}, rhs: {...baseProps}, expectSameTileTree:false},
      {lhs: {...baseProps, subLayers: [{name: "sub1", visible: true}]}, rhs: {...baseProps}, expectSameTileTree:false},
      {lhs: {...baseProps, properties: {key: "value"}}, rhs: {...baseProps}, expectSameTileTree:false},
      {lhs: {...baseProps}, rhs: {...baseProps, properties: {key: "value"}}, expectSameTileTree:false},
      {lhs: {...baseProps, properties: {key: "value"}}, rhs: {...baseProps, properties: {key: "value"}}, expectSameTileTree:true},
      {lhs: {...baseProps, properties: {key: [1,2,3]}}, rhs: {...baseProps}, expectSameTileTree:false},
      {lhs: {...baseProps}, rhs: {...baseProps, properties: {key: [1,2,3]}}, expectSameTileTree:false},
      {lhs: {...baseProps, properties: {key: "value"}}, rhs: {...baseProps, properties: {key: [1,2,3]}}, expectSameTileTree:false},
      {lhs: {...baseProps,  properties: {key: [1,2,3,4]}}, rhs: {...baseProps, properties: {key: [1,2,3]}}, expectSameTileTree:false},
      {lhs: {...baseProps,  properties: {key: [1,2,3]}}, rhs: {...baseProps, properties: {key: [1,2,3,4]}}, expectSameTileTree:false},
      {lhs: {...baseProps,  properties: {key: [1,2,3]}}, rhs: {...baseProps, properties: {key: [1,2,3]}}, expectSameTileTree:true},
    ];
    for (const entry of dataset) {
      const settingsLhs = ImageMapLayerSettings.fromJSON(entry.lhs);
      const treeRefLhs = new ImageryMapLayerTreeReference({ layerSettings: settingsLhs, layerIndex: 0, iModel: imodel });
      const treeOwnerLhs = treeRefLhs.treeOwner;
      const tileTreeLhs = await treeOwnerLhs.loadTree();
      expect(tileTreeLhs).toBeDefined();

      const settingsRhs = ImageMapLayerSettings.fromJSON(entry.rhs);
      const treeRefRhs = new ImageryMapLayerTreeReference({ layerSettings: settingsRhs, layerIndex: 0, iModel: imodel });
      const treeOwnerRhs = treeRefRhs.treeOwner;
      const tileTreeRhs = await treeOwnerRhs.loadTree();
      expect(tileTreeRhs).toBeDefined();

      if (entry.expectSameTileTree)
        expect(tileTreeLhs!.modelId).toEqual(tileTreeRhs!.modelId);
      else
        expect(tileTreeLhs!.modelId).not.toEqual(tileTreeRhs!.modelId);
    }
  });

  /** Helper: create a tree and return the root tile + tree ref */
  async function createTreeAndRoot() {
    const props: ImageMapLayerProps = { formatId: "Custom1", url: "https://dummy.com", name: "TestLayer", subLayers: [{ name: "sub0", visible: true }] };
    const settings = ImageMapLayerSettings.fromJSON(props);
    const treeRef = new ImageryMapLayerTreeReference({ layerSettings: settings, layerIndex: 0, iModel: imodel });
    const tree = await treeRef.treeOwner.loadTree() as ImageryMapTileTree;
    expect(tree).toBeDefined();
    const root = tree.rootTile as ImageryMapTile;
    return { tree, root };
  }

  /** Helper: create a child ImageryMapTile under a parent */
  function createChild(parent: ImageryMapTile, tree: ImageryMapTileTree, level: number, column: number, row: number, isLeaf = false): ImageryMapTile {
    const quadId = new QuadId(level, column, row);
    const rectangle = tree.tilingScheme.tileXYToRectangle(column, row, level);
    const range = Range3d.createXYZXYZ(rectangle.low.x, rectangle.low.y, 0, rectangle.high.x, rectangle.high.y, 0);
    return new ImageryMapTile({ parent, isLeaf, contentId: quadId.contentId, range, maximumSize: 256 }, tree, quadId, rectangle);
  }

  describe("setContent", () => {
    it("should mark self as leaf when content has no texture, not the parent", async () => {
      const { tree, root } = await createTreeAndRoot();
      const child = createChild(root, tree, 1, 0, 0);

      // Before setContent: neither should be a leaf
      expect(child.isLeaf).toBe(false);
      const rootWasLeaf = root.isLeaf;

      // Set content with no texture (simulates empty tile from server)
      child.setContent({});

      // Child should be marked as leaf (no data below it)
      expect(child.isLeaf).toBe(true);
      // Parent should NOT be affected — siblings should remain traversable
      expect(root.isLeaf).toBe(rootWasLeaf);
    });

    it("should not mark self as leaf when content has a texture", async () => {
      const { tree, root } = await createTreeAndRoot();
      const child = createChild(root, tree, 1, 0, 0);

      // Create a mock texture
      const mockTexture = { bytesUsed: 100 } as any;
      child.setContent({ imageryTexture: mockTexture });

      // Child should NOT be a leaf — texture exists, so deeper levels may too
      expect(child.isLeaf).toBe(false);
    });
  });

  describe("selectCartoDrapeTiles", () => {
    it("should drill through not-found tiles to reach deeper children", async () => {
      const { tree, root } = await createTreeAndRoot();

      // Simulate a sparse tile pyramid: level-1 child returns 404 (not found)
      const child = createChild(root, tree, 1, 0, 0);
      child.setNotFound();

      // The child is not-found but NOT a leaf — children haven't been explored yet
      expect(child.isNotFound).toBe(true);
      expect(child.isLeaf).toBe(false);

      // selectCartoDrapeTiles should NOT treat this as a terminal tile.
      // Instead it should call loadChildren() → returning Loading status.
      const drapeTiles: ImageryMapTile[] = [];
      const highResTiles: ImageryMapTile[] = [];
      const mockArgs = { markChildrenLoading: vi.fn() } as unknown as TileDrawArgs;
      // Use a drapePixelSize small enough so the tile is NOT "smaller than drape"
      const status = child.selectCartoDrapeTiles(drapeTiles, highResTiles, child.rectangle, 0.0000001, mockArgs);

      // Should be Loading (children are being loaded), NOT Loaded (which would mean it stopped here)
      expect(status).toBe(TileTreeLoadStatus.Loading);
      expect(mockArgs.markChildrenLoading).toHaveBeenCalled();
      // Tile should NOT appear in drapeTiles — it has no content, traversal continues deeper
      expect(drapeTiles).toHaveLength(0);
    });
  });
});
