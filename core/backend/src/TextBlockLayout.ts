/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ###TODO
 */

import { BaselineShift, FontId, FractionRun, LineLayoutResult, Paragraph, Run, RunLayoutResult, TextBlock, TextBlockComponent, TextBlockLayoutResult, TextRun, TextStyleSettings } from "@itwin/core-common";
import { LowAndHighXY, Range2d } from "@itwin/core-geometry";
import { IModelDb } from "./IModelDb";
import { assert } from "@itwin/core-bentley";

/** @internal */
export interface TextLayoutRanges {
  layout: Range2d;
  justification: Range2d;
}

/** @internal */
export type ComputeRangesForTextLayout = (args: {
  chars: string,
  bold: boolean,
  italic: boolean,
  baselineShift: BaselineShift,
  fontId: FontId,
}) => TextLayoutRanges;

/** @internal */
export type FindFontId = (name: string) => FontId;

/** @internal */
export type FindTextStyle = (name: string) => TextStyleSettings;

export interface LayoutTextBlockArgs {
  textBlock:TextBlock;
  iModel:IModelDb;
  /** @internal chiefly for tests */
  computeTextRange?: ComputeRangesForTextLayout;
  /** @internal chiefly for tests */
  findTextStyle?: FindTextStyle;
  /** @internal chiefly for tests */
  findFontId?: FindFontId;
}

export function layoutTextBlock(args: LayoutTextBlockArgs): TextBlockLayoutResult {
  const { computeTextRange, findTextStyle, findFontId } = args;
  if (!computeTextRange || !findTextStyle || !findFontId) {
    throw new Error("###TODO use default implementations");
  }

  const layout = new TextBlockLayout(args.textBlock, new LayoutContext(computeTextRange, findTextStyle, findFontId));
  return layout.toResult();
}

function scaleRange(range: Range2d, scale: number): void {
  range.low.scaleInPlace(scale);
  range.high.scaleInPlace(scale);
}

function rangeResult(range: Range2d): LowAndHighXY {
  return {
    low: { x: range.low.x, y: range.low.y },
    high: { x: range.high.x, y: range.high.y },
  }
}
class LayoutContext {
  private readonly _textStyles = new Map<string, TextStyleSettings>();
  private readonly _fontIds = new Map<string, FontId>();
  
  public constructor(private readonly _computeTextRange: ComputeRangesForTextLayout, private readonly _findTextStyle: FindTextStyle, private readonly _findFontId: FindFontId) { }

  public findFontId(name: string): FontId {
    let fontId = this._fontIds.get(name);
    if (undefined === fontId) {
      this._fontIds.set(name, fontId = this._findFontId(name));
    }

    return fontId;
  }

  public findTextStyle(name: string): TextStyleSettings {
    let style = this._textStyles.get(name);
    if (undefined === style) {
      this._textStyles.set(name, style = this._findTextStyle(name));
    }

    return style;
  }

  public createEffectiveStyle(component: TextBlockComponent): TextStyleSettings {
    const settings = this.findTextStyle(component.styleName);
    return component.createEffectiveSettings(settings);
  }

  public computeRangeForText(chars: string, style: TextStyleSettings, baselineShift: BaselineShift): TextLayoutRanges {
    if (chars.length === 0) {
      return {
        layout: new Range2d(0, 0, 0, style.lineHeight),
        justification: new Range2d(),
      };
    }

    const fontId = this.findFontId(style.fontName);
    const { layout, justification } = this._computeTextRange({
      chars,
      fontId,
      baselineShift,
      bold: style.isBold,
      italic: style.isItalic,
    });

    if ("none" !== baselineShift) {
      const isSub = "subscript" === baselineShift;
      const scale = isSub ? style.subScriptScale : style.superScriptScale;
      const offsetFactor = isSub ? style.subScriptOffsetFactor : style.superScriptOffsetFactor;
      const offset = { x: 0, y: style.lineHeight * offsetFactor };

      scaleRange(layout, scale);
      layout.cloneTranslated(offset, layout);

      scaleRange(justification, scale);
      justification.cloneTranslated(offset, justification);
    }

    return { layout, justification };
  }

  public computeRangeForTextRun(style: TextStyleSettings, run: TextRun, charOffset: number, numChars: number): TextLayoutRanges {
    return this.computeRangeForText(run.content.substring(charOffset, charOffset + numChars), style, run.baselineShift);
  }

