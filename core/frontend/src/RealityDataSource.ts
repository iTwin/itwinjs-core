/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid, GuidString, Logger } from "@bentley/bentleyjs-core";
import { RealityDataProvider, RealityDataSourceContextShareKey, RealityDataSourceKey, RealityDataSourceProps, RealityDataSourceURLKey } from "@bentley/imodeljs-common";
import { AccessToken } from "@bentley/itwin-client";
import { RealityDataClient } from "@bentley/reality-data-client";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { AuthorizedFrontendRequestContext } from "./FrontendRequestContext";
import { IModelApp } from "./IModelApp";

export function realityDataSourceKeyToString(rdSourceKey: RealityDataSourceKey): string {
  const contextShareKey = rdSourceKey as RealityDataSourceContextShareKey;
  if (contextShareKey) {
    return `${contextShareKey.provider}:${contextShareKey.realityDataId}`;
  }
  const urlKey = rdSourceKey as RealityDataSourceURLKey;
  if (urlKey) {
    return `${urlKey.provider}:${urlKey.tilesetUrl}`;
  }
  return "undefined";
}

export class RealityDataSource {
  public readonly rdSourceKey: RealityDataSourceKey;
  /** The URL that supplies the 3d tiles for displaying the reality model. */
  public tilesetUrl: string | undefined;
  public isUrlResolved: boolean = false;

  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  protected constructor(props: RealityDataSourceProps) {
    this.rdSourceKey = props.sourceKey;
    this.isUrlResolved=false;
  }
  public static createRealityDataSourceKeyFromUrl(tilesetUrl: string, inputProvider?: RealityDataProvider): RealityDataSourceKey {
    if (tilesetUrl.includes("$CesiumIonAsset=")) {
      const provider = inputProvider ? inputProvider : RealityDataProvider.CesiumIonAsset;
      const cesiumIonAssetKey: RealityDataSourceURLKey = { provider, tilesetUrl };
      return cesiumIonAssetKey;
    }

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
    const isOPC = attUrl.pathname.match(".opc*") !== null;
    const isRDSUrl = (urlParts1[partOffset1] === "Repositories") && (urlParts1[partOffset1 + 1].match("S3MXECPlugin--*") !== null) && (urlParts1[partOffset1 + 2] === "S3MX");
    // Make sure the url to compare are REALITYMESH3DTILES url, otherwise, compare the url directly
    if (isRDSUrl || isOPC) {
      // Make sure the reality data id are the same
      const guid1 = urlParts1.find(Guid.isGuid);
      if (guid1 !== undefined) {
        const provider = inputProvider ? inputProvider : isOPC ? RealityDataProvider.ContextShareOrbitGt : RealityDataProvider.ContextShare;
        const contextShareKey: RealityDataSourceContextShareKey = { provider, realityDataId: guid1 };
        return contextShareKey;
      }
    }
    // default to tileSetUrl
    const provider2 = inputProvider ? inputProvider : RealityDataProvider.TilesetUrl;
    const urlKey: RealityDataSourceURLKey = { provider: provider2, tilesetUrl };
    return urlKey;
  }
  public static createFromBlobUrl(blobUrl: string, inputProvider?: RealityDataProvider): RealityDataSourceKey {
    const url = new URL(blobUrl);

    // If we cannot interpret that url pass in parameter we just fallback to old implementation
    if(!url.pathname)
      return { provider: RealityDataProvider.TilesetUrl, tilesetUrl: blobUrl };

    // const accountName   = url.hostname.split(".")[0];
    const pathSplit     = url.pathname.split("/");
    const containerName = pathSplit[1];
    // const blobFileName  = `/${pathSplit[2]}`;
    // const sasToken      = url.search.substr(1);
    const isOPC = url.pathname.match(".opc*") !== null;
    const provider = inputProvider ? inputProvider : isOPC ? RealityDataProvider.ContextShareOrbitGt : RealityDataProvider.ContextShare;
    const contextShareKey: RealityDataSourceContextShareKey = { provider, realityDataId: containerName };
    return contextShareKey;
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
    return (this.rdSourceKey.provider === RealityDataProvider.ContextShare ||
            this.rdSourceKey.provider === RealityDataProvider.ContextShareOrbitGt);
  }
  public get realityDataId(): string | undefined {
    const sourceKey = this.rdSourceKey as RealityDataSourceContextShareKey;
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
      const rdSourceKey = this.rdSourceKey as RealityDataSourceContextShareKey;
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
    } else if (this.rdSourceKey.provider === RealityDataProvider.TilesetUrl || this.rdSourceKey.provider === RealityDataProvider.CesiumIonAsset) {
      const rdSourceKey = this.rdSourceKey as RealityDataSourceURLKey;
      this.tilesetUrl = rdSourceKey.tilesetUrl;
    }
    return this.tilesetUrl;
  }
}
