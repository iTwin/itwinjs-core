/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import { BentleyError, BentleyStatus, GuidString, Logger, LoggingMetaData, RealityDataStatus } from "@itwin/core-bentley";
import { Cartographic, EcefLocation, OrbitGtBlobProps, RealityData, RealityDataFormat, RealityDataProvider, RealityDataSourceKey } from "@itwin/core-common";
import { Range3d } from "@itwin/core-geometry";
import { FrontendLoggerCategory } from "./common/FrontendLoggerCategory";
import { CesiumIonAssetProvider, ContextShareProvider, getCesiumAssetUrl } from "./tile/internal";
import { RealityDataSourceTilesetUrlImpl } from "./RealityDataSourceTilesetUrlImpl";
import { RealityDataSourceContextShareImpl } from "./RealityDataSourceContextShareImpl";
import { RealityDataSourceCesiumIonAssetImpl } from "./RealityDataSourceCesiumIonAssetImpl";
import { RealityDataSourceGoogle3dTilesImpl } from "./internal/RealityDataSourceGoogle3dTilesImpl";
import { IModelApp } from "./IModelApp";
import { getCopyrights, GoogleMapsDecorator } from "./internal/GoogleMapsDecorator";
import { DecorateContext } from "./ViewContext";
import { ScreenViewport } from "./Viewport";

const loggerCategory: string = FrontendLoggerCategory.RealityData;

/**
 * Reality Data Operation error
 * @alpha
 */
export class RealityDataError extends BentleyError {
  public constructor(errorNumber: RealityDataStatus, message: string, getMetaData?: LoggingMetaData) {
    super(errorNumber, message, getMetaData);
  }
}

/** This interface provide spatial location and volume of interest, in meters, centered around `spatial location`
 * @alpha
 */
export interface SpatialLocationAndExtents {
  /** location of the point at the center of the reaity data */
  location: Cartographic | EcefLocation;
  /** extents of the volume around location */
  worldRange: Range3d;
  /** true if this reality data is geolocated
   * A reality data is geolocated when we can compute a valid position relative to the earth surface.
   * Note that some reality data contains custom coordinate system without any information on the relative position on earth.
   * These reality data will have a location and worldRange but will be identified by the isGeoLocated set to false.
   */
  isGeolocated: boolean;
}

/** This interface provides information to identify the product and engine that create this reality data
 * @alpha
 */
export interface PublisherProductInfo {
  /** product that create this reality data */
  product: string;
  /** engine that create this reality data */
  engine: string;
  /** the version of the engine that create this reality data */
  version: string;
}

/** This interface provide methods used to access a reality data from a reality data provider
 * @beta
 */
export interface RealityDataSource {
  readonly key: RealityDataSourceKey;
  readonly isContextShare: boolean;
  readonly realityDataId: string | undefined;
  /** Metatdata on the reality data source */
  readonly realityData: RealityData | undefined;
  /** The reality data type (e.g.: "RealityMesh3DTiles", OPC, Terrain3DTiles, Cesium3DTiles, ... )*/
  readonly realityDataType: string | undefined;
  /** This method returns the URL to obtain the Reality Data properties.
   * @param iTwinId id of associated iTwin project
   * @returns string containing the URL to reality data.
   */
  getServiceUrl(iTwinId: GuidString | undefined): Promise<string | undefined>;
  /** If true, the geometricError property of the tiles will be used to compute screen-space error.
   * @alpha
   */
  readonly usesGeometricError?: boolean;
  /** If [[usesGeometricError]] is `true`, optionally specifies the maximum error, in pixels, to permit for a tile before requiring refinement of that tile.
   * Default: 16
   * @alpha
   */
  readonly maximumScreenSpaceError?: number;
  /** Given the URL of a tile's content, return the type of that content.
   * "tileset" indicates the content points to a JSON tileset describing the structure of the tile tree below the tile.
   * "tile" indicates the content points to a binary representation of the tile's graphics.
   * @alpha
   */
  getTileContentType(url: string): "tile" | "tileset";

