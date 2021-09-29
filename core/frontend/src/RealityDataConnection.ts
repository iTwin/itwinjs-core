/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid, GuidString, Logger } from "@bentley/bentleyjs-core";
import { RealityDataProvider, RealityDataSourceContextShareKey, RealityDataSourceKey, RealityDataSourceProps, RealityDataSourceURLKey } from "@bentley/imodeljs-common";
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

  public get isContextShare() {
    return (this._rdSourceKey.provider === RealityDataProvider.ContextShare ||
            this._rdSourceKey.provider === RealityDataProvider.ContextShareOrbitGt);
  }
  public get realityDataId(): string | undefined {
    const sourceKey = this._rdSourceKey as RealityDataSourceContextShareKey;
    return sourceKey.realityDataId;
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
  public async getServiceUrl(iTwinId: GuidString | undefined): Promise<string | undefined> {
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

          this.tilesetUrl = await client.getRealityDataUrl(authRequestContext, iTwinId, rdSourceKey.realityDataId);
          this.isUrlResolved=true;
        }
      } catch (e) {
        const errMsg = `Error getting URL from ContextShare using realityDataId=${rdSourceKey.realityDataId} and iTwinId=${iTwinId}`;
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

  public static async createFromSourceKey(sk: RealityDataSourceKey, iTwinId: GuidString | undefined): Promise<RealityDataConnection | undefined> {
    const props: RealityDataSourceProps = {sourceKey: sk};
    const rdConnection = new RealityDataConnection(props);
    let tilesetUrl: string | undefined;
    try {
      await rdConnection.queryRealityData(iTwinId);
      tilesetUrl = await rdConnection._rdSource.getServiceUrl(iTwinId);
    } catch (e) {
    }

    return (tilesetUrl !== undefined) ? rdConnection : undefined;
  }
  public static async createFromUrl(url: string, iTwinId: GuidString): Promise<RealityDataConnection | undefined>  {
    const sourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(url);
    return RealityDataConnection.createFromSourceKey(sourceKey, iTwinId);
  }

  public async queryRealityData(iTwinId: GuidString | undefined) {
    if (this._rdSource.isContextShare && !this._rd) {
      const token = await this._rdSource.getAccessToken();
      if (token && this._rdSource.realityDataId) {
        const client = new RealityDataClient();      // we need to resolve tilesetURl from realityDataId and iTwinId
        const requestContext = new AuthorizedFrontendRequestContext(token);
        this._rd = await client.getRealityData(requestContext,iTwinId, this._rdSource.realityDataId);
      }
    }
  }

  public get realityData(): RealityData | undefined {
    return this._rd;
  }

  public get realityDataType(): string | undefined {
    return this._rd?.type;
  }
  public async getServiceUrl(iTwinId: GuidString | undefined): Promise<string | undefined> {
    return this._rdSource.getServiceUrl(iTwinId);
  }
}
