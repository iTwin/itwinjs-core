/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { IModelApp } from "../IModelApp";
import { Viewport } from "../Viewport";
import { Tile, TileLoader } from "./internal";

/** Specialization of loader used for context tiles (reality models and maps).
 * Turns on optimized realitytile traversal.
 * @internal
 */
export abstract class ContextTileLoader extends TileLoader {
  private _preloadRealityParentDepth: number;
  private _preloadRealityParentSkip: number;
  public get preloadRealityParentDepth(): number { return this._preloadRealityParentDepth; }
  public get preloadRealityParentSkip(): number { return this._preloadRealityParentSkip; }

  constructor() {
    super();
    this._preloadRealityParentDepth = IModelApp.tileAdmin.contextPreloadParentDepth;
    this._preloadRealityParentSkip = IModelApp.tileAdmin.contextPreloadParentSkip;
  }

  public computeTilePriority(tile: Tile, viewports: Iterable<Viewport>): number {
    // ###TODO: Handle case where tile tree reference(s) have a transform different from tree's (background map with ground bias).
    return TileLoader.computeTileClosestToEyePriority(tile, viewports, tile.root.iModelTransform);
  }
}
