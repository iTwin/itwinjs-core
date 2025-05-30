/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

// cSpell:ignore vals

/** Describes the semantics of a [PolylineArgs]($frontend).
 * @public
 */
export enum PolylineTypeFlags {
  /** Just an ordinary polyline with no special semantics. */
  Normal = 0,
  /** A polyline used to define the edges of a planar region. */
  Edge = 1 << 0,
  /** Like [[Edge]], but the edges are only displayed in [[RenderMode.Wireframe]] when the surface's fill is not displayed.
   * [[FillFlags]] controls whether the fill is displayed.
   */
  Outline = 1 << 1,
}

/** Flags describing a [PolylineArgs]($frontend).
 * @public
 */
export interface PolylineFlags {
  /** If `true`, the polylines are to be drawn as individual disconnected point strings instead of as connected line strings. */
  isDisjoint?: boolean;
  /** If `true`, the polylines' positions are all coplanar. */
  isPlanar?: boolean;
  /** If `true`, the polylines' positions all have the same z coordinate. */
  is2d?: boolean;
  /** Default: Normal. */
  type?: PolylineTypeFlags;
}

/** Describes the vertex indices of a single line within a [PolylineArgs]($frontend).
 * The indices represent either a line string as a connected series of points, or a point string as a set of disconnected points, depending
 * on the [[PolylineFlags.isDisjoint]] value of [PolylineArgs.flags]($frontend).
 * @public
 */
export type PolylineIndices = number[];
