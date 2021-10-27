/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid, GuidString, Logger } from "@itwin/core-bentley";
import { OrbitGtBlobProps, RealityDataFormat, RealityDataProvider, RealityDataSourceKey, RealityDataSourceProps } from "@itwin/core-common";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { IModelApp } from "./IModelApp";

/** Utility function to convert a RealityDataSourceKey into its string representation
* @alpha
*/
export function realityDataSourceKeyToString(rdSourceKey: RealityDataSourceKey): string {
  return `${rdSourceKey.provider}:${rdSourceKey.format}:${rdSourceKey.id}:${rdSourceKey.iTwinId}`;
}

/** This class provides access to the reality data provider services.
* @alpha
*/
export class RealityDataSource {
  public readonly rdSourceKey: RealityDataSourceKey;
  /** The URL that supplies the 3d tiles for displaying the reality model. */
  private _tilesetUrl: string | undefined;
  private _isUrlResolved: boolean = false;

  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  protected constructor(props: RealityDataSourceProps) {
    this.rdSourceKey = props.sourceKey;
    this._isUrlResolved=false;
  }
  public static createRealityDataSourceKeyFromUrl(tilesetUrl: string, inputProvider?: RealityDataProvider, inputFormat?: RealityDataFormat): RealityDataSourceKey {
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
  public static createFromBlobUrl(blobUrl: string, inputProvider?: RealityDataProvider, inputFormat?: RealityDataFormat): RealityDataSourceKey {
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
  public static createKeyFromOrbitGtBlobProps(orbitGtBlob: OrbitGtBlobProps, inputProvider?: RealityDataProvider, inputFormat?: RealityDataFormat): RealityDataSourceKey {
    const format = inputFormat ? inputFormat : RealityDataFormat.OPC;
    if(orbitGtBlob.blobFileName && orbitGtBlob.blobFileName.toLowerCase().startsWith("http")) {
      return RealityDataSource.createFromBlobUrl(orbitGtBlob.blobFileName,inputProvider,format);
    } else if (orbitGtBlob.rdsUrl) {
      return RealityDataSource.createRealityDataSourceKeyFromUrl(orbitGtBlob.rdsUrl,inputProvider,format);
    }
    const provider = inputProvider ? inputProvider : RealityDataProvider.OrbitGtBlob;
    const id = `${orbitGtBlob.accountName}:${orbitGtBlob.containerName}:${orbitGtBlob.blobFileName}:?${orbitGtBlob.sasToken}`;
    return { provider, format, id };
  }
  public static createOrbitGtBlobPropsFromKey(rdSourceKey: RealityDataSourceKey): OrbitGtBlobProps | undefined {
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
  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  public static fromProps(props: RealityDataSourceProps): RealityDataSource {
    return new RealityDataSource(props);
  }
  public get isContextShare() {
    return (this.rdSourceKey.provider === RealityDataProvider.ContextShare);
  }
  public get realityDataId(): string | undefined {
    const realityDataId = this.isContextShare ? this.rdSourceKey.id : undefined;
    return realityDataId;
  }
  public get iTwinId(): string | undefined {
    return this.rdSourceKey.iTwinId;
  }

  /**
   * This method returns the URL to access the actual 3d tiles from the service provider.
   * @returns string containing the URL to reality data.
   */
  public async getServiceUrl(iTwinId: GuidString | undefined): Promise<string | undefined> {
    // If url was not resolved - resolve it
    if (this.isContextShare && !this._isUrlResolved) {
      const rdSourceKey = this.rdSourceKey;
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
    } else if (this.rdSourceKey.provider === RealityDataProvider.TilesetUrl || this.rdSourceKey.provider === RealityDataProvider.CesiumIonAsset) {
      this._tilesetUrl = this.rdSourceKey.id;
    }
    return this._tilesetUrl;
  }
}
