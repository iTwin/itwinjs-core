/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Point3d, Range2d, Transform, XYZProps, YawPitchRollAngles, YawPitchRollProps } from "@itwin/core-geometry";
import { TextBlock, TextBlockProps } from "./TextBlock";
import { TextStyleSettingsProps } from "./TextStyle";

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

/**
 * Describes how to attach a [[TextAnnotationLeader]] to the frame around a [[TextBlock]].
 * Leader can be attached using one of the three modes:
 * - KeyPoint: attach to a point on the frame specified by the given curveIndex and fractional position.
 * - TextPoint: attach to a point that is projected on to the frame from the point on a particular line of text specified by [[LeaderTextPointOptions]].
 * - Nearest: attach to the point on frame that is nearest to [[TextAnnotationLeader.startPoint]].
 * @beta
 */
export type LeaderAttachment =
  | { mode: "KeyPoint"; curveIndex: number; fraction: number }
  | { mode: "TextPoint"; position: LeaderTextPointOptions }
  | { mode: "Nearest" };

/**
 * Specifies the possible positions to attach a leader on the frame around a [[TextBlock]]
 * when [[TextAnnotationLeader.attachment.mode]] is set to TextPoint.
 * TopLeft : attach to a point projected onto the frame from the point on the left side of the first line of text.
 * TopRight : attach to a point projected onto the frame from the point on the right side of the first line of text.
 * BottomLeft : attach to a point projected onto the frame from the point on the left side of the last line of text.
 * BottomRight : attach to a point projected onto the frame from the point on the right side of the last line of text.
 * @beta
 */
export type LeaderTextPointOptions = "TopLeft" | "TopRight" | "BottomLeft" | "BottomRight"

/**
 * A line that connects a [[TextAnnotation]] to a point in space relative to another element in the iModel.
 * A leader is always attached to the frame around the annotation's [[TextBlock]].
 * If the frame is not visible, the leader attaches to an invisible rectangular frame around the text block.
 * @see [[TextAnnotation.leaders]] for the leaders associated with an annotation.
 * @see [[TextStyleSettings.leader]] and [[styleOverrides]] to customize the appearance of leaders.
 * @beta
*/
export interface TextAnnotationLeader {
  /** The point where the leader starts.
   * This is the point on another element where the leader points to */
  startPoint: Point3d;
  /** Describes how to attach the leader to the frame around {@link TextAnnotation.textBlock}.*/
  attachment: LeaderAttachment;
  /** Optional intermediate points that the leader should pass through.
   * If not specified, the leader will be a straight line from startPoint to the point on the frame.
   * For now, intermediate points are a set of points which create additional LineSegments in the leader, but there could be intermediate shapes instead of straight LineSegments in future*/
  intermediatePoints?: Point3d[];
  /** Optional style overrides for the leader. If not specified, the leader will use the style defined by {@link TextBlockComponent.styleOverrides} as it is.
   * If specified, these overrides will be applied to the style.
   */
  styleOverrides?: TextStyleSettingsProps;
}
/**
 * JSON representation of a [[TextAnnotationLeader]].
 * @beta
 */
export interface TextAnnotationLeaderProps {
  /** See [[TextAnnotationLeader.startPoint]]. */
  startPoint: XYZProps;
  /** See [[TextAnnotationLeader.attachment]]. */
  attachment: LeaderAttachment;
  /** See [[TextAnnotationLeader.intermediatePoints]]. Default: no intermediate points. */
  intermediatePoints?: XYZProps[];
  /** See [[TextAnnotationLeader.styleOverrides]]. Default: no style overrides. */
  styleOverrides?: TextStyleSettingsProps;
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
  /** See [[TextAnnotation.leader]]. Default: an empty leader array  */
  leaders?: TextAnnotationLeaderProps[];
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
  /** See [[TextAnnotation.leader]]. Default: an empty leader array  */
  leaders?: TextAnnotationLeader[];
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
  /** The leaders of the text annotation. */
  public leaders?: TextAnnotationLeader[];

  private constructor(offset: Point3d, angles: YawPitchRollAngles, textBlock: TextBlock, anchor: TextAnnotationAnchor, leaders?: TextAnnotationLeader[]) {
    this.offset = offset;
    this.orientation = angles;
    this.textBlock = textBlock;
    this.anchor = anchor;
    this.leaders = leaders;
  }

  /** Creates a new TextAnnotation. */
  public static create(args?: TextAnnotationCreateArgs): TextAnnotation {
    const offset = args?.offset ?? new Point3d();
    const angles = args?.orientation ?? new YawPitchRollAngles();
    const textBlock = args?.textBlock ?? TextBlock.create();
    const anchor = args?.anchor ?? { vertical: "top", horizontal: "left" };
    const leaders = args?.leaders ?? undefined;
    return new TextAnnotation(offset, angles, textBlock, anchor, leaders);
  }

