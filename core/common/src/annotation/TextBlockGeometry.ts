/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { TextString } from "../geometry/TextString";
import { TextStyleColor, TextStyleSettings } from "./TextStyle";
import { LineSegment3d, Point3d, Range2d, Transform, Vector2d } from "@itwin/core-geometry";
import { LineLayoutResult, RunLayoutResult, TextBlockLayoutResult } from "./TextBlockLayoutResult";
import { FractionRun, Paragraph, Run, TextBlock, TextRun } from "./TextBlock";
import { assert } from "@itwin/core-bentley";
 
export interface TextBlockGeometryProcessor {
  textBlock: TextBlock;
  layout: TextBlockLayoutResult;

  getSettings(styleName: string): TextStyleSettings;

  changeColor(color: TextStyleColor): void;
  acceptTextString(textString: TextString): void;
  acceptFractionSeparator(separator: LineSegment3d): void;
}

export namespace TextBlockGeometryProcessor {
  export function process(processor: TextBlockGeometryProcessor): void {
    const context = new GeometryContext(processor);
    context.process();
  }
}

class GeometryContext {
  private readonly _settings = new Map<string, TextStyleSettings>();
  private readonly _processor: TextBlockGeometryProcessor;
  private _curColor?: TextStyleColor;

  public constructor(processor: TextBlockGeometryProcessor) {
    this._processor = processor;
  }

  public process(): void {
    assert(undefined === this._curColor);
    
    for (const line of this._processor.layout.lines) {
      const paragraph = this._processor.textBlock.paragraphs[line.sourceParagraphIndex];
      if (!paragraph) {
        throw new Error("Source paragraph for LineLayoutResult not found in TextBlock");
      }

      const lineTrans = Transform.createTranslationXYZ(line.offsetFromDocument.x, line.offsetFromDocument.y, 0);
      for (const run of line.runs) {
        const source = paragraph.runs[run.sourceRunIndex];
        if (!source) {
          throw new Error("Source run for RunLayoutResult not found in TextBlock");
        } else if ("linebreak" === source.type) {
          continue;
        }

        const runTrans = Transform.createTranslationXYZ(run.offsetFromLine.x, run.offsetFromLine.y, 0);
        lineTrans.multiplyTransformTransform(runTrans, runTrans);

        const style = this.createEffectiveRunStyle(source);
        if ("text" === source.type) {
          this.processTextRun(source, run, style, runTrans);
        } else {
          this.processFractionRun(source, run, style, runTrans);
        }
      }
    }

    this._curColor = undefined;
  }

  private setColor(color: TextStyleColor): void {
    if (this._curColor !== color) {
      this._processor.changeColor(this._curColor = color);
    }
  }

  private createTextString(text: string, style: TextStyleSettings, layout: RunLayoutResult, origin?: Point3d): TextString {
    assert(text.length > 0);
    
    return new TextString({
      text,
      font: layout.fontId,
      height: style.lineHeight,
      widthFactor: style.widthFactor,
      bold: style.isBold,
      italic: style.isItalic,
      underline: style.isUnderlined,
      origin,
    });
  }

  private createFractionTextString(text: string, style: TextStyleSettings, layout: RunLayoutResult, origin: Point3d, transform: Transform): TextString {
    const ts = this.createTextString(text, style, layout, origin);
    assert(undefined !== ts.widthFactor);
    
    ts.height *= style.stackedFractionScale;
    ts.widthFactor *= style.stackedFractionScale;
    ts.transformInPlace(transform);
    return ts;
  }

  private processTextRun(source: TextRun, layout: RunLayoutResult, style: TextStyleSettings, transform: Transform): void {
    const text = source.content.substring(layout.characterOffset, layout.characterOffset + layout.characterCount);
    if (text.length === 0) {
      return;
    }

    const ts = this.createTextString(text, style, layout);

    if ("none" !== source.baselineShift) {
      const isSub = "subscript" === source.baselineShift;
      const offsetFactor = isSub ? style.subScriptOffsetFactor : style.superScriptOffsetFactor;
      const scale = isSub ? style.subScriptScale : style.superScriptScale;

      ts.origin.y += offsetFactor * ts.height;
      ts.height *= scale;
    }

    ts.transformInPlace(transform);

    this.setColor(style.color);
    this._processor.acceptTextString(ts);
  }

  private processFractionRun(source: FractionRun, layout: RunLayoutResult, style: TextStyleSettings, transform: Transform): void {
    if (source.numerator.length === 0 && source.denominator.length === 0) {
      return;
    }

    assert(undefined !== layout.numeratorRange && undefined !== layout.denominatorRange);

    // ###TODO native computes this and calls TextString.style.SetSize, unclear...below I just scale the height and width factors instead...
    const fontSize = new Vector2d(style.lineHeight * style.widthFactor, style.lineHeight);
    fontSize.scale(style.stackedFractionScale, fontSize);

    const numeratorOffset = new Point3d(layout.numeratorRange.low.x, layout.numeratorRange.low.y, 0);
    const denominatorOffset = new Point3d(layout.denominatorRange.low.x, layout.denominatorRange.low.y, 0);

    this.setColor(style.color);

    if (source.numerator.length > 0) {
      this._processor.acceptTextString(this.createFractionTextString(source.numerator, style, layout, numeratorOffset, transform));
    }

    const numeratorRange = Range2d.fromJSON(layout.numeratorRange);
    const denominatorRange = Range2d.fromJSON(layout.denominatorRange);
    
    let segment: LineSegment3d;
    if (style.stackedFractionType === "horizontal") {
      const fractionWidth = Math.max(numeratorRange.xLength(), denominatorRange.xLength());
      const y = 1.25 * denominatorRange.yLength();
      segment = LineSegment3d.createXYXY(0, y, fractionWidth, y);
    } else {
      const p0 = new Point3d(denominatorRange.low.x - fontSize.x / 2, denominatorRange.low.y + fontSize.y * (1 / 3), 0);
      const p1 = new Point3d(p0.x + fontSize.x, p0.y + fontSize.y * 1.5, 0);
      segment = LineSegment3d.createCapture(p0, p1);
    }

    segment.tryTransformInPlace(transform);
    this._processor.acceptFractionSeparator(segment);

    if (source.denominator.length > 0) {
      this._processor.acceptTextString(this.createFractionTextString(source.denominator, style, layout, denominatorOffset, transform));
    }
  }

  private createEffectiveRunStyle(run: Run) {
    // ###TODO the native implementation combines height, width, and spacing from TextBlock style with the properties from Run style.
    // Layout, OTOH, only uses the Run style.
    // One of them has to be wrong...
    let settings = this._settings.get(run.styleName);
    if (!settings) {
      this._settings.set(run.styleName, settings = this._processor.getSettings(run.styleName));
    }

    return run.createEffectiveSettings(settings);
  }
}
