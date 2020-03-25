/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import {
  TerrainProps,
  TerrainSettings,
} from "./TerrainSettings";

/** Describes the type of background map displayed by a [[DisplayStyle]]
 * @see [[BackgroundMapProps]]
 * @see [[DisplayStyleSettingsProps]]
 * @public
 */
export enum BackgroundMapType {
  Street = 1,
  Aerial = 2,
  Hybrid = 3,
}

/** Describes the projection of the background map
 * @see [[BackgroundMapProps]]
 * @see [[DisplayStyleSettingsProps]]
 * @public
 */
export enum GlobeMode {
  /** Display Earth as 3d ellipsoid */
  Ellipsoid = 0,
  /** Display Earth as plane. */
  Plane = 1,
}

/** JSON representation of the settings associated with a background map displayed by a [[DisplayStyle]].
 * @see [[DisplayStyleSettingsProps]]
 * @public
 */
export interface BackgroundMapProps {
  /** The elevation of the map in meters relative to sea level. Default value: 0. */
  groundBias?: number;
  /** Identifies the source of the map tiles. Currently supported providers are "BingProvider" and "MapBoxProvider". Support for additional providers may be added in the future.
   *
   * Default value: "BingProvider"
   */
  providerName?: string;
  /** Options for customizing the tiles supplied by the provider. If undefined, default values of all members are used. */
  providerData?: {
    /** The type of map graphics to request. Default value: BackgroundMapType.Hybrid. */
    mapType?: BackgroundMapType;
  };
  /** A transparency value from 0.0 (fully opaque) to 1.0 (fully transparent) to apply to map graphics when drawing, or false to indicate the transparency should not be overridden. Default value: false. */
  transparency?: number | false;
  /** If set to true, the map tiles will be rendered with depth, allowing them to obscure other geometry. Otherwise, they are always rendered behind all other geometry. Default value: false. */
  useDepthBuffer?: boolean;
  /** If true, terrain heights will be applied to the map; otherwise the map will be rendered as a plane. */
  applyTerrain?: boolean;
  /** Properties associated with terrain display.
   * @beta
   */
  terrainSettings?: TerrainProps;
  /** Globe Mode. Default value: GlobeMode.Ellipsoid
   * @beta
   */
  globeMode?: GlobeMode;
}

/** The current set of supported background map providers.
 * @beta
 */
export type BackgroundMapProviderName = "BingProvider" | "MapBoxProvider";

/** Normalized representation of a [[BackgroundMapProps]] for which type and provider have been validated and default values have been applied where explicit values not defined.
 * @beta
 */
export class BackgroundMapSettings {
  /** Elevation in meters, relative to sea level. */
  public readonly groundBias: number;
  /** Identifies the provider from which map image will be obtained. */
  public readonly providerName: BackgroundMapProviderName;
  /** The type of map graphics to be drawn. */
  public readonly mapType: BackgroundMapType;
  /** A transparency value from 0.0 (fully opaque) to 1.0 (fully transparent) to apply to map graphics when drawing, or false to indicate the transparency should not be overridden. Default value: false. */
  public readonly transparency: number | false;
  /** If set to true, the map tiles will be rendered with depth, allowing them to obscure other geometry. Otherwise, they are always rendered behind all other geometry. Default value: false. */
  public readonly useDepthBuffer: boolean;
  /** If true, terrain heights will be applied to the map; otherwise the map will be rendered as a plane. */
  public readonly applyTerrain: boolean;
  /**  Settings associated with terrain display
   * @beta
   */
  public readonly terrainSettings: TerrainSettings;
  /**  Globe display mode
   * @beta
   */
  public readonly globeMode: GlobeMode;

  /** If transparency is overridden, the transparency to apply; otherwise, undefined. */
  public get transparencyOverride(): number | undefined { return false !== this.transparency ? this.transparency : undefined; }

