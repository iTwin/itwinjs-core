/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

/// cSpell:ignore quadkey

import {
  BeTimePoint,
  Id64String,
  assert,
  compareBooleans,
  compareNumbers,
  compareStrings,
} from "@bentley/bentleyjs-core";
import {
  BackgroundMapProviderName,
  BackgroundMapType,
  Feature,
  FeatureTable,
  GeoCoordStatus,
  ImageSource,
  ImageSourceFormat,
  PackedFeatureTable,
  RenderTexture,
  TileProps,
  TileTreeProps,
} from "@bentley/imodeljs-common";
import {
  Matrix4d,
  Point3d,
  Point4d,
  Range1d,
  Range3d,
  Range3dProps,
  Transform,
  TransformProps,
  XYZProps,
} from "@bentley/geometry-core";
import {
  TileTree,
  ContextTileLoader,
  TileTreeOwner,
  TileGraphicType,
  TileTreeSupplier,
  tileTreeParamsFromJSON,
  Tile, TileLoadPriority,
  TileContent,
  TileDrawArgs,
  TileParams,
  TileRequest,
  MapTilingScheme,
  QuadId,
  WebMercatorTilingScheme,
  MapTileTree,
  MapTile,
  MapTileTreeReference,
  ImageryProvider,
  MapTileGeometryAttributionProvider,
} from "./internal";
import { imageElementFromImageSource } from "../ImageUtil";
import { IModelConnection } from "../IModelConnection";
import { SceneContext } from "../ViewContext";
import { RenderClipVolume, RenderSystem } from "../render/System";

/** @internal */
export class WebMapTileTreeProps implements TileTreeProps {
  /** The unique identifier of this TileTree within the iModel */
  public id: string;
  /** Metadata describing the tree's root Tile. */
  public rootTile: TileProps;
  /** Transform tile coordinates to iModel world coordinates. */
  public location: TransformProps;
  public yAxisUp = true;
  public maxTilesToSkip = 10;
  public constructor(groundBias: number, modelId: Id64String, heightRange?: Range1d, maxTilesToSkip?: number) {
    const corners: Point3d[] = [];
    corners[0] = new Point3d(-10000000, -10000000, groundBias);
    corners[1] = new Point3d(-10000000, 10000000, groundBias);
    corners[2] = new Point3d(10000000, -10000000, groundBias);
    corners[3] = new Point3d(10000000, 10000000, groundBias);

    this.rootTile = new WebMapTileProps("0_0_0", 0, corners, heightRange ? heightRange.low : groundBias, heightRange ? heightRange.high : groundBias);
    this.location = Transform.createIdentity();
    this.id = modelId;
    if (maxTilesToSkip)
      this.maxTilesToSkip = maxTilesToSkip;
  }
}

/** @internal */
export class WebMapTileProps implements TileProps {
  public readonly contentId: string;
  public readonly range: Range3dProps;
  public readonly contentRange?: Range3dProps;  // not used for WebMap tiles.
  public readonly maximumSize: number;
  public readonly isLeaf: boolean = false;
  public readonly corners: Point3d[];
  private static _scratchRange = Range3d.create();

  constructor(thisId: string, level: number, corners: Point3d[], zLow: number, zHigh: number) {
    this.corners = corners;

    WebMapTileProps._scratchRange.setNull();
    WebMapTileProps._scratchRange.extendArray(corners);
    WebMapTileProps._scratchRange.low.z = zLow;
    WebMapTileProps._scratchRange.high.z = zHigh;
    this.range = WebMapTileProps._scratchRange.toJSON();

    this.contentId = thisId;
    this.maximumSize = (0 === level) ? 0.0 : 512;
  }
}

/** @internal */
export abstract class MapTileLoaderBase extends ContextTileLoader {
  protected _applyLights = false;
  protected _featureTable: PackedFeatureTable;
  public get heightRange(): Range1d | undefined { return this._heightRange; }
  protected readonly _heightRange: Range1d | undefined;
  public get isContentUnbounded(): boolean { return true; }
  public isLeaf(quadId: QuadId) { return quadId.level >= this.maxDepth; }

