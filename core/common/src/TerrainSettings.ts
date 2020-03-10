/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { BackgroundMapProps } from "./BackgroundMapSettings";

/** The current set of supported terrain providers. Currently only CesiumWorldTerrain.
 * @beta
 * @see [[TerrainProps]]
 */
export type TerrainProviderName = "CesiumWorldTerrain";

/**  JSON representation of the settings of the terrain applied to background map display by a [[DisplayStyle]].
 * @see [[DisplayStyleSettingsProps]]
 * @see [[BackgroundMapProps]]
 * @beta
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
  /** Determines how/if the heightOrigin is applied to the terrain height. Default value: Ground */
  heightOriginMode?: TerrainHeightOriginMode;
}

/** Correction modes for terrain height
 * @beta
 * @see [[TerrainProps]]
 */
export enum TerrainHeightOriginMode {
  /** Height value indicates the geodetic height of the IModel origin (also referred to as ellipsoidal or GPS height) */
  Geodetic = 0,
  /** Height value indicates the geoidal height of the IModel origin (commonly referred to as sea level). */
  Geoid = 1,
  /** Height value indicates the height of the IModel origin relative to ground level at project center. */
  Ground = 2,
}

/**  Normalized version of [[TerrainProps]] for which provider has been validated and default values of all members are used.
 * @beta
 */
export class TerrainSettings {
  /** Identifies the provider currently only CesiumWorldTerrain supported. */
  public readonly providerName: TerrainProviderName;
  /** A value greater than one will cause terrain height to be exaggerated/scaled. 1.0 indicates no exaggeration. Default value: 1.0 */
  public readonly exaggeration: number;
  /**  Applying lighting can help to visualize subtle terrain variations. Default value: false */
  public readonly applyLighting: boolean;
  /** Origin value - height of the IModel origin at the project center as defined by heightOriginMode. Default value 0.0 */
  public readonly heightOrigin: number;
  /** Determines how/if the heightOrigin is applied to the terrain height. Default value: ground */
  public readonly heightOriginMode: TerrainHeightOriginMode;

  constructor(providerName: TerrainProviderName = "CesiumWorldTerrain", exaggeration: number = 1.0, applyLighting = false, heightOrigin = 0.0, heightOriginMode = TerrainHeightOriginMode.Ground) {
    this.providerName = providerName;
    this.exaggeration = Math.min(100, Math.max(0.1, exaggeration));
    this.applyLighting = applyLighting;
    this.heightOrigin = heightOrigin;
    this.heightOriginMode = heightOriginMode;
  }
  public static fromJSON(json?: TerrainProps) {
    if (undefined === json)
      return new TerrainSettings();

    const providerName = "CesiumWorldTerrain";    // This is only terrain provider currently supported.
    return new TerrainSettings(providerName, json.exaggeration, json.applyLighting, json.heightOrigin, json.heightOriginMode);
  }
  public toJSON(): TerrainProps {
    return {
      providerName: this.providerName,
      exaggeration: this.exaggeration,
      applyLighting: this.applyLighting,
      heightOrigin: this.heightOrigin,
      heightOriginMode: this.heightOriginMode,
    };
  }
  public equals(other: TerrainSettings): boolean {
    return this.providerName === other.providerName && this.exaggeration === other.exaggeration && this.applyLighting === other.applyLighting && this.heightOrigin === other.heightOrigin && this.heightOriginMode === other.heightOriginMode;
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
      providerName: undefined !== changedProps.providerName ? changedProps.providerName : this.providerName,
      exaggeration: undefined !== changedProps.exaggeration ? changedProps.exaggeration : this.exaggeration,
      applyLighting: undefined !== changedProps.applyLighting ? changedProps.applyLighting : this.applyLighting,
      heightOrigin: undefined !== changedProps.heightOrigin ? changedProps.heightOrigin : this.heightOrigin,
      heightOriginMode: undefined !== changedProps.heightOriginMode ? changedProps.heightOriginMode : this.heightOriginMode,
    };
    return TerrainSettings.fromJSON(props);
  }
}
