/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid } from "@itwin/core-bentley";
import { RealityDataFormat, RealityDataProvider } from "@itwin/core-common";

/**
 * This class provide methods used to interpret url to Project Wise Context Share (RealityDataProvider.ContextShare)
 * @internal
 */
export class ContextShareProvider {
  /** Return true if this is a supported url to this service provider */
  public static isProviderUrl(tilesetUrl: string): boolean {
    // Try to extract realityDataId from URL and if not possible, use the url as the key
    let attUrl: URL;
    try {
      attUrl = new URL(tilesetUrl);
    } catch (e) {
      // Not a valid URL for Context share
      return false;
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
      const isRDSUrl = (urlParts1[partOffset1] === "Repositories") && (urlParts1[partOffset1 + 1].match("S3MXECPlugin--*") !== null) && (urlParts1[partOffset1 + 2] === "S3MX");
      return isRDSUrl;
    }
    return false;
  }
  /** Return true if this is a supported url to this service provider */
  public static getInfoFromUrl(tilesetUrl: string): {provider: RealityDataProvider, format: RealityDataFormat, id: string, iTwinId: string | undefined} {
    const invalidUrlInfo = { provider: RealityDataProvider.TilesetUrl, format: RealityDataFormat.ThreeDTile, id: tilesetUrl, iTwinId: undefined };
    let attUrl: URL;
    try {
      attUrl = new URL(tilesetUrl);
    } catch (e) {
      // Not a valid URL and not equal, probably $cesiumAsset
      return invalidUrlInfo;
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
          const provider = RealityDataProvider.ContextShare;
          const format = isOPC ? RealityDataFormat.OPC : RealityDataFormat.ThreeDTile;
          const contextShareKey = { provider, format, id: guid1, iTwinId: projectId };
          return contextShareKey;
        }
      }
    }
    // Not a valid URL and not equal, probably $cesiumAsset
    return invalidUrlInfo;
  }
  public static getInfoFromBlobUrl(blobUrl: string): {provider: RealityDataProvider, format: RealityDataFormat, id: string } {
    let format = RealityDataFormat.ThreeDTile;
    let provider = RealityDataProvider.TilesetUrl;
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
    provider = RealityDataProvider.ContextShare;
    format = isOPC ? RealityDataFormat.OPC : RealityDataFormat.ThreeDTile;
    const contextShareKey = { provider, format, id: containerName };
    return contextShareKey;
  }
}
