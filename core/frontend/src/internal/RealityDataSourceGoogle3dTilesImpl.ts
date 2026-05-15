/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import { BentleyStatus, GuidString } from "@itwin/core-bentley";
import { IModelError, RealityData, RealityDataFormat, RealityDataSourceKey, RealityDataSourceProps } from "@itwin/core-common";

import { request } from "../request/Request";
import { PublisherProductInfo, RealityDataSource, SpatialLocationAndExtents } from "../RealityDataSource";
import { ThreeDTileFormatInterpreter } from "../tile/internal";

/** This class provides access to the reality data provider services.
 * It encapsulates access to a reality data from the Google Photorealistic 3D Tiles service.
 * A valid Google 3D Tiles authentication key must be configured for this provider to work (provide the key in the [[RealityDataSourceGoogle3dTilesImpl.createFromKey]] method).
* @internal
*/
export class RealityDataSourceGoogle3dTilesImpl implements RealityDataSource {
  public readonly key: RealityDataSourceKey;
  /** The URL that supplies the 3d tiles for displaying the Google 3D Tiles tileset. */
  private _tilesetUrl: string | undefined;
  /** Base URL of the Google 3D Tiles tileset. Does not include trailing subdirectories. */
  private _baseUrl: string = ""
  /** Search parameters that must be passed down to child tile requests. */
  private _searchParams?: URLSearchParams;
  /** Google Map Tiles API Key used to access Google 3D Tiles. */
  private _apiKey?: string;
  /** Function that returns an OAuth token for authenticating with GP3sDT. This token is expected to not contain the "Bearer" prefix. */
  private _getAuthToken?: () => Promise<string | undefined>;

  /** This is necessary for Google 3D Tiles tilesets! This tells the iTwin.js tiling system to use the geometric error specified in the tileset rather than any of our own. */
  public readonly usesGeometricError = true;
  public readonly maximumScreenSpaceError = 16;

  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  protected constructor(props: RealityDataSourceProps, apiKey: string | undefined, _getAuthToken?: () => Promise<string | undefined>) {
    this.key = props.sourceKey;
    this._tilesetUrl = this.key.id;
    this._apiKey = apiKey;
    this._getAuthToken = _getAuthToken;
  }

  /**
   * Create an instance of this class from a source key and iTwin context.
   */
  public static async createFromKey(sourceKey: RealityDataSourceKey, _iTwinId: GuidString | undefined, apiKey: string | undefined, _getAuthToken?: () => Promise<string | undefined>): Promise<RealityDataSource | undefined> {
    return new RealityDataSourceGoogle3dTilesImpl({ sourceKey }, apiKey, _getAuthToken);
  }

  public get isContextShare(): boolean {
    return false;
  }
  /**
   * Returns Reality Data if available
  */
  public get realityData(): RealityData | undefined {
    return undefined;
  }
  public get realityDataId(): string | undefined {
    return undefined;
  }
  /**
   * Returns Reality Data type if available
   */
  public get realityDataType(): string | undefined {
    return undefined;
  }

  public getTilesetUrl(): string | undefined {
    return this._tilesetUrl;
  }

  /** Return the URL of the Google 3D Tiles tileset with its API key included. */
  private getTilesetUrlWithKey() {
    const google3dTilesKey = this._apiKey;
    if (this._getAuthToken) {
      // If we have a getAuthToken function, no need to append API key to the URL
      return this._tilesetUrl;
    } else {
      return `${this._tilesetUrl}?key=${google3dTilesKey}`;
    }
  }

  protected setBaseUrl(url: string): void {
    const urlParts = url.split("/");
    const newUrl = new URL(url);
    this._searchParams = newUrl.searchParams;
    urlParts.pop();
    if (urlParts.length === 0) {
      this._baseUrl = "";
    } else {
      this._baseUrl = newUrl.origin;
    }
  }

