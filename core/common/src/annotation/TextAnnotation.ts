/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Point3d, Range2d, Transform, XYZProps, YawPitchRollAngles, YawPitchRollProps } from "@itwin/core-geometry";
import { TextBlock, TextBlockProps } from "./TextBlock";
import { TextStyleColor } from "./TextStyle";

/** Describes how to compute the "anchor point" for a [[TextAnnotation]].
 * The anchor point is a point on or inside of the 2d bounding box enclosing the contents of the annotation's [[TextBlock]].
 * The annotation can be rotated and translated relative to the anchor point. The anchor point also serves as the snap point
 * when [AccuSnap]($frontend) is set to [SnapMode.Origin]($frontend).
 * [[TextAnnotation.computeTransform]] will align the anchor point with (0, 0).
 * @see [[TextAnnotation]] for a description of how the anchor point is computed.
 * @beta
 */
export interface TextAnnotationAnchor {
  /**
   * The vertical alignment of the anchor point.
   * "top" aligns the anchor point with the top of the text's bounding box.
   * "middle" aligns the anchor point with the middle of the text's bounding box.
   * "bottom" aligns the anchor point with the bottom of the text's bounding box.
   */
  vertical: "top" | "middle" | "bottom";

  /**
   * The horizontal alignment of the anchor point.
   * "left" aligns the anchor point with left side of the text's bounding box.
   * "center" aligns the anchor point with center of the text with's bounding box.
   * "right" aligns the anchor point with right side of the text's bounding box.
   */
  horizontal: "left" | "center" | "right";
}

/** Set of predefined shapes that can be computed and drawn around the margins of a [[TextBlock]]
 * @beta
*/
export type TextAnnotationFrameShape = "none" | "line" | "rectangle" | "circle" | "equilateralTriangle" | "diamond" | "square" | "pentagon" | "hexagon" | "octagon" | "capsule" | "roundedRectangle";


/**
 * Describes what color to use when filling the frame around a [[TextBlock]].
 * If `background` is specified, [[GeometryParams.BackgroundFill]] will be set to `BackgroundFill.Outline`.
 * @beta
 */
export type TextAnnotationFillColor = TextStyleColor | "background";

/**
 * Describes how to draw the frame around a [[TextBlock]].
 * The frame can be a simple line, a filled shape, or both.
 * @beta
 */
export interface TextFrameStyleProps {
  /** Shape of the frame. Default: "rectangle" */
  shape?: TextAnnotationFrameShape;
  /** The color to fill the shape of the text frame. This fill will is applied using [[FillDisplay.Blanking]]. Default: no fill */
  fill?: TextAnnotationFillColor;
  /** The color of the text frame's outline. Default: black */
  border?: TextStyleColor;
  /** This will be used to set the [[GeometryParams.weight]] property of the frame (in pixels). Default: 1px */
  borderWeight?: number;
}

/**
 * JSON representation of a [[TextAnnotation]].
 * @beta
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
  /** See [[TextAnnotation.frame]]. Default: no frame */
  frame?: TextFrameStyleProps
}

/** Arguments supplied to [[TextAnnotation.create]].
 * @beta
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
  /** See [[TextAnnotation.frame]]. Default: no frame */
  frame?: TextFrameStyleProps
}

/**
 * Represents a formatted block of text positioned in 2d or 3d space.
 * [TextAnnotation2d]($backend) and [TextAnnotation3d]($backend) elements store a single TextAnnotation from which their geometric representation is generated.
 * Other types of elements may store multiple TextAnnotations, positioned relative to one another.
 * The annotation's position and orientation relative to the host element's [Placement]($common) is determined as follows:
 * - First, a bounding box is computed enclosing the contents of the [[textBlock].
 * - Then, an "anchor point" is computed based on the bounding box and the [[anchor]] property. The anchor point can be at one of the four corners of the box, in the middle of one of its four
 * edges, or in the center of the box.
 * - The [[orientation]] is applied to rotate the box around the anchor point.
 * - Finally, the [[offset]] is added to the anchor point to apply translation.
 * @see [appendTextAnnotationGeometry]($backend) to construct the geometry and append it to an [[ElementGeometry.Builder]].
 * @beta
 */
