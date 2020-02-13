/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  TileTreeLoadStatus,
  TileTree,
} from "./internal";

/** Owns and manages the lifecycle of a [[TileTree]]. It is in turn owned by an IModelConnection.Tiles object.
 * @note The *only* legitimate way to obtain a TileTreeOwner is via [[IModelConnection.Tiles.getTileTreeOwner]].
 * @internal
 */
export interface TileTreeOwner {
  /** The owned [[TileTree]]. Do not store a direct reference to it, because it may become disposed by its owner.
   * @see [[TileTreeOwner.load]] to ensure the tree is enqueued for loading if necessary.
   */
  readonly tileTree: TileTree | undefined;
  /** The current load state of the tree. This can be reset to NotLoaded after loading if the owner becomes disposed or the tree is not used for a long period of time.
   * @see [[TileTreeOwner.load]] to ensure the tree is enqueued for loading if necessary.
   */
  readonly loadStatus: TileTreeLoadStatus;
  /** If the TileTree has not yet been loaded (loadStatus = NotLoaded), enqueue an asynchronous request to load it (changing loadStatus to Loading).
   * loadStatus will be updated to Loaded when that request succeeds, or NotFound if the request fails.
   * @returns the loaded TileTree if loading completed successfully, or undefined if the tree is still loading or loading failed.
   */
  load(): TileTree | undefined;

  /** Do not call this directly.
   * @internal
   */
  dispose(): void;

  /** It is generally not a good idea to await the TileTree - use load() instead. */
  loadTree(): Promise<TileTree | undefined>;
}