  public computeRangeForFractionRun(style: TextStyleSettings, source: FractionRun): { layout: Range2d, numerator: Range2d, denominator: Range2d } {
    const numerator = this.computeRangeForText(source.numerator, style, "none").layout;
    scaleRange(numerator, style.stackedFractionScale);

    const denominator = this.computeRangeForText(source.denominator, style, "none").layout;
    scaleRange(denominator, style.stackedFractionScale);

    const numLen = numerator.xLength();
    const denomLen = denominator.xLength();
    switch (style.stackedFractionType) {
      case "horizontal": {
        if (numLen > denomLen) {
          denominator.cloneTranslated({ x: (numLen - denomLen) / 2, y: 0 }, denominator);
        } else {
          numerator.cloneTranslated({ x: (denomLen - numLen) / 2, y: 0 }, numerator);
        }

        break;
      }
      case "diagonal": {
        numerator.cloneTranslated({ x: 0, y: denomLen }, numerator);
        denominator.cloneTranslated({ x: numLen, y: 0 }, denominator);
        break;
      }
    }

    const layout = numerator.clone();
    layout.extendRange(denominator);
    return { layout, numerator, denominator };
  }
}

class RunLayout {
  public source: Run;
  public charOffset = 0;
  public numChars = 0;
  public range: Range2d;
  public justificationRange?: Range2d;
  public denominatorRange?: Range2d;
  public numeratorRange?: Range2d;
  public offsetFromLine = { x: 0, y: 0 };
  public style: TextStyleSettings;
  public fontId: FontId;

  public constructor(source: Run, context: LayoutContext) {
    this.source = source;
    this.style = context.createEffectiveStyle(source);
    this.fontId = context.findFontId(this.style.fontName);
    this.charOffset = 0;

    switch (source.type) {
      case "text": {
        this.numChars = source.content.length;
        const ranges = context.computeRangeForTextRun(this.style, source, this.charOffset, this.numChars);
        this.range = ranges.layout;
        this.justificationRange = ranges.justification;
        break;
      }
      case "fraction": {
        this.numChars = 1;
        const ranges = context.computeRangeForFractionRun(this.style, source);
        this.range = ranges.layout;
        this.numeratorRange = ranges.numerator;
        this.denominatorRange = ranges.denominator;
        break;
      }
      default: {
        // We do this so that blank lines space correctly without special casing later.
        this.range = new Range2d(0, 0, 0, this.style.lineHeight);
        break;
      }
    }
  }

  public toResult(paragraph: Paragraph): RunLayoutResult {
    const result: RunLayoutResult = {
      sourceRunIndex: paragraph.runs.indexOf(this.source),
      fontId: this.fontId,
      characterOffset: this.charOffset,
      characterCount: this.numChars,
      range: rangeResult(this.range),
      offsetFromLine: this.offsetFromLine,
    };

    if (this.justificationRange) {
      result.justificationRange = rangeResult(this.justificationRange);
    }

    if (this.numeratorRange) {
      result.numeratorRange = rangeResult(this.numeratorRange);
    }

    if (this.denominatorRange) {
      result.denominatorRange = rangeResult(this.denominatorRange);
    }

    return result;
  }
}

class LineLayout {
  public source: Paragraph;
  public range = new Range2d(0, 0, 0, 0);
  public justificationRange = new Range2d(0, 0, 0, 0);
  public offsetFromDocument = { x: 0, y: 0 };
  public runs: RunLayout[] = [];

  public constructor(source: Paragraph) {
    this.source = source;
  }

  public get isEmpty() { return this.runs.length === 0; }
  public get back(): RunLayout {
    assert(!this.isEmpty);
    return this.runs[this.runs.length - 1];
  }

  /** Invoked after runs have been populated, just before this line is added to a TextBlockLayout. */
  public computeRanges(): void {
    assert(this.range.low.isAlmostZero && this.range.high.isAlmostZero, "LineLayout.computeRanges should only be called once");

    for (const run of this.runs) {
      const runOffset = { x: this.range.high.x, y: 0 };
      run.offsetFromLine = runOffset;

      const runLayoutRange = run.range.cloneTranslated(runOffset);
      this.range.extendRange(runLayoutRange);

      if ("linebreak" !== run.source.type) {
        const runJustificationRange = run.justificationRange?.cloneTranslated(runOffset);
        this.justificationRange.extendRange(runJustificationRange ?? runLayoutRange);
      }
    }
  }

  public toResult(textBlock: TextBlock): LineLayoutResult {
    return {
      sourceParagraphIndex: textBlock.paragraphs.indexOf(this.source),
      runs: this.runs.map((x) => x.toResult(this.source)),
      range: rangeResult(this.range),
      justificationRange: rangeResult(this.justificationRange),
      offsetFromDocument: this.offsetFromDocument,
    };
  }
}

