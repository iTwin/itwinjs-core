/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { BackgroundMapProps } from "./BackgroundMapSettings";

/** Identifies a [TerrainProvider]($frontend).
 * @see [[TerrainSettings.providerName]] and [[TerrainProps.providerName]].
 * @public
 * @extensions
 * @deprecated in 3.x. Use string instead.
 */
export type TerrainProviderName = string;

/** Ids of [Cesium ION assets](https://cesium.com/platform/cesium-ion/content/) providing global terrain data.
 * These values are appropriate to use with [[TerrainSettings.dataSource]] when [[TerrainSettings.providerName]] is set to "CesiumWorldTerrain".
 * You may alternatively use the Id of any ION asset to which you have access.
 * @see [[TerrainSettings.fromCesiumIonAsset]] to create TerrainSettings that obtain terrain from a specified ION asset.
 * @public
 */
export enum CesiumTerrainAssetId {
  /** Default [global 3d terrain](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/). */
  Default = "1",
  /** Global 3d terrain that includes [bathymetry](https://cesium.com/platform/cesium-ion/content/cesium-world-bathymetry/) (seafloor) terrain. */
  Bathymetry = "2426648",
}

/**  JSON representation of the settings of the terrain applied to background map display by a [[DisplayStyle]].
 * @see [[DisplayStyleSettingsProps]]
 * @see [[BackgroundMapProps]]
 * @public
 * @extensions
 */
export interface TerrainProps {
  /** Identifies the [TerrainProvider]($frontend) that will supply terrain meshes.
   * If omitted, it defaults to "CesiumWorldTerrain".
   */
  providerName?: string;
  /** Identifies the specific terrain data source to be supplied by the [TerrainProvider]($frontend) identified by [[providerName]],
   * for those providers that support multiple data sources.
   * For example, the "CesiumWorldTerrain" provider uses this field to store a [[CesiumTerrainAssetId]].
   * Default value: an empty string.
   */
  dataSource?: string;
  /** A value greater than one will cause terrain height to be exaggerated/scaled.false (or 1.0) indicate no exaggeration. Default value: 1.0 */
  exaggeration?: number;
  /**  Applying lighting can help to visualize subtle terrain variation.  Default value: true */
  applyLighting?: boolean;
  /** Origin value - height of the IModel origin at the project center as defined by heightOriginMode. Default value: 0.0 */
  heightOrigin?: number;
  /** Determines how/if the heightOrigin is applied to the terrain height. Default value: Geodetic */
  heightOriginMode?: TerrainHeightOriginMode;
  /** If true, the terrain will not be locatable. Otherwise, [[BackgroundMapProps.nonLocatable]] will determine whether terrain is locatable.
   * @internal use [[BackgroundMapProps.nonLocatable]]. Retained for backwards compatibility only.
   */
  nonLocatable?: boolean;
}

/** Correction modes for terrain height
 * @see [[TerrainProps]]
 * @public
 * @extensions
 */
export enum TerrainHeightOriginMode {
  /** Height value indicates the geodetic height of the IModel origin (also referred to as ellipsoidal or GPS height) */
  Geodetic = 0,
  /** Height value indicates the geoidal height of the IModel origin (commonly referred to as sea level). */
  Geoid = 1,
  /** Height value indicates the height of the IModel origin relative to ground level at project center. */
  Ground = 2,
}

/** Normalized version of [[TerrainProps]] for which provider has been validated and default values of all members are used.
 * @public
 */
export class TerrainSettings {
  private _nonLocatable: true | undefined;
  /** Identifies the [TerrainProvider]($frontend) that will supply terrain meshes.
   * Defaults to "CesiumWorldTerrain".
   */
  public readonly providerName: string;
  /** Identifies the specific terrain data source to be supplied by the [TerrainProvider]($frontend) identified by [[providerName]],
   * for those providers that support multiple data sources.
   * For example, the "CesiumWorldTerrain" provider uses this field to store a [[CesiumTerrainAssetId]].
   * Default value: an empty string.
   */
  public readonly dataSource: string;
  /** A value greater than one will cause terrain height to be exaggerated/scaled. 1.0 indicates no exaggeration. Default value: 1.0 */
  public readonly exaggeration: number;
  /**  Applying lighting can help to visualize subtle terrain variations. Default value: false */
  public readonly applyLighting: boolean;
  /** Origin value - height of the IModel origin at the project center as defined by heightOriginMode. Default value 0.0 */
  public readonly heightOrigin: number;
  /** Determines how/if the heightOrigin is applied to the terrain height. Default value: Geodetic */
  public readonly heightOriginMode: TerrainHeightOriginMode;
  /** Optionally overrides [[BackgroundMapSettings.locatable]]. For backwards compatibility only.
   * @see [[TerrainProps.nonLocatable]].
   * @internal
   */
  public get nonLocatable(): true | undefined {
    return this._nonLocatable;
  }

