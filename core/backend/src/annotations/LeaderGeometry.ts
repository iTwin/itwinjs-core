/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { ColorDef, ElementGeometry, FillDisplay, GeometryParams, TextAnnotationLeader, TextFrameStyleProps, TextStyleColor, TextStyleSettings } from "@itwin/core-common";
import { Angle, Arc3d, CurveCurve, CurvePrimitive, LineSegment3d, LineString3d, Loop, Path, Point3d, Transform, Vector3d } from "@itwin/core-geometry";
import { computeFrame } from "./FrameGeometry";
import { TextBlockLayout, TextStyleResolver } from "./TextBlockLayout";

/**
 * Constructs and appends leader lines and their terminators to the provided geometry builder for a text annotation.
 *
 * This function processes an array of `TextAnnotationLeader` objects, computes their attachment points
 * relative to a text frame (or a default rectangular frame if none is provided), and appends the leader
 * line and terminator geometry to the builder. It also applies color overrides if specified
 * in the leader's style overrides.
 *
 * @param builder - The geometry builder to which the leader geometries will be appended.
 * @param leaders - An array of leader properties.
 * @param layout - The layout information for the text block, including its range.
 * @param transform - The transform to apply to the frame and leader geometry.
 * @param params - The geometry parameters, such as color, to use for the leader lines.
 * @param textStyleResolver - Resolver for text styles, used to obtain leader styles.
 * @param scaleFactor - The scale factor to apply to leader dimensions, usually comes from the `scaleFactor` of a [[Drawing]] element.
 * @returns `true` if at least one leader with a terminator was successfully appended; otherwise, `false`.
 * @beta
 */
export function appendLeadersToBuilder(builder: ElementGeometry.Builder, leaders: TextAnnotationLeader[], layout: TextBlockLayout, transform: Transform, params: GeometryParams, textStyleResolver: TextStyleResolver, scaleFactor: number): boolean {
  let result = true;
  const scaledBlockTextHeight = textStyleResolver.blockSettings.textHeight * scaleFactor;
  let frame: TextFrameStyleProps | undefined = textStyleResolver.blockSettings.frame;

  // If there is no frame, use a rectangular frame to compute the attachmentPoints for leaders.
  if (frame === undefined || frame.shape === "none") {
    frame = { shape: "rectangle" }
  }
  if (frame.shape === undefined || frame.shape === "none") return false;
  const frameCurve = computeFrame({ frame: frame.shape, range: layout.range, transform });

  for (const leader of leaders) {
    const leaderStyle = textStyleResolver.resolveSettings(leader.styleOverrides ?? {}, true);

    let effectiveColor: TextStyleColor = "subcategory";

    if (leaderStyle.leader.color === "inherit") {
      effectiveColor = leaderStyle.color;
    } else if (leaderStyle.leader.color !== "subcategory") {
      effectiveColor = leaderStyle.leader.color;
    }

    if (effectiveColor !== "subcategory") {
      params.lineColor = ColorDef.fromJSON(effectiveColor);
      result = result && builder.appendGeometryParamsChange(params);
    }

    const attachmentPoint = computeLeaderAttachmentPoint(leader, frameCurve, layout, transform);
    if (!attachmentPoint) return false;

    // Leader line geometry
    const leaderLinePoints: Point3d[] = [];

    leaderLinePoints.push(leader.startPoint)

    leader.intermediatePoints?.forEach((point) => {
      leaderLinePoints.push(point);
    });

    if (leaderStyle.leader.wantElbow) {
      const elbowLength = leaderStyle.leader.elbowLength * scaledBlockTextHeight;
      const elbowDirection = computeElbowDirection(attachmentPoint, frameCurve, elbowLength);
      if (elbowDirection)
        leaderLinePoints.push(attachmentPoint.plusScaled(elbowDirection, elbowLength))
    }

    leaderLinePoints.push(attachmentPoint)

    const terminatorDirection = Vector3d.createStartEnd(
      leaderLinePoints[0], leaderLinePoints[1]
    ).normalize();
    const terminatorWidth = leaderStyle.leader.terminatorWidthFactor * scaledBlockTextHeight;
    // Truncate the first segment of the leader lines to account for the arrowhead size when closedArrow (hollow triangle) terminatorShape is used.
    if (leaderStyle.leader.terminatorShape === "closedArrow") {
      if (terminatorDirection)
        leaderLinePoints[0] = leaderLinePoints[0].plusScaled(terminatorDirection, terminatorWidth);
    }

    result = result && builder.appendGeometryQuery(LineString3d.create(leaderLinePoints));

    // Terminator geometry
    if (!terminatorDirection) continue; // Assuming leaders without terminators is a valid case.

    result = result && createTerminatorGeometry(builder, leader.startPoint, terminatorDirection, params, leaderStyle, scaledBlockTextHeight);

  }
  return result;
}

