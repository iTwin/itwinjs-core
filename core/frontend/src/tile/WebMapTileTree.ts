/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

/// cSpell:ignore quadkey

import {
  Id64String,
  assert,
  compareBooleans,
  compareNumbers,
  compareStrings,
} from "@bentley/bentleyjs-core";
import {
  Point3d,
  Range1d,
  Range3d,
  Transform,
  TransformProps,
  XYZProps,
} from "@bentley/geometry-core";
import {
  BackgroundMapProviderName,
  BackgroundMapType,
  Feature,
  FeatureTable,
  GeoCoordStatus,
  GlobeMode,
  ImageSource,
  ImageSourceFormat,
  PackedFeatureTable,
  RenderTexture,
  TileProps,
  TileTreeProps,
} from "@bentley/imodeljs-common";
import {
  ContextTileLoader,
  ImageryProvider,
  MapTile,
  MapTileGeometryAttributionProvider,
  MapTileTree,
  MapTileTreeReference,
  MapTilingScheme,
  QuadId,
  Tile,
  TileContent,
  TileGraphicType,
  TileLoadPriority,
  TileParams,
  TileRequest,
  TileTree,
  TileTreeOwner,
  TileTreeSupplier,
  WebMercatorTilingScheme,
  tileTreeParamsFromJSON,
  calculateEcefToDb,
} from "./internal";
import { imageElementFromImageSource } from "../ImageUtil";
import { IModelConnection } from "../IModelConnection";
import { RenderSystem } from "../render/RenderSystem";

/** @internal */
export class WebMapTileTreeProps implements TileTreeProps {
  /** The unique identifier of this TileTree within the iModel */
  public id: string;
  /** Transform tile coordinates to iModel world coordinates. */
  public location: TransformProps;
  public yAxisUp = true;
  public maxTilesToSkip = 10;
  public rootTile = { contentId: "", range: Range3d.createNull(), maximumSize: 0 };
  public constructor(groundBias: number, modelId: Id64String, maxTilesToSkip?: number) {
    const corners: Point3d[] = [];
    corners[0] = new Point3d(-10000000, -10000000, groundBias);
    corners[1] = new Point3d(-10000000, 10000000, groundBias);
    corners[2] = new Point3d(10000000, -10000000, groundBias);
    corners[3] = new Point3d(10000000, 10000000, groundBias);

    this.location = Transform.createIdentity();
    this.id = modelId;
    if (maxTilesToSkip)
      this.maxTilesToSkip = maxTilesToSkip;
  }
}

/** @internal */
export abstract class MapTileLoaderBase extends ContextTileLoader {
  protected _applyLights = false;
  public readonly featureTable: PackedFeatureTable;
  // public get heightRange(): Range1d | undefined { return this._heightRange; }
  protected readonly _heightRange: Range1d | undefined;
  public get isContentUnbounded(): boolean { return true; }
  public isTileAvailable(quadId: QuadId) { return quadId.level <= this.maxDepth; }

  constructor(protected _iModel: IModelConnection, protected _modelId: Id64String, protected _groundBias: number, protected _mapTilingScheme: MapTilingScheme, public readonly isDrape?: boolean) {
    super();
    const featureTable = new FeatureTable(1, this._modelId);
    const feature = new Feature(this._modelId);
    featureTable.insert(feature);
    this.featureTable = PackedFeatureTable.pack(featureTable);
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

/** @internal */
export class WebMapTileLoader extends MapTileLoaderBase {
  public get geometryAttributionProvider(): MapTileGeometryAttributionProvider | undefined {
    return undefined !== this._imageryProvider ? this._imageryProvider.geometryAttributionProvider : undefined;
  }
  public set geometryAttributionProvider(provider: MapTileGeometryAttributionProvider | undefined) {
    if (this._imageryProvider)
      this._imageryProvider.geometryAttributionProvider = provider;
  }

  public get parentsAndChildrenExclusive(): boolean { return this._globeMode !== GlobeMode.Plane; } // Allow map tiles to draw both parent and children if in planar/columbus -- this will cause these to be displayed with parents first.
  public get imageryProvider(): ImageryProvider {
    return this._imageryProvider;
  }

  constructor(private _imageryProvider: ImageryProvider, iModel: IModelConnection, modelId: Id64String, groundBias: number, mapTilingScheme: MapTilingScheme, private _filterTextures: boolean, private _globeMode: GlobeMode, isDrape?: boolean) {
    super(iModel, modelId, groundBias, mapTilingScheme, isDrape);
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

    if (this.isDrape) {
      content.imageryTexture = texture;
      return content;
    }

    // we put the corners property on WebMapTiles
    assert(tile instanceof MapTile);
    const mapTile = tile as MapTile;
    const graphic = mapTile.getGraphic(system, texture);

    content.graphic = undefined !== graphic ? system.createBatch(graphic, this.featureTable, tile.range) : graphic;

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
export interface BackgroundMapTreeId {
  providerName: BackgroundMapProviderName;
  mapType: BackgroundMapType;
  groundBias: number;
  forDrape: boolean;
  filterTextures: boolean;
  globeMode: GlobeMode;
  wantSkirts: boolean;
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
          if (0 === cmp) {
            cmp = compareBooleans(lhs.filterTextures, rhs.filterTextures);
            if (0 === cmp) {
              cmp = compareNumbers(lhs.globeMode, rhs.globeMode);
              if (0 === cmp)
                cmp = compareBooleans(lhs.wantSkirts, rhs.wantSkirts);

            }
          }
        }
      }
    }

    return cmp;
  }

  public async createTileTree(id: BackgroundMapTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    const imageryProvider = ImageryProvider.fromNameAndType(id.providerName, id.mapType);
    if (undefined === imageryProvider)
      return undefined;

    return createTileTreeFromImageryProvider(imageryProvider, id.groundBias, id.filterTextures, id.globeMode, id.wantSkirts, iModel, id.forDrape);
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

  public async createTileTree(options: { groundBias: number, filterTextures: boolean, globeMode: GlobeMode, wantSkirts: boolean }, iModel: IModelConnection): Promise<TileTree | undefined> {
    return createTileTreeFromImageryProvider(this.provider, options.groundBias, options.filterTextures, options.globeMode, options.wantSkirts, iModel, false);
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

/** Represents the service that is providing map tiles for Web Mercator models (background maps).
 * @internal
 */
export async function createTileTreeFromImageryProvider(imageryProvider: ImageryProvider, bimElevationBias: number, filterTextures: boolean, globeMode: GlobeMode, useDepthBuffer: boolean, iModel: IModelConnection, forDrape = false): Promise<TileTree | undefined> {
  if (undefined === iModel.ecefLocation)
    return undefined;

  await imageryProvider.initialize();

  const modelId = iModel.transientIds.next;
  const tilingScheme = new WebMercatorTilingScheme();
  const haveConverter = await getGcsConverterAvailable(iModel);
  const loader = new WebMapTileLoader(imageryProvider, iModel, modelId, bimElevationBias, tilingScheme, filterTextures, globeMode, forDrape);
  const tileTreeProps = new WebMapTileTreeProps(bimElevationBias, modelId);
  const ecefToDb = await calculateEcefToDb(iModel, bimElevationBias);
  return new MapTileTree(tileTreeParamsFromJSON(tileTreeProps, iModel, true, loader, modelId), ecefToDb!, bimElevationBias, haveConverter, tilingScheme, imageryProvider.maximumZoomLevel, globeMode, false, useDepthBuffer);
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
