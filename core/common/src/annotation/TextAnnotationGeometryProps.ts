/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { FrameGeometryProps } from "./FrameGeometryProps";
import { TextBlockGeometryProps } from "./TextBlockGeometryProps";

/**
 * JSON representation of the geometric primitives that can be used to display a [[TextBlock]].
 * @see [produceTextAnnotationGeometry]($backend) to convert an annotation to its geometric representation.
 * @see [[GeometryStreamBuilder.appendTextBlock]] to add a block of text to a [GeometryStream]($docs/learning/common/GeometryStream.md).
 * @beta
 */
export interface TextAnnotationGeometryProps {
  /** The set of geometric primitives representing the contents of the [[TextBlock]]. */
  textBlockGeometry: TextBlockGeometryProps;
  frameGeometry?: FrameGeometryProps
}