  /** Gets a reality data root document json
   * @returns tile data json
   * @internal
   */
  getRootDocument(iTwinId: GuidString | undefined): Promise<any>;
  /** Gets tile content
   * @param name name or path of tile
   * @returns array buffer of tile content
   * @internal
   */
  getTileContent(name: string): Promise<any>;
  /** Gets a tileset's app data json
   * @param name name or path of tile
   * @returns app data json object
   * @internal
   */
  getTileJson(name: string): Promise<any>;
  /** Gets spatial location and extents of this reality data source.
   * Will return undefined if cannot be resolved or is unbounded (cover entire earth eg: Open Street Map Building from Ion Asset)
   * @returns spatial location and extents
   * @throws [[RealityDataError]] if source is invalid or cannot be read
   * @alpha
   */
  getSpatialLocationAndExtents(): Promise<SpatialLocationAndExtents | undefined>;
  /** Gets information to identify the product and engine that create this reality data
   * Will return undefined if cannot be resolved
   * @returns information to identify the product and engine that create this reality data
   * @alpha
   */
  getPublisherProductInfo(): Promise<PublisherProductInfo | undefined>;
  /** Optional, gets the tileset url associated with the reality data source
   * @returns tileset url
   * @internal
   */
  getTilesetUrl?(): string | undefined;
}
/** Utility functions for RealityDataSource
 * @beta
 */
export namespace RealityDataSource {
  /** Create a RealityDataSourceKey from a tilesetUrl.
   * @param tilesetUrl the reality data attachment url
   * @param inputProvider identify the RealityDataProvider if known, otherwise function will try to extract it from the tilesetUrl
   * @param inputFormat identify the RealityDataFormat if known, otherwise function will try to extract it from the tilesetUrl
   * @returns the RealityDataSourceKey that uniquely identify a reality data for a provider
   */
  export function createKeyFromUrl(tilesetUrl: string, inputProvider?: RealityDataProvider, inputFormat?: RealityDataFormat): RealityDataSourceKey {
    let format = inputFormat ? inputFormat : RealityDataFormat.fromUrl(tilesetUrl);
    if (CesiumIonAssetProvider.isProviderUrl(tilesetUrl)) {
      const provider = RealityDataProvider.CesiumIonAsset;
      let cesiumIonAssetKey: RealityDataSourceKey = { provider, format, id:  CesiumIonAssetProvider.osmBuildingId }; // default OSM building
      // Parse URL to extract possible asset id and key if provided
      const cesiumAsset = CesiumIonAssetProvider.parseCesiumUrl(tilesetUrl);
      if (cesiumAsset) {
        cesiumIonAssetKey = RealityDataSource.createCesiumIonAssetKey(cesiumAsset.id, cesiumAsset.key);
      }
      return cesiumIonAssetKey;
    }

    // Try to extract realityDataId from URL and if not possible, use the url as the key
    if (ContextShareProvider.isProviderUrl(tilesetUrl)) {
      const info = ContextShareProvider.getInfoFromUrl(tilesetUrl);
      const provider = inputProvider ? inputProvider : info.provider;
      format = inputFormat ? inputFormat : info.format;
      const contextShareKey: RealityDataSourceKey = { provider, format, id: info.id, iTwinId: info.iTwinId };
      return contextShareKey;
    }

    // default to tileSetUrl
    const provider2 = inputProvider ? inputProvider : RealityDataProvider.TilesetUrl;
    const urlKey: RealityDataSourceKey = { provider: provider2, format, id: tilesetUrl };
    return urlKey;
  }
  /** @alpha - was used for a very specific case of point cloud (opc) attachment that should not be made public */
  export function createKeyFromBlobUrl(blobUrl: string, inputProvider?: RealityDataProvider, inputFormat?: RealityDataFormat): RealityDataSourceKey {
    const info = ContextShareProvider.getInfoFromBlobUrl(blobUrl);
    const format = inputFormat ? inputFormat : info.format;
    const provider = inputProvider ? inputProvider : info.provider;
    const contextShareKey: RealityDataSourceKey = { provider, format, id: info.id };
    return contextShareKey;
  }
  /** @alpha - OrbitGtBlobProps is alpha */
  export function createKeyFromOrbitGtBlobProps(orbitGtBlob: OrbitGtBlobProps, inputProvider?: RealityDataProvider, inputFormat?: RealityDataFormat): RealityDataSourceKey {
    const format = inputFormat ? inputFormat : RealityDataFormat.OPC;
    if (orbitGtBlob.blobFileName && orbitGtBlob.blobFileName.toLowerCase().startsWith("http")) {
      return RealityDataSource.createKeyFromBlobUrl(orbitGtBlob.blobFileName, inputProvider, format);
    } else if (orbitGtBlob.rdsUrl) {
      return RealityDataSource.createKeyFromUrl(orbitGtBlob.rdsUrl, inputProvider, format);
    }
    const provider = inputProvider ? inputProvider : RealityDataProvider.OrbitGtBlob;
    const id = `${orbitGtBlob.accountName}:${orbitGtBlob.containerName}:${orbitGtBlob.blobFileName}:?${orbitGtBlob.sasToken}`;
    return { provider, format, id };
  }
  /** @alpha - OrbitGtBlobProps is alpha */
  export function createOrbitGtBlobPropsFromKey(rdSourceKey: RealityDataSourceKey): OrbitGtBlobProps | undefined {
    if (rdSourceKey.provider !== RealityDataProvider.OrbitGtBlob)
      return undefined;
    const splitIds = rdSourceKey.id.split(":");
    const sasTokenIndex = rdSourceKey.id.indexOf(":?");
    const sasToken = rdSourceKey.id.substring(sasTokenIndex + 2);
    const orbitGtBlob: OrbitGtBlobProps = {
      accountName: splitIds[0],
      containerName: splitIds[1],
      blobFileName: splitIds[2],
      sasToken,
    };
    return orbitGtBlob;
  }
  /** @internal - Is used by "fdt attach cesium asset" keyin*/
  export function createCesiumIonAssetKey(osmAssetId: number, requestKey: string): RealityDataSourceKey {
    const id = getCesiumAssetUrl(osmAssetId,requestKey);
    return {provider: RealityDataProvider.CesiumIonAsset, format: RealityDataFormat.ThreeDTile, id};
  }
  /** Return an instance of a RealityDataSource from a source key.
   * There will aways be only one reality data RealityDataSource for a corresponding reality data source key.
   * @alpha
   */
  export async function fromKey(key: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataSource | undefined> {
    const provider = IModelApp.realityDataSourceProviders.find(key.provider);
    if (!provider) {
      Logger.logWarning(loggerCategory, `RealityDataSourceProvider "${key.provider}" is not registered`);
      return undefined;
    }

    return provider.createRealityDataSource(key, iTwinId);
  }
}

/** A named supplier of [RealityDataSource]]s.
 * The provider's name is stored in a [RealityDataSourceKey]($common). When the [[RealityDataSource]] is requested from the key,
 * the provider is looked up in [[IModelApp.realityDataSourceProviders]] by its name and, if found, its [[createRealityDataSource]] method
 * is invoked to produce the reality data source.
 * @beta
 */

export interface RealityDataSourceProvider {
  /** Produce a RealityDataSource for the specified `key`.
   * @param key Identifies the reality data source.
   * @param iTwinId A default iTwinId to use.
   * @returns the requested reality data source, or `undefined` if it could not be produced.
   */
  createRealityDataSource(key: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataSource | undefined>;
  /** Optionally add any decorations specific to this reality data source provider.
   * For example, the Google Photorealistic 3D Tiles reality data source provider will add the Google logo.
   */
  decorate?(_context: DecorateContext): void;
  /** Optionally add attribution logo cards to the viewport's logo div. */
  addAttributions?(cards: HTMLTableElement, vp: ScreenViewport): Promise<void>;
  /** Enables cached decorations for this provider. @see [[ViewportDecorator.useCachedDecorations]] */
  useCachedDecorations?: true | undefined;
}

/** A registry of [[RealityDataSourceProvider]]s identified by their unique names. The registry can be accessed via [[IModelApp.realityDataSourceProviders]].
 * It includes a handful of built-in providers for sources like Cesium ION, ContextShare, OrbitGT, and arbitrary public-accessible URLs.
 * Any number of additional providers can be registered. They should typically be registered just after [[IModelApp.startup]].
 * @beta
 */
export class RealityDataSourceProviderRegistry {
  private readonly _providers = new Map<string, RealityDataSourceProvider>();