  constructor(protected _iModel: IModelConnection, protected _modelId: Id64String, protected _groundBias: number, protected _mapTilingScheme: MapTilingScheme, heightRange?: Range1d) {
    super();
    const featureTable = new FeatureTable(1, this._modelId);
    const feature = new Feature(this._modelId);
    featureTable.insert(feature);
    this._featureTable = PackedFeatureTable.pack(featureTable);
    this._heightRange = (heightRange === undefined) ? undefined : heightRange.clone();
  }

  public get priority(): TileLoadPriority { return TileLoadPriority.Map; }
  public tileRequiresLoading(params: TileParams): boolean {
    return 0.0 !== params.maximumSize;
  }
  public abstract async loadTileContent(tile: Tile, data: TileRequest.ResponseData, system: RenderSystem, isCanceled?: () => boolean): Promise<TileContent>;
  public abstract get maxDepth(): number;
  public abstract async requestTileContent(tile: Tile, _isCanceled: () => boolean): Promise<TileRequest.Response>;
  public async getChildrenProps(_parent: Tile): Promise<TileProps[]> {
    assert(false);      // children are generated synchronously in MapTile....
    return [];
  }
}

class WebMapDrawArgs extends TileDrawArgs {
  private readonly _tileToView: Matrix4d;
  private readonly _scratchViewCorner = Point4d.createZero();

  public constructor(context: SceneContext, location: Transform, root: TileTree, now: BeTimePoint, purgeOlderThan: BeTimePoint, clip?: RenderClipVolume) {
    super(context, location, root, now, purgeOlderThan, clip, false);
    const tileToWorld = Matrix4d.createTransform(this.location);
    this._tileToView = tileToWorld.multiplyMatrixMatrix(this.worldToViewMap.transform0);
  }

  public getPixelSize(tile: Tile): number {
    /* For background maps which contain only rectangles with textures, use the projected screen rectangle rather than sphere to calculate pixel size.  */
    const rangeCorners = tile.contentRange.corners();
    const xRange = Range1d.createNull();
    const yRange = Range1d.createNull();

    let behindEye = false;
    for (const corner of rangeCorners) {
      const viewCorner = this._tileToView.multiplyPoint3d(corner, 1, this._scratchViewCorner);
      if (viewCorner.w < 0.0) {
        behindEye = true;
        break;
      }

      xRange.extendX(viewCorner.x / viewCorner.w);
      yRange.extendX(viewCorner.y / viewCorner.w);
    }

    if (!behindEye)
      return xRange.isNull ? 1.0E-3 : Math.sqrt(xRange.length() * yRange.length());

    return super.getPixelSize(tile);
  }
}

/** @internal */
export class WebMapTileLoader extends MapTileLoaderBase {
  public get geometryAttributionProvider(): MapTileGeometryAttributionProvider | undefined {
    return undefined !== this._imageryProvider ? this._imageryProvider.geometryAttributionProvider : undefined;
  }
  public set geometryAttributionProvider(provider: MapTileGeometryAttributionProvider | undefined) {
    if (this._imageryProvider)
      this._imageryProvider.geometryAttributionProvider = provider;
  }

  public get parentsAndChildrenExclusive(): boolean { return false; }     // Allow map tiles to draw both parent and children -- this will cause these to be displayed with parents first.
  public get imageryProvider(): ImageryProvider {
    return this._imageryProvider;
  }

  constructor(private _imageryProvider: ImageryProvider, iModel: IModelConnection, modelId: Id64String, groundBias: number, mapTilingScheme: MapTilingScheme, private _filterTextures: boolean, heightRange?: Range1d) {
    super(iModel, modelId, groundBias, mapTilingScheme, heightRange);
  }

  public async requestTileContent(tile: Tile, _isCanceled: () => boolean): Promise<TileRequest.Response> {
    const quadId = QuadId.createFromContentId(tile.contentId);
    return this._imageryProvider.loadTile(quadId.row, quadId.column, quadId.level);
  }

