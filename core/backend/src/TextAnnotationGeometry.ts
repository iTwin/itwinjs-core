/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ###TODO
 */

import { TextAnnotation, TextBlockGeometryProps, TextBlockGeometryPropsEntry, TextString, TextStyleColor } from "@itwin/core-common";
import { ComputeRangesForTextLayout, FindFontId, FindTextStyle, layoutTextBlock, RunLayout, TextBlockLayout } from "./TextAnnotationLayout";
import { LineSegment3d, Point3d, Range2d, Transform, Vector2d } from "@itwin/core-geometry";
import { assert } from "@itwin/core-bentley";
import { IModelDb } from "./IModelDb";

interface GeometryContext {
  curColor?: TextStyleColor;
  entries: TextBlockGeometryPropsEntry[];
}

function setColor(color: TextStyleColor, context: GeometryContext): void {
  if (color !== context.curColor) {
    context.curColor = color;
    context.entries.push({ color });
  }
}

function createTextString(text: string, run: RunLayout, origin?: Point3d): TextString {
  assert(text.length > 0);

  const { lineHeight, widthFactor, isBold, isItalic, isUnderlined } = run.style;

  return new TextString({
    text,
    font: run.fontId,
    height: lineHeight,
    widthFactor,
    bold: isBold,
    italic: isItalic,
    underline: isUnderlined,
    origin,
  });
}

function processTextRun(run: RunLayout, transform: Transform, context: GeometryContext): void {
  assert(run.source.type === "text");
  const text = run.source.content.substring(run.charOffset, run.charOffset + run.numChars);
  if (text.length === 0) {
    return;
  }

  const ts = createTextString(text, run);
  if ("none" !== run.source.baselineShift) {
    const isSub = "subscript" === run.source.baselineShift;
    const offsetFactor = run.style[isSub ? "subScriptOffsetFactor" : "superScriptOffsetFactor"];
    const scale = run.style[isSub ? "subScriptScale" : "superScriptScale"];

    ts.origin.y += offsetFactor * ts.height;
    ts.height *= scale;
  }

  ts.transformInPlace(transform);

  setColor(run.style.color, context);
  context.entries.push({ text: ts});
}

function createFractionTextString(text: string, run: RunLayout, origin: Point3d, transform: Transform): TextString {
  const ts = createTextString(text, run, origin);
  assert(undefined !== ts.widthFactor);

  ts.height *= run.style.stackedFractionScale;
  ts.widthFactor *= run.style.stackedFractionScale;

  ts.transformInPlace(transform);

  return ts;
}

function processFractionRun(run: RunLayout, transform: Transform, context: GeometryContext): void {
  const source = run.source;
  assert(source.type === "fraction");

  if (source.numerator.length === 0 && source.denominator.length === 0) {
    return;
  }

  assert(undefined !== run.numeratorRange && undefined !== run.denominatorRange);

  const fontSize = new Vector2d(run.style.lineHeight * run.style.widthFactor, run.style.lineHeight);
  fontSize.scale(run.style.stackedFractionScale, fontSize);

  const numeratorOffset = new Point3d(run.numeratorRange.low.x, run.numeratorRange.low.y, 0);
  const denominatorOffset = new Point3d(run.denominatorRange.low.x, run.denominatorRange.low.y, 0);

  setColor(run.style.color, context);

  if (source.numerator.length > 0) {
    context.entries.push({ text: createFractionTextString(source.numerator, run, numeratorOffset, transform) });
  }

  const numeratorRange = Range2d.fromJSON(run.numeratorRange);
  const denominatorRange = Range2d.fromJSON(run.denominatorRange);

  let separator: LineSegment3d;
  if (run.style.stackedFractionType === "horizontal") {
    const fractionWidth = Math.max(numeratorRange.xLength(), denominatorRange.xLength());
    const y = 1.25 * denominatorRange.yLength();
    separator = LineSegment3d.createXYXY(0, y, fractionWidth, y);
  } else {
    const p0 = new Point3d(denominatorRange.low.x - fontSize.x / 2, denominatorRange.low.y + fontSize.y * (1 / 3), 0);
    const p1 = new Point3d(p0.x + fontSize.x, p0.y + fontSize.y * 1.5, 0);
    separator = LineSegment3d.createCapture(p0, p1);
  }

  separator.tryTransformInPlace(transform);

  context.entries.push({
    separator: {
      startPoint: separator.point0Ref.toJSON(),
      endPoint: separator.point1Ref.toJSON(),
    },
  });

  if (source.denominator.length > 0) {
    context.entries.push({ text: createFractionTextString(source.denominator, run,denominatorOffset, transform) });
  }
}

function produceTextBlockGeometry(layout: TextBlockLayout, documentTransform: Transform): TextBlockGeometryProps {
  const context: GeometryContext = { entries: [] };
  for (const line of layout.lines) {
    const lineTrans = Transform.createTranslationXYZ(line.offsetFromDocument.x, line.offsetFromDocument.y, 0);
    for (const run of line.runs) {
      if ("linebreak" === run.source.type) {
        continue;
      }

      const runTrans = Transform.createTranslationXYZ(run.offsetFromLine.x, run.offsetFromLine.y, 0);
      documentTransform.multiplyTransformTransform(runTrans, runTrans);
      lineTrans.multiplyTransformTransform(runTrans, runTrans);
      if ("text" === run.source.type) {
        processTextRun(run, runTrans, context);
      } else {
        processFractionRun(run, runTrans, context);
      }
    }
  }

  return { entries: context.entries };
}

/** Arguments supplied to [[produceTextAnnotationGeometry]].
 * @beta
 */
export interface ProduceTextAnnotationGeometryArgs {
  /** The annotation from which to produce the geometry. */
  annotation: TextAnnotation;
  /** The iModel from which to obtain fonts and text styles. */
  iModel: IModelDb;
  /** @internal chiefly for tests */
  computeTextRange?: ComputeRangesForTextLayout;
  /** @internal chiefly for tests */
  findTextStyle?: FindTextStyle;
  /** @internal chiefly for tests */
  findFontId?: FindFontId;
}

/** Produce a geometric representation of a text annotation.
 * The result can be supplied to [GeometryStreamBuilder.appendTextAnnotation]($common).
 * @see [[TextAnnotation2d.setAnnotation]] and [[TextAnnotation3d.setAnnotation]] to update the annotation, geometry, and placement of an annotation element.
 * @beta
 */
export function produceTextAnnotationGeometry(args: ProduceTextAnnotationGeometryArgs): TextBlockGeometryProps {
  const layout = layoutTextBlock({
    ...args,
    textBlock: args.annotation.textBlock,
  });

  const transform = args.annotation.computeDocumentTransform(layout.range);
  return produceTextBlockGeometry(layout, transform);
}
