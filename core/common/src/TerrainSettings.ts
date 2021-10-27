/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { BackgroundMapProps } from "./BackgroundMapSettings";

/** The current set of supported terrain providers. Currently only CesiumWorldTerrain.
 * @see [[TerrainProps]]
 * @public
 */
export type TerrainProviderName = "CesiumWorldTerrain";

/**  JSON representation of the settings of the terrain applied to background map display by a [[DisplayStyle]].
 * @see [[DisplayStyleSettingsProps]]
 * @see [[BackgroundMapProps]]
 * @public
 */
export interface TerrainProps {
  /** Identifies the provider currently only CesiumWorldTerrain is supported. */
  providerName?: string;
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
  /** Identifies the provider currently only CesiumWorldTerrain supported. */
  public readonly providerName: TerrainProviderName;
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

  constructor(providerName: TerrainProviderName = "CesiumWorldTerrain", exaggeration: number = 1.0, applyLighting = false, heightOrigin = 0.0, heightOriginMode = TerrainHeightOriginMode.Geodetic) {
    this.providerName = providerName;
    this.exaggeration = Math.min(100, Math.max(0.1, exaggeration));
    this.applyLighting = applyLighting;
    this.heightOrigin = heightOrigin;
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
    if (undefined === json)
      return new TerrainSettings();

    const providerName = "CesiumWorldTerrain";    // This is only terrain provider currently supported.
    const settings = new TerrainSettings(providerName, json.exaggeration, json.applyLighting, json.heightOrigin, json.heightOriginMode);
    if (true === json.nonLocatable)
      settings._nonLocatable = true;

    return settings;
  }

  public toJSON(): TerrainProps {
    const props: TerrainProps = { heightOriginMode: this.heightOriginMode };
    if ("CesiumWorldTerrain" !== this.providerName)
      props.providerName = this.providerName;
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
    return this.providerName === other.providerName && this.exaggeration === other.exaggeration && this.applyLighting === other.applyLighting
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
      exaggeration: changedProps.exaggeration ?? this.exaggeration,
      nonLocatable: changedProps.nonLocatable ?? this.nonLocatable,
      applyLighting: changedProps.applyLighting ?? this.applyLighting,
      heightOrigin: changedProps.heightOrigin ?? this.heightOrigin,
      heightOriginMode: changedProps.heightOriginMode ?? this.heightOriginMode,
    };

    return TerrainSettings.fromJSON(props);
  }
}