export function createTerminatorGeometry(builder: ElementGeometry.Builder, point: Point3d, dir: Vector3d, params: GeometryParams, textStyleSettings: TextStyleSettings, textHeight: number): boolean {

  let result = true;
  const termY = dir.unitCrossProduct(Vector3d.unitZ());
  if (!termY) return false; // If dir is parallel to Z, we can't create a terminator
  const terminatorHeight = textStyleSettings.leader.terminatorHeightFactor * textHeight;
  const terminatorWidth = textStyleSettings.leader.terminatorWidthFactor * textHeight;
  const basePoint = point.plusScaled(dir, terminatorWidth);
  const point1 = basePoint.plusScaled(termY, terminatorHeight / 2);
  const point2 = basePoint.plusScaled(termY.negate(), terminatorHeight / 2);
  const radius = terminatorHeight / 2;

  // Helper function to add fill parameters
  const addFillParams = () => {
    params.fillColor = ColorDef.black;
    params.fillDisplay = FillDisplay.Always;
    result = result && builder.appendGeometryParamsChange(params);
  };

  // Helper function to create geometry entry
  const addGeometry = (content: CurvePrimitive, useLoop = false) => {
    const finalContent = useLoop ? Loop.create(content) : content;
    result = result && builder.appendGeometryQuery(finalContent);
  };

  switch (textStyleSettings.leader.terminatorShape) {
    case "openArrow": {
      const lineString = LineString3d.create([point1, point, point2]);
      addGeometry(lineString);
      break;
    }

    case "closedArrow": {
      const lineString = LineString3d.create([point1, point, point2, point1]);
      addGeometry(lineString);
      break;
    }

    case "closedArrowFilled": {
      addFillParams();
      const lineString = LineString3d.create([point1, point, point2, point1]);
      addGeometry(lineString, true);
      break;
    }

    case "circle": {
      const circle = Arc3d.createXY(point, radius);
      addGeometry(circle);
      break;
    }

    case "circleFilled": {
      addFillParams();
      const circle = Arc3d.createXY(point, radius);
      addGeometry(circle, true);
      break;
    }

    case "slash": {
      const normalizedVector = dir.normalize();
      if (!normalizedVector) throw new Error("Invalid reference vector for slash terminator.");

      const rotatedVector = normalizedVector.rotateXY(Angle.createDegrees(45));
      const startPoint = point.plusScalesd(rotatedVector, -radius);
      const endPoint = point.plusScaled(rotatedVector, radius);

      const slashLine = LineSegment3d.create(startPoint, endPoint);
      addGeometry(slashLine);
      break;
    }

    default:
      throw new Error(`Unknown terminator shape: ${textStyleSettings.leader.terminatorShape}`);
  }

  return result;
};


/**
 * Computes the direction vector for an "elbow" for leader based on the attachment point and a frame curve.
 * The elbow direction is determined by whether the attachment point is closer to the left or right side of the frame.
 * If the computed elbow would be tangent to the frame at the intersection, no elbow direction is returned.
 *
 * @param attachmentPoint - The point where the leader attaches.
 * @param frameCurve - The frame curve (either a Loop or Path) to which the leader is attached.
 * @param elbowLength - The length of the elbow segment to be created.
 * @returns The direction vector for the elbow, or `undefined` if the elbow would be tangent to the frame.
 * @beta
 */
