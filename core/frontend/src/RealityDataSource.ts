/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { request, RequestOptions } from "@bentley/itwin-client";
import { assert, BentleyStatus, GuidString, Logger } from "@itwin/core-bentley";
import { IModelError, OrbitGtBlobProps, RealityDataFormat, RealityDataProvider, RealityDataSourceKey, RealityDataSourceProps } from "@itwin/core-common";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { IModelApp } from "./IModelApp";
import { RealityData } from "./RealityDataAccessProps";
import { CesiumIonAssetProvider, ContextShareProvider, getCesiumAccessTokenAndEndpointUrl } from "./tile/internal";

/**
 * This interface provide methods used to access a reality data from a reality data provider
 * @alpha
 */
export interface RealityDataSource {
  readonly key: RealityDataSourceKey;
  readonly isContextShare: boolean;
  readonly realityDataId: string | undefined;
  /** Metatdata on the reality data source */
  readonly realityData: RealityData | undefined;
  /** The reality data type (e.g.: "RealityMesh3DTiles", OPC, Terrain3DTiles, Cesium3DTiles, ... )*/
  readonly realityDataType: string | undefined;
  /**
   * This method returns the URL to obtain the Reality Data properties.
   * @param iTwinId id of associated iTwin project
   * @returns string containing the URL to reality data.
   */
  getServiceUrl(iTwinId: GuidString | undefined): Promise<string | undefined>;
  /**
   * Gets string url for the provider to fetch data from. Access is read-only.
   * @param accessToken The client request context.
   * @returns string url containing the data (blob data url for context share provider)
   */
  getDataUrl(accessToken: string): Promise<string>;
  /**
   * @internal
   */
  getRootDocument(iTwinId: GuidString | undefined): Promise<any>;
  /**
   * Returns the tile content. The path to the tile is relative to the base url of present reality data whatever the type.
   * @internal
   */
  getTileContent(url: string): Promise<any>;
  /**
   * Returns the tile content in json format. The path to the tile is relative to the base url of present reality data whatever the type.
   * @internal
   */
  getTileJson(url: string): Promise<any>;
}
/** @alpha */
export namespace RealityDataSource {
  /** Utility function to convert a RealityDataSourceKey into its string representation
  * @alpha
  */
  export function keyToString(rdSourceKey: RealityDataSourceKey): string {
    return `${rdSourceKey.provider}:${rdSourceKey.format}:${rdSourceKey.id}:${rdSourceKey.iTwinId}`;
  }
  export function createKeyFromUrl(tilesetUrl: string, inputProvider?: RealityDataProvider, inputFormat?: RealityDataFormat): RealityDataSourceKey {
    let format = inputFormat ? inputFormat : RealityDataFormat.ThreeDTile;
    if (CesiumIonAssetProvider.isProviderUrl(tilesetUrl)) {
      const provider = inputProvider ? inputProvider : RealityDataProvider.CesiumIonAsset;
      const cesiumIonAssetKey: RealityDataSourceKey = { provider, format, id: tilesetUrl };
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
  export function createKeyFromBlobUrl(blobUrl: string, inputProvider?: RealityDataProvider, inputFormat?: RealityDataFormat): RealityDataSourceKey {
    const info = ContextShareProvider.getInfoFromBlobUrl(blobUrl);
    const format = inputFormat ? inputFormat : info.format;
    const provider = inputProvider ? inputProvider : info.provider;
    const contextShareKey: RealityDataSourceKey = { provider, format, id: info.id };
    return contextShareKey;
  }
  export function createKeyFromOrbitGtBlobProps(orbitGtBlob: OrbitGtBlobProps, inputProvider?: RealityDataProvider, inputFormat?: RealityDataFormat): RealityDataSourceKey {
    const format = inputFormat ? inputFormat : RealityDataFormat.OPC;
    if(orbitGtBlob.blobFileName && orbitGtBlob.blobFileName.toLowerCase().startsWith("http")) {
      return RealityDataSource.createKeyFromBlobUrl(orbitGtBlob.blobFileName,inputProvider,format);
    } else if (orbitGtBlob.rdsUrl) {
      return RealityDataSource.createKeyFromUrl(orbitGtBlob.rdsUrl,inputProvider,format);
    }
    const provider = inputProvider ? inputProvider : RealityDataProvider.OrbitGtBlob;
    const id = `${orbitGtBlob.accountName}:${orbitGtBlob.containerName}:${orbitGtBlob.blobFileName}:?${orbitGtBlob.sasToken}`;
    return { provider, format, id };
  }
  export function createOrbitGtBlobPropsFromKey(rdSourceKey: RealityDataSourceKey): OrbitGtBlobProps | undefined {
    if (rdSourceKey.provider !== RealityDataProvider.OrbitGtBlob)
      return undefined;
    const splitIds = rdSourceKey.id.split(":");
    const sasTokenIndex = rdSourceKey.id.indexOf(":?");
    const sasToken = rdSourceKey.id.substr(sasTokenIndex+2);
    const orbitGtBlob: OrbitGtBlobProps = {
      accountName: splitIds[0],
      containerName: splitIds[1],
      blobFileName: splitIds[2],
      sasToken,
    };
    return orbitGtBlob;
  }
  /** Return an instance of a RealityDataSource from a source key.
   * There will aways be only one reality data RealityDataSource for a corresponding reality data source key.
   * @internal
   */
  export async function fromKey(rdSourceKey: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataSource | undefined> {
    return RealityDataSourceImpl.fromKey(rdSourceKey, iTwinId);
  }
}

/** This class provides access to the reality data provider services.
 * It encapsulates access to a reality data wether it be from local access, http or ProjectWise Context Share.
 * The key provided at the creation determines if this is ProjectWise Context Share reference.
 * If not then it is considered local (ex: C:\temp\TileRoot.json) or plain http access (http://someserver.com/data/TileRoot.json)
 * There is a one to one relationship between a reality data and the instances of present class.
* @alpha
*/
class RealityDataSourceImpl implements RealityDataSource {
  private static _realityDataSources = new Map<string, RealityDataSource>();
  public readonly key: RealityDataSourceKey;
  /** The URL that supplies the 3d tiles for displaying the reality model. */
  private _tilesetUrl: string | undefined;
  private _isUrlResolved: boolean = false;
  private _rd: RealityData | undefined;
  /** For use by all Reality Data. For RD stored on PW Context Share, represents the portion from the root of the Azure Blob Container*/
  private _baseUrl: string = "";
  /** Request authorization for non PW ContextShare requests.*/
  private _requestAuthorization?: string;

  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  protected constructor(props: RealityDataSourceProps) {
    this.key = props.sourceKey;
    this._isUrlResolved=false;
  }

  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  public static fromProps(props: RealityDataSourceProps): RealityDataSource {
    return new RealityDataSourceImpl(props);
  }
  /**
   * Create an instance of this class from a source key and iTwin context/
   * @alpha
   */
  public static async createFromKey(sourceKey: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataSource | undefined> {
    const rdSource = new RealityDataSourceImpl({sourceKey});
    let tilesetUrl: string | undefined;
    try {
      await rdSource.queryRealityData(iTwinId);
      tilesetUrl = await rdSource.getServiceUrl(iTwinId);
    } catch (e) {
    }

    return (tilesetUrl !== undefined) ? rdSource : undefined;
  }
  /** Return an instance of a RealityDataSource from a source key.
   * There will aways be only one reality data connection for a corresponding reality data source key.
   * @alpha
   */
  public static async fromKey(rdSourceKey: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataSource | undefined> {
    // search to see if it was already created
    const rdSourceKeyString = RealityDataSource.keyToString(rdSourceKey);
    let rdSource = RealityDataSourceImpl._realityDataSources.get(rdSourceKeyString);
    if (rdSource)
      return rdSource;
    // If not already in our list, create and add it to our list before returing it.
    rdSource = await RealityDataSourceImpl.createFromKey(rdSourceKey,  iTwinId);
    if (rdSource)
      RealityDataSourceImpl._realityDataSources.set(rdSourceKeyString,rdSource);
    return rdSource;
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
    const realityDataId = this.isContextShare ? this.key.id : undefined;
    return realityDataId;
  }
  /**
   * Returns Reality Data type if available
   */
  public get realityDataType(): string | undefined {
    return this._rd?.type;
  }
  public get iTwinId(): string | undefined {
    return this.key.iTwinId;
  }
  /**
   * Query Reality Data from provider
   */
  private async queryRealityData(iTwinId: GuidString | undefined) {
    if (this.isContextShare && !this._rd) {
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
  private async _doRequest(url: string, responseType: string): Promise<any> {
    const authToken = this._requestAuthorization ?? (await IModelApp.getAccessToken());

    const options: RequestOptions = {
      method: "GET",
      responseType,
      headers: {
        authorization: authToken,
      },
    };
    const data = await request(url, options);
    return data.body;
  }
  /**
   * Gets string url to fetch blob data from. Access is read-only.
   * @param accessToken The client request context.
   * @param name name or path of tile
   * @returns string url for blob data
   */
  public async getDataUrl(accessToken: string): Promise<string> {
    if (!this.realityData)
      throw new Error("Reality data is undefined, it is required to access context share blob string url.");

    const url = await this.realityData.getBlobUrl(accessToken);

    const host = `${url.origin + url.pathname}/`;

    const query = url.search;

    return `${host}${this.realityData.rootDocument}${query}`;
  }
  /**
   * This method returns the URL to access the actual 3d tiles from the service provider.
   * @returns string containing the URL to reality data.
   */
  public async getServiceUrl(iTwinId: GuidString | undefined): Promise<string | undefined> {
    // If url was not resolved - resolve it
    if (this.isContextShare && !this._isUrlResolved) {
      const rdSourceKey = this.key;
      // we need to resolve tilesetURl from realityDataId and iTwinId
      if (undefined === IModelApp.realityDataAccess)
        throw new Error("Missing an implementation of RealityDataAccess on IModelApp, it is required to access reality data. Please provide an implementation to the IModelApp.startup using IModelAppOptions.realityDataAccess.");
      try {
        const resolvedITwinId = iTwinId ? iTwinId : rdSourceKey.iTwinId;

        this._tilesetUrl = await IModelApp.realityDataAccess.getRealityDataUrl(resolvedITwinId, rdSourceKey.id);
        this._isUrlResolved=true;
      } catch (e) {
        const errMsg = `Error getting URL from ContextShare using realityDataId=${rdSourceKey.id} and iTwinId=${iTwinId}`;
        Logger.logError(FrontendLoggerCategory.RealityData, errMsg);
      }
    } else if (this.key.provider === RealityDataProvider.TilesetUrl || this.key.provider === RealityDataProvider.CesiumIonAsset) {
      this._tilesetUrl = this.key.id;
    }
    return this._tilesetUrl;
  }
  public async getRootDocument(iTwinId: GuidString | undefined): Promise<any> {
    let url = await this.getServiceUrl(iTwinId);
    if (!url)
      throw new IModelError(BentleyStatus.ERROR, "Unable to read reality data");

    const token = await IModelApp.getAccessToken();
    if (this.isContextShare && token) {
      const realityData = this.realityData;

      if (!realityData)
        throw new Error(`Reality Data not defined`);

      if (!realityData.rootDocument)
        throw new Error(`Root document not defined for reality data: ${realityData.id}`);

      return realityData.getTileJson(token, realityData.rootDocument);
    }

    // The following is only if the reality data is not stored on PW Context Share.
    const cesiumAsset = CesiumIonAssetProvider.parseCesiumUrl(url);
    if (cesiumAsset) {
      const tokenAndUrl = await getCesiumAccessTokenAndEndpointUrl(cesiumAsset.id, cesiumAsset.key);
      if (tokenAndUrl.url && tokenAndUrl.token) {
        url = tokenAndUrl.url;
        this._requestAuthorization = `Bearer ${tokenAndUrl.token}`;
      }
    }

    // The following is only if the reality data is not stored on PW Context Share.
    this.setBaseUrl(url);
    return this._doRequest(url, "json");
  }
  /**
   * Returns the tile content. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileContent(url: string): Promise<any> {
    assert(url !== undefined);
    const token = await IModelApp.getAccessToken();
    const useRds = this.isContextShare && token !== undefined;

    const tileUrl = this._baseUrl + url;
    if (useRds)
      return this.realityData!.getTileContent(token, tileUrl);

    return this._doRequest(tileUrl, "arraybuffer");
  }

  /**
   * Returns the tile content in json format. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileJson(url: string): Promise<any> {
    assert(url !== undefined);
    const token = await IModelApp.getAccessToken();
    const tileUrl = this._baseUrl + url;

    if (this.isContextShare && undefined !== token)
      return this.realityData!.getTileJson(token, tileUrl);

    return this._doRequest(tileUrl, "json");
  }
}

