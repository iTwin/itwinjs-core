/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Frustum } from "@itwin/core-common";

/** Used for debugging purposes, to toggle display of instanced or batched primitives.
 * @see [[RenderTargetDebugControl]].
 * @internal
 */
export enum PrimitiveVisibility {
  /** Draw all primitives. */
  All,
  /** Only draw instanced primitives. */
  Instanced,
  /** Only draw un-instanced primitives. */
  Uninstanced,
}

/** An interface optionally exposed by a RenderTarget that allows control of various debugging features.
 * @internal
 */
export interface RenderTargetDebugControl {
  /** If true, render to the screen as if rendering off-screen for readPixels(). */
  drawForReadPixels: boolean;
  primitiveVisibility: PrimitiveVisibility;
  vcSupportIntersectingVolumes: boolean;
  readonly shadowFrustum: Frustum | undefined;
  displayDrapeFrustum: boolean;
  displayMaskFrustum: boolean;
  /** Override device pixel ratio for on-screen targets only. This supersedes window.devicePixelRatio.
   * Undefined clears the override. Chiefly useful for tests.
   */
  devicePixelRatioOverride?: number;
  displayRealityTilePreload: boolean;
  displayRealityTileRanges: boolean;
  logRealityTiles: boolean;
  displayNormalMaps: boolean;
  freezeRealityTiles: boolean;
  /** Obtain a summary of the render commands required to draw the scene currently displayed.
   * Each entry specifies  the type of command and the number of such commands required by the current scene.
   */
  getRenderCommands(): Array<{ name: string, count: number }>;
}