export function computeElbowDirection(attachmentPoint: Point3d, frameCurve: Loop | Path, elbowLength: number): Vector3d | undefined {

  let elbowDirection: Vector3d | undefined;
  // Determine the direction based on the closest point's position relative to the frame
  const isCloserToLeft = Math.abs(attachmentPoint.x - frameCurve.range().low.x) < Math.abs(attachmentPoint.x - frameCurve.range().high.x);

  // Decide the direction: left (-X) or right (+X)
  elbowDirection = isCloserToLeft ? Vector3d.unitX().negate() : Vector3d.unitX();

  // Verify if the elbow is a tangent to the frame, if yes, do not create an elbow
  const elbowPoint = attachmentPoint.plusScaled(elbowDirection, elbowLength);
  const elbowLine = LineSegment3d.create(attachmentPoint, elbowPoint);
  // Find intersection points between the elbow and the frame
  const intersections = CurveCurve.intersectionXYZPairs(elbowLine, false, frameCurve, false);
  // As the elbow will intersect the frame only at one point, we can safely use the first intersection
  const intersection = intersections[0];
  const curveFraction = intersection.detailB.fraction;
  const derivative = intersection.detailB.curve?.fractionToPointAndDerivative(curveFraction);
  const tangent = derivative?.direction.normalize();
  const lineDirection = Vector3d.createStartEnd(elbowLine.point0Ref, elbowLine.point1Ref).normalize();
  if (tangent && lineDirection) {
    const dot = tangent.dotProduct(lineDirection);
    // If the tangent and line direction are aligned (dot product close to 1 or -1), it's tangent
    if (Math.abs(dot) > 0.999) {
      elbowDirection = undefined;
    }
  }
  return elbowDirection;
}

/**
 * Computes the attachment point for a leader line on a text annotation frame.
 *
 * The attachment point is determined based on the leader's attachment mode:
 * - `"Nearest"`: Finds the closest point on the frame curve to the leader's start point.
 * - `"KeyPoint"`: Uses a specific curve segment and fraction along that segment to determine the point.
 * - `"TextPoint"`: Calculates a point on the text layout (top/bottom, left/right) and projects it onto the frame curve.
 *
 * @param leader - The leader props.
 * @param frameCurve - The curve (Loop or Path) representing the annotation frame.
 * @param textLayout - The layout information for the text block.
 * @param transform - The transform applied to the text layout.
 * @returns The computed attachment point as a `Point3d`, or `undefined` if it cannot be determined.
 * @beta
 */
export function computeLeaderAttachmentPoint(
  leader: TextAnnotationLeader,
  frameCurve: Loop | Path,
  textLayout: TextBlockLayout,
  transform: Transform
): Point3d | undefined {
  let attachmentPoint: Point3d | undefined;

  if (leader.attachment.mode === "Nearest") {
    attachmentPoint = frameCurve.closestPoint(leader.startPoint)?.point;
  } else if (leader.attachment.mode === "KeyPoint") {
    const curves = frameCurve.collectCurvePrimitives(undefined, false, true);
    const curveIndex = leader.attachment.curveIndex;
    const fraction = leader.attachment.fraction;
    if (curveIndex >= curves.length) {
      // If the curveIndex is invalid, use the last curve
      // This is a fallback to avoid out-of-bounds access
      attachmentPoint = curves[curves.length - 1].fractionToPoint(fraction);
    } else {
      attachmentPoint = curves[curveIndex].fractionToPoint(fraction);
    }
  } else { // attachment.mode="TextPoint"
    let scaleDirection = transform.matrix.getColumn(0).negate(); // direction to draw a scaled line from text attachment point to find intersection point on frame
    let lineIndex: number;
    if (leader.attachment.position.includes("Top")) {
      lineIndex = 0
    } else {
      lineIndex = textLayout.lines.length - 1
    }
    const lineRange = textLayout.lines[lineIndex].range;
    const lineOffset = textLayout.lines[lineIndex].offsetFromDocument;
    const origin = transform.multiplyPoint3d(Point3d.fromJSON(lineOffset));
    let attachmentPointOnText = origin.plusScaled(transform.matrix.getColumn(1), ((lineRange.yLength()) / 2));

    if (leader.attachment.position.includes("Right")) {
      attachmentPointOnText = attachmentPointOnText.plusScaled(transform.matrix.getColumn(0), lineRange.xLength());
      scaleDirection = scaleDirection.negate();
    }
    // Find the nearest intersection point on the frame to get the correct attachment point
    // Extend the direction vector to create a target point far along the direction
    const targetPoint = attachmentPointOnText.plusScaled(scaleDirection, 1e6); // Scale the direction vector to a large value
    const intersectionLine = LineSegment3d.create(attachmentPointOnText, targetPoint);
    const closestPointDetail = CurveCurve.intersectionXYZPairs(intersectionLine, false, frameCurve, false);
    attachmentPoint = closestPointDetail[0]?.detailA.point;
  }
  return attachmentPoint;
}