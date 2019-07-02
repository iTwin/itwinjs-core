/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ScreenViewport, TiledGraphicsProvider, Viewport } from "./Viewport";
import { IModelApp } from "./IModelApp";
import { TileTree } from "./tile/TileTree";

/** Terrain provider that provides tile tree for display within a [[Viewport]].
 * @internal
 */
export abstract class TerrainProvider implements TiledGraphicsProvider {
  public onInitialized(): void {
    IModelApp.viewManager.onViewOpen.addListener((viewport: ScreenViewport) => {
      viewport.addTiledGraphicsProvider(this);
    });
  }

  public abstract getTileTree(viewport: Viewport): TileTree.Reference | undefined;
}
