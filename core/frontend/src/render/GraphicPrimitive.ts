/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import type { Arc3d, Loop, Path, Point2d, Point3d, Polyface, SolidPrimitive } from "@itwin/core-geometry";

/** Base interface for a 2d [[GraphicPrimitive]] that can be supplied to [[GraphicBuilder.addPrimitive]].
 * @public
 */
export interface GraphicPrimitive2d {
  /** Z value in local coordinates to use for each point. */
  zDepth: number;
}

/** A [[GraphicPrimitive]] representing a line string that can be supplied to [[GraphicBuilder.addPrimitive]].
 * @see [[GraphicBuilder.addLineString]].
 * @public
 */
export interface GraphicLineString {
  type: "linestring";
  points: Point3d[];
}

/** A [[GraphicPrimitive]] representing a 2d line string that can be supplied to [[GraphicBuilder.addPrimitive]].
 * @see [[GraphicBuilder.addLineString2d]].
 * @public
 */
export interface GraphicLineString2d extends GraphicPrimitive2d {
  type: "linestring2d";
  points: Point2d[];
}

/** A [[GraphicPrimitive]] representing a point string that can be supplied to [[GraphicBuilder.addPrimitive]].
 * @see [[GraphicBuilder.addPointString]].
 * @public
 */
export interface GraphicPointString {
  type: "pointstring";
  points: Point3d[];
}

/** A [[GraphicPrimitive]] representing a 2d point string that can be supplied to [[GraphicBuilder.addPrimitive]].
 * @see [[GraphicBuilder.addPointString2d]].
 * @public
 */
export interface GraphicPointString2d extends GraphicPrimitive2d {
  type: "pointstring2d";
  points: Point2d[];
}

/** A [[GraphicPrimitive]] representing a closed 3d planar region that can be supplied to [[GraphicBuilder.addPrimitive]].
 * @see [[GraphicBuilder.addShape]].
 * @public
 */
export interface GraphicShape {
  type: "shape";
  points: Point3d[];
}

/** A [[GraphicPrimitive]] representing a closed 2d region that can be supplied to [[GraphicBuilder.addPrimitive]].
 * @see [[GraphicBuilder.addShape2d]].
 * @public
 */
export interface GraphicShape2d extends GraphicPrimitive2d {
  type: "shape2d";
  points: Point2d[];
}

/** A [[GraphicPrimitive]] representing a 3d open arc or closed ellipse that can be supplied to [[GraphicBuilder.addPrimitive]].
 * @see [[GraphicBuilder.addArc]].
 * @public
 */
export interface GraphicArc {
  type: "arc";
  arc: Arc3d;
  isEllipse?: boolean;
  filled?: boolean;
}

/** A [[GraphicPrimitive]] representing a 2d open arc or closed ellipse that can be supplied to [[GraphicBuilder.addPrimitive]].
 * @see [[GraphicBuilder.addArc2d]].
 * @public
 */
export interface GraphicArc2d {
  type: "arc2d";
  arc: Arc3d;
  isEllipse?: boolean;
  filled?: boolean;
  zDepth: number;
}

/** A [[GraphicPrimitive]] representing a 3d open path that can be supplied to [[GraphicBuilder.addPrimitive]].
 * @see [[GraphicBuilder.addPath]].
 * @public
 */
export interface GraphicPath {
  type: "path";
  path: Path;
}

/** A [[GraphicPrimitive]] representing a 3d planar region that can be supplied to [[GraphicBuilder.addPrimitive]].
 * @see [[GraphicBuilder.addLoop]].
 * @public
 */
export interface GraphicLoop {
  type: "loop";
  loop: Loop;
}

/** A [[GraphicPrimitive]] representing a mesh that can be supplied to [[GraphicBuilder.addPrimitive]].
 * @see [[GraphicBuilder.addPolyface]].
 * @public
 */
export interface GraphicPolyface {
  type: "polyface";
  polyface: Polyface;
  filled?: boolean;
}

/** A [[GraphicPrimitive]] representing a [SolidPrimitive]($core-geometry) to be supplied to [[GraphicBuilder.addPrimitive]].
 * @see [[GraphicBuilder.addSolidPrimitive]].
 * @public
 */
export interface GraphicSolidPrimitive {
  type: "solidPrimitive";
  solidPrimitive: SolidPrimitive;
}

/** Union type representing a graphic primitive that can be supplied to [[GraphicBuilder.addPrimitive]].
 * Each primitive type corresponds to one of GraphicBuilder's `addXXX` methods. This is useful when the precise type of
 * geometry is not known at the point at which it is added to the builder. As a simple example:
 * ```ts
 *  function getPrimitives(): GraphicPrimitive[] {
 *    const primitives: GraphicPrimitive[] = [{ type: "polyface", polyface: getPolyface(), filled: true }];
 *    if (someCondition())
 *      primitives.push({ type: "linestring", points: getPoints() });
 *    else
 *      primitives.push({ type: "arc", arc: getArc(), isEllipse: true });
 *
 *    return primitives;
 *  }
 *
 *  function addGraphics(builder: GraphicBuilder) {
 *    for (const primitive of getPrimitives())
 *      builder.addPrimitive(primitive);
 *  }
 * ```
 * @public
 */
export type GraphicPrimitive = GraphicLineString | GraphicLineString2d | GraphicPointString | GraphicPointString2d | GraphicShape | GraphicShape2d | GraphicArc | GraphicArc2d | GraphicPath | GraphicLoop | GraphicPolyface | GraphicSolidPrimitive;
