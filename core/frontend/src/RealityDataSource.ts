/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import { BentleyError, GuidString, Logger, LoggingMetaData, RealityDataStatus } from "@itwin/core-bentley";
import { Cartographic, EcefLocation, OrbitGtBlobProps, RealityData, RealityDataFormat, RealityDataProvider, RealityDataSourceKey } from "@itwin/core-common";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { CesiumIonAssetProvider, ContextShareProvider, getCesiumAssetUrl } from "./tile/internal";
import { RealityDataSourceTilesetUrlImpl } from "./RealityDataSourceTilesetUrlImpl";
import { RealityDataSourceContextShareImpl } from "./RealityDataSourceContextShareImpl";
import { RealityDataSourceCesiumIonAssetImpl } from "./RealityDataSourceCesiumIonAssetImpl";
import { Range3d } from "@itwin/core-geometry";

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
    const sasToken = rdSourceKey.id.substr(sasTokenIndex + 2);
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
  export async function fromKey(rdSourceKey: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataSource | undefined> {
    switch(rdSourceKey.provider) {
      case RealityDataProvider.CesiumIonAsset:
        return RealityDataSourceCesiumIonAssetImpl.createFromKey(rdSourceKey, iTwinId);
      case RealityDataProvider.TilesetUrl:
        return RealityDataSourceTilesetUrlImpl.createFromKey(rdSourceKey, iTwinId);
      case RealityDataProvider.ContextShare:
        return RealityDataSourceContextShareImpl.createFromKey(rdSourceKey, iTwinId);
      case RealityDataProvider.OrbitGtBlob:
        return RealityDataSourceTilesetUrlImpl.createFromKey(rdSourceKey, iTwinId);
      default:
        Logger.logError(loggerCategory, `Error realityModelFromJson - region undefined`);
    }
    return undefined;
  }
}

