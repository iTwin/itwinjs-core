/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { PlanarClipMaskProps, PlanarClipMaskSettings } from "./PlanarClipMask";
import { TerrainProps, TerrainSettings } from "./TerrainSettings";

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
  /** The elevation of the map in meters relative the WGS84 ellipsoid. Default value: 0. */
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
  /** Properties associated with terrain display. */
  terrainSettings?: TerrainProps;
  /** Globe Mode. Default value: GlobeMode.Ellipsoid */
  globeMode?: GlobeMode;
  /** If true, the map will be treated as non-locatable - i.e., tools will not interact with it. This is particularly useful when the map is transparent - it
   * allows the user to select elements that are behind the map.
   */
  nonLocatable?: boolean;
  /** A planar mask applied to the map geometry
   * @beta
   */
  planarClipMask?: PlanarClipMaskProps;
}

/** The current set of supported background map providers.
 * @public
 */
export type BackgroundMapProviderName = "BingProvider" | "MapBoxProvider";

function normalizeMapType(props: BackgroundMapProps): BackgroundMapType {
  switch (props.providerData?.mapType) {
    case BackgroundMapType.Street:
    case BackgroundMapType.Aerial:
      return props.providerData.mapType;
    default:
      return BackgroundMapType.Hybrid;
  }
}

function normalizeGlobeMode(mode?: GlobeMode): GlobeMode {
  return GlobeMode.Plane === mode ? mode : GlobeMode.Ellipsoid;
}

function normalizeTransparency(trans?: number | false): number | false {
  if ("number" === typeof trans)
    return Math.min(1, Math.max(0, trans));

  return false;
}

function normalizeProviderName(provider?: string): BackgroundMapProviderName {
  return "MapBoxProvider" === provider ? provider : "BingProvider";
}

/** Normalized representation of a [[BackgroundMapProps]] for which type and provider have been validated and default values have been applied where explicit values not defined.
 * @public
 */
export class BackgroundMapSettings {
  /** Elevation in meters, relative to WGS84 Ellipsoid.. */
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
  /**  Settings associated with terrain display. */
  public readonly terrainSettings: TerrainSettings;
  /** Globe display mode. */
  public readonly globeMode: GlobeMode;
  /** Planar Mask - used to mask the background map to avoid overlapping with other geometry
   * @beta
   */
  public readonly planarClipMask: PlanarClipMaskSettings;
  private readonly _locatable: boolean;
  /** If false, the map will be treated as non-locatable - i.e., tools will not interact with it. This is particularly useful when the map is transparent - it
   * allows the user to select elements that are behind the map.
   */
  public get locatable(): boolean {
    // Handle deprecated TerrainProps.nonLocatable:
    // - If TerrainProps.nonLocatable=true and terrain is on, terrain is not locatable.
    // - Otherwise, use BackgroundMapProps.nonLocatable.
    if (this.applyTerrain && !this.terrainSettings.locatable) // eslint-disable-line deprecation/deprecation
      return false;

    return this._locatable;
  }

  /** If transparency is overridden, the transparency to apply; otherwise, undefined. */
  public get transparencyOverride(): number | undefined { return false !== this.transparency ? this.transparency : undefined; }

  private constructor(props: BackgroundMapProps) {
    this.groundBias = props.groundBias ?? 0;
    this.providerName = normalizeProviderName(props.providerName);
    this.mapType = normalizeMapType(props);
    this.transparency = normalizeTransparency(props.transparency);
    this.useDepthBuffer = props.useDepthBuffer ?? false;
    this.applyTerrain = props.applyTerrain ?? false;
    this.terrainSettings = TerrainSettings.fromJSON(props.terrainSettings);
    this.globeMode = normalizeGlobeMode(props.globeMode);
    this._locatable = true !== props.nonLocatable;
    this.planarClipMask = PlanarClipMaskSettings.fromJSON(props.planarClipMask);
  }

  /** Construct from JSON, performing validation and applying default values for undefined fields. */
  public static fromJSON(json?: BackgroundMapProps): BackgroundMapSettings {
    return new BackgroundMapSettings(json ?? {});
  }

  public toJSON(): BackgroundMapProps {
    const props: BackgroundMapProps = {};
    if (0 !== this.groundBias)
      props.groundBias = this.groundBias;
    if ("BingProvider" !== this.providerName)
      props.providerName = this.providerName;
    if (this.applyTerrain)
      props.applyTerrain = true;
    if (BackgroundMapType.Hybrid !== this.mapType)
      props.providerData = { mapType: this.mapType };
    if (false !== this.transparency)
      props.transparency = this.transparency;
    if (GlobeMode.Ellipsoid !== this.globeMode)
      props.globeMode = this.globeMode;
    if (this.useDepthBuffer)
      props.useDepthBuffer = true;
    if (!this._locatable)
      props.nonLocatable = true;

    const terrainSettings = this.terrainSettings.toJSON();
    for (const prop of Object.values(terrainSettings)) {
      if (undefined !== prop) {
        props.terrainSettings = terrainSettings;
        break;
      }
    }
    if (this.planarClipMask.isValid)
      props.planarClipMask = this.planarClipMask.toJSON();

    return props;
  }

  /** Returns true if these settings are equivalent to the supplied JSON settings. */
  public equalsJSON(json?: BackgroundMapProps): boolean {
    return this.equals(BackgroundMapSettings.fromJSON(json));
  }

  public equals(other: BackgroundMapSettings): boolean {
    return this.groundBias === other.groundBias && this.providerName === other.providerName && this.mapType === other.mapType
      && this.useDepthBuffer === other.useDepthBuffer && this.transparency === other.transparency && this.globeMode === other.globeMode
      && this._locatable === other._locatable && this.applyTerrain === other.applyTerrain && this.terrainSettings.equals(other.terrainSettings) && this.planarClipMask.equals(other.planarClipMask);
  }

  /** Create a copy of this BackgroundMapSettings, optionally modifying some of its properties.
   * @param changedProps JSON representation of the properties to change.
   * @returns A BackgroundMapSettings with all of its properties set to match those of `this`, except those explicitly defined in `changedProps`.
   */
  public clone(changedProps?: BackgroundMapProps): BackgroundMapSettings {
    if (undefined === changedProps)
      return this;

    const props = {
      providerName: changedProps.providerName ?? this.providerName,
      groundBias: changedProps.groundBias ?? this.groundBias,
      transparency: changedProps.transparency ?? this.transparency,
      useDepthBuffer: changedProps.useDepthBuffer ?? this.useDepthBuffer,
      globeMode: changedProps.globeMode ?? this.globeMode,
      nonLocatable: changedProps.nonLocatable ?? !this._locatable,
      applyTerrain: changedProps.applyTerrain ?? this.applyTerrain,
      terrainSettings: changedProps.terrainSettings ? this.terrainSettings.clone(changedProps.terrainSettings).toJSON() : this.terrainSettings.toJSON(),
      providerData: {
        mapType: changedProps.providerData?.mapType ?? this.mapType,
      },
      planarClipMask: changedProps.planarClipMask ? this.planarClipMask.clone(changedProps.planarClipMask).toJSON() : this.planarClipMask.toJSON(),
    };

    return BackgroundMapSettings.fromJSON(props);
  }
}
