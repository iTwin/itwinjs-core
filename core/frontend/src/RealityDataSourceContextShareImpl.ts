/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import { request } from "./request/Request";
import { AccessToken, assert, GuidString, Logger } from "@itwin/core-bentley";
import { RealityData, RealityDataFormat, RealityDataProvider, RealityDataSourceKey, RealityDataSourceProps } from "@itwin/core-common";
import { FrontendLoggerCategory } from "./common/FrontendLoggerCategory";
import { IModelApp } from "./IModelApp";

import { PublisherProductInfo, RealityDataSource, SpatialLocationAndExtents } from "./RealityDataSource";
import { OPCFormatInterpreter, ThreeDTileFormatInterpreter } from "./tile/internal";

/** This class provides access to the reality data provider services.
 * It encapsulates access to a reality data weiter it be from local access, http or ProjectWise Context Share.
 * The key provided at the creation determines if this is ProjectWise Context Share reference.
 * If not then it is considered local (ex: C:\temp\TileRoot.json) or plain http access (http://someserver.com/data/TileRoot.json)
 * There is a one to one relationship between a reality data and the instances of present class.
* @internal
*/
export class RealityDataSourceContextShareImpl implements RealityDataSource {
  public readonly key: RealityDataSourceKey;
  /** The URL that supplies the 3d tiles for displaying the reality model. */
  private _tilesetUrl: string | undefined;
  private _isUrlResolved: boolean = false;
  private _rd: RealityData | undefined;
  /** For use by all Reality Data. For RD stored on PW Context Share, represents the portion from the root of the Azure Blob Container*/
  private _baseUrl: string = "";

  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  protected constructor(props: RealityDataSourceProps) {
    // this implementaiton is specific to ContextShare provider
    assert(props.sourceKey.provider === RealityDataProvider.ContextShare);
    this.key = props.sourceKey;
    this._isUrlResolved = false;
  }

  /**
   * Create an instance of this class from a source key and iTwin context/
   */
  public static async createFromKey(sourceKey: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataSource | undefined> {
    if (sourceKey.provider !== RealityDataProvider.ContextShare)
      return undefined;
    const rdSource = new RealityDataSourceContextShareImpl({ sourceKey });
    let tilesetUrl: string | undefined;
    try {
      await rdSource.queryRealityData(iTwinId);
      tilesetUrl = await rdSource.getServiceUrl(iTwinId);
    } catch (e) {
    }

    return (tilesetUrl !== undefined) ? rdSource : undefined;
  }

  public get isContextShare(): boolean {
    return (this.key.provider === RealityDataProvider.ContextShare);
  }
  /**
   * Returns Reality Data if available
  */
  public get realityData(): RealityData | undefined {
    return this._rd;
  }
  public get realityDataId(): string | undefined {
    const realityDataId = this.key.id;
    return realityDataId;
  }
  /**
   * Returns Reality Data type if available
   */
  public get realityDataType(): string | undefined {
    return this._rd?.type;
  }

  /**
   * Query Reality Data from provider
   */
  private async queryRealityData(iTwinId: GuidString | undefined) {
    if (!this._rd) {
      const token = await IModelApp.getAccessToken();
      if (token && this.realityDataId) {
        if (undefined === IModelApp.realityDataAccess)
          throw new Error("Missing an implementation of RealityDataAccess on IModelApp, it is required to access reality data. Please provide an implementation to the IModelApp.startup using IModelAppOptions.realityDataAccess.");
        this._rd = await IModelApp.realityDataAccess.getRealityData(token, iTwinId, this.realityDataId);
        // A reality data that has not root document set should not be considered.
        const rootDocument: string = this._rd.rootDocument ?? "";
        this.setBaseUrl(rootDocument);
      }
    }
  }
  // This is to set the root url from the provided root document path.
  // If the root document is stored on PW Context Share then the root document property of the Reality Data is provided,
  // otherwise the full path to root document is given.
  // The base URL contains the base URL from which tile relative path are constructed.
  // The tile's path root will need to be reinserted for child tiles to return a 200
  private setBaseUrl(url: string): void {
    const urlParts = url.split("/");
    urlParts.pop();
    if (urlParts.length === 0)
      this._baseUrl = "";
    else
      this._baseUrl = `${urlParts.join("/")}/`;
  }

  /**
   * Gets a tileset's app data json
   * @param name name or path of tile
   * @returns app data json object
   * @internal
   */
  public async getRealityDataTileJson(accessToken: AccessToken, name: string, realityData: RealityData): Promise<any> {
    const url = await realityData.getBlobUrl(accessToken, name);

    return request(url.toString(), "json");
  }

  /**
   * This method returns the URL to access the actual 3d tiles from the service provider.
   * @returns string containing the URL to reality data.
   */
  public async getServiceUrl(iTwinId: GuidString | undefined): Promise<string | undefined> {
    // If url was not resolved - resolve it
    if (!this._isUrlResolved) {
      const rdSourceKey = this.key;
      // we need to resolve tilesetURl from realityDataId and iTwinId
      if (undefined === IModelApp.realityDataAccess)
        throw new Error("Missing an implementation of RealityDataAccess on IModelApp, it is required to access reality data. Please provide an implementation to the IModelApp.startup using IModelAppOptions.realityDataAccess.");
      try {
        const resolvedITwinId = iTwinId ? iTwinId : rdSourceKey.iTwinId;

        this._tilesetUrl = await IModelApp.realityDataAccess.getRealityDataUrl(resolvedITwinId, rdSourceKey.id);
        this._isUrlResolved = true;
      } catch (e) {
        const errMsg = `Error getting URL from ContextShare using realityDataId=${rdSourceKey.id} and iTwinId=${iTwinId}`;
        Logger.logError(FrontendLoggerCategory.RealityData, errMsg);
      }
    }
    return this._tilesetUrl;
  }

  public async getRootDocument(_iTwinId: GuidString | undefined): Promise<any> {
    const token = await IModelApp.getAccessToken();
    if (token) {
      const realityData = this.realityData;

      if (!realityData)
        throw new Error(`Reality Data not defined`);

      if (!realityData.rootDocument)
        throw new Error(`Root document not defined for reality data: ${realityData.id}`);

      return this.getRealityDataTileJson(token, realityData.rootDocument, realityData);
    }
  }

  /**
   * Gets tile content
   * @param name name or path of tile
   * @returns array buffer of tile content
   */
  public async getRealityDataTileContent(accessToken: AccessToken, name: string, realityData: RealityData): Promise<ArrayBuffer> {
    const url = await realityData.getBlobUrl(accessToken, name);
    return request(url.toString(), "arraybuffer");
  }

  /**
   * Returns the tile content. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileContent(name: string): Promise<any> {
    const token = await IModelApp.getAccessToken();
    const tileUrl = this._baseUrl + name;

    if (this.realityData) {
      return this.getRealityDataTileContent(token, tileUrl, this.realityData);
    }
    return undefined;
  }

  /**
   * Returns the tile content in json format. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileJson(name: string): Promise<any> {
    const token = await IModelApp.getAccessToken();
    const tileUrl = this._baseUrl + name;

    if (this.realityData) {
      return this.getRealityDataTileJson(token, tileUrl, this.realityData);
    }

    return undefined;
  }

  public getTileContentType(url: string): "tile" | "tileset" {
    return url.endsWith("json") ? "tileset" : "tile";
  }

  /**
   * Gets spatial location and extents of this reality data source
   * @returns spatial location and extents
   * @internal
   */
  public async getSpatialLocationAndExtents(): Promise<SpatialLocationAndExtents | undefined> {
    let spatialLocation: SpatialLocationAndExtents | undefined;
    const fileType = this.realityDataType;

    // Mapping Resource are not currenlty supported
    if (fileType === "OMR")
      return undefined;

    if (this.key.format === RealityDataFormat.ThreeDTile) {
      const rootDocument = await this.getRootDocument(undefined);
      spatialLocation = ThreeDTileFormatInterpreter.getSpatialLocationAndExtents(rootDocument);
    } else if (this.key.format === RealityDataFormat.OPC) {
      if (this.realityData === undefined)
        return undefined;
      const token = await IModelApp.getAccessToken();
      const docRootName = this.realityData.rootDocument;
      if (!docRootName)
        return undefined;
      const blobUrl = await this.realityData.getBlobUrl(token, docRootName);
      if (!blobUrl)
        return undefined;
      const blobStringUrl = blobUrl.toString();
      const filereader = await OPCFormatInterpreter.getFileReaderFromBlobFileURL(blobStringUrl);
      spatialLocation = await OPCFormatInterpreter.getSpatialLocationAndExtents(filereader);
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
    if (this.key.format === RealityDataFormat.ThreeDTile) {
      const rootDocument = await this.getRootDocument(undefined);
      publisherInfo = ThreeDTileFormatInterpreter.getPublisherProductInfo(rootDocument);
    }
    return publisherInfo;
  }
}

