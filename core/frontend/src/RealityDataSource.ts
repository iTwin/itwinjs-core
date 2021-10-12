/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid, GuidString, Logger } from "@itwin/core-bentley";
import { RealityDataFormat, RealityDataProvider, RealityDataSourceKey, RealityDataSourceProps } from "@itwin/core-common";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { IModelApp } from "./IModelApp";
import { RealityData } from "./RealityDataAccessProps";

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
    if (tilesetUrl.includes("$CesiumIonAsset=")) {
      const provider = inputProvider ? inputProvider : RealityDataProvider.CesiumIonAsset;
      const cesiumIonAssetKey: RealityDataSourceKey = { provider, format, id: tilesetUrl };
      return cesiumIonAssetKey;
    }

    // Try to extract realityDataId from URL and if not possible, use the url as the key
    let attUrl: URL;
    try {
      attUrl = new URL(tilesetUrl);
    } catch (e) {
      // Not a valid URL and not equal, probably $cesiumAsset
      const invalidUrlKey: RealityDataSourceKey = { provider: RealityDataProvider.TilesetUrl,  format, id: tilesetUrl };
      return invalidUrlKey;
    }
    // detect if it is a RDS url
    const formattedUrl1 = attUrl.pathname.replace(/~2F/g, "/").replace(/\\/g, "/");
    if (formattedUrl1) {
      const urlParts1 = formattedUrl1.split("/").map((entry: string) => entry.replace(/%2D/g, "-"));
      let partOffset1: number = 0;
      urlParts1.find((value, index) => {
        if (value === "Repositories") {
          partOffset1 = index;
          return true;
        }
        return false;
      });
      const isOPC = attUrl.pathname.match(".opc*") !== null;
      const isRDSUrl = (urlParts1[partOffset1] === "Repositories") && (urlParts1[partOffset1 + 1].match("S3MXECPlugin--*") !== null) && (urlParts1[partOffset1 + 2] === "S3MX");
      let projectId: string | undefined;
      const projectIdSection = urlParts1.find((val: string) => val.includes("--"));
      if (projectIdSection)
        projectId = projectIdSection.split("--")[1];
      // Make sure the url to compare are REALITYMESH3DTILES url, otherwise, compare the url directly
      if (isRDSUrl || isOPC) {
        // Make sure the reality data id are the same
        const guid1 = urlParts1.find(Guid.isGuid);
        if (guid1 !== undefined) {
          const provider = inputProvider ? inputProvider : RealityDataProvider.ContextShare;
          format = inputFormat ? inputFormat : isOPC ? RealityDataFormat.OPC : RealityDataFormat.ThreeDTile;
          const contextShareKey: RealityDataSourceKey = { provider, format, id: guid1, iTwinId: projectId };
          return contextShareKey;
        }
      }
    }

    // default to tileSetUrl
    const provider2 = inputProvider ? inputProvider : RealityDataProvider.TilesetUrl;
    const urlKey: RealityDataSourceKey = { provider: provider2, format, id: tilesetUrl };
    return urlKey;
  }
  export function createKeyFromBlobUrl(blobUrl: string, inputProvider?: RealityDataProvider, inputFormat?: RealityDataFormat): RealityDataSourceKey {
    let format = inputFormat ? inputFormat : RealityDataFormat.ThreeDTile;
    let provider = inputProvider ? inputProvider : RealityDataProvider.TilesetUrl;
    const url = new URL(blobUrl);

    // If we cannot interpret that url pass in parameter we just fallback to old implementation
    if(!url.pathname)
      return { provider, format, id: blobUrl };

    // const accountName   = url.hostname.split(".")[0];
    let containerName= "";
    if (url.pathname) {
      const pathSplit = url.pathname.split("/");
      containerName = pathSplit[1];
    }

    // const blobFileName  = `/${pathSplit[2]}`;
    // const sasToken      = url.search.substr(1);
    const isOPC = url.pathname.match(".opc*") !== null;
    provider = inputProvider ? inputProvider : RealityDataProvider.ContextShare;
    format = inputFormat ? inputFormat : isOPC ? RealityDataFormat.OPC : RealityDataFormat.ThreeDTile;
    const contextShareKey: RealityDataSourceKey = { provider, format, id: containerName };
    return contextShareKey;
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
* @alpha
*/
class RealityDataSourceImpl implements RealityDataSource {
  private static _realityDataSources = new Map<string, RealityDataSource>();
  public readonly key: RealityDataSourceKey;
  /** The URL that supplies the 3d tiles for displaying the reality model. */
  private _tilesetUrl: string | undefined;
  private _isUrlResolved: boolean = false;
  private _rd: RealityData | undefined;

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
      }
    }
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
}
