/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { getCesiumTerrainProvider, TerrainMeshProvider, TerrainMeshProviderOptions } from "../internal";

/** Interface adopted by an object that can supply [[TerrainMeshProviders]] enabling the display of 3d terrain in a [[Viewport]].
 * @see [[TerrainProviderRegistry]] to register or look up a `TerrainProvider` by its name.
 * @see [TerrainSettings.providerName]($common) to specify the terrain provider used by a [DisplayStyle]($backend).
 * @beta
 */
export interface TerrainProvider {
  /** Produce a [[TerrainMeshProvider]] using the specified options. */
  createTerrainMeshProvider(options: TerrainMeshProviderOptions): Promise<TerrainMeshProvider | undefined>;
}

/** A registry of [[TerrainProvider]]s identified by their unique names. The registry can be accessed via [[IModelApp.terrainProviderRegistry]].
 * It always includes the built-in provider named "CesiumWorldTerrain", which obtains terrain meshes from [Cesium ION](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/). That provider requires a valid [[TileAdmin.Props.cesiumIonKey]] to be supplied to [[IModelApp.startup]].
 * Any number of additional providers can be [[register]]red.
 *
 * When terrain is enabled for a [[Viewport]], the display system will attempt to look up the [[TerrainProvider]] corresponding to the [TerrainSettings.providerName]($common) specified by the [[Viewport]]'s [DisplayStyleSettings]($common). If a provider by that name is registered, it will be used to obtain terrain meshes; otherwise, the display system will produce flat terrain meshes.
 * @beta
 */
export class TerrainProviderRegistry {
  private readonly _providers = new Map<string, TerrainProvider>();

  /** @internal */
  public constructor() {
    this.register("CesiumWorldTerrain", {
      createTerrainMeshProvider: (options) => getCesiumTerrainProvider(options),
    });
  }

  /** Register a new [[TerrainProvider]].
   * @param name The name of the provider. It must be unique among all providers.
   * @param provider The provider to register.
   * @see [[find]] to later retrieve the provider by name.
   */
  public register(name: string, provider: TerrainProvider): void {
    this._providers.set(name, provider);
  }

  /** Look up a [[register]]ed [[TerrainProvider]] by its name. */
  public find(name: string): TerrainProvider | undefined {
    return this._providers.get(name);
  }
}
