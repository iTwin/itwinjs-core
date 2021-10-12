/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MapSubLayerProps } from "@itwin/core-common";
import { MapLayerImageryProvider } from "@itwin/core-frontend";

export interface StyleMapLayerSettings {
  /** Name */
  name: string;
  /** URL */
  url: string;
  /** Controls visibility of layer */
  visible: boolean;
  /** A transparency value from 0.0 (fully opaque) to 1.0 (fully transparent) to apply to map graphics when drawing, or false to indicate the transparency should not be overridden. Default value: false. */
  transparency: number;
  /** Transparent background */
  transparentBackground: boolean;
  /** set map as underlay or overlay */
  isOverlay: boolean;
  /** Available map sub-layer */
  subLayers?: MapSubLayerProps[];
  /** sub-layer panel displayed. */
  showSubLayers: boolean;
  /** Some format can publish only a single layer at a time (i.e WMTS) */
  provider?: MapLayerImageryProvider;
}

export interface MapTypesOptions {
  readonly supportTileUrl: boolean;
  readonly supportWmsAuthentication: boolean;
}

export interface MapLayerOptions {
  hideExternalMapLayers?: boolean;
  fetchPublicMapLayerSources?: boolean;
  mapTypeOptions?: MapTypesOptions;
}

/**
 * Argument for methods that must supply an iTwinId
 * @beta
 */
export interface ITwinIdArg {
  readonly iTwinId?: string;
  readonly iModelId?: string;
}

/**
 * Argument for methods that must supply an IModelId
 * @beta
 */
export interface TokenArg {
  accessToken?: string;
}

/**
 * Argument for methods that must supply an IModelId
 * @beta
 */
export interface PreferenceArg extends PreferenceKeyArg {
  readonly content?: any;
}

/**
 * Argument for methods that must supply an IModelId
 * @beta
 */
export interface PreferenceKeyArg {
  readonly key: string;
}

/** The iTwin preferences access provides a way to store, get and delete preferences for an iTwin at
 * two different levels, iTwin and iModel.
 *
 * Note: Both the key and return type are intended to be abstract and allow any preferences to be stored.
 *     Based on this simple interface, the implementation of this interface can interpret the key as needed
 *     to store and retrieve the preferences.
 * @beta
 */
export interface ITwinPreferencesAccess {
  /** A method to get a iTwin preference based off of a key.
   *
   * If both iTwinId and iModelId are provided, the iModel level will be check first. If
   * it does not exist, the iTwin level will checked next.
   *
   * @returns undefined if a preference is not found.
   * @throws if an error occurs when attempting to retrieve a preference.
   */
  get: (arg: PreferenceKeyArg & ITwinIdArg & TokenArg) => Promise<any>;

  /** Deletes the specified preference by key, if it exists, within the level provided.
   *
   * If both iTwinId and iModelId are provided, the key will be deleted from both levels.
   *
   * If the key does not exist in either level provided, then this function will do nothing.
   *
   * @throws if any error occurs when deleting the preference.
   */
  delete: (arg: PreferenceKeyArg & ITwinIdArg & TokenArg) => Promise<void>;

  /** Saves the provided preference by the key within the provided level.
   *
   * If both iTwinId and iModelId are provided, the key will be saved to both levels.
   *
   * If the key already exists, in either level, the preference will be updated.
   *
   * @throws if any error occurs while saving.
   */
  save: (arg: PreferenceArg & ITwinIdArg & TokenArg) => Promise<void>;
}