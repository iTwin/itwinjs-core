/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { ColorDef, ElementGeometry, FillDisplay, GeometryParams, TextAnnotation, TextAnnotationProps, TextFrameStyleProps } from "@itwin/core-common";
import { TextBlockLayout } from "./TextBlockLayout";
import { LineString3d, PointString3d, Range2d, Transform } from "@itwin/core-geometry";
import { Id64 } from "@itwin/core-bentley";
import { produceTextBlockGeometry } from "./TextBlockGeometry";
import { FrameGeometry } from "./FrameGeometry";

/**
 * @beta
 */
export namespace TextAnnotationGeometry {
  export interface RequestProps {
    /** The annotation to be drawn. Be sure to include a TextBlock with runs or no geometry will be produced. */
    annotationProps: TextAnnotationProps;
    /** Layout provided by calling [[layoutTextBlock]] */
    layout: TextBlockLayout;
    /** Builder that will be added to in place */
    builder: ElementGeometry.Builder;
    /** Whether or not to draw geometry for things like the snap points, range, and anchor point */
    wantDebugGeometry?: boolean;
  }

  /** Constructs the TextBlockGeometry and FrameGeometry and appends the geometry to the provided builder.
   * @returns true if the geometry was successfully appended.
   */
  export function appendTextAnnotationGeometry(props: RequestProps): void {
    const annotation = TextAnnotation.fromJSON(props.annotationProps);
    const range = Range2d.fromJSON(props.layout.range);
    const transform = annotation.computeTransform(range);

    // Construct the TextBlockGeometry
    const params = new GeometryParams(Id64.invalid);
    const entries = produceTextBlockGeometry(props.layout, annotation.computeTransform(props.layout.range));
    props.builder.appendTextBlock(entries, params);

    // Construct the FrameGeometry
    if (annotation.frame && annotation.frame.shape !== "none") {
      FrameGeometry.appendFrameToBuilder(props.builder, annotation.frame, range, transform, params);
    }

    // Construct the debug geometry
    if (props.wantDebugGeometry) {
      debugAnchorPoint(props.builder, annotation, props.layout, annotation.computeTransform(props.layout.range));
      if (annotation.frame) debugSnapPoints(props.builder, annotation.frame, props.layout.range, annotation.computeTransform(props.layout.range));
    }
  };

  /**
   * Draws the anchor point and margins of the text annotation.
   * The anchor point is the point around which the text rotates and is drawn as a blue x (1m by 1m).
   * The margins are drawn as a blue box.
   * The text range is drawn as a red box.
   */
  function debugAnchorPoint(builder: ElementGeometry.Builder, annotation: TextAnnotation, layout: TextBlockLayout, transform: Transform): boolean {
    const range = Range2d.fromJSON(layout.range);
    const debugAnchorPt = transform.multiplyPoint3d(annotation.computeAnchorPoint(range));

    // Make it blue
    const blueLineParams = new GeometryParams(Id64.invalid);
    blueLineParams.lineColor = ColorDef.blue;
    let result = builder.appendGeometryParamsChange(blueLineParams);

    // Draw a blue box to show the element's margin
    const marginCorners = range.corners3d(true);
    transform.multiplyPoint3dArrayInPlace(marginCorners);
    result = result && builder.appendGeometryQuery(LineString3d.create(marginCorners));

    // Draw a blue x to show the anchor point - Rotation occurs around this point. The x will be 1 m by 1 m.
    result = result && builder.appendGeometryQuery(LineString3d.create(debugAnchorPt.plusXYZ(-1, -1), debugAnchorPt.plusXYZ(1, 1)));
    result = result && builder.appendGeometryQuery(LineString3d.create(debugAnchorPt.plusXYZ(1, -1), debugAnchorPt.plusXYZ(-1, 1)));

    // Draw a red box to show the text range
    const redLineParams = new GeometryParams(Id64.invalid);
    redLineParams.lineColor = ColorDef.red;
    result = result && builder.appendGeometryParamsChange(redLineParams);

    const rangeCorners = layout.textRange.corners3d(true);
    transform.multiplyPoint3dArrayInPlace(rangeCorners);
    result = result && builder.appendGeometryQuery(LineString3d.create(rangeCorners));

    return result;
  }

  /** Draws the interval points defined by calling [[FrameGeometry.computeIntervalPoints]]. The points are shown as black dots 5x larger than the borderWeight */
  function debugSnapPoints(builder: ElementGeometry.Builder, frame: TextFrameStyleProps, range: Range2d, transform: Transform): boolean {
    if (frame.shape === "none")
      return false;
    const points = FrameGeometry.computeIntervalPoints({ frame: frame.shape, range, transform, lineIntervalFactor: 0.5, arcIntervalFactor: 0.25 });

    const params = new GeometryParams(Id64.invalid);
    params.lineColor = ColorDef.black;
    params.weight = (frame.borderWeight ?? 1) * 5; // We want the dots to be bigger than the frame so we can see them.
    params.fillDisplay = FillDisplay.Always;

    const result = builder.appendGeometryParamsChange(params) && builder.appendGeometryQuery(PointString3d.create(points));
    return result;
  }
}