  /** @deprecated in 4.5.x. Use the overload that takes [[TerrainProps]]. */
  constructor(providerName?: string, exaggeration?: number, applyLighting?: boolean, heightOrigin?: number, heightOriginMode?: TerrainHeightOriginMode);

  constructor(props?: TerrainProps);

  /** @internal */
  constructor(providerNameOrProps: string | TerrainProps | undefined, exaggeration?: number, applyLighting?: boolean, heightOrigin?: number, heightOriginMode?: TerrainHeightOriginMode) {
    let providerName;
    let dataSource;
    let nonLocatable;
    if (typeof providerNameOrProps === "string") {
      providerName = providerNameOrProps;
    } else if (providerNameOrProps) {
      ({ providerName, dataSource, exaggeration, applyLighting, heightOrigin, heightOriginMode, nonLocatable } = providerNameOrProps);
    }

    this.providerName = providerName ?? "CesiumWorldTerrain";
    this.dataSource = dataSource ?? "";
    this.exaggeration = Math.min(100, Math.max(0.1, exaggeration ?? 1.0));
    this.applyLighting = applyLighting ?? false;
    this.heightOrigin = heightOrigin ?? 0.0;

    if (true === nonLocatable)
      this._nonLocatable = true;

    switch (heightOriginMode) {
      case TerrainHeightOriginMode.Ground:
      case TerrainHeightOriginMode.Geoid:
        this.heightOriginMode = heightOriginMode;
        break;
      default:
        this.heightOriginMode = TerrainHeightOriginMode.Geodetic;
        break;
    }
  }

  public static fromJSON(json?: TerrainProps) {
    return new TerrainSettings(json);
  }

  /** Create settings that obtain terrain from a [Cesium ION asset](https://cesium.com/platform/cesium-ion/content/) such as
   * one of those defined by [[CesiumTerrainAssetId]].
   * @note You must ensure your Cesium ION account has access to the specified asset.
   */
  public static fromCesiumIonAsset(assetId: string = CesiumTerrainAssetId.Default, options?: Omit<TerrainProps, "providerName" | "dataSource">): TerrainSettings {
    return TerrainSettings.fromJSON({
      ...options,
      dataSource: assetId,
    });
  }

  public toJSON(): TerrainProps {
    const props: TerrainProps = { heightOriginMode: this.heightOriginMode };
    if ("CesiumWorldTerrain" !== this.providerName)
      props.providerName = this.providerName;
    if (this.dataSource)
      props.dataSource = this.dataSource;
    if (1 !== this.exaggeration)
      props.exaggeration = this.exaggeration;
    if (this.nonLocatable)
      props.nonLocatable = true;
    if (this.applyLighting)
      props.applyLighting = true;
    if (0 !== this.heightOrigin)
      props.heightOrigin = this.heightOrigin;

    return props;
  }

  public equals(other: TerrainSettings): boolean {
    return this.providerName === other.providerName && this.dataSource === other.dataSource && this.exaggeration === other.exaggeration && this.applyLighting === other.applyLighting
      && this.heightOrigin === other.heightOrigin && this.heightOriginMode === other.heightOriginMode && this.nonLocatable === other.nonLocatable;
  }

  /** Returns true if these settings are equivalent to the supplied JSON settings. */
  public equalsJSON(json?: BackgroundMapProps): boolean {
    return this.equals(TerrainSettings.fromJSON(json));
  }

  /** Create a copy of this TerrainSettings, optionally modifying some of its properties.
   * @param changedProps JSON representation of the properties to change.
   * @returns A TerrainSettings with all of its properties set to match those of`this`, except those explicitly defined in `changedProps`.
   */
  public clone(changedProps?: TerrainProps): TerrainSettings {
    if (undefined === changedProps)
      return this;

    const props = {
      providerName: changedProps.providerName ?? this.providerName,
      dataSource: changedProps.dataSource ?? this.dataSource,
      exaggeration: changedProps.exaggeration ?? this.exaggeration,
      nonLocatable: changedProps.nonLocatable ?? this.nonLocatable,
      applyLighting: changedProps.applyLighting ?? this.applyLighting,
      heightOrigin: changedProps.heightOrigin ?? this.heightOrigin,
      heightOriginMode: changedProps.heightOriginMode ?? this.heightOriginMode,
    };

    return TerrainSettings.fromJSON(props);
  }
}
