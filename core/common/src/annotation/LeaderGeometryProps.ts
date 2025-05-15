/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { XYZProps } from "@itwin/core-geometry";

/**
 * A single entry in a [[FrameGeometryProps]], representing one of the following primitive types:
 * - TODO
 * @beta
 */
export interface LeaderGeometryPropsEntry {
  leader: {
    terminators: { startPoint: XYZProps, endPoint: XYZProps }[];
    leaderLine: XYZProps[];
  }
}
/**
 * JSON representation of the geometric primitives that can be used to display a [[TextBlock]].
 * @see [produceTextAnnotationGeometry]($backend) to convert an annotation to its geometric representation.
 * @see [[GeometryStreamBuilder.appendTextBlock]] to add a block of text to a [GeometryStream]($docs/learning/common/GeometryStream.md).
 * @beta
 */
export interface LeaderGeometryProps {
  /** The set of geometric primitives representing the contents of the [[TextBlock]]. */
  entries: LeaderGeometryPropsEntry[];
}
