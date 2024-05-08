/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Point3d, Transform, XYZProps, XAndY, YawPitchRollAngles, YawPitchRollProps } from "@itwin/core-geometry";
import { TextBlock, TextBlockProps } from "./TextBlock";

/**
 * Describes the horizontal and vertical alignment of a [[TextAnnotation]]'s text relative to the [Placement]($common) origin of
 * the [TextAnnotation2d]($backend) or [TextAnnotation3d]($backend) host element, also referred to as the annotation's "anchor point".
 * For example, if the anchor is specified as middle-center, the text will be centered on the element's origin.
 * The anchor point also serves as the pivot point for [[TextAnnotation.rotation]], such that the text is rotated about the
 * anchor point while the anchor point remains fixed.
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
  /** See [[TextAnnotation.offset]]. Default: [0, 0, 0]. */
  offset?: XYZProps;
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
  /** See [[TextAnnotation.offset]]. Default: (0, 0, 0). */
  offset?: Point3d;
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
  /** The rotation of the annotation.
   * @note When defining an annotation for a [TextAnnotation2d]($backend), only the `yaw` component (rotation around the Z axis) is used.
   */
  public orientation: YawPitchRollAngles;
  /** The formatted document. */
  public textBlock: TextBlock;
  /** Describes how the [[textBlock]]'s content should be aligned relative to the host element's origin. */
  public anchor: TextAnnotationAnchor;
  public offset: Point3d;

  private constructor(offset: Point3d, angles: YawPitchRollAngles, textBlock: TextBlock, anchor: TextAnnotationAnchor) {
    this.offset = offset;
    this.orientation = angles;
    this.textBlock = textBlock;
    this.anchor = anchor;
  }

  /** Creates a new TextAnnotation. */
  public static create(args?: TextAnnotationCreateArgs): TextAnnotation {
    const offset = args?.offset ?? new Point3d();
    const angles = args?.orientation ?? new YawPitchRollAngles();
    const textBlock = args?.textBlock ?? TextBlock.createEmpty();
    const anchor = args?.anchor ?? { vertical: "top", horizontal: "left" };

    return new TextAnnotation(offset, angles, textBlock, anchor);
  }

  /**
   * Creates a new TextAnnotation instance from its JSON representation.
   */
  public static fromJSON(props: TextAnnotationProps | undefined): TextAnnotation {
    return TextAnnotation.create({
      offset: props?.offset ? Point3d.fromJSON(props.offset) : undefined,
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

    if (!this.offset.isZero) {
      props.offset = this.offset.toJSON();
    }

    if (!this.orientation.isIdentity()) {
      props.orientation = this.orientation.toJSON();
    }

    if (this.anchor.vertical !== "top" || this.anchor.horizontal !== "left") {
      props.anchor = { ...this.anchor };
    }

    return props;
  }

  /** Compute the transform that positions and orients this annotation relative to its anchor point, based on the [[textBlock]]'s computed bounding box.
   * The anchor point is computed as specified by this annotation's [[anchor]] setting. For example, if the text block is anchored
   * at the bottom left, then the transform will be relative to the bottom-left corner of `textBlockExtents`.
   * The text block will be rotated around the fixed anchor point according to [[orientation]], then the anchor point will be translated by [[offset]].
   * @param textBlockDimensions The width and height of the bounding box containing the text block. You can compute this using [computeTextBlockExtents]($common).
   * @see [[computeAnchorPoint]] to compute the transform's anchor point.
   */
  public computeTransform(textBlockDimensions: XAndY): Transform {
    const anchorPt = this.computeAnchorPoint(textBlockDimensions);
    const matrix = this.orientation.toMatrix3d();

    const rotation = Transform.createFixedPointAndMatrix(anchorPt, matrix);
    const translation = Transform.createTranslation(this.offset);
    return translation.multiplyTransformTransform(rotation, rotation);
  }

  /** Compute the anchor point of this annotation as specified by [[anchor]].
   * @param textBlockDimensions The width and height of the bounding box containing the [[textBlock]]. You can compute this using [computeTextBlockExtents]($common).
   * @see [[computeTransform]] to compute the transform relative to the anchor point.
   */
  public computeAnchorPoint(textBlockDimensions: XAndY): Point3d {
    let x = 0;
    let y = 0;

    switch (this.anchor.horizontal) {
      case "center":
        x += textBlockDimensions.x / 2;
        break;
      case "right":
        x += textBlockDimensions.x;
        break;
    }

    switch (this.anchor.vertical) {
      case "middle":
        y -= textBlockDimensions.y / 2;
        break;
      case "bottom":
        y -= textBlockDimensions.y;
        break;
    }

    return new Point3d(x, y, 0);
  }

  /** Returns true if this annotation is logically equivalent to `other`. */
  public equals(other: TextAnnotation): boolean {
    return this.anchor.horizontal === other.anchor.horizontal && this.anchor.vertical === other.anchor.vertical
      && this.orientation.isAlmostEqual(other.orientation) && this.offset.isAlmostEqual(other.offset)
      && this.textBlock.equals(other.textBlock);
  }
}
