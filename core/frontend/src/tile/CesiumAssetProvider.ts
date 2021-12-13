/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * This class provide methods used to interpret url to a cesiumIon asset (RealityDataProvider.CesiumIonAsset)
 * @internal
 */
export class CesiumIonAssetProvider {
  public static osmBuildingId="OSMBuildings";
  /** Return true if this is a supported url to this service provider */
  public static isProviderUrl(url: string): boolean {
    return url.includes("$CesiumIonAsset=");
  }
  // TBD - Allow an object to override the URL and provide its own authentication.
  public static parseCesiumUrl(url: string): { id: number, key: string } | undefined {
    const cesiumSuffix = "$CesiumIonAsset=";
    const cesiumIndex = url.indexOf(cesiumSuffix);
    if (cesiumIndex < 0)
      return undefined;
    const cesiumIonString = url.slice(cesiumIndex + cesiumSuffix.length);
    const cesiumParts = cesiumIonString.split(":");
    if (cesiumParts.length !== 2)
      return undefined;

    const id = parseInt(cesiumParts[0], 10);
    if (id === undefined)
      return undefined;

    return { id, key: cesiumParts[1] };
  }
}
