/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import { assert, BentleyStatus, GuidString } from "@itwin/core-bentley";
import { IModelError, RealityData, RealityDataFormat, RealityDataProvider, RealityDataSourceKey, RealityDataSourceProps } from "@itwin/core-common";

import { request } from "./request/Request";
import { PublisherProductInfo, RealityDataSource, SpatialLocationAndExtents } from "./RealityDataSource";
import { ThreeDTileFormatInterpreter } from "./tile/internal";

/** This class provides access to the reality data provider services.
 * It encapsulates access to a reality data weiter it be from local access, http or ProjectWise Context Share.
 * The key provided at the creation determines if this is ProjectWise Context Share reference.
 * If not then it is considered local (ex: C:\temp\TileRoot.json) or plain http access (http://someserver.com/data/TileRoot.json)
 * There is a one to one relationship between a reality data and the instances of present class.
* @internal
*/
export class RealityDataSourceTilesetUrlImpl implements RealityDataSource {
  public readonly key: RealityDataSourceKey;
  /** The URL that supplies the 3d tiles for displaying the reality model. */
  private _tilesetUrl: string | undefined;
  /** For use by all Reality Data. For RD stored on PW Context Share, represents the portion from the root of the Azure Blob Container*/
  private _baseUrl: string = "";
  /** Need to be passed down to child tile requests when requesting from blob storage, e.g. a Cesium export from the Mesh Export Service*/
  private _searchParams?: URLSearchParams;

  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  protected constructor(props: RealityDataSourceProps) {
    assert(props.sourceKey.provider === RealityDataProvider.TilesetUrl || props.sourceKey.provider === RealityDataProvider.OrbitGtBlob);
    this.key = props.sourceKey;
    this._tilesetUrl = this.key.id;
  }

  /**
   * Create an instance of this class from a source key and iTwin context/
   */
  public static async createFromKey(sourceKey: RealityDataSourceKey, _iTwinId: GuidString | undefined): Promise<RealityDataSource | undefined> {
    if (sourceKey.provider !== RealityDataProvider.TilesetUrl)
      return undefined;
    const rdSource = new RealityDataSourceTilesetUrlImpl({ sourceKey });
    return rdSource;
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
  // This is to set the root url from the provided root document path.
  // If the root document is stored on PW Context Share then the root document property of the Reality Data is provided,
  // otherwise the full path to root document is given.
  // The base URL contains the base URL from which tile relative path are constructed.
  // The tile's path root will need to be reinserted for child tiles to return a 200
  // If the original url includes search paramaters, they are stored in _searchParams to be reinserted into child tile requests.
  private setBaseUrl(url: string): void {
    const urlParts = url.split("/");
    const newUrl = new URL(url);
    this._searchParams = newUrl.searchParams
    urlParts.pop();
    if (urlParts.length === 0)
      this._baseUrl = "";
    else
      this._baseUrl = `${urlParts.join("/")}/`;
  }

  /**
   * This method returns the URL to access the actual 3d tiles from the service provider.
   * @returns string containing the URL to reality data.
   */
  public async getServiceUrl(_iTwinId: GuidString | undefined): Promise<string | undefined> {
    return this._tilesetUrl;
  }

  public async getRootDocument(iTwinId: GuidString | undefined): Promise<any> {
    const url = await this.getServiceUrl(iTwinId);
    if (!url)
      throw new IModelError(BentleyStatus.ERROR, "Unable to get service url");

    // The following is only if the reality data is not stored on PW Context Share.
    this.setBaseUrl(url);
    return request(url, "json");
  }

  /** Returns the tile URL relative to the base URL.
   * If the tile path is a relative URL, the base URL is prepended to it.
   * For both absolute and relative tile path URLs, the search parameters are checked. If the search params are empty, the base URL's search params are appended to the tile path.
   */
  private getTileUrl(tilePath: string): string {

    //&&MM Notes
    // Spec: https://docs.ogc.org/cs/18-053r2/18-053r2.html 6.4 and 7.8.2
    //  query params:
    //    - no mention about propagation/preservation of query params.
    //    - not sure if absolute url should receive params from base url?
    // - "When the URI is relative, its base is always relative to the referring tileset JSON file."
    //     - We are always using the base URL of the root document but we need to use the referring tileset which is nested in the tree structure. In case of google they add the session id.
    // - What are we breaking by using the URL API instead of a simple concatenation of the base URL and tile path?

    // TODO absolute vs relative URL handling?

    // Build a relative URL where tilePath params will win over base URL params.
    const url = new URL(tilePath, this._baseUrl);
    if(this._searchParams === undefined || this._searchParams.size === 0)
      return url.toString();

    // append the base URL params to the tile path URL
    const result = url.searchParams.size === 0 ? `${url}?${this._searchParams}` :`${url}&${this._searchParams}`;
    return result;
  }

  /**
   * Returns the tile content. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileContent(name: string): Promise<ArrayBuffer> {
    return request(this.getTileUrl(name), "arraybuffer");
  }

  /**
   * Returns the tile content in json format. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileJson(name: string): Promise<any> {
    return request(this.getTileUrl(name), "json");
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

