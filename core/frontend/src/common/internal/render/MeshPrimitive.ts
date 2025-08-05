/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Point3d, Range3d } from "@itwin/core-geometry";
import { QPoint3dList } from "@itwin/core-common";

/** @internal */
export enum MeshPrimitiveType {
  Mesh,
  Polyline,
  Point,
}

/** A Point3d[] with an [[add]] method used to enable compatibility with the [[MeshPointList]] union type.
 * It is provided a range to contain all of the points. Each point added to the list is transformed to be relative to
 * the center of that range.
 * In the finished graphic, a transform is applied to transform back from the range's center.
 * @internal
 */
export interface Point3dList extends Array<Point3d> {
  /** Identical to `push`, except it returns `void` instead of `number`; compatible with [QPoint3dList.add]($common). */
  add(point: Point3d): void;
  /** The range containing all of the points to be contained in the list, computed in advance. */
  range: Range3d;
}

/** The list of points associated with a [[Mesh]].
 * @see [[Mesh.Props.quantizePositions]] to specify whether points should be quantized or not.
 * @internal
 */
export type MeshPointList = Point3dList | QPoint3dList;
