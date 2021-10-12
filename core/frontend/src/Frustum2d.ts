/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Range1d } from "@itwin/core-geometry";

/** Constants and functions for working with two-dimensions [Frustum]($common)s.
 * A 2d view is rendered using an orthographic frustum with depth. 2d elements have no meaningful placement in Z, but they can have a display priority
 * that controls which elements draw in front of others. Usable priority values range from -500 (behind everything else) to 500 (in front of everything else).
 * Priority values are mapped to Z coordinates in [-1, 1] meters. Therefore a 2d view always has *at least* that same depth range.
 * Sometimes, 3d views are displayed in the context of 2d views. Because 3d views can have arbitrarily large depths, the 2d view's extents are expanded
 * in Z to accommodate the 3d geometry. Expanding the frustum depth does *not* affect the mapping of display priorities to depth values.
 * @public
 */
export namespace Frustum2d {
  /** The minimum distance in positive or negative Z for a 2d frustum, in meters. */
  export const minimumZDistance = 1;

  /** The minimum total z extents for a 2d frustum, in meters. */
  export const minimumZExtents: Readonly<Range1d> = Range1d.createXX(-minimumZDistance, minimumZDistance);

  const maxPriorityAbs = 500;
  const priorityToZDistanceRatio = minimumZDistance / maxPriorityAbs;

  /** Convert display priority to Z. */
  export function depthFromDisplayPriority(priority: number): number {
    priority = Math.max(-maxPriorityAbs, Math.min(maxPriorityAbs, priority));
    return priority * priorityToZDistanceRatio;
  }
}