export class TextAnnotation {
  /** The rotation of the annotation.
   * @note When defining an annotation for a [TextAnnotation2d]($backend), only the `yaw` component (rotation around the Z axis) is used.
   */
  public orientation: YawPitchRollAngles;
  /** The formatted document. */
  public textBlock: TextBlock;
  /** Describes how to compute the [[textBlock]]'s anchor point. */
  public anchor: TextAnnotationAnchor;
  /** An offset applied to the anchor point that can be used to position annotations within the same geometry stream relative to one another. */
  public offset: Point3d;
  /** The frame settings of the text annotation. */
  public frame?: TextFrameStyleProps;

  private constructor(offset: Point3d, angles: YawPitchRollAngles, textBlock: TextBlock, anchor: TextAnnotationAnchor, frame?: TextFrameStyleProps) {
    this.offset = offset;
    this.orientation = angles;
    this.textBlock = textBlock;
    this.anchor = anchor;
    this.frame = frame
  }

  /** Creates a new TextAnnotation. */
  public static create(args?: TextAnnotationCreateArgs): TextAnnotation {
    const offset = args?.offset ?? new Point3d();
    const angles = args?.orientation ?? new YawPitchRollAngles();
    const textBlock = args?.textBlock ?? TextBlock.createEmpty();
    const anchor = args?.anchor ?? { vertical: "top", horizontal: "left" };
    // If the user supplies a frame, but doesn't supply a shape, default the shape to "rectangle"
    const shape: TextAnnotationFrameShape = args?.frame?.shape ?? "rectangle";
    const frame = args?.frame ? { shape, ...args.frame } : undefined;

    return new TextAnnotation(offset, angles, textBlock, anchor, frame);
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
      frame: props?.frame ? { shape: "rectangle", ...props.frame } : undefined,
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

    // Default frame to "none"
    props.frame = this.frame ? { ...this.frame } : undefined;

    return props;
  }

  /** Compute the transform that positions and orients this annotation relative to its anchor point, based on the [[textBlock]]'s computed bounding box.
   * The anchor point is computed as specified by this annotation's [[anchor]] setting. For example, if the text block is anchored
   * at the bottom left, then the transform will be relative to the bottom-left corner of `textBlockExtents`.
   * The text block will be rotated around the fixed anchor point according to [[orientation]], then translated by [[offset]].
   * The anchor point will coincide with (0, 0, 0) unless an [[offset]] is present.
   * @param boundingBox A box fully containing the [[textBlock]]. This range should include the margins.
   * @see [[computeAnchorPoint]] to compute the transform's anchor point.
   * @see [computeLayoutTextBlockResult]($backend) to lay out a `TextBlock`.
   */
  public computeTransform(boundingBox: Range2d): Transform {
    const anchorPt = this.computeAnchorPoint(boundingBox);
    const matrix = this.orientation.toMatrix3d();

    const rotation = Transform.createFixedPointAndMatrix(anchorPt, matrix);
    const translation = Transform.createTranslation(this.offset.minus(anchorPt));

    return translation.multiplyTransformTransform(rotation, rotation);
  }

  /** Compute the anchor point of this annotation as specified by [[anchor]].
   * @param boundingBox A box fully containing the [[textBlock]].
   * @see [[computeTransform]] to compute the transform relative to the anchor point.
   */
  public computeAnchorPoint(boundingBox: Range2d): Point3d {
    let x = boundingBox.low.x;
    let y = boundingBox.high.y;

    switch (this.anchor.horizontal) {
      case "center":
        x += boundingBox.xLength() / 2;
        break;
      case "right":
        x += boundingBox.xLength();
        break;
    }

    switch (this.anchor.vertical) {
      case "middle":
        y -= boundingBox.yLength() / 2;
        break;
      case "bottom":
        y -= boundingBox.yLength();
        break;
    }

    return new Point3d(x, y, 0);
  }

  /** Returns true if this annotation is logically equivalent to `other`. */
  public equals(other: TextAnnotation): boolean {
    const framesMatch = this.frame?.shape === other.frame?.shape
      && this.frame?.fill === other.frame?.fill
      && this.frame?.border === other.frame?.border
      && this.frame?.borderWeight === other.frame?.borderWeight;

    return this.anchor.horizontal === other.anchor.horizontal && this.anchor.vertical === other.anchor.vertical
      && this.orientation.isAlmostEqual(other.orientation) && this.offset.isAlmostEqual(other.offset)
      && this.textBlock.equals(other.textBlock)
      && framesMatch;
  }
}
