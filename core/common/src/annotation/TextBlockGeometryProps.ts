/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { XYZProps } from "@itwin/core-geometry";
import { TextStringProps } from "../geometry/TextString";
import { TextStyleColor } from "./TextStyle";

/**
 * A single entry in a [[TextBlockGeometryProps]], representing one of the following primitive types:
 * - A [[TextString]],
 * - A fraction separator described by a [LineSegment3d]($geometry), or
 * - A change in color, to be applied to all subsequent primitives.
 */
export type TextBlockGeometryPropsEntry = {
  text: TextStringProps;
  separator?: never;
  color?: never;
} | {
  text?: never;
  separator: {
    startPoint: XYZProps;
    endPoint: XYZProps;
  };
  color?: never;
} | {
  text?: never;
  separator?: never;
  color: TextStyleColor;
};

/**
 * JSON representation of the geometric primitives that can be used to display a [[TextBlock]].
 * @see [produceTextAnnotationGeometry]($backend) to convert an annotation to its geometric representation.
 * @see [[GeometryStreamBuilder.appendTextBlock]] to add a block of text to a [GeometryStream]($docs/learning/common/GeometryStream.md).
 */
export interface TextBlockGeometryProps {
  /** The set of geometric primitives representing the contents of the [[TextBlock]]. */
  entries: TextBlockGeometryPropsEntry[];
}