  private constructor(providerName: BackgroundMapProviderName = "BingProvider", mapType: BackgroundMapType = BackgroundMapType.Hybrid, groundBias = 0, useDepthBuffer = false, transparency: number | false = false, applyTerrain = false, terrainSettings?: TerrainProps, globeMode = GlobeMode.Ellipsoid) {
    this.groundBias = groundBias;
    this.providerName = providerName;
    this.useDepthBuffer = useDepthBuffer;
    this.transparency = false !== transparency ? Math.min(1, Math.max(0, transparency)) : false;
    this.applyTerrain = applyTerrain;

    switch (mapType) {
      case BackgroundMapType.Street:
      case BackgroundMapType.Aerial:
        this.mapType = mapType;
        break;
      default:
        this.mapType = BackgroundMapType.Hybrid;
    }

    this.globeMode = GlobeMode.Plane === globeMode ? globeMode : GlobeMode.Ellipsoid;

    this.terrainSettings = TerrainSettings.fromJSON(terrainSettings);
  }

  /** Construct from JSON, performing validation and applying default values for undefined fields. */
  public static fromJSON(json?: BackgroundMapProps): BackgroundMapSettings {
    if (undefined === json)
      return new BackgroundMapSettings();

    const providerName = ("MapBoxProvider" === json.providerName) ? "MapBoxProvider" : "BingProvider";
    const mapType = (undefined !== json.providerData) ? json.providerData.mapType : BackgroundMapType.Hybrid;
    const globeMode = (undefined !== json.globeMode) ? json.globeMode : GlobeMode.Ellipsoid;
    return new BackgroundMapSettings(providerName, mapType, json.groundBias, json.useDepthBuffer, json.transparency, json.applyTerrain, json.terrainSettings, globeMode);
  }

  public toJSON(): BackgroundMapProps {
    let terrainSettings: TerrainProps | undefined = this.terrainSettings.toJSON();
    let haveTerrainSettings = false;
    for (const prop of Object.values(terrainSettings)) {
      if (undefined !== prop) {
        haveTerrainSettings = true;
        break;
      }
    }

    if (!haveTerrainSettings)
      terrainSettings = undefined;

    return {
      groundBias: 0 !== this.groundBias ? this.groundBias : undefined,
      providerName: "BingProvider" !== this.providerName ? this.providerName : undefined,
      applyTerrain: this.applyTerrain ? true : undefined,
      providerData: BackgroundMapType.Hybrid !== this.mapType ? { mapType: this.mapType } : undefined,
      transparency: false !== this.transparency ? this.transparency : undefined,
      terrainSettings,
      globeMode: GlobeMode.Ellipsoid !== this.globeMode ? this.globeMode : undefined,
      useDepthBuffer: this.useDepthBuffer ? true : undefined,
    };
  }

  /** Returns true if these settings are equivalent to the supplied JSON settings. */
  public equalsJSON(json?: BackgroundMapProps): boolean {
    return this.equals(BackgroundMapSettings.fromJSON(json));
  }

  public equals(other: BackgroundMapSettings): boolean {
    return this.groundBias === other.groundBias && this.providerName === other.providerName && this.mapType === other.mapType
      && this.useDepthBuffer === other.useDepthBuffer && this.transparency === other.transparency && this.globeMode === other.globeMode && this.applyTerrain === other.applyTerrain && this.terrainSettings.equals(other.terrainSettings);
  }

  /** Create a copy of this BackgroundMapSettings, optionally modifying some of its properties.
   * @param changedProps JSON representation of the properties to change.
   * @returns A BackgroundMapSettings with all of its properties set to match those of `this`, except those explicitly defined in `changedProps`.
   */
  public clone(changedProps?: BackgroundMapProps): BackgroundMapSettings {
    if (undefined === changedProps)
      return this;

    const props = {
      providerName: undefined !== changedProps.providerName ? changedProps.providerName : this.providerName,
      groundBias: undefined !== changedProps.groundBias ? changedProps.groundBias : this.groundBias,
      transparency: undefined !== changedProps.transparency ? changedProps.transparency : this.transparency,
      useDepthBuffer: undefined !== changedProps.useDepthBuffer ? changedProps.useDepthBuffer : this.useDepthBuffer,
      applyTerrain: undefined !== changedProps.applyTerrain ? changedProps.applyTerrain : this.applyTerrain,
      terrainSettings: undefined !== changedProps.terrainSettings ? this.terrainSettings.clone(changedProps.terrainSettings) : this.terrainSettings,
      providerData: {
        mapType: undefined !== changedProps.providerData && undefined !== changedProps.providerData.mapType ? changedProps.providerData.mapType : this.mapType,
      },
      globeMode: undefined !== changedProps.globeMode ? changedProps.globeMode : this.globeMode,
    };

    return BackgroundMapSettings.fromJSON(props);
  }
}
