/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Viewport, ScreenViewport } from "./Viewport";
import { TiledGraphicsProvider } from "./TiledGraphicsProvider";
import { IModelApp } from "./IModelApp";

/** Terrain provider that provides tile tree for display within a [[Viewport]].
 * @internal
 */
export abstract class TerrainProvider implements TiledGraphicsProvider.Provider {
  public onInitialized(): void {
    IModelApp.viewManager.onViewOpen.addListener((viewport: ScreenViewport) => { viewport.addTiledGraphicsProvider(TiledGraphicsProvider.Type.Geometry, this); });
  }

  public abstract getTileTree(viewport: Viewport): TiledGraphicsProvider.Tree | undefined;
}
