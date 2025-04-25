/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BackgroundFill, ColorDef, FillDisplay, FlatBufferGeometryStream, FrameGeometry, GeometryParams, GeometryStreamBuilder, JsonGeometryStream, PlacementProps, TextAnnotation, TextAnnotationProps, TextFrameStyleProps } from "@itwin/core-common";
import { Stroker } from "./Stroker";
import { produceTextBlockGeometry } from "../TextAnnotationGeometry";
import { IModelDb } from "../IModelDb";
import { Id64 } from "@itwin/core-bentley";
import { LineString3d, PointString3d, Range2d, Transform } from "@itwin/core-geometry";
import { layoutTextBlock, TextBlockLayout } from "../TextAnnotationLayout";

/** @packageDocumentation
 * @module Strokers
 */

export interface TextAnnotationStrokerArgs {
  annotationProps: TextAnnotationProps;
  placementProps?: PlacementProps;
  debugAnchorPoint?: boolean;
  debugSnapPoints?: boolean;
}

export class TextAnnotationStroker extends Stroker<TextAnnotationStrokerArgs> {
  private _iModel: IModelDb;
  private _builder: GeometryStreamBuilder;

  public constructor(iModel: IModelDb) {
    super();
    this._iModel = iModel;
    this._builder = new GeometryStreamBuilder();
  }

  public get builder(): GeometryStreamBuilder { return this._builder };

  public createGeometry({ annotationProps, placementProps, debugAnchorPoint, debugSnapPoints }: TextAnnotationStrokerArgs): FlatBufferGeometryStream | JsonGeometryStream | undefined {
    if (placementProps) this._builder.setLocalToWorldFromPlacement(placementProps)

    const annotation = TextAnnotation.fromJSON(annotationProps);

    const layout = layoutTextBlock({
      iModel: this._iModel,
      textBlock: annotation.textBlock,
    });

    const dimensions = layout.range;
    const transform = annotation.computeTransform(dimensions);

    const textBlockGeometry = produceTextBlockGeometry(layout, transform);

    // TODO: test these params
    const highPriorityParams = new GeometryParams(Id64.invalid);
    highPriorityParams.elmPriority = 1;
    this._builder.appendGeometryParamsChange(highPriorityParams);
    this._builder.appendTextBlock(textBlockGeometry);

    const lowPriorityParams = new GeometryParams(Id64.invalid);
    lowPriorityParams.elmPriority = 0;
    this._builder.appendGeometryParamsChange(lowPriorityParams);

    if (annotation.frame)
      this.appendFrame(annotation, layout);

    if (debugSnapPoints && annotation.frame)
      this.debugSnapPoints(annotation.frame, dimensions, transform);

    if (debugAnchorPoint)
      this.debugAnchorPoint(annotation, layout, transform);

    return { format: "json", data: this._builder.geometryStream };
  }

  private appendFrame(annotation: TextAnnotation, layout: TextBlockLayout): boolean {
    const range = Range2d.fromJSON(layout.range);
    const transform = annotation.computeTransform(range);
    const frame = annotation.frame;

    if (!frame || frame.shape === "none") return false;

    const params = new GeometryParams(Id64.invalid);
    params.elmPriority = 0;

    if (frame.fill === undefined) {
      params.fillDisplay = FillDisplay.Never;
    } else if (frame.fill === "background") {
      params.backgroundFill = BackgroundFill.Outline;
      params.fillDisplay = FillDisplay.Always;
    } else if (frame.fill !== "subcategory") {
      params.fillColor = ColorDef.fromJSON(frame.fill);
      params.lineColor = params.fillColor;
      params.fillDisplay = FillDisplay.Always;
    }

    if (frame.border !== "subcategory") {
      params.lineColor = ColorDef.fromJSON(frame.border);
      params.weight = frame.borderWeight;
    }

    const frameGeometry = FrameGeometry.computeFrame(frame.shape, range, transform.toJSON());

    const result = this._builder.appendGeometryParamsChange(params) && this._builder.appendGeometry(frameGeometry);
    return result;
  }

  private debugAnchorPoint(annotation: TextAnnotation, layout: TextBlockLayout, transform: Transform): boolean {
    const range = Range2d.fromJSON(layout.range);
    const debugAnchorPt = transform.multiplyPoint3d(annotation.computeAnchorPoint(range));

    // Make it blue
    const blueLineParams = new GeometryParams(Id64.invalid);
    blueLineParams.lineColor = ColorDef.blue;
    let result = this._builder.appendGeometryParamsChange(blueLineParams);

    // Draw a blue box to show the element's margin
    const marginCorners = range.corners3d(true);
    transform.multiplyPoint3dArrayInPlace(marginCorners);
    result = result && this._builder.appendGeometry(LineString3d.create(marginCorners));

    // Draw a blue x to show the anchor point - Rotation occurs around this point. The x will be 1 m by 1 m.
    result = result && this._builder.appendGeometry(LineString3d.create(debugAnchorPt.plusXYZ(-1, -1), debugAnchorPt.plusXYZ(1, 1)));
    result = result && this._builder.appendGeometry(LineString3d.create(debugAnchorPt.plusXYZ(1, -1), debugAnchorPt.plusXYZ(-1, 1)));

    // Draw a red box to show the text range
    const redLineParams = new GeometryParams(Id64.invalid);
    redLineParams.lineColor = ColorDef.red;
    result = result && this._builder.appendGeometryParamsChange(redLineParams);

    const rangeCorners = layout.textRange.corners3d(true);
    transform.multiplyPoint3dArrayInPlace(rangeCorners);
    result = result && this._builder.appendGeometry(LineString3d.create(rangeCorners));

    return result;
  }

  private debugSnapPoints(frame: TextFrameStyleProps, range: Range2d, transform: Transform): boolean {
    const points = FrameGeometry.computeIntervalPoints(frame.shape, range.toJSON(), transform.toJSON(), 0.5, 0.25);

    const params = new GeometryParams(Id64.invalid);
    params.lineColor = ColorDef.black;
    params.weight = (frame.borderWeight ?? 1) * 5; // We want the dots to be bigger than the frame so we can see them.
    params.fillDisplay = FillDisplay.Always;

    const result = this._builder.appendGeometryParamsChange(params) && this._builder.appendGeometry(PointString3d.create(points));
    return result;
  }
}