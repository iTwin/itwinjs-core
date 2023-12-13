/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, compareBooleans, compareNumbers, compareStrings, compareStringsOrUndefined, dispose, Logger} from "@itwin/core-bentley";
import { Angle, Range3d, Transform } from "@itwin/core-geometry";
import { Cartographic, ImageMapLayerSettings, ImageSource, MapLayerSettings, RenderTexture, ViewFlagOverrides } from "@itwin/core-common";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { RenderMemory } from "../../render/RenderMemory";
import { RenderSystem } from "../../render/RenderSystem";
import { ScreenViewport } from "../../Viewport";
import {
  MapCartoRectangle, MapFeatureInfoOptions, MapLayerFeatureInfo, MapLayerImageryProvider, MapLayerTileTreeReference, MapTile, MapTileTreeScaleRangeVisibility, MapTilingScheme, QuadId, RealityTile, RealityTileLoader, RealityTileTree,
  RealityTileTreeParams, Tile, TileContent, TileDrawArgs, TileLoadPriority, TileParams, TileRequest, TileTree, TileTreeLoadStatus, TileTreeOwner,
  TileTreeSupplier,
} from "../internal";
import { HitDetail } from "../../HitDetail";

const loggerCategory = "ImageryMapTileTree";

/** @internal */
export interface ImageryTileContent extends TileContent {
  imageryTexture?: RenderTexture;
}

/** @internal */
export class ImageryMapTile extends RealityTile {
  private _texture?: RenderTexture;
  private _mapTileUsageCount = 0;

  private readonly _outOfLodRange: boolean;

  constructor(params: TileParams, public imageryTree: ImageryMapTileTree, public quadId: QuadId, public rectangle: MapCartoRectangle) {
    super(params, imageryTree);

    this._outOfLodRange = this.depth < imageryTree.minDepth;
  }

  public get texture() { return this._texture; }
  public get tilingScheme() { return this.imageryTree.tilingScheme; }
  public override get isDisplayable() { return (this.depth > 1) && super.isDisplayable; }
  public override get isOutOfLodRange(): boolean { return this._outOfLodRange;}

  public override setContent(content: ImageryTileContent): void {
    this._texture = content.imageryTexture;        // No dispose - textures may be shared by terrain tiles so let garbage collector dispose them.
    if (undefined === content.imageryTexture)
      (this.parent! as ImageryMapTile).setLeaf();   // Avoid traversing bing branches after no graphics is found.

    this.setIsReady();
  }

  public selectCartoDrapeTiles(drapeTiles: ImageryMapTile[], highResolutionReplacementTiles: ImageryMapTile[], rectangleToDrape: MapCartoRectangle, drapePixelSize: number, args: TileDrawArgs): TileTreeLoadStatus {
    // Base draping overlap on width rather than height so that tiling schemes with multiple root nodes overlay correctly.
    const isSmallerThanDrape = (this.rectangle.xLength() / this.maximumSize) < drapePixelSize;
    if (  (this.isLeaf )           // Include leaves so tiles get stretched past max LOD levels. (Only for base imagery layer)
      || isSmallerThanDrape
      || this._anyChildNotFound) {
      if (this.isOutOfLodRange ) {
        drapeTiles.push(this);
        this.setIsReady();
      } else if (this.isLeaf && !isSmallerThanDrape && !this._anyChildNotFound) {
        // These tiles are selected because we are beyond the max LOD of the tile tree,
        // might be used to display "stretched" tiles instead of having blank.
        highResolutionReplacementTiles.push(this);
      } else {
        drapeTiles.push(this);
      }
      return TileTreeLoadStatus.Loaded;
    }

    let status = this.loadChildren();
    if (TileTreeLoadStatus.Loading === status) {
      args.markChildrenLoading();
    } else if (TileTreeLoadStatus.Loaded === status) {
      if (undefined !== this.children) {
        for (const child of this.children) {
          const mapChild = child as ImageryMapTile;
          if (mapChild.rectangle.intersectsRange(rectangleToDrape))
            status = mapChild.selectCartoDrapeTiles(drapeTiles, highResolutionReplacementTiles, rectangleToDrape, drapePixelSize, args);
          if (TileTreeLoadStatus.Loaded !== status)
            break;
        }
      }
    }
    return status;
  }
  public markMapTileUsage() {
    this._mapTileUsageCount++;
  }
  public releaseMapTileUsage() {
    assert(!this._texture || this._mapTileUsageCount > 0);
    if (this._mapTileUsageCount)
      this._mapTileUsageCount--;
  }

  /** @internal */
  public override setLeaf(): void {
    // Don't potentially re-request the children later.
    this.disposeChildren();
    this._isLeaf = true;
    this._childrenLoadStatus = TileTreeLoadStatus.Loaded;
  }

  protected override _loadChildren(resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void {

    const imageryTree = this.imageryTree;
    const resolveChildren = (childIds: QuadId[]) => {
      const children = new Array<Tile>();
      const childrenAreLeaves = (this.depth + 1) === imageryTree.maxDepth;
      // If children depth is lower than min LOD, mark them as disabled.
      // This is important: if those tiles are requested and the server refuse to serve them,
      // they will be marked as not found and their descendant will never be displayed.

      childIds.forEach((quadId) => {
        const rectangle = imageryTree.tilingScheme.tileXYToRectangle(quadId.column, quadId.row, quadId.level);
        const range = Range3d.createXYZXYZ(rectangle.low.x, rectangle.low.x, 0, rectangle.high.x, rectangle.high.y, 0);
        const maximumSize = imageryTree.imageryLoader.maximumScreenSize;
        const tile = new ImageryMapTile({ parent: this, isLeaf: childrenAreLeaves, contentId: quadId.contentId, range, maximumSize}, imageryTree, quadId, rectangle);
        children.push(tile);
      });

      resolve(children);
    };

    imageryTree.imageryLoader.generateChildIds(this, resolveChildren);
  }

  protected override _collectStatistics(stats: RenderMemory.Statistics): void {
    super._collectStatistics(stats);
    if (this._texture)
      stats.addTexture(this._texture.bytesUsed);
  }

  public override freeMemory(): void {
    // ###TODO MapTiles and ImageryMapTiles share resources and don't currently interact well with TileAdmin.freeMemory(). Opt out for now.
  }

  public override disposeContents() {
    if (0 === this._mapTileUsageCount) {
      super.disposeContents();
      this.disposeTexture();
    }
  }

  private disposeTexture(): void {
    this._texture = dispose(this._texture);
  }
  public override dispose() {
    this._mapTileUsageCount = 0;
    super.dispose();
  }
}

/** Object that holds various state values for an ImageryTileTree
 * @internal */
export class ImageryTileTreeState {
  private _scaleRangeVis: MapTileTreeScaleRangeVisibility;

  constructor() {
    this._scaleRangeVis = MapTileTreeScaleRangeVisibility.Unknown;
  }

  /** Get the scale range visibility of the imagery tile tree.
   * @returns the scale range visibility of the imagery tile tree.
   */
  public getScaleRangeVisibility() {return this._scaleRangeVis;}

  /** Makes a deep copy of the current object.
   */
  public clone() {
    const clone = new ImageryTileTreeState();
    clone._scaleRangeVis = this._scaleRangeVis;
    return clone;
  }

  /** Reset the scale range visibility of imagery tile tree (i.e. unknown)
   */
  public reset() {
    this._scaleRangeVis = MapTileTreeScaleRangeVisibility.Unknown;
  }

  /** Sets the scale range visibility of the current imagery tile tree.
   * The state will be derived based on the previous visibility values:
   * Initial state: 'Unknown'
   * The first call will set the state to either: 'Visible' or 'Hidden'.
   * If subsequent visibility values are not consistent with the first visibility state, the state become 'Partial',
   * meaning the imagery tree currently contains a mixed of tiles being in range and out of range.
   */
  public setScaleRangeVisibility(visible: boolean) {
    if (this._scaleRangeVis === MapTileTreeScaleRangeVisibility.Unknown) {
      this._scaleRangeVis = (visible ? MapTileTreeScaleRangeVisibility.Visible : MapTileTreeScaleRangeVisibility.Hidden);
    } else if ((visible && this._scaleRangeVis === MapTileTreeScaleRangeVisibility.Hidden) || (!visible && this._scaleRangeVis === MapTileTreeScaleRangeVisibility.Visible)) {
      this._scaleRangeVis = MapTileTreeScaleRangeVisibility.Partial;
    }
  }
}

/** @internal */
export class ImageryMapTileTree extends RealityTileTree {
  constructor(params: RealityTileTreeParams, private _imageryLoader: ImageryTileLoader) {
    super(params);
    const rootQuadId = new QuadId(_imageryLoader.imageryProvider.tilingScheme.rootLevel, 0, 0);
    this._rootTile = new ImageryMapTile(params.rootTile, this, rootQuadId, this.getTileRectangle(rootQuadId));
  }
  public get tilingScheme(): MapTilingScheme { return this._imageryLoader.imageryProvider.tilingScheme; }
  public addLogoCards(cards: HTMLTableElement, vp: ScreenViewport): void {
    this._imageryLoader.addLogoCards(cards, vp);
  }

  public getTileRectangle(quadId: QuadId): MapCartoRectangle {
    return this.tilingScheme.tileXYToRectangle(quadId.column, quadId.row, quadId.level);
  }
  public get imageryLoader(): ImageryTileLoader { return this._imageryLoader; }
  public override get is3d(): boolean {
    assert(false);
    return false;
  }
  public override get viewFlagOverrides(): ViewFlagOverrides {
    assert(false);
    return {};
  }
  public override get isContentUnbounded(): boolean {
    assert(false);
    return true;
  }
  protected override _selectTiles(_args: TileDrawArgs): Tile[] {
    assert(false);
    return [];
  }
  public override draw(_args: TileDrawArgs): void { assert(false); }

  private static _scratchDrapeRectangle = MapCartoRectangle.createZero();
  private static _drapeIntersectionScale = 1.0 - 1.0E-5;

  public selectCartoDrapeTiles(drapeTiles: ImageryMapTile[], highResolutionReplacementTiles: ImageryMapTile[], tileToDrape: MapTile, args: TileDrawArgs): TileTreeLoadStatus {
    const drapeRectangle = tileToDrape.rectangle.clone(ImageryMapTileTree._scratchDrapeRectangle);
    // Base draping overlap on width rather than height so that tiling schemes with multiple root nodes overlay correctly.
    const drapePixelSize = 1.05 * tileToDrape.rectangle.xLength() / tileToDrape.maximumSize;
    drapeRectangle.scaleAboutCenterInPlace(ImageryMapTileTree._drapeIntersectionScale);    // Contract slightly to avoid draping adjacent or slivers.
    return (this.rootTile as ImageryMapTile).selectCartoDrapeTiles(drapeTiles, highResolutionReplacementTiles, drapeRectangle, drapePixelSize, args);
  }
  public cartoRectangleFromQuadId(quadId: QuadId): MapCartoRectangle { return this.tilingScheme.tileXYToRectangle(quadId.column, quadId.row, quadId.level); }
}

class ImageryTileLoader extends RealityTileLoader {
  constructor(private _imageryProvider: MapLayerImageryProvider, private _iModel: IModelConnection) {
    super();
  }
  public override computeTilePriority(tile: Tile): number {
    return 25 * (this._imageryProvider.usesCachedTiles ? 2 : 1) - tile.depth;     // Always cached first then descending by depth (high resolution/front first)
  }  // Prioritized fast, cached tiles first.

  public get maxDepth(): number { return this._imageryProvider.maximumZoomLevel; }
  public get minDepth(): number { return this._imageryProvider.minimumZoomLevel; }
  public get priority(): TileLoadPriority { return TileLoadPriority.Map; }
  public addLogoCards(cards: HTMLTableElement, vp: ScreenViewport): void {
    this._imageryProvider.addLogoCards(cards, vp);
  }

  public get maximumScreenSize(): number { return this._imageryProvider.maximumScreenSize; }
  public get imageryProvider(): MapLayerImageryProvider { return this._imageryProvider; }
  public async getToolTip(strings: string[], quadId: QuadId, carto: Cartographic, tree: ImageryMapTileTree): Promise<void> { await this._imageryProvider.getToolTip(strings, quadId, carto, tree); }

  public async getMapFeatureInfo(featureInfos: MapLayerFeatureInfo[], quadId: QuadId, carto: Cartographic, tree: ImageryMapTileTree, hit: HitDetail, options?: MapFeatureInfoOptions): Promise<void> {
    await this._imageryProvider.getFeatureInfo(featureInfos, quadId, carto, tree, hit, options);
  }

  public generateChildIds(tile: ImageryMapTile, resolveChildren: (childIds: QuadId[]) => void) { return this._imageryProvider.generateChildIds(tile, resolveChildren); }

  /** Load this tile's children, possibly asynchronously. Pass them to `resolve`, or an error to `reject`. */
  public async loadChildren(_tile: RealityTile): Promise<Tile[] | undefined> {
    assert(false);
    return undefined;
  }
  public async requestTileContent(tile: Tile, _isCanceled: () => boolean): Promise<TileRequest.Response> {
    const quadId = QuadId.createFromContentId(tile.contentId);
    return this._imageryProvider.loadTile(quadId.row, quadId.column, quadId.level);
  }

  public getRequestChannel(_tile: Tile) {
    // ###TODO use hostname from url - but so many layers to go through to get that...
    return IModelApp.tileAdmin.channels.getForHttp("itwinjs-imagery");
  }

  public override async loadTileContent(tile: Tile, data: TileRequest.ResponseData, system: RenderSystem): Promise<ImageryTileContent> {
    assert(data instanceof ImageSource);
    assert(tile instanceof ImageryMapTile);
    const content: ImageryTileContent = {};
    const texture = await this.loadTextureImage(data, system);
    if (undefined === texture)
      return content;

    content.imageryTexture = texture;
    return content;
  }

  private async loadTextureImage(source: ImageSource, system: RenderSystem): Promise<RenderTexture | undefined> {
    try {
      return await system.createTextureFromSource({
        type: RenderTexture.Type.FilteredTileSection,
        source,
      });
    } catch {
      return undefined;
    }
  }
}

interface ImageryMapLayerTreeId {
  settings: ImageMapLayerSettings;
}

/** Supplies a TileTree that can load and draw tiles based on our imagery provider.
 * The TileTree is uniquely identified by its imagery type.
 */
class ImageryMapLayerTreeSupplier implements TileTreeSupplier {
  /** Return a numeric value indicating how two tree IDs are ordered relative to one another.
   * This allows the ID to serve as a lookup key to find the corresponding TileTree.
   */
  public compareTileTreeIds(lhs: ImageryMapLayerTreeId, rhs: ImageryMapLayerTreeId): number {
    let cmp = compareStrings(lhs.settings.formatId, rhs.settings.formatId);
    if (0 === cmp) {
      cmp = compareStrings(lhs.settings.url, rhs.settings.url);
      if (0 === cmp) {
        cmp = compareStringsOrUndefined(lhs.settings.userName, rhs.settings.userName);
        if (0 === cmp) {
          cmp = compareStringsOrUndefined(lhs.settings.password, rhs.settings.password);
          if (0 === cmp) {
            cmp = compareBooleans(lhs.settings.transparentBackground, rhs.settings.transparentBackground);
            if (0 === cmp) {
              cmp = compareNumbers(lhs.settings.subLayers.length, rhs.settings.subLayers.length);
              if (0 === cmp) {
                for (let i = 0; i < lhs.settings.subLayers.length && 0 === cmp; i++) {
                  cmp = compareStrings(lhs.settings.subLayers[i].name, rhs.settings.subLayers[i].name);
                  if (0 === cmp) {
                    cmp = compareBooleans(lhs.settings.subLayers[i].visible, rhs.settings.subLayers[i].visible);
                  }
                }
              }
            }
          }
        }
      }
    }

    return cmp;
  }

  /** The first time a tree of a particular imagery type is requested, this function creates it. */
  public async createTileTree(id: ImageryMapLayerTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    const imageryProvider = IModelApp.mapLayerFormatRegistry.createImageryProvider(id.settings);
    if (undefined === imageryProvider) {
      Logger.logError(loggerCategory, `Failed to create imagery provider for format '${id.settings.formatId}'`);
      return undefined;
    }

    try {
      await imageryProvider.initialize();
    } catch (e: any) {
      Logger.logError(loggerCategory, `Could not initialize imagery provider for map layer '${id.settings.name}' : ${e}`);
      throw e;
    }

    const modelId = iModel.transientIds.getNext();
    const tilingScheme = imageryProvider.tilingScheme;
    const rootLevel =  (1 === tilingScheme.numberOfLevelZeroTilesX && 1 === tilingScheme.numberOfLevelZeroTilesY) ? 0 : -1;
    const rootTileId = new QuadId(rootLevel, 0, 0).contentId;
    const rootRange = Range3d.createXYZXYZ(-Angle.piRadians, -Angle.piOver2Radians, 0, Angle.piRadians, Angle.piOver2Radians, 0);
    const rootTileProps = { contentId: rootTileId, range: rootRange, maximumSize: 0 };
    const loader = new ImageryTileLoader(imageryProvider, iModel);
    const treeProps = { rootTile: rootTileProps, id: modelId, modelId, iModel, location: Transform.createIdentity(), priority: TileLoadPriority.Map, loader, gcsConverterAvailable: false };
    return new ImageryMapTileTree(treeProps, loader);
  }
}

const imageryTreeSupplier = new ImageryMapLayerTreeSupplier();

/** A reference to one of our tile trees. The specific TileTree drawn may change when the desired imagery type or target iModel changes.
 * @beta
 */
export class ImageryMapLayerTreeReference extends MapLayerTileTreeReference {
  /**
   * Constructor for an ImageryMapLayerTreeReference.
   * @param layerSettings Map layer settings that are applied to the ImageryMapLayerTreeReference.
   * @param layerIndex The index of the associated map layer. Usually passed in through [[createMapLayerTreeReference]] in [[MapTileTree]]'s constructor.
   * @param iModel The iModel containing the ImageryMapLayerTreeReference.
   */
  public constructor(args: { layerSettings: MapLayerSettings, layerIndex: number, iModel: IModelConnection }) {
    super(args.layerSettings, args.layerIndex, args.iModel);
  }

  public override get castsShadows() { return false; }

  /** Return the owner of the TileTree to draw. */
  public get treeOwner(): TileTreeOwner {
    return this.iModel.tiles.getTileTreeOwner({ settings: this._layerSettings }, imageryTreeSupplier);
  }

  /* @internal */
  public override resetTreeOwner() {
    return this.iModel.tiles.resetTileTreeOwner({ settings: this._layerSettings }, imageryTreeSupplier);
  }

  public override get imageryProvider(): MapLayerImageryProvider | undefined {
    const tree = this.treeOwner.load();
    if (!tree || !(tree instanceof ImageryMapTileTree))
      return undefined;

    return tree.imageryLoader.imageryProvider;
  }
}
