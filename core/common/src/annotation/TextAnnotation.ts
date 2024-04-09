/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Point3d, YawPitchRollAngles, XYZProps, YawPitchRollProps, Range2d, Transform } from "@itwin/core-geometry";
import { TextBlock, TextBlockProps } from "./TextBlock";
 
export interface TextAnnotationAnchor {
  vertical: "top" | "middle" | "bottom";
  horizontal: "left" | "center" | "right";
}

export interface TextAnnotationProps {
  origin?: XYZProps;
  orientation?: YawPitchRollProps;
  textBlock?: TextBlockProps;
  anchor?: TextAnnotationAnchor;
}

export class TextAnnotation {
  public origin: Point3d;
  public orientation: YawPitchRollAngles;
  public textBlock: TextBlock;
  public anchor: TextAnnotationAnchor;

  private constructor(origin: Point3d, angles: YawPitchRollAngles, textBlock: TextBlock, anchor: TextAnnotationAnchor) {
    this.origin = origin;
    this.orientation = angles;
    this.textBlock = textBlock;
    this.anchor = anchor;
  }

  public static fromJSON(props: TextAnnotationProps | undefined): TextAnnotation {
    const origin = Point3d.fromJSON(props?.origin);
    const angles = YawPitchRollAngles.fromJSON(props?.orientation);
    const textBlock = TextBlock.create(props?.textBlock ?? { styleName: "" });
    const anchor: TextAnnotationAnchor = props?.anchor ? { ...props.anchor } : { vertical: "top", horizontal: "left" };

    return new TextAnnotation(origin, angles, textBlock, anchor);
  }

  public toJSON(): TextAnnotationProps {
    const props: TextAnnotationProps = { };
    if (!this.textBlock.isEmpty) {
      props.textBlock = this.textBlock.toJSON();
    }

    if (!this.origin.isZero) {
      props.origin = this.origin.toJSON();
    }

    if (!this.orientation.isIdentity()) {
      props.orientation = this.orientation.toJSON();
    }

    if (this.anchor.vertical !== "top" || this.anchor.horizontal !== "left") {
      props.anchor = { ...this.anchor };
    }

    return props;
  }

  public computeDocumentTransform(layoutRange: Range2d): Transform {
    const origin = this.origin.clone();
    const matrix = this.orientation.toMatrix3d();

    switch (this.anchor.horizontal) {
      case "center":
        origin.x -= layoutRange.xLength() / 2;
        break;
      case "right":
        origin.x -= layoutRange.xLength();
        break;
    }

    switch (this.anchor.vertical) {
      case "middle":
        origin.y += layoutRange.yLength() / 2;
        break;
      case "bottom":
        origin.y += layoutRange.yLength();
        break;
    }

    return Transform.createRefs(origin, matrix);
  }
}
