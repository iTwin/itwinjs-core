/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Range2dProps, TransformProps } from "@itwin/core-geometry";
import { TextStyleColor } from "./TextStyle";
import { TextAnnotationFillColor, TextAnnotationFrame } from "./TextAnnotation";

/**
 * A single entry in a [[FrameGeometryProps]], representing one of the following primitive types:
 * - TODO
 * @beta
 */
export type FrameGeometryPropsEntry = {
  frame: {
    fillColor?: TextAnnotationFillColor;
    lineColor?: TextStyleColor;
    lineWidth?: number;
    shape: TextAnnotationFrame;
    transform: TransformProps;
    range: Range2dProps;
  };
  debugSnap?: never;
} | {
  frame?: never;
  debugSnap: {
    shape: TextAnnotationFrame;
    transform: TransformProps;
    range: Range2dProps;
  };
};

/**
 * JSON representation of the geometric primitives that can be used to display a [[TextBlock]].
 * @see [produceTextAnnotationGeometry]($backend) to convert an annotation to its geometric representation.
 * @see [[GeometryStreamBuilder.appendTextBlock]] to add a block of text to a [GeometryStream]($docs/learning/common/GeometryStream.md).
 * @beta
 */
export interface FrameGeometryProps {
  /** The set of geometric primitives representing the contents of the [[TextBlock]]. */
  entries: FrameGeometryPropsEntry[];
}
