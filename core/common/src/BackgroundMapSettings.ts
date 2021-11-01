/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { BackgroundMapProvider, BackgroundMapType } from "./BackgroundMapProvider";
import { PlanarClipMaskProps, PlanarClipMaskSettings } from "./PlanarClipMask";
import { TerrainProps, TerrainSettings } from "./TerrainSettings";

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

/** In-memory JSON representation of a [[BackgroundMapSettings]].
 * @see [[PersistentBackgroundMapProps]] for the persistent JSON representation.
 * @public
 */
export interface BackgroundMapProps {
  /** The elevation of the map in meters relative the WGS84 ellipsoid. Default value: 0. */
  groundBias?: number;
  /** A transparency value from 0.0 (fully opaque) to 1.0 (fully transparent) to apply to map graphics when drawing, or false to indicate the transparency should not be overridden.
   * Default value: false.
   */
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

  /** @see [[DeprecatedBackgroundMapProps.providerName]]. */
  providerName?: never;
  /** @see [[DeprecatedBackgroundMapProps.providerData]]. */
  providerData?: never;
}

/** Properties of [[PersistentBackgroundMapProps]] that have been deprecated, but are retained for backwards compatibility.
 * These properties are omitted from [[BackgroundMapProps]] as they are no longer part of the API, but are included in
 * [[PersistentBackgroundMapProps]] because they remain part of the persistence format.
 * @public
 */
export interface DeprecatedBackgroundMapProps {
  /** Identifies the source of the map tiles. Currently supported providers are "BingProvider" and "MapBoxProvider".
   * Default value: "BingProvider"
   * @deprecated use MapImageryProps.backgroundBase.
   */
  providerName?: string;
  /** Options for customizing the tiles supplied by the provider. If undefined, default values of all members are used.
   * @deprecated use MapImageryProps.backgroundBase
   */
  providerData?: {
    /** The type of map graphics to request. Default value: BackgroundMapType.Hybrid. */
    mapType?: BackgroundMapType;
  };
}

/** Persistent JSON representation of a [[BackgroundMapSettings]].
 * @public
 */
export type PersistentBackgroundMapProps = Omit<BackgroundMapProps, keyof DeprecatedBackgroundMapProps> & DeprecatedBackgroundMapProps;

function normalizeGlobeMode(mode?: GlobeMode): GlobeMode {
  return GlobeMode.Plane === mode ? mode : GlobeMode.Ellipsoid;
}

function normalizeTransparency(trans?: number | false): number | false {
  if ("number" === typeof trans)
    return Math.min(1, Math.max(0, trans));

  return false;
}

/** As part of a [[DisplayStyleSettings]], controls aspects of how the background map is displayed.
 * @see [[DisplayStyleSettings.backgroundMap]] to query or change these settings for a display style.
 * @see [[MapImagerySettings]] to control the type of imagery applied to the background map.
 * @public
 */
export class BackgroundMapSettings {
  /** Retained strictly for persistence. */
  private readonly _provider: BackgroundMapProvider;

  /** Elevation in meters, relative to WGS84 Ellipsoid.. */
  public readonly groundBias: number;
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
    // Handle legacy TerrainProps.nonLocatable:
    // - If TerrainProps.nonLocatable=true and terrain is on, terrain is not locatable.
    // - Otherwise, use BackgroundMapProps.nonLocatable.
    if (this.applyTerrain && this.terrainSettings.nonLocatable)
      return false;

    return this._locatable;
  }

  /** If transparency is overridden, the transparency to apply; otherwise, undefined. */
  public get transparencyOverride(): number | undefined { return false !== this.transparency ? this.transparency : undefined; }

  private constructor(props: BackgroundMapProps | PersistentBackgroundMapProps) {
    this.groundBias = props.groundBias ?? 0;
    this.transparency = normalizeTransparency(props.transparency);
    this.useDepthBuffer = props.useDepthBuffer ?? false;
    this.applyTerrain = props.applyTerrain ?? false;
    this.terrainSettings = TerrainSettings.fromJSON(props.terrainSettings);
    this.globeMode = normalizeGlobeMode(props.globeMode);
    this._locatable = true !== props.nonLocatable;
    this.planarClipMask = PlanarClipMaskSettings.fromJSON(props.planarClipMask);
    this._provider = BackgroundMapProvider.fromBackgroundMapProps(props);
  }

  /** Create settings from their persistent representation. In general, this method should only be used when reading the settings directly from
   * the iModel - otherwise, prefer [[fromJSON]].
   */
  public static fromPersistentJSON(json?: PersistentBackgroundMapProps): BackgroundMapSettings {
    return new this(json ?? {});
  }

  /** Construct from JSON, performing validation and applying default values for undefined fields.
   * @see [[fromPersistentJSON]] if you are reading the settings directly from the iModel.
   */
  public static fromJSON(json?: BackgroundMapProps): BackgroundMapSettings {
    return new BackgroundMapSettings(json ?? {});
  }

  /** Convert these settings to their in-memory JSON representation.
   * @see [[toPersistentJSON]] if you intend to write the JSON directly to an iModel.
   */
  public toJSON(): BackgroundMapProps {
    const props: BackgroundMapProps = {};
    if (0 !== this.groundBias)
      props.groundBias = this.groundBias;
    if (this.applyTerrain)
      props.applyTerrain = true;
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

  /** Convert these settings to their persistent representation. In general, this method should only be used when writing the settings directly to
   * the iModel - otherwise, prefer [[toJSON]].
   */
  public toPersistentJSON(): PersistentBackgroundMapProps {
    const props = this.toJSON() as PersistentBackgroundMapProps;

    // Preserve deprecated imagery provider properties.
    if ("BingProvider" !== this._provider.name)
      props.providerName = this._provider.name; // eslint-disable-line deprecation/deprecation
    if (BackgroundMapType.Hybrid !== this._provider.type)
      props.providerData = { mapType: this._provider.type }; // eslint-disable-line deprecation/deprecation

    return props;
  }

  /** Returns true if these settings are equivalent to the supplied JSON settings. */
  public equalsJSON(json?: BackgroundMapProps): boolean {
    return this.equals(BackgroundMapSettings.fromJSON(json));
  }

  /** Returns true if the persistent representation of these settings is equivalent to `json`. */
  public equalsPersistentJSON(json?: PersistentBackgroundMapProps): boolean {
    return this.equals(BackgroundMapSettings.fromPersistentJSON(json));
  }

  /** Returns true if these settings are equivalent to `other`. */
  public equals(other: BackgroundMapSettings): boolean {
    return this.groundBias === other.groundBias && this.useDepthBuffer === other.useDepthBuffer && this.transparency === other.transparency
      && this.globeMode === other.globeMode && this._locatable === other._locatable && this.applyTerrain === other.applyTerrain
      && this.terrainSettings.equals(other.terrainSettings) && this.planarClipMask.equals(other.planarClipMask)
      && this._provider.name === other._provider.name && this._provider.type === other._provider.type;
  }

  /** Create a copy of this BackgroundMapSettings, optionally modifying some of its properties.
   * @param changedProps JSON representation of the properties to change.
   * @returns A BackgroundMapSettings with all of its properties set to match those of `this`, except those explicitly defined in `changedProps`.
   */
  public clone(changedProps?: BackgroundMapProps): BackgroundMapSettings {
    if (undefined === changedProps)
      return this;

    const props = {
      groundBias: changedProps.groundBias ?? this.groundBias,
      transparency: changedProps.transparency ?? this.transparency,
      useDepthBuffer: changedProps.useDepthBuffer ?? this.useDepthBuffer,
      globeMode: changedProps.globeMode ?? this.globeMode,
      nonLocatable: changedProps.nonLocatable ?? !this._locatable,
      applyTerrain: changedProps.applyTerrain ?? this.applyTerrain,
      terrainSettings: changedProps.terrainSettings ? this.terrainSettings.clone(changedProps.terrainSettings).toJSON() : this.terrainSettings.toJSON(),
      planarClipMask: changedProps.planarClipMask ? this.planarClipMask.clone(changedProps.planarClipMask).toJSON() : this.planarClipMask.toJSON(),
      providerName: this._provider.name,
      providerData: { mapType: this._provider.type },
    };

    return BackgroundMapSettings.fromPersistentJSON(props);
  }
}
