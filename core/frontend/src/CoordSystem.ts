/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

/** Coordinate system types
 * @public
 */
export enum CoordSystem {
  /** Coordinates are relative to the origin of the viewing rectangle.
   * x and y values correspond to pixels within that rectangle, with (x=0,y=0) corresponding to the top-left corner.
   */
  View,

  /** Coordinates are in [Normalized Plane Coordinates]($docs/learning/glossary.md#npc). NPC is a coordinate system
   * for frustums in which each dimension [x,y,z] is normalized to hold values between 0.0 and 1.0.
   * [0,0,0] corresponds to the left-bottom-rear and [1,1,1] to the right-top-front of the frustum.
   */
  Npc,

  /** Coordinates are in the coordinate system of the models in the view. For SpatialViews, this is the iModel's spatial coordinate system.
   * For 2d views, it is the coordinate system of the GeometricModel2d that the view shows.
   */
  World,
}