  /**
   * This method returns the URL to access the actual 3d tiles from the service provider.
   * @returns string containing the URL to reality data.
   */
  public async getServiceUrl(_iTwinId: GuidString | undefined): Promise<string | undefined> {
    return this._tilesetUrl;
  }

  public async getRootDocument(_iTwinId: GuidString | undefined): Promise<any> {
    const url = this.getTilesetUrlWithKey();
    if (!url)
      throw new IModelError(BentleyStatus.ERROR, "Unable to get service url");

    this.setBaseUrl(url);

    let authToken;
    if (this._getAuthToken) {
      authToken = await this._getAuthToken();
    }

    return request(url, "json", authToken ? {
      headers: {
        authorization: `Bearer ${authToken}`
      }} : undefined
    );
  }

  /** Returns the tile URL relative to the base URL.
   * If the tile path is a relative URL, the base URL is prepended to it.
   * For both absolute and relative tile path URLs, the search parameters are checked. If the search params are empty, the base URL's search params are appended to the tile path.
   */
  public getTileUrl(tilePath: string): string {
    // this._baseUrl does not include the trailing subdirectories.
    // This is not an issue because the tile path always starts with the appropriate subdirectories.
    // We also do not need to worry about the tile path starting with a slash.
    // This happens in these tiles at the second .json level, but the URL API will handle that for us.
    const url = new URL(tilePath, this._baseUrl);

    // If tile is a reference to a tileset, iterate over tileset url's search params and store them in this._searchParams so we can pass them down to children
    if (this.getTileContentType(url.toString()) === "tileset" && url.searchParams.size !== 0) {
      for (const [key, value] of url.searchParams.entries()) {
        this._searchParams?.append(key, value);
      }
    }

    if (this._searchParams === undefined || this._searchParams.size === 0) {
      return url.toString();
    }

    // Append all stored search params to url's existing ones
    const newUrl = new URL(url.toString());
    for (const [key, value] of this._searchParams.entries()) {
      if (!url.searchParams.has(key)) {
        // Only append the search param if it does not already exist in the url
        newUrl.searchParams.append(key, value);
      }
    }

    return newUrl.toString();
  }

  /**
   * Returns the tile content. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileContent(name: string): Promise<ArrayBuffer> {
    let authToken;
    if (this._getAuthToken) {
      authToken = await this._getAuthToken();
    }

    return request(this.getTileUrl(name), "arraybuffer", authToken ? {
      headers: {
        authorization: `Bearer ${authToken}`
      }} : undefined
    );
  }

  /**
   * Returns the tile content in json format. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileJson(name: string): Promise<any> {
    let authToken;
    if (this._getAuthToken) {
      authToken = await this._getAuthToken();
    }

    return request(this.getTileUrl(name), "json", authToken ? {
      headers: {
        authorization: `Bearer ${authToken}`
      }} : undefined
    );
  }

  public getTileContentType(url: string): "tile" | "tileset" {
    return new URL(url, "https://localhost/").pathname.toLowerCase().endsWith("json") ? "tileset" : "tile";
  }

  /**
   * Gets spatial location and extents of this reality data source
   * @returns spatial location and extents
   * @internal
   */
  public async getSpatialLocationAndExtents(): Promise<SpatialLocationAndExtents | undefined> {
    let spatialLocation: SpatialLocationAndExtents | undefined;
    if (this.key.format === RealityDataFormat.ThreeDTile) {
      const rootDocument = await this.getRootDocument(undefined);
      spatialLocation = ThreeDTileFormatInterpreter.getSpatialLocationAndExtents(rootDocument);
    }
    return spatialLocation;
  }
  /**
   * Gets information to identify the product and engine that create this reality data
   * Will return undefined if cannot be resolved
   * @returns information to identify the product and engine that create this reality data
   * @alpha
   */
  public async getPublisherProductInfo(): Promise<PublisherProductInfo | undefined> {
    let publisherInfo: PublisherProductInfo | undefined;
    return publisherInfo;
  }
}