  /** @internal */
  public constructor() {
    this.register(RealityDataProvider.CesiumIonAsset, {
      createRealityDataSource: async (key, iTwinId) => RealityDataSourceCesiumIonAssetImpl.createFromKey(key, iTwinId),
    });
    this.register(RealityDataProvider.TilesetUrl, {
      createRealityDataSource: async (key, iTwinId) => RealityDataSourceTilesetUrlImpl.createFromKey(key, iTwinId),
    });
    this.register(RealityDataProvider.ContextShare, {
      createRealityDataSource: async (key, iTwinId) => RealityDataSourceContextShareImpl.createFromKey(key, iTwinId),
    });
    this.register(RealityDataProvider.OrbitGtBlob, {
      // ###TODO separate TilesetUrlImpl
      createRealityDataSource: async (key, iTwinId) => RealityDataSourceTilesetUrlImpl.createFromKey(key, iTwinId),
    });
  }

  /** Register `provider` to produce [[RealityDataSource]]s for the specified provider `name`. */
  public register(name: string, provider: RealityDataSourceProvider): void {
    this._providers.set(name, provider);
  }

  /** Look up the provider registered by the specified `name`. */
  public find(name: string): RealityDataSourceProvider | undefined {
    return this._providers.get(name);
  }
}

/**
 * Options for creating a Google Photorealistic 3D Tiles reality data source provider.
 * The caller must provide either an API key or a function that returns an auth token.
 * @beta
 */
export type Google3dTilesProviderOptions = {
  /** Google Map Tiles API Key used to access Google 3D Tiles. */
  apiKey: string;
  getAuthToken?: never;
  /** If true, the data attributions/copyrights from the Google 3D Tiles will be displayed on screen. The Google Maps logo will always be displayed. Defaults to `true`. */
  showCreditsOnScreen?: boolean
} | {
  apiKey?: never;
  /** Function that returns an OAuth token for authenticating with Google 3D Tiles. This token is expected to not contain the "Bearer" prefix. */
  getAuthToken: () => Promise<string>;
  /** If true, the data attributions/copyrights from the Google 3D Tiles will be displayed on screen. The Google Maps logo will always be displayed. Defaults to `true`. */
  showCreditsOnScreen?: boolean;
};

/**
 * Will provide Google Photorealistic 3D Tiles (in 3dTile format).
 * A valid API key or getAuthToken fuction must be supplied when creating this provider.
 * To use this provider, you must register it with [[IModelApp.realityDataSourceProviders]].
 * Example usage:
 * ```ts
 * [[include:GooglePhotorealistic3dTiles_providerApiKey]]
 * ```
 * @see [Google Photorealistic 3D Tiles]($docs/learning/frontend/GooglePhotorealistic3dTiles.md)
 * @beta
 */
export class Google3dTilesProvider implements RealityDataSourceProvider {
  /** Google Map Tiles API Key used to access Google 3D Tiles. */
  private _apiKey?: string;
  /** Function that returns an OAuth token for authenticating with Google 3D Tiles. This token is expected to not contain the "Bearer" prefix. */
  private _getAuthToken?: () => Promise<string | undefined>;
  /** Decorator for Google Maps logos. */
  private _decorator: GoogleMapsDecorator;
  /** Enables cached decorations for this provider. @see [[ViewportDecorator.useCachedDecorations]] */
  public readonly useCachedDecorations = true;