class TextBlockLayout {
  public source: TextBlock;
  public context: LayoutContext;
  public range = new Range2d();
  public lines: LineLayout[] = [];

  public constructor(source: TextBlock, context: LayoutContext) {
    this.source = source;
    this.context = context;

    this.populateLines();
    this.justifyLines();
  }

  public toResult(): TextBlockLayoutResult {
    return {
      lines: this.lines.map((x) => x.toResult(this.source)),
      range: rangeResult(this.range),
    };
  }

  private get back(): LineLayout {
    assert(this.lines.length > 0);
    return this.lines[this.lines.length - 1];
  }

  private populateLines(): void {
    const doc = this.source;
    if (doc.paragraphs.length === 0) {
      return;
    }

    const isWrapped = doc.width > 0;

    let line = new LineLayout(doc.paragraphs[0]);
    for (let i = 0; i < doc.paragraphs.length; i++) {
      const paragraph = doc.paragraphs[i];
      if (i > 0) {
        line = this.flushLine(line, paragraph);
      }

      for (const run of paragraph.runs) {
        const layoutRun = new RunLayout(run, this.context);

        // Line break? It always "fits" and causes us to flush the line.
        if ("linebreak" === run.type) {
          line.runs.push(layoutRun);
          line = this.flushLine(line);
          continue;
        }

        const effectiveRunWidth = isWrapped ? layoutRun.range.xLength() : 0;
        const effectiveRemainingWidth = isWrapped ? doc.width - line.range.xLength() : Number.MAX_VALUE;

        // Do we fit (no wrapping or narrow enough)? Append and go around to the next run.
        if (effectiveRunWidth < effectiveRemainingWidth) {
          line.runs.push(layoutRun);
          continue;
        }

        // Can't fit, but can't wrap? Force on the line if it's the first thing; otherwise flush and add to the next line.
        if ("text" !== run.type) { // only TextRun can wrap.
          if (line.runs.length === 0) {
            line.runs.push(layoutRun);
            line = this.flushLine(line);
          } else {
            line = this.flushLine(line);
            line.runs.push(layoutRun);
          }

          continue;
        }

        // Otherwise, keep splitting the run into lines until the whole thing is appended.
        line.runs.push(layoutRun); // ###TODO Word-wrapping
      }
    }

    if (line.runs.length > 0) {
      this.flushLine(line);
    }
  }

  private justifyLines(): void {
    if (this.lines.length <= 1 || "left" === this.source.justification) {
      return;
    }

    let docWidth = this.source.width;
    if (docWidth <= 0) {
      for (const line of this.lines) {
        const lineWidth = line.justificationRange.xLength();
        docWidth = Math.max(docWidth, lineWidth);
      }
    }

    let minOffset = Number.MAX_VALUE;
    for (const line of this.lines) {
      const lineWidth = line.justificationRange.xLength();

      let offset = docWidth - lineWidth;
      if ("center" === this.source.justification) {
        offset = offset / 2;
      }

      line.offsetFromDocument.x += offset;
      minOffset = Math.min(offset, minOffset);
    }

    this.range.low.x += minOffset;
    this.range.high.x += minOffset;
  }

  private flushLine(line: LineLayout, nextParagraph?: Paragraph): LineLayout {
    nextParagraph = nextParagraph ?? line.source;
    
    // We want to guarantee that each layout line has at least one run.
    if (line.runs.length === 0) {
      // If we're empty, there should always be a preceding run, and it should be a line break.
      if (this.lines.length === 0 || this.back.runs.length === 0) {
        return new LineLayout(nextParagraph);
      }

      const prevRun = this.back.back.source;
      assert(prevRun.type === "linebreak");
      if (prevRun.type !== "linebreak") {
        return new LineLayout(nextParagraph);
      }

      line.runs.push(new RunLayout(prevRun.clone(), this.context));
    }

    // Line origin is its baseline.
    const lineOffset = { x: 0, y: -line.range.yLength };

    // Place it below any existing lines
    if (this.lines.length > 0) {
      lineOffset.y += this.back.offsetFromDocument.y;
      const style = this.context.createEffectiveStyle(this.source);
      lineOffset.y -= style.lineSpacingFactor * style.lineHeight;
    }

    line.offsetFromDocument = lineOffset;

    // Update document range from computed line range and position
    this.range.extendRange(line.range.cloneTranslated(lineOffset));

    line.computeRanges();
    this.lines.push(line);
    return new LineLayout(nextParagraph);
  }
}
