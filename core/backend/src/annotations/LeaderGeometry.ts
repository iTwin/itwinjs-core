import { ColorDef, ElementGeometry, GeometryParams, TextAnnotationLeader, TextFrameStyleProps } from "@itwin/core-common";
import { CurveCurve, LineSegment3d, LineString3d, Loop, Path, Point3d, Transform, Vector3d } from "@itwin/core-geometry";
import { computeFrame } from "./FrameGeometry";
import { TextBlockLayout } from "./TextBlockLayout";

export function appendLeadersToBuilder(builder: ElementGeometry.Builder, leaders: TextAnnotationLeader[], layout: TextBlockLayout, transform: Transform, params: GeometryParams, frame?: TextFrameStyleProps,): boolean {
  // If there is no frame, use a rectangular frame to compute the attachmentPoints for leaders.
  if (frame === undefined || frame.shape === "none") {
    frame = { shape: "rectangle" }
  }
  if (frame.shape === undefined || frame.shape === "none") return false;
  const frameCurve = computeFrame({ frame: frame.shape, range: layout.range, transform });

  leaders.forEach((leader) => {
    if (leader.styleOverrides?.leaderColor !== "subcategory" && leader.styleOverrides?.color !== "subcategory") {
      const color = leader.styleOverrides?.leaderColor ?? leader.styleOverrides?.color;
      params.lineColor = color ? ColorDef.fromJSON(color) : ColorDef.black;
      builder.appendGeometryParamsChange(params);
    }

    const attachmentPoint = computeLeaderAttachmentPoint(leader, frameCurve, layout, transform);
    if (!attachmentPoint) return false;

    // Leader line geometry
    const leaderLinePoints: Point3d[] = [];

    leaderLinePoints.push(leader.startPoint)

    leader.intermediatePoints?.forEach((point) => {
      leaderLinePoints.push(point);
    });

    if (leader.styleOverrides?.wantElbow) {
      const elbowLength = (leader.styleOverrides.elbowLength ?? 1) * (leader.styleOverrides.lineHeight ?? 1)
      const elbowDirection = computeElbowDirection(attachmentPoint, frameCurve, elbowLength);
      if (elbowDirection)
        leaderLinePoints.push(attachmentPoint.plusScaled(elbowDirection, elbowLength))
    }

    leaderLinePoints.push(attachmentPoint)

    builder.appendGeometryQuery(LineString3d.create(leaderLinePoints));

    // Terminator geometry
    const terminatorDirection = Vector3d.createStartEnd(
      leaderLinePoints[0], leaderLinePoints[1]
    ).normalize();

    const termY = terminatorDirection?.unitCrossProduct(Vector3d.unitZ());
    if (!termY || !terminatorDirection) return true; // Assuming leaders without terminators is a valid case.
    const terminatorHeight = (leader.styleOverrides?.terminatorHeight ?? 1) * (leader.styleOverrides?.lineHeight ?? 1);
    const terminatorWidth = (leader.styleOverrides?.terminatorWidth ?? 1) * (leader.styleOverrides?.lineHeight ?? 1);
    const basePoint = leader.startPoint.plusScaled(terminatorDirection, terminatorWidth);
    const termPointA = basePoint.plusScaled(termY, terminatorHeight);
    const termPointB = basePoint.plusScaled(termY.negate(), terminatorHeight);
    builder.appendGeometryQuery(LineString3d.create([termPointA, leader.startPoint, termPointB]));

    return true;
  })
  return false;
}

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

export function computeLeaderAttachmentPoint(
  leader: TextAnnotationLeader,
  frameCurve: Loop | Path,
  textLayout: TextBlockLayout,
  transform: Transform
): Point3d | undefined {
  let attachmentPoint: Point3d | undefined;

  if (leader.attachmentMode.mode === "Nearest") {
    attachmentPoint = frameCurve.closestPoint(leader.startPoint)?.point;
  } else if (leader.attachmentMode.mode === "KeyPoint") {
    const curves = frameCurve.collectCurvePrimitives(undefined, false, true);
    const curveIndex = leader.attachmentMode.curveIndex;
    const fraction = leader.attachmentMode.fraction;
    if (curveIndex >= curves.length) {
      // If the curveIndex is invalid, use the last curve
      // This is a fallback to avoid out-of-bounds access
      attachmentPoint = curves[curves.length - 1].fractionToPoint(fraction);
    } else {
      attachmentPoint = curves[curveIndex].fractionToPoint(fraction);
    }
  } else { // attachmentMode="TextPoint"
    let scaleDirection = transform.matrix.getColumn(0).negate(); // direction to draw a scaled line from text attachment point to find intersection point on frame
    let lineIndex: number;
    if (leader.attachmentMode.position.includes("Top")) {
      lineIndex = 0
    } else {
      lineIndex = textLayout.lines.length - 1
    }
    const lineRange = textLayout.lines[lineIndex].range;
    const lineOffset = textLayout.lines[lineIndex].offsetFromDocument;
    const origin = transform.multiplyPoint3d(Point3d.fromJSON(lineOffset));
    let attachmentPointOnText = origin.plusScaled(transform.matrix.getColumn(1), ((lineRange.yLength()) / 2));

    if (leader.attachmentMode.position.includes("Right")) {
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