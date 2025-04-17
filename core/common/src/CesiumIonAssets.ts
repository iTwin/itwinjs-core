
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

/** Ids of [Cesium ion assets](https://cesium.com/platform/cesium-ion/content/) providing global terrain data.
 * These values are appropriate to use with [[TerrainSettings.dataSource]] when [[TerrainSettings.providerName]] is set to "CesiumWorldTerrain".
 * You may alternatively use the Id of any ion asset to which you have access.
 * @see [[TerrainSettings.fromCesiumIonAsset]] to create TerrainSettings that obtain terrain from a specified ion asset.
 * @public
 */
export enum CesiumTerrainAssetId {
  /** Default [global 3d terrain](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/). */
  Default = "1",
  /** Global 3d terrain that includes [bathymetry](https://cesium.com/platform/cesium-ion/content/cesium-world-bathymetry/) (seafloor) terrain. */
  Bathymetry = "2426648",
}

/** Ids of [Cesium ion assets](https://cesium.com/platform/cesium-ion/content/) providing data not covered by [[CesiumTerrainAssetId]].
 * @beta
 */
export enum CesiumIonAssetId {
  /** [Cesium OSM Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/). */
  OSMBuildings = "96188",
}