  public async loadTileContent(tile: Tile, data: TileRequest.ResponseData, system: RenderSystem, isCanceled?: () => boolean): Promise<TileContent> {
    if (undefined === isCanceled)
      isCanceled = () => !tile.isLoading;

    assert(data instanceof ImageSource);
    assert(tile instanceof MapTile);
    const content: TileContent = {};
    const texture = await this.loadTextureImage(data as ImageSource, this._iModel, system, isCanceled);
    if (undefined === texture)
      return content;

    // we put the corners property on WebMapTiles
    const corners = (tile as any).corners;
    const graphic = system.createTile(texture, corners, 0);
    content.graphic = undefined !== graphic ? system.createBatch(graphic, this._featureTable, tile.range) : graphic;

    return content;
  }

  private async loadTextureImage(imageSource: ImageSource, iModel: IModelConnection, system: RenderSystem, isCanceled: () => boolean): Promise<RenderTexture | undefined> {
    try {
      const textureParams = new RenderTexture.Params(undefined, this._filterTextures ? RenderTexture.Type.FilteredTileSection : RenderTexture.Type.TileSection);
      return imageElementFromImageSource(imageSource)
        .then((image) => isCanceled() ? undefined : system.createTextureFromImage(image, ImageSourceFormat.Png === imageSource.format, iModel, textureParams))
        .catch((_) => undefined);
    } catch (e) {
      return undefined;
    }
  }

  public get maxDepth(): number { return this._imageryProvider.maximumZoomLevel; }
}

/** Specialization of map tile loader that includes terrain geometry with map imagery draped on it.
 * @internal
 */
export abstract class TerrainTileLoaderBase extends MapTileLoaderBase {
  abstract get geometryAttributionProvider(): MapTileGeometryAttributionProvider;
  public get priority(): TileLoadPriority { return TileLoadPriority.Terrain; }
  public get clipLowResolutionTiles(): boolean { return true; }
}

/** Methods and properties common to both BackgroundMapProviders and OverlayMapProviders
 * @internal
 */
interface BackgroundMapTreeId {
  providerName: BackgroundMapProviderName;
  mapType: BackgroundMapType;
  groundBias: number;
  forDrape: boolean;
  filterTextures: boolean;
}

class BackgroundMapTreeSupplier implements TileTreeSupplier {
  public compareTileTreeIds(lhs: BackgroundMapTreeId, rhs: BackgroundMapTreeId): number {
    let cmp = compareStrings(lhs.providerName, rhs.providerName);
    if (0 === cmp) {
      cmp = compareNumbers(lhs.mapType, rhs.mapType);
      if (0 === cmp) {
        cmp = compareNumbers(lhs.groundBias, rhs.groundBias);
        if (0 === cmp) {
          cmp = compareBooleans(lhs.forDrape, rhs.forDrape);
          if (0 === cmp)
            cmp = compareBooleans(lhs.filterTextures, rhs.filterTextures);
        }
      }
    }

    return cmp;
  }

  public async createTileTree(id: BackgroundMapTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    const imageryProvider = ImageryProvider.fromNameAndType(id.providerName, id.mapType);
    if (undefined === imageryProvider)
      return undefined;

    return createTileTreeFromImageryProvider(imageryProvider, id.groundBias, id.filterTextures, iModel);
  }
}

const backgroundMapTreeSupplier = new BackgroundMapTreeSupplier();

/** @internal */
export function getBackgroundMapTreeSupplier(): TileTreeSupplier {
  return backgroundMapTreeSupplier;
}

/** Better if folks implement their own TileTreeSupplier which can share tiles... */
class ImageryTreeSupplier implements TileTreeSupplier {
  public readonly provider: ImageryProvider;

  public constructor(provider: ImageryProvider) {
    this.provider = provider;
  }

  public compareTileTreeIds(lhs: number, rhs: number) { return compareNumbers(lhs, rhs); }