  /**
   * Creates a new TextAnnotation instance from its JSON representation.
   */
  public static fromJSON(props?: TextAnnotationProps): TextAnnotation {
    return TextAnnotation.create({
      offset: props?.offset ? Point3d.fromJSON(props.offset) : undefined,
      orientation: props?.orientation ? YawPitchRollAngles.fromJSON(props.orientation) : undefined,
      textBlock: props?.textBlock ? TextBlock.create(props.textBlock) : undefined,
      anchor: props?.anchor ? { ...props.anchor } : undefined,
      leaders: props?.leaders ? props.leaders.map((leader) => ({
        startPoint: Point3d.fromJSON(leader.startPoint),
        attachment: leader.attachment,
        styleOverrides: leader.styleOverrides ?? undefined,
        intermediatePoints: leader.intermediatePoints ? leader.intermediatePoints.map((point) => Point3d.fromJSON(point)) : undefined,
      })) : undefined,
    });
  }

  /**
   * Converts this annotation to its JSON representation.
   */
  public toJSON(): TextAnnotationProps {
    const props: TextAnnotationProps = {};

    // Even if the text block is empty, we want to record its style ID and overrides, e.g.,
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

    props.leaders = this.leaders?.map((leader) => ({
      startPoint: leader.startPoint.toJSON(),
      attachment: leader.attachment,
      styleOverrides: leader.styleOverrides ?? undefined,
      intermediatePoints: leader.intermediatePoints ? leader.intermediatePoints.map((point) => point.toJSON()) : undefined,
    })) ?? undefined;

    return props;
  }

  /** Compute the transform that positions and orients this annotation relative to its anchor point, based on the [[textBlock]]'s computed bounding box.
   * The anchor point is computed as specified by this annotation's [[anchor]] setting. For example, if the text block is anchored
   * at the bottom left, then the transform will be relative to the bottom-left corner of `textBlockExtents`.
   * The text block will be rotated around the fixed anchor point according to [[orientation]], then translated by [[offset]].
   * The anchor point will coincide with (0, 0, 0) unless an [[offset]] is present.
   * If a scale factor is specified, the transform will also scale the annotation by that factor. Usually, this should come from the [[Drawing]] containing the annotation.
   * @param boundingBox A box fully containing the [[textBlock]]. This range should include the margins.
   * @param scaleFactor A factor by which to scale the annotation. Default: 1 (no scaling).
   * @see [[computeAnchorPoint]] to compute the transform's anchor point.
   * @see [computeLayoutTextBlockResult]($backend) to lay out a `TextBlock`.
   */
  public computeTransform(boundingBox: Range2d, scaleFactor: number = 1): Transform {
    const anchorPt = this.computeAnchorPoint(boundingBox);
    const matrix = this.orientation.toMatrix3d();

    const transform = Transform.createIdentity();
    const translation = Transform.createTranslation(this.offset.minus(anchorPt));
    const scaleTransform = Transform.createScaleAboutPoint(anchorPt, scaleFactor);
    const rotation = Transform.createFixedPointAndMatrix(anchorPt, matrix);
    transform.multiplyTransformTransform(translation, transform);
    transform.multiplyTransformTransform(scaleTransform, transform);
    transform.multiplyTransformTransform(rotation, transform);
    return transform;
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

  /** Returns true if the leaders of this annotation are equal to the leaders of `other`. */
  private areLeadersEqual(leadersA?: TextAnnotationLeader[], leadersB?: TextAnnotationLeader[]): boolean {
    if (leadersA === leadersB) return true;
    if (!leadersA || !leadersB || leadersA.length !== leadersB.length) return false;

    for (let i = 0; i < leadersA.length; ++i) {
      const a = leadersA[i];
      const b = leadersB[i];

      if (!a.startPoint.isAlmostEqual(b.startPoint)) return false;
      if (JSON.stringify(a.attachment) !== JSON.stringify(b.attachment)) return false;
      if (JSON.stringify(a.styleOverrides) !== JSON.stringify(b.styleOverrides)) return false;

      const pointsA = a.intermediatePoints ?? [];
      const pointsB = b.intermediatePoints ?? [];
      if (pointsA.length !== pointsB.length) return false;
      for (let j = 0; j < pointsA.length; ++j) {
        if (!pointsA[j].isAlmostEqual(pointsB[j])) return false;
      }
    }
    return true;
  }

  /** Returns true if this annotation is logically equivalent to `other`. */
  public equals(other: TextAnnotation): boolean {
    if (this.anchor.horizontal !== other.anchor.horizontal ||
      this.anchor.vertical !== other.anchor.vertical ||
      !this.orientation.isAlmostEqual(other.orientation) ||
      !this.offset.isAlmostEqual(other.offset) ||
      !this.textBlock.equals(other.textBlock))
      return false;

    return this.areLeadersEqual(this.leaders, other.leaders);

  }
}