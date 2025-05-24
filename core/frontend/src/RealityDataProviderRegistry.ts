/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

/** Returns the URL used for retrieving Google Photorealistic 3D Tiles.
 * @alpha
 */
export function getGooglePhotorealistic3DTilesURL() {
  return "https://tile.googleapis.com/v1/3dtiles/root.json";
}

/** Stores key-value pair to be added to reality data requests.
 * @alpha
 */
export interface RealityDataProviderKey {
  key: string;
  value: string;
}

/** Options supplied at startup via [[IModelAppOptions.realityDataOptions]] to specify access keys for various reality data formats.
 * `gp3dt` must have its key value set to `key`
 * @alpha
 */
export interface RealityDataProviderOptions {
  /** Access key for Google Photorealistic 3D Tiles in the format `{ key: "key", value: "your-gp3dt-key" }`. */
  gp3dt?: RealityDataProviderKey;
  /** Access keys for additional reality data providers. */
  [provider: string]: RealityDataProviderKey | undefined;
}

/**
 * A registry of RealityDataFormats identified by their unique format IDs. The registry can be accessed via [[IModelApp.realityDataFormatRegistry]].
 * @alpha
 */
export class RealityDataProviderRegistry {
  private _configOptions: RealityDataProviderOptions;

  constructor(opts?: RealityDataProviderOptions) {
    this._configOptions = opts ?? {};
  }

  public get configOptions(): RealityDataProviderOptions {
    return this._configOptions;
  }
}
