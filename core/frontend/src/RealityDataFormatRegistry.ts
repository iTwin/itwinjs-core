/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

/** Stores key-value pair to be added to reality data requests.
 * @alpha
 */
export interface RealityDataKey {
  key: string;
  value: string;
}

/** Options supplied at startup via [[IModelAppOptions.realityDataOptions]] to specify access keys for various reality data formats.
 * `gp3dt` must have its key value set to `key`
 * @alpha
 */
export interface RealityDataOptions {
  /** Access key for Google Photorealistic 3D Tiles in the format `{ key: "key", value: "your-gp3dt-key" }`. */
  gp3dt?: RealityDataKey;
}

/**
 * A registry of RealityDataFormats identified by their unique format IDs. The registry can be accessed via [[IModelApp.realityDataFormatRegistry]].
 * @alpha
 */
export class RealityDataFormatRegistry {
  private _configOptions: RealityDataOptions;

  constructor(opts?: RealityDataOptions) {
    this._configOptions = opts ?? {};
  }

  public get configOptions(): RealityDataOptions {
    return this._configOptions;
  }
}
