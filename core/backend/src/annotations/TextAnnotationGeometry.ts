/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { ColorDef, ElementGeometry, FillDisplay, GeometryParams, TextAnnotation, TextAnnotationProps, TextFrameStyleProps } from "@itwin/core-common";
import { IModelDb } from "../IModelDb";
import { layoutTextBlock, TextBlockLayout } from "./TextAnnotationLayout";
import { LineString3d, PointString3d, Range2d, Transform } from "@itwin/core-geometry";
import { Id64 } from "@itwin/core-bentley";
import { produceTextBlockGeometry } from "./TextBlockGeometry";
import { FrameGeometry } from "./FrameGeometry";

export namespace TextAnnotationGeometry {
  export interface RequestProps {
    annotationProps: TextAnnotationProps;
    layout: TextBlockLayout;
    builder: ElementGeometry.Builder;
    wantDebugGeometry?: boolean;
    // categoryId: string;
    // placementProps: PlacementProps;
  }

  /**
   *
   * @param props
   */
  export function appendTextAnnotationGeometry(props: RequestProps): void {
    const annotation = TextAnnotation.fromJSON(props.annotationProps);
    const range = Range2d.fromJSON(props.layout.range);
    const transform = annotation.computeTransform(range);

    const entries = produceTextBlockGeometry(props.layout, annotation.computeTransform(props.layout.range));
    props.builder.appendTextBlock(entries);

    if (annotation.frame && annotation.frame.shape !== "none") {
      FrameGeometry.appendFrameToBuilder(props.builder, annotation.frame, range, transform);
    }

    if (props.wantDebugGeometry) {
      debugAnchorPoint(props.builder, annotation, props.layout, annotation.computeTransform(props.layout.range));
      if (annotation.frame) debugSnapPoints(props.builder, annotation.frame, props.layout.range, annotation.computeTransform(props.layout.range));
    }

  };

  export function getTextBlockLayout(props: { iModel: IModelDb, annotation: TextAnnotationProps }): TextBlockLayout {
    const annotation = TextAnnotation.fromJSON(props.annotation);
    return layoutTextBlock({
      iModel: props.iModel,
      textBlock: annotation.textBlock,
    });
  }

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