/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { TerrainProviderName } from "@itwin/core-common";
import { EllipsoidTerrainProvider, getCesiumTerrainProvider, TerrainMeshProvider, TerrainMeshProviderOptions } from "../internal";

export interface TerrainProvider {
  createTerrainMeshProvider(options: TerrainMeshProviderOptions): Promise<TerrainMeshProvider | undefined>;
}

export class TerrainProviderRegistry {
  private readonly _providers = new Map<TerrainProviderName, TerrainProvider>();

  public constructor() {
    this.register("CesiumWorldTerrain", {
      createTerrainMeshProvider: (options) => getCesiumTerrainProvider(options),
    });

    this.register("Ellipsoid", {
      createTerrainMeshProvider: (options) => Promise.resolve(new EllipsoidTerrainProvider(options)),
    });
  }

  public register(name: TerrainProviderName, provider: TerrainProvider): void {
    this._providers.set(name, provider);
  }
}
