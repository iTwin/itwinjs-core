/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { ColorDef, ElementGeometry, FillDisplay, GeometryParams, TextAnnotation, TextAnnotationProps, TextStyleSettings } from "@itwin/core-common";
import { RunLayout, TextBlockLayout, TextStyleResolver } from "./TextBlockLayout";
import { LineString3d, PointString3d, Range2d, Transform } from "@itwin/core-geometry";
import { Id64, Id64String } from "@itwin/core-bentley";
import { produceTextBlockGeometry } from "./TextBlockGeometry";
import { appendFrameToBuilder, computeIntervalPoints } from "./FrameGeometry";
import { appendLeadersToBuilder } from "./LeaderGeometry";


/**
 * Render priorities for different parts of a text annotation.
 * These values are provided to geometryParams.elmPriority.
 * @beta
 */
export interface RenderPriority {
  annotation?: number,
  annotationLabels?: number;
}
/**
 * Properties required to compute the geometry of a text annotation.
 * @beta
 * @see [[appendTextAnnotationGeometry]] to append the geometry to an [[ElementGeometry.Builder]].
 */
export interface AppendTextAnnotationGeometryArgs {
  /** The annotation to be drawn. Be sure to include a TextBlock with runs or no geometry will be produced. */
  annotationProps: TextAnnotationProps;
  /** Layout provided by calling [[layoutTextBlock]] */
  layout: TextBlockLayout;
  /** [[TextStyleResolver]] used to get styling and scale information for creating geometry. */
  textStyleResolver: TextStyleResolver;
  /** The scale factor to apply to the annotation. Usually comes from the `scaleFactor` of a [[Drawing]] element. */
  scaleFactor: number;
  /** Builder that will be added to in place */
  builder: ElementGeometry.Builder;
  /** The category the element will belong to. This will passed into the [[GeometryParams]] */
  categoryId: Id64String
  /** The optional sub-category the element will belong to. This will passed into the [[GeometryParams]] */
  subCategoryId?: Id64String
  /** Whether or not to draw geometry for things like the snap points, range, and anchor point */
  wantDebugGeometry?: boolean;
  /** Optional render priorities for different parts of the annotation. These values are provided to geometryParams.elmPriority. */
  renderPriority?: RenderPriority;
}

/** Constructs the TextBlockGeometry and frame geometry and appends the geometry to the provided builder.
 * @returns true if the geometry was successfully appended.
 * @beta
 */
