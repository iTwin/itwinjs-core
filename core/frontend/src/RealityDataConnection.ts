/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid, Logger } from "@bentley/bentleyjs-core";
import { RealityDataConnectionProps, RealityDataProvider, RealityDataSourceContextShareKey, RealityDataSourceKey, RealityDataSourceProps, RealityDataSourceURLKey } from "@bentley/imodeljs-common";
import { AccessToken } from "@bentley/itwin-client";
import { RealityData, RealityDataClient } from "@bentley/reality-data-client";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { IModelApp } from "./IModelApp";

export class RealityDataSource {
  protected readonly _rdSourceKey: RealityDataSourceKey;
  /** The URL that supplies the 3d tiles for displaying the reality model. */
  public tilesetUrl: string | undefined;
  public isUrlResolved: boolean = false;

  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  protected constructor(props: RealityDataSourceProps) {
    this._rdSourceKey = props.sourceKey;
    this.isUrlResolved=false;
  }

  public static createRealityDataSourceKeyFromUrl(tilesetUrl: string, inputProvider?: RealityDataProvider): RealityDataSourceKey {
    // TODO: Check for OSMBuilding
    // if (tilesetUrl.includes("$CesiumIonAsset="))
    //   return getOSMBuildingsKey();
    // Try to extract realityDataId from URL and if not possible, use the url as the key
    let attUrl: URL;
    try {
      attUrl = new URL(tilesetUrl);
    } catch (e) {
      // Not a valid URL and not equal, probably $cesiumAsset
      const invalidUrlKey: RealityDataSourceURLKey = { provider: RealityDataProvider.TilesetUrl, tilesetUrl };
      return invalidUrlKey;
    }
    // detect if it is a RDS url
    const formattedUrl1 = attUrl.pathname.replace(/~2F/g, "/").replace(/\\/g, "/");
    const urlParts1 = formattedUrl1.split("/").map((entry: string) => entry.replace(/%2D/g, "-"));
    let partOffset1: number = 0;
    urlParts1.find((value, index) => {
      if (value === "Repositories") {
        partOffset1 = index;
        return true;
      }
      return false;
    });
    const isOPC1 = attUrl.pathname.match(".opc*") !== null;
    const isRDSUrl1 = (urlParts1[partOffset1] === "Repositories") && (urlParts1[partOffset1 + 1].match("S3MXECPlugin--*") !== null) && (urlParts1[partOffset1 + 2] === "S3MX");
    // Make sure the url to compare are REALITYMESH3DTILES url, otherwise, compare the url directly
    if (isRDSUrl1 || isOPC1) {
      // Make sure the reality data id are the same
      const guid1 = urlParts1.find(Guid.isGuid);
      if (guid1 !== undefined) {
        // TODO: extract projectId from tileset URL
        const provider = inputProvider ? inputProvider : isOPC1 ? RealityDataProvider.ContextShareOrbitGt : RealityDataProvider.ContextShare;
        const contextShareKey: RealityDataSourceContextShareKey = { provider, realityDataId: guid1 };
        return contextShareKey;
      }
    }
    // default to tileSetUrl
    const provider2 = inputProvider ? inputProvider : RealityDataProvider.TilesetUrl;
    const urlKey: RealityDataSourceURLKey = { provider: provider2, tilesetUrl };
    return urlKey;
  }
  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  public static fromProps(props: RealityDataSourceProps): RealityDataSource {
    return new RealityDataSource(props);
  }
  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  public static fromUrl(url: string): RealityDataSource {
    const sourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(url);
    const props: RealityDataSourceProps = {
      sourceKey,
    };
    return new RealityDataSource(props);
  }
  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  // public toProps(): RealityDataSourceProps {
  //   let sourceKey: RealityDataSourceKey;
  //   if (this.realityDataId)
  //     sourceKey = { provider: RealityDataProvider.ContextShare, realityDataId: this.realityDataId, iTwinId: this.iTwinId};
  //   else
  //     sourceKey = {provider: RealityDataProvider.TilesetUrl, tilesetUrl: this.tilesetUrl};
  //   const props: RealityDataSourceProps = {
  //     sourceKey,
  //   };
  //   return props;
  // }
  public get isContextShare() {
    return (this._rdSourceKey.provider === RealityDataProvider.ContextShare ||
            this._rdSourceKey.provider === RealityDataProvider.ContextShareOrbitGt);
  }
  public get realityDataId(): string | undefined {
    const sourceKey = this._rdSourceKey as RealityDataSourceContextShareKey;
    return sourceKey.realityDataId;
  }
  public get iTwinId(): string | undefined {
    const sourceKey = this._rdSourceKey as RealityDataSourceContextShareKey;
    return sourceKey.iTwinId;
  }
  public async getAccessToken(): Promise<AccessToken | undefined> {
    if (!IModelApp.authorizationClient || !IModelApp.authorizationClient.hasSignedIn)
      return undefined; // Not signed in
    let accessToken: AccessToken;
    try {
      accessToken = await IModelApp.authorizationClient.getAccessToken();
    } catch (error) {
      return undefined;
    }
    return accessToken;
  }
  /**
   * This method returns the URL to access the actual 3d tiles from the service provider.
   * @returns string containing the URL to reality data.
   */
  public async getServiceUrl(): Promise<string | undefined> {
    // If url was not resolved - resolve it
    if (this.isContextShare && !this.isUrlResolved) {
      const rdSourceKey = this._rdSourceKey as RealityDataSourceContextShareKey;
      // we need to resolve tilesetURl from realityDataId and iTwinId
      const client = new RealityDataClient();
      try {
        const accessToken = await this.getAccessToken();
        if (accessToken) {
          const authRequestContext = new AuthorizedFrontendRequestContext(accessToken);
          authRequestContext.enter();

          this.tilesetUrl = await client.getRealityDataUrl(authRequestContext, rdSourceKey.iTwinId, rdSourceKey.realityDataId);
          this.isUrlResolved=true;
        }
      } catch (e) {
        const errMsg = `Error getting URL from ContextShare using realityDataId=${rdSourceKey.realityDataId} and iTwinId=${rdSourceKey.iTwinId}`;
        Logger.logError(FrontendLoggerCategory.RealityData, errMsg);
      }
    } else if (this._rdSourceKey.provider === RealityDataProvider.TilesetUrl) {
      const rdSourceKey = this._rdSourceKey as RealityDataSourceURLKey;
      this.tilesetUrl = rdSourceKey.tilesetUrl;
    }
    return this.tilesetUrl;
  }
}
export class RealityDataConnection {
  private _rd: RealityData | undefined;
  private _rdSource: RealityDataSource;

  private constructor(props: RealityDataSourceProps) {
    this._rdSource = RealityDataSource.fromProps(props);
  }

  /** Create a new RealityDataConnection object from a set of properties.
   * @param props JSON representation of the reality data source or RealityDataConnectionProps
   */
  public static async createFromProps(props: RealityDataSourceProps | RealityDataConnectionProps): Promise<RealityDataConnection | undefined>  {
    const rdConnection = new RealityDataConnection(props);
    let tilesetUrl: string | undefined;
    try {
      await rdConnection.queryRealityData();
      tilesetUrl = await rdConnection._rdSource.getServiceUrl();
    } catch (e) {
    }

    return (tilesetUrl !== undefined) ? rdConnection : undefined;
  }
  public static async createFromSourceKey(sk: RealityDataSourceKey): Promise<RealityDataConnection | undefined> {
    const props = {provider: sk.provider, sourceKey: sk};
    return RealityDataConnection.createFromProps(props);
  }
  public static async createFromUrl(url: string): Promise<RealityDataConnection | undefined>  {
    const sourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(url);
    return RealityDataConnection.createFromSourceKey(sourceKey);
  }

  public async queryRealityData() {
    if (this._rdSource.isContextShare && !this._rd) {
      const token = await this._rdSource.getAccessToken();
      if (token && this._rdSource.realityDataId) {
        const client = new RealityDataClient();      // we need to resolve tilesetURl from realityDataId and iTwinId
        const requestContext = new AuthorizedFrontendRequestContext(token);
        this._rd = await client.getRealityData(requestContext,this._rdSource.iTwinId, this._rdSource.realityDataId);
      }
    }
  }

  public get realityData(): RealityData | undefined {
    return this._rd;
  }

  public get realityDataType(): string | undefined {
    return this._rd?.type;
  }
  public async getServiceUrl(): Promise<string | undefined> {
    return this._rdSource.getServiceUrl();
  }
  /** Serialize a RealityDataConnection to JSON. The returned JSON can later be passed to [deserializeViewState] to reinstantiate the ViewState.
   * @beta
   */
  // public toProps(): RealityDataConnectionProps {
  //   const props: RealityDataConnectionProps = {
  //     sourceKey: this._rdSource,
  //     realityDataId: this._rdSource.realityDataId,
  //     iTwinId: this._rdSource.iTwinId,
  //     realityDataType: this.realityDataType,
  //     tilesetUrl: this._tilesetUrl,
  //   };
  //   return props;
  // }
}
