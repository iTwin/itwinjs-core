/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BaselineShift, FontId, FractionRun, Paragraph, Run, TextBlock, TextRun, TextStyle, TextStyleSettings, TextStyleSettingsProps } from "@itwin/core-common";
import { Range2d } from "@itwin/core-geometry";
import { IModelDb } from "./IModelDb";
import { NonFunctionPropertiesOf, assert } from "@itwin/core-bentley";

/** @internal */
export interface TextLayoutRanges {
  layout: Range2d;
  justification: Range2d;
}

/** Arguments to [[ComputeRangesForTextLayout]].
 * @internal
 */
export interface ComputeRangesForTextLayoutArgs {
  chars: string;
  bold: boolean;
  italic: boolean;
  baselineShift: BaselineShift;
  fontId: FontId;
  widthFactor: number;
  lineHeight: number;
}

/** A function that uses a font to compute the layout and justification ranges of a string of text.
 * @internal
 */
export type ComputeRangesForTextLayout = (args: ComputeRangesForTextLayoutArgs) => TextLayoutRanges;

/** @internal */
export type FindFontId = (name: string) => FontId;

/** @internal */
export type FindTextStyle = (name: string) => TextStyleSettings;

/** @internal */
export interface LayoutTextBlockArgs {
  textBlock: TextBlock;
  iModel: IModelDb;
  /** @internal chiefly for tests, by default uses IModelJsNative.DgnDb.computeRangesForText. */
  computeTextRange?: ComputeRangesForTextLayout;
  /** @internal chiefly for tests, by default looks up styles from a workspace. */
  findTextStyle?: FindTextStyle;
  /** @internal chiefly for tests, by default uses IModelDb.fontMap. */
  findFontId?: FindFontId;
}

/**
 * Lays out the contents of a TextBlock into a series of lines containing runs.
 * Each paragraph is decomposed into a series of lines.
 * Each series of consecutive non-linebreak runs within a paragraph is concatenated into one line.
 * If the document specifies a width > 0, individual lines are split to try to avoid exceeding that width.
 * Individual TextRuns can be split onto multiple lines at word boundaries if necessary. Individual FractionRuns are never split.
 * @internal
 */
export function layoutTextBlock(args: LayoutTextBlockArgs): TextBlockLayout {
  const findFontId = args.findFontId ?? ((name) => args.iModel.fontMap.getFont(name)?.id ?? 0);
  const computeTextRange = args.computeTextRange ?? ((x) => args.iModel.computeRangesForText(x));

  // ###TODO finding text styles in workspaces.
  const findTextStyle = args.findTextStyle ?? (() => TextStyleSettings.fromJSON());

  return new TextBlockLayout(args.textBlock, new LayoutContext(args.textBlock, computeTextRange, findTextStyle, findFontId));
}

function scaleRange(range: Range2d, scale: number): void {
  range.low.scaleInPlace(scale);
  range.high.scaleInPlace(scale);
}

function applyBlockSettings(target: TextStyleSettings, source: TextStyleSettings | TextStyleSettingsProps): TextStyleSettings {
  if (source === target) {
    return target;
  }

  const lineSpacingFactor = source.lineSpacingFactor ?? target.lineSpacingFactor;
  const lineHeight = source.lineHeight ?? target.lineHeight;
  const widthFactor = source.widthFactor ?? target.widthFactor;

  if (lineSpacingFactor !== target.lineSpacingFactor || lineHeight !== target.lineHeight || widthFactor !== target.widthFactor) {
    target = target.clone({ lineSpacingFactor, lineHeight, widthFactor });
  }

  return target;
}

class LayoutContext {
  private readonly _textStyles = new Map<string, TextStyleSettings>();
  private readonly _fontIds = new Map<string, FontId>();
  public readonly blockSettings: TextStyleSettings;

  public constructor(block: TextBlock, private readonly _computeTextRange: ComputeRangesForTextLayout, private readonly _findTextStyle: FindTextStyle, private readonly _findFontId: FindFontId) {
    const settings = this.findTextStyle(block.styleName);
    this.blockSettings = applyBlockSettings(settings, block.styleOverrides);
  }

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