export function appendTextAnnotationGeometry(props: AppendTextAnnotationGeometryArgs): boolean {
  const annotation = TextAnnotation.fromJSON(props.annotationProps);

  const transform = annotation.computeTransform(props.layout.range, props.scaleFactor);

  let result = true;

  // Construct the TextBlockGeometry
  const params = new GeometryParams(props.categoryId, props.subCategoryId);
  // Set the element priority for the text labels if provided. TextBlock with its fill has a different priority than the rest of the annotation.
  props.renderPriority?.annotationLabels && (params.elmPriority = props.renderPriority.annotationLabels);
  const entries = produceTextBlockGeometry(props.layout, transform.clone());
  result = result && props.builder.appendTextBlock(entries, params);

  // Construct the frame geometry
  if (props.textStyleResolver.blockSettings.frame.shape !== "none") {
    result = result && appendFrameToBuilder(props.builder, props.textStyleResolver.blockSettings.frame, props.layout.range, transform.clone(), params);
  }

  // Set the element priority for the entire annotation element except textBlock and its fill.
  if (props.renderPriority?.annotation) {
    params.elmPriority = props.renderPriority.annotation;
    result && props.builder.appendGeometryParamsChange(params);
  }
  // Construct the leader geometry
  if (annotation.leaders && annotation.leaders.length > 0) {
    result = result && appendLeadersToBuilder(props.builder, annotation.leaders, props.layout, transform.clone(), params, props.textStyleResolver, props.scaleFactor);
  }

  // Construct the debug geometry
  if (props.wantDebugGeometry) {
    result = result && debugAnchorPoint(props.builder, annotation, props.layout, transform.clone());
    result = result && debugRunLayout(props.builder, props.layout, transform.clone());
    if (props.textStyleResolver.blockSettings.frame.shape !== "none") result = result && debugSnapPoints(props.builder, props.textStyleResolver.blockSettings, props.layout.range, transform.clone());
  }

  return result;
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

/** Draws the interval points defined by calling [[computeIntervalPoints]]. The points are shown as black dots 5x larger than the borderWeight */
function debugSnapPoints(builder: ElementGeometry.Builder, style: TextStyleSettings, range: Range2d, transform: Transform): boolean {
  if (style.frame.shape === "none")
    return false;
  const points = computeIntervalPoints({ frame: style.frame.shape, range, transform, lineIntervalFactor: 0.5, arcIntervalFactor: 0.25 });

  const params = new GeometryParams(Id64.invalid);
  params.lineColor = ColorDef.black;
  params.weight = style.frame.borderWeight * 5; // We want the dots to be bigger than the frame so we can see them.
  params.fillDisplay = FillDisplay.Always;

  const result = builder.appendGeometryParamsChange(params) && builder.appendGeometryQuery(PointString3d.create(points));
  return result;
}

/**
 * Draws debug geometry for each line and run in a TextBlockLayout.
 *
 * For each line and run, this function draws boxes to visualize their layout and boundaries.
 * Different run types (e.g., text, linebreak, fraction, tab) are assigned distinct colors for clarity.
 * This is useful for debugging text layout and alignment issues.
 *
 * @param builder - The geometry builder to append debug geometry to.
 * @param layout - The text block layout containing lines and runs to visualize.
 * @param documentTransform - The transform to apply to the entire document.
 * @returns True if all debug geometry was successfully appended.
 */
function debugRunLayout(builder: ElementGeometry.Builder, layout: TextBlockLayout, documentTransform: Transform): boolean {
  let result = true; // Tracks if all geometry was appended successfully
  let lastColor = ColorDef.black; // Last color used, to minimize param changes

  // Map run types to debug colors
  const colors = {
    "text": ColorDef.fromString("orange"),
    "linebreak": ColorDef.fromString("yellow"),
    "fraction": ColorDef.fromString("green"),
    "tab": ColorDef.fromString("aquamarine"),
    "field": ColorDef.fromString("purple"),
    "marker": ColorDef.fromString("pink"),
  }

  const drawBox = (run: RunLayout, lineTransform: Transform, newColor: ColorDef) => {
    // Only change geometry params if the color changes
    if (lastColor !== newColor) {
      const colorParams = new GeometryParams(Id64.invalid);
      colorParams.lineColor = newColor;
      colorParams.weight = run.source.type === "linebreak" ? 3 : undefined;
      result = result && builder.appendGeometryParamsChange(colorParams);
      lastColor = newColor;
    }

    // Apply the line's offset to the run's offset
    const runTrans = Transform.createTranslationXYZ(run.offsetFromLine.x, run.offsetFromLine.y, 0);
    lineTransform.multiplyTransformTransform(runTrans, runTrans);

    // Draw the enclosing range for the run
    const runCorners = run.range.corners3d(true);
    runTrans.multiplyPoint3dArrayInPlace(runCorners);
    result = result && builder.appendGeometryQuery(LineString3d.create(runCorners));
  }

  layout.lines.forEach(line => {
    // Apply the line's offset transform
    const lineTrans = Transform.createTranslationXYZ(line.offsetFromDocument.x, line.offsetFromDocument.y, 0);
    documentTransform.multiplyTransformTransform(lineTrans, lineTrans);

    if (line.marker) {
      drawBox(line.marker, lineTrans, colors.marker);
    }

    line.runs.forEach(run => {
      // Determine color for this run type
      const color = colors[run.source.type] ?? ColorDef.black;
      drawBox(run, lineTrans, color);
    });
  });

  return result;
}