  public async createRealityDataSource(key: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataSource | undefined> {
    if (!this._apiKey && !this._getAuthToken) {
      Logger.logError(loggerCategory, "Either an API key or getAuthToken function are required to create a Google3dTilesProvider.");
      return undefined;
    }
    return RealityDataSourceGoogle3dTilesImpl.createFromKey(key, iTwinId, this._apiKey, this._getAuthToken);
  }

  public constructor(options: Google3dTilesProviderOptions) {
    this._apiKey = options.apiKey;
    this._getAuthToken = options.getAuthToken;
    this._decorator = new GoogleMapsDecorator(options.showCreditsOnScreen ?? true);
  }

  /**
   * Initialize the Google 3D Tiles reality data source provider by activating its decorator, which consists of loading the correct Google Maps logo.
   * @returns `true` if the decorator was successfully activated, otherwise `false`.
   */
  public async initialize(): Promise<boolean> {
    const isActivated = await this._decorator.activate("satellite");
    if (!isActivated) {
      const msg = "Failed to activate decorator";
      Logger.logError(loggerCategory, msg);
      throw new BentleyError(BentleyStatus.ERROR, msg);
    }
    return isActivated;
  }

  public decorate(_context: DecorateContext): void {
    this._decorator.decorate(_context);
  }

  public async addAttributions(cards: HTMLTableElement, vp: ScreenViewport): Promise<void> {
    const copyrightMap = getCopyrights(vp);

    // Only add another logo card if the tiles have copyright
    if (copyrightMap.size > 0) {
      // Order by most occurances to least
      // See https://developers.google.com/maps/documentation/tile/create-renderer#display-attributions
      const sortedCopyrights = [...copyrightMap.entries()].sort((a, b) => b[1] - a[1]);

      let copyrightMsg = "Data provided by:<br><ul>";
      copyrightMsg += sortedCopyrights.map(([key]) => `<li>${key}</li>`).join("");
      copyrightMsg += "</ul>";

      const iconSrc = document.createElement("img");
      iconSrc.src = `${IModelApp.publicPath}images/GoogleMaps_Logo_Gray.svg`;
      iconSrc.style.padding = "10px 10px 5px 10px";

      cards.appendChild(IModelApp.makeLogoCard({
        iconSrc,
        iconWidth: 98,
        heading: "Google Photorealistic 3D Tiles",
        notice: copyrightMsg
      }));
    }
  }
}

/** Returns the URL used for retrieving Google Photorealistic 3D Tiles.
 * @beta
 */
export function getGoogle3dTilesUrl() {
  return "https://tile.googleapis.com/v1/3dtiles/root.json";
}