  public createRunSettings(run: Run): TextStyleSettings {
    let settings = this.findTextStyle(run.styleName);
    if (run.overridesStyle) {
      settings = settings.clone(run.styleOverrides);
    }

    return applyBlockSettings(settings, this.blockSettings);
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
      lineHeight: this.blockSettings.lineHeight,
      widthFactor: this.blockSettings.widthFactor,
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

/** @internal */
export class RunLayout {
  public source: Run;
  public charOffset: number;
  public numChars: number;
  public range: Range2d;
  public justificationRange?: Range2d;
  public denominatorRange?: Range2d;
  public numeratorRange?: Range2d;
  public offsetFromLine: { x: number, y: number };
  public style: TextStyleSettings;
  public fontId: FontId;

  private constructor(props: NonFunctionPropertiesOf<RunLayout>) {
    this.source = props.source;
    this.charOffset = props.charOffset;
    this.numChars = props.numChars;
    this.range = props.range;
    this.justificationRange = props.justificationRange;
    this.denominatorRange = props.denominatorRange;
    this.numeratorRange = props.numeratorRange;
    this.offsetFromLine = props.offsetFromLine;
    this.style = props.style;
    this.fontId = props.fontId;
  }

  public static create(source: Run, context: LayoutContext): RunLayout {
    const style = context.createRunSettings(source);
    const fontId = context.findFontId(style.fontName);
    const charOffset = 0;
    const offsetFromLine = { x: 0, y: 0 };
    let numChars = 0;

    let range, justificationRange, numeratorRange, denominatorRange;
    
    switch (source.type) {
      case "text": {
        numChars = source.content.length;
        const ranges = context.computeRangeForTextRun(style, source, charOffset, numChars);
        range = ranges.layout;
        justificationRange = ranges.justification;
        break;
      }
      case "fraction": {
        numChars = 1;
        const ranges = context.computeRangeForFractionRun(style, source);
        range = ranges.layout;
        numeratorRange = ranges.numerator;
        denominatorRange = ranges.denominator;
        break;
      }
      default: {
        // We do this so that blank lines space correctly without special casing later.
        range = new Range2d(0, 0, 0, style.lineHeight);
        break;
      }
    }

    return new RunLayout({ source, charOffset, numChars, range, justificationRange, denominatorRange, numeratorRange, offsetFromLine, style, fontId });
  }

  canWrap(): this is { source: TextRun } {
    return this.source.type === "text";
  }

  private cloneForWrap(args: { ranges: TextLayoutRanges, charOffset: number, numChars: number}): RunLayout {
    assert(this.canWrap());
    
    return new RunLayout({
      ...this,
      charOffset: args.charOffset,
      numChars: args.numChars,
      range: args.ranges.layout,
      justificationRange: args.ranges.justification,
      offsetFromLine: { ...this.offsetFromLine },
    })
  }

  public wrap(availableWidth: number, shouldForceLeadingUnit: boolean, context: LayoutContext): RunLayout | undefined {
    if (!this.canWrap()) {
      return undefined;
    }

    // An optimization that tracks the computed width so far so we don't have to repeatedly recompute preceding character ranges.
    // Assumes (to the best of Jeff's knowledge) that characters before a break point can't affect the shaping of subsequent characters.
    let runningWidth = 0;
    let breakPos = 0;
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    for (const segment of segmenter.segment(this.source.content)) {
      const testContent = segment.segment;
      const forceCurrentUnit = shouldForceLeadingUnit && (0 === breakPos);

      // If we don't fit, the previous break position is the split point.
      const ranges = context.computeRangeForText(testContent, this.style, this.source.baselineShift);
      if (!forceCurrentUnit && (runningWidth + ranges.justification.xLength()) > availableWidth) {
        break;
      }

      // Otherwise, we fit; keep trying.
      runningWidth += ranges.layout.xLength();
      breakPos = segment.index + testContent.length;
    }

    // If the whole thing fits, we don't have to wrap (i.e., we just wasted a bunch of time).
    if (breakPos >= this.source.content.length) {
      return undefined;
    }

    // Trim this run and return the remainder.
    const charOffset = this.charOffset + breakPos;
    const numChars = this.numChars - breakPos;
    this.numChars = breakPos;
    
    const leftover = this.source.content.substring(charOffset, charOffset + numChars);
    return this.cloneForWrap({
      ranges: context.computeRangeForText(leftover, this.style, this.source.baselineShift),
      charOffset,
      numChars,
    });
  }
}

/** @internal */
export class LineLayout {
  public source: Paragraph;
  public range = new Range2d(0, 0, 0, 0);
  public justificationRange = new Range2d(0, 0, 0, 0);
  public offsetFromDocument = { x: 0, y: 0 };
  private _runs: RunLayout[] = [];

  public constructor(source: Paragraph) {
    this.source = source;
  }

  public get runs(): ReadonlyArray<RunLayout> { return this._runs; }
  public get isEmpty() { return this._runs.length === 0; }
  public get back(): RunLayout {
    assert(!this.isEmpty);
    return this._runs[this._runs.length - 1];
  }

  public append(run: RunLayout): void {
    this._runs.push(run);
    this.computeRanges();
  }

  /** Invoked every time a run is appended,. */
  private computeRanges(): void {
    this.range.low.setZero();
    this.range.high.setZero();

    for (const run of this._runs) {
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
}

/**
 * Describes the layout of a text block as a collection of lines containing runs.
 * @internal
 */
export class TextBlockLayout {
  public source: TextBlock;
  public range = new Range2d();
  public lines: LineLayout[] = [];

  public constructor(source: TextBlock, context: LayoutContext) {
    this.source = source;

    this.populateLines(context);
    this.justifyLines();
  }

  private get _back(): LineLayout {
    assert(this.lines.length > 0);
    return this.lines[this.lines.length - 1];
  }

  private populateLines(context: LayoutContext): void {
    const doc = this.source;
    if (doc.paragraphs.length === 0) {
      return;
    }

    const isWrapped = doc.width > 0;

    let line = new LineLayout(doc.paragraphs[0]);
    for (let i = 0; i < doc.paragraphs.length; i++) {
      const paragraph = doc.paragraphs[i];
      if (i > 0) {
        line = this.flushLine(context, line, paragraph);
      }

      for (const run of paragraph.runs) {
        const layoutRun = RunLayout.create(run, context);

        // Line break? It always "fits" and causes us to flush the line.
        if ("linebreak" === run.type) {
          line.append(layoutRun);
          line = this.flushLine(context, line);
          continue;
        }

        const effectiveRunWidth = isWrapped ? layoutRun.range.xLength() : 0;
        const effectiveRemainingWidth = isWrapped ? doc.width - line.range.xLength() : Number.MAX_VALUE;

        // Do we fit (no wrapping or narrow enough)? Append and go around to the next run.
        if (effectiveRunWidth < effectiveRemainingWidth) {
          line.append(layoutRun);
          continue;
        }

        // Can't fit, but can't wrap? Force on the line if it's the first thing; otherwise flush and add to the next line.
        if (!layoutRun.canWrap()) {
          if (line.runs.length === 0) {
            line.append(layoutRun);
            line = this.flushLine(context, line);
          } else {
            line = this.flushLine(context, line);
            line.append(layoutRun);
          }

          continue;
        }

        // Otherwise, keep splitting the run into lines until the whole thing is appended.
        line.append(layoutRun); // ###TODO Word-wrapping
      }
    }

    if (line.runs.length > 0) {
      this.flushLine(context, line);
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

  private flushLine(context: LayoutContext, line: LineLayout, nextParagraph?: Paragraph): LineLayout {
    nextParagraph = nextParagraph ?? line.source;

    // We want to guarantee that each layout line has at least one run.
    if (line.runs.length === 0) {
      // If we're empty, there should always be a preceding run, and it should be a line break.
      if (this.lines.length === 0 || this._back.runs.length === 0) {
        return new LineLayout(nextParagraph);
      }

      const prevRun = this._back.back.source;
      assert(prevRun.type === "linebreak");
      if (prevRun.type !== "linebreak") {
        return new LineLayout(nextParagraph);
      }

      line.append(RunLayout.create(prevRun.clone(), context));
    }

    // Line origin is its baseline.
    const lineOffset = { x: 0, y: -line.range.yLength() };

    // Place it below any existing lines
    if (this.lines.length > 0) {
      lineOffset.y += this._back.offsetFromDocument.y;
      lineOffset.y -= context.blockSettings.lineSpacingFactor * context.blockSettings.lineHeight;
    }

    line.offsetFromDocument = lineOffset;

    // Update document range from computed line range and position
    this.range.extendRange(line.range.cloneTranslated(lineOffset));

    this.lines.push(line);
    return new LineLayout(nextParagraph);
  }
}