  public async createTileTree(options: { groundBias: number, filterTextures: boolean }, iModel: IModelConnection): Promise<TileTree | undefined> {
    return createTileTreeFromImageryProvider(this.provider, options.groundBias, options.filterTextures, iModel);
  }
}
/** Returns whether a GCS converter is available.
 * @internal
 */
export async function getGcsConverterAvailable(iModel: IModelConnection) {
  // Determine if we have a usable GCS.
  const converter = iModel.geoServices.getConverter("WGS84");
  if (undefined === converter)
    return false;
  const requestProps: XYZProps[] = [{ x: 0, y: 0, z: 0 }];
  let haveConverter;
  try {
    const responseProps = await converter.getIModelCoordinatesFromGeoCoordinates(requestProps);
    haveConverter = responseProps.iModelCoords.length === 1 && responseProps.iModelCoords[0].s !== GeoCoordStatus.NoGCSDefined;
  } catch (_) {
    haveConverter = false;
  }
  return haveConverter;
}

class BackgroundMapTileTree extends MapTileTree {

  public createDrawArgs(context: SceneContext): TileDrawArgs {
    const now = BeTimePoint.now();
    const purgeOlderThan = now.minus(this.expirationTime);
    return new WebMapDrawArgs(context, this.location.clone(), this, now, purgeOlderThan, this.clipVolume);
  }
}

/** Represents the service that is providing map tiles for Web Mercator models (background maps).
 * @internal
 */
export async function createTileTreeFromImageryProvider(imageryProvider: ImageryProvider, groundBias: number, filterTextures: boolean, iModel: IModelConnection): Promise<TileTree | undefined> {
  if (undefined === iModel.ecefLocation)
    return undefined;

  await imageryProvider.initialize();

  const modelId = iModel.transientIds.next;
  const tilingScheme = new WebMercatorTilingScheme();
  const heightRange = Range1d.createXX(groundBias, groundBias);
  const haveConverter = await getGcsConverterAvailable(iModel);
  const loader = new WebMapTileLoader(imageryProvider, iModel, modelId, groundBias, tilingScheme, filterTextures);
  const tileTreeProps = new WebMapTileTreeProps(groundBias, modelId);
  return new BackgroundMapTileTree(tileTreeParamsFromJSON(tileTreeProps, iModel, true, loader, modelId), groundBias, haveConverter, tilingScheme, true, heightRange);
}

/** A specialization of MapTileTreeReference associated with a specific ImageryProvider. Provided mostly as a convenience.
 * The ImageryProvider, graphic type, and/or ground bias can be changed to cause different tiles to be displayed.
 * @internal
 */
export class MapImageryTileTreeReference extends MapTileTreeReference {
  public groundBias: number;
  public transparency?: number;
  public applyTerrain: boolean;
  public provider: ImageryProvider;
  public graphicType: TileGraphicType;
  protected readonly _iModel: IModelConnection;
  private _supplier: ImageryTreeSupplier;

  public constructor(imageryProvider: ImageryProvider, groundBias: number, applyTerrain: boolean, iModel: IModelConnection, graphicType: TileGraphicType = TileGraphicType.Overlay, transparency?: number) {
    super();
    this.groundBias = groundBias;
    this.applyTerrain = applyTerrain;
    this.provider = imageryProvider;
    this.graphicType = graphicType;
    this.transparency = transparency;
    this._iModel = iModel;
    this._supplier = new ImageryTreeSupplier(imageryProvider);
  }

  public get treeOwner(): TileTreeOwner {
    if (this.provider !== this._supplier.provider)
      this._supplier = new ImageryTreeSupplier(this.provider);

    return this._iModel.tiles.getTileTreeOwner(this.groundBias, this._supplier);
  }

  protected get _groundBias() { return this.groundBias; }
  protected get _graphicType() { return this.graphicType; }
  protected get _transparency() { return this.transparency; }
  protected get _imageryProvider() { return this.provider; }
}
