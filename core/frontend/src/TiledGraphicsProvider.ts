import { Plane3dByOriginAndUnitNormal } from "@bentley/geometry-core";

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */
import { TileTree } from "./tile/TileTree";
import { Viewport } from "./Viewport";

export namespace TiledGraphicsProvider {

  export interface Tree {
    tileTree: TileTree;
    plane?: Plane3dByOriginAndUnitNormal;
  }

  /** An object that provides a tile tree for display within a  [[Viewport]].
   * @alpha
   */
  export interface Provider {
    getTileTree(viewport: Viewport): TiledGraphicsProvider.Tree | undefined;
  }

  /** Types of TiledGraphicsProviders.
   * @alpha
   */
  export enum Type {
    BackgroundMap = 0,
    Geometry = 1,
    Overlay = 2,
  }

  export type ProviderSet = Set<TiledGraphicsProvider.Provider>;

}
