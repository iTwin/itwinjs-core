/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Point3d, Range2d, Transform, XYZProps, YawPitchRollAngles, YawPitchRollProps } from "@itwin/core-geometry";
import { TextBlock, TextBlockProps } from "./TextBlock";

/**
 * Describes the horizontal and vertical alignment of a [[TextAnnotation]]'s text relative to [[TextAnnotation.origin]].
 * @beta
 * @preview
 * @extensions
 */
export interface TextAnnotationAnchor {
  /**
   * The vertical alignment of the anchor point.
   * "top" aligns the top of the text with the anchor point.
   * "middle" aligns the middle of the text with the anchor point.
   * "bottom" aligns the bottom of the text with the anchor point.
   */
  vertical: "top" | "middle" | "bottom";

  /**
   * The horizontal alignment of the anchor point.
   * "left" aligns the left side of the text with the anchor point.
   * "center" aligns the center of the text with the anchor point.
   * "right" aligns the right side of the text with the anchor point.
   */
  horizontal: "left" | "center" | "right";
}

/**
 * JSON representation of a [[TextAnnotation]].
 * @beta
 * @preview
 * @extensions
 */
export interface TextAnnotationProps {
  /** See [[TextAnnotation.origin]]. Default: [0, 0, 0]*/
  origin?: XYZProps;
  /** See [[TextAnnotation.orientation]]. Default: no rotation. */
  orientation?: YawPitchRollProps;
  /** See [[TextAnnotation.textBlock]]. Default: an empty text block. */
  textBlock?: TextBlockProps;
  /** See [[TextAnnotation.anchor]]. Default: top-left. */
  anchor?: TextAnnotationAnchor;
}

/** Arguments supplied to [[TextAnnotation.create]].
 * @beta
 * @preview
 * @extensions
 */
export interface TextAnnotationCreateArgs {
  /** See [[TextAnnotation.origin]]. Default: [0, 0, 0]*/
  origin?: Point3d;
  /** See [[TextAnnotation.orientation]]. Default: no rotation. */
  orientation?: YawPitchRollAngles;
  /** See [[TextAnnotation.textBlock]]. Default: an empty text block. */
  textBlock?: TextBlock;
  /** See [[TextAnnotation.anchor]]. Default: top-left. */
  anchor?: TextAnnotationAnchor;
}
/**
 * Represents a formatted block of text positioned in 2d or 3d space.
 * [TextAnnotation2d]($backend) and [TextAnnotation3d]($backend) elements store a TextAnnotation from which their geometric representation is generated.
 * @see [produceTextAnnotationGeometry]($backend) to decompose the annotation into a set of geometric primitives suitable for use with [[GeometryStreamBuilder.appendTextBlock]].
 * @beta
 * @preview
 * @extensions
 */
export class TextAnnotation {
  /**
   * The point considered to be the origin of the annotation. The [[textBlock]]'s content is justified relative to this point as specified by [[anchor]].
   * This point is also considered the origin by [AccuSnap]($frontend) when using [SnapMode.Origin]($frontend).
   * Often, the origin is specified by a user clicking in a viewport when placing text annotations interactively.
   * @note When defining an annotation for a [TextAnnotation2d]($backend), the `z` component should be zero.
   */
  public origin: Point3d;
  /**
   * The rotation of the annotation.
   * @note When defining an annotation for a [TextAnnotation2d]($backend), only the `yaw` component (rotation around the Z axis) is used.
   */
  public orientation: YawPitchRollAngles;
  /**
   * The formatted document.
   */
  public textBlock: TextBlock;
  /**
   * Describes how the [[textBlock]]'s content should be aligned relative to the [[origin]].
   */
  public anchor: TextAnnotationAnchor;

  private constructor(origin: Point3d, angles: YawPitchRollAngles, textBlock: TextBlock, anchor: TextAnnotationAnchor) {
    this.origin = origin;
    this.orientation = angles;
    this.textBlock = textBlock;
    this.anchor = anchor;
  }

  /** Creates a new TextAnnotation. */
  public static create(args?: TextAnnotationCreateArgs): TextAnnotation {
    const origin = args?.origin ?? new Point3d();
    const angles = args?.orientation ?? new YawPitchRollAngles();
    const textBlock = args?.textBlock ?? TextBlock.createEmpty();
    const anchor = args?.anchor ?? { vertical: "top", horizontal: "left" };

    return new TextAnnotation(origin, angles, textBlock, anchor);
  }

  /**
   * Creates a new TextAnnotation instance from its JSON representation.
   */
  public static fromJSON(props: TextAnnotationProps | undefined): TextAnnotation {
    return TextAnnotation.create({
      origin: props?.origin ? Point3d.fromJSON(props.origin) : undefined,
      orientation: props?.orientation ? YawPitchRollAngles.fromJSON(props.orientation) : undefined,
      textBlock: props?.textBlock ? TextBlock.create(props.textBlock) : undefined,
      anchor: props?.anchor ? { ...props.anchor } : undefined,
    });
  }

  /**
   * Converts this annotation to its JSON representation.
   */
  public toJSON(): TextAnnotationProps {
    const props: TextAnnotationProps = {};

    // Even if the text block is empty, we want to record its style name and overrides, e.g.,
    // so the user can pick up where they left off editing it next time.
    props.textBlock = this.textBlock.toJSON();

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

  /**
   * @internal used by produceTextAnnotationGeometry; requires layoutRange computed by layoutTextBlock.
   */
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

  /** Returns true if this annotation is logically equivalent to `other`. */
  public equals(other: TextAnnotation): boolean {
    return this.anchor.horizontal === other.anchor.horizontal && this.anchor.vertical === other.anchor.vertical
      && this.orientation.isAlmostEqual(other.orientation) && this.origin.isAlmostEqual(other.origin)
      && this.textBlock.equals(other.textBlock);
  }
}
