/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { BaselineShift, FontId, FontType, FractionRun, LineLayoutResult, Paragraph, Run, RunLayoutResult, TabRun, TextBlock, TextBlockLayoutResult, TextBlockMargins, TextRun, TextStyleSettings, TextStyleSettingsProps } from "@itwin/core-common";
import { Geometry, Range2d } from "@itwin/core-geometry";
import { IModelDb } from "../IModelDb";
import { assert, NonFunctionPropertiesOf } from "@itwin/core-bentley";
import * as LineBreaker from "linebreak";


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

/** A function that looks up the font Id corresponding to a [FontFamilyDescriptor]($common).
 * If no type is provided, the function can return a font of any type matching `name` (there may be more than one, of different types).
 * @internal
 */
export type FindFontId = (name: string, type?: FontType) => FontId;

/** @internal */
export type FindTextStyle = (name: string) => TextStyleSettings;

/**
 * Arguments supplied to [[computeLayoutTextBlockResult]].
 * @beta
 */
export interface LayoutTextBlockArgs {
  /** The text block whose extents are to be computed. */
  textBlock: TextBlock;
  /** The iModel from which to obtain fonts and [TextStyle]($common)s when laying out glyphs. */
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
 * @see [[computeLayoutTextBlockResult]]
 * @beta
 */
export function layoutTextBlock(args: LayoutTextBlockArgs): TextBlockLayout {
  const findFontId = args.findFontId ?? ((name, type) => args.iModel.fonts.findId({ name, type }) ?? 0);
  const computeTextRange = args.computeTextRange ?? ((x) => args.iModel.computeRangesForText(x));

  // ###TODO finding text styles in workspaces.
  const findTextStyle = args.findTextStyle ?? (() => TextStyleSettings.fromJSON());

  return new TextBlockLayout(args.textBlock, new LayoutContext(args.textBlock, computeTextRange, findTextStyle, findFontId));
}

/**
 * Gets the result of laying out the the contents of a TextBlock into a series of lines containing runs.
 * The visual layout accounts for the [TextStyle]($common)s, fonts, and [TextBlock.width]($common). It applies word-wrapping if needed.
 * The layout returned matches the visual layout of the geometry produced by [[appendTextAnnotationGeometry]].
 * @beta
 */
export function computeLayoutTextBlockResult(args: LayoutTextBlockArgs): TextBlockLayoutResult {
  const layout = layoutTextBlock(args);
  return layout.toResult();
}

/**
 * Arguments supplied to [[computeGraphemeOffsets]].
 * @beta
 */
export interface ComputeGraphemeOffsetsArgs extends LayoutTextBlockArgs {
  /** The index of the [Paragraph]($common) in the text block that contains the run layout result text. */
  paragraphIndex: number;
  /** The run layout result for which grapheme ranges will be computed. */
  runLayoutResult: RunLayoutResult;
  /** An array of starting character indexes for each grapheme. Each entry represents the index of the first character in a grapheme. */
  graphemeCharIndexes: number[];
};

/**
 * Computes the range from the start of a [RunLayoutResult]($common) to the trailing edge of each grapheme.
 * It is the responsibility of the caller to determine the number and character indexes of the graphemes.
 * @returns If the [RunLayoutResult]($common)'s source is a [TextRun]($common), it returns an array containing the range of each grapheme.
 * Otherwise, it returns and empty array.
 * @beta
 */
export function computeGraphemeOffsets(args: ComputeGraphemeOffsetsArgs): Range2d[] {
  const { textBlock, paragraphIndex, runLayoutResult, graphemeCharIndexes, iModel } = args;
  const findFontId = args.findFontId ?? ((name, type) => iModel.fonts.findId({ name, type }) ?? 0);
  const computeTextRange = args.computeTextRange ?? ((x) => iModel.computeRangesForText(x));
  const findTextStyle = args.findTextStyle ?? (() => TextStyleSettings.fromJSON());
  const source = textBlock.paragraphs[paragraphIndex].runs[runLayoutResult.sourceRunIndex];

  if (source.type !== "text" || runLayoutResult.characterCount === 0) {
    return [];
  }

  const style = TextStyleSettings.fromJSON(runLayoutResult.textStyle);

  const layoutContext = new LayoutContext(textBlock, computeTextRange, findTextStyle, findFontId);
  const graphemeRanges: Range2d[] = [];

  graphemeCharIndexes.forEach((_, index) => {
    const nextGraphemeCharIndex = graphemeCharIndexes[index + 1] ?? runLayoutResult.characterCount;
    graphemeRanges.push(layoutContext.computeRangeForTextRun(style, source, runLayoutResult.characterOffset, nextGraphemeCharIndex).layout);
  });
  return graphemeRanges;
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

        numerator.cloneTranslated({ x: 0, y: 1.5 * denominator.yLength() }, numerator);
        break;
      }
      case "diagonal": {
        numerator.cloneTranslated({ x: 0, y: denominator.yLength() }, numerator);
        denominator.cloneTranslated({ x: numLen, y: 0 }, denominator);
        break;
      }
    }

    const layout = numerator.clone();
    layout.extendRange(denominator);
    return { layout, numerator, denominator };
  }

  public computeRangeForTabRun(style: TextStyleSettings, source: TabRun, length: number): Range2d {
    const interval = source.styleOverrides.tabInterval ?? style.tabInterval;
    const tabEndX = interval - length % interval;

    const range = new Range2d(0, 0, 0, style.lineHeight);
    range.extendXY(tabEndX, range.low.y);

    return range;
  }
}

interface Segment {
  segment: string;
  index: number;
}

function split(source: string): Segment[] {
  if (source.length === 0) {
    return [];
  }

  let index = 0;
  const segments: Segment[] = [];
  const breaker = new LineBreaker(source);
  for (let brk = breaker.nextBreak(); brk; brk = breaker.nextBreak()) {
    segments.push({
      segment: source.slice(index, brk.position),
      index,
    });

    index = brk.position;
  }

  return segments;
}

function applyTabShift(run: RunLayout, parent: LineLayout, context: LayoutContext): void {
  if (run.source.type === "tab") {
    run.range.setFrom(context.computeRangeForTabRun(run.style, run.source, parent.lengthFromLastTab));
  }
}

/**
 * Represents the layout of a single run (text, fraction, or line break) within a line of text.
 * Stores information about the run's position, style, and font within the line.
 * Provides utilities for splitting text runs for word wrapping and converting to result objects.
 * @beta
 */
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
      default: { // "linebreak" or "tab"
      // "tab": Tabs rely on the context they are in, so we compute its range later.
      // lineBreak: We do this so that blank lines space correctly without special casing later.
        range = new Range2d(0, 0, 0, style.lineHeight);
        break;
      }
    }

    return new RunLayout({ source, charOffset, numChars, range, justificationRange, denominatorRange, numeratorRange, offsetFromLine, style, fontId });
  }

  /** Compute a string representation, primarily for debugging purposes. */
  public stringify(): string {
    return this.source.type === "text" ? this.source.content.substring(this.charOffset, this.charOffset + this.numChars) : this.source.stringify();
  }

  public canWrap(): this is { source: TextRun } {
    return this.source.type === "text";
  }

  private cloneForWrap(args: { ranges: TextLayoutRanges, charOffset: number, numChars: number }): RunLayout {
    assert(this.canWrap());

    return new RunLayout({
      ...this,
      charOffset: args.charOffset,
      numChars: args.numChars,
      range: args.ranges.layout,
      justificationRange: args.ranges.justification,
      offsetFromLine: { ...this.offsetFromLine },
    });
  }

  public split(context: LayoutContext): RunLayout[] {
    assert(this.charOffset === 0, "cannot re-split a run");
    if (!this.canWrap() || this.charOffset > 0) {
      return [this];
    }

    const myText = this.source.content.substring(this.charOffset, this.charOffset + this.numChars);
    const segments = split(myText);

    if (segments.length <= 1) {
      return [this];
    }

    return segments.map((segment: any) => {
      return this.cloneForWrap({
        ranges: context.computeRangeForText(segment.segment, this.style, this.source.baselineShift),
        charOffset: segment.index,
        numChars: segment.segment.length,
      });
    });
  }

  public toResult(paragraph: Paragraph): RunLayoutResult {
    const result: RunLayoutResult = {
      sourceRunIndex: paragraph.runs.indexOf(this.source),
      fontId: this.fontId,
      characterOffset: this.charOffset,
      characterCount: this.numChars,
      range: this.range.toJSON(),
      offsetFromLine: this.offsetFromLine,
      textStyle: this.style.toJSON(),
    };

    if (this.justificationRange) {
      result.justificationRange = this.justificationRange.toJSON();
    }

    if (this.numeratorRange) {
      result.numeratorRange = this.numeratorRange.toJSON();
    }

    if (this.denominatorRange) {
      result.denominatorRange = this.denominatorRange.toJSON();
    }

    return result;
  }
}

/**
 * Represents the layout of a single line within a paragraph of a text block.
 * Contains a sequence of RunLayout objects, the computed range of the line, and its offset from the document origin.
 * Provides utilities for appending runs, computing ranges, and converting to result objects.
 * @beta
 */
export class LineLayout {
  public source: Paragraph;
  public range = new Range2d(0, 0, 0, 0);
  public justificationRange = new Range2d(0, 0, 0, 0);
  public offsetFromDocument = { x: 0, y: 0 };
  public lengthFromLastTab = 0; // Used to track the length from the last tab for tab runs.
  private _runs: RunLayout[] = [];

  public constructor(source: Paragraph) {
    this.source = source;
  }

  /** Compute a string representation, primarily for debugging purposes. */
  public stringify(): string {
    const runs = this._runs.map((run) => run.stringify());
    return `${runs.join("")}`;
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

    // Some runs (fractions) are taller than others.
    // We want to center each run vertically inside the line.
    let lineHeight = 0;
    for (const run of this._runs) {
      lineHeight = Math.max(lineHeight, run.range.yLength());
    }

    for (const run of this._runs) {
      const runHeight = run.range.yLength();
      const runOffset = { x: this.range.high.x, y: (lineHeight - runHeight) / 2 };
      run.offsetFromLine = runOffset;

      const runLayoutRange = run.range.cloneTranslated(runOffset);
      this.range.extendRange(runLayoutRange);

      if ("linebreak" !== run.source.type) {
        const runJustificationRange = run.justificationRange?.cloneTranslated(runOffset);
        this.justificationRange.extendRange(runJustificationRange ?? runLayoutRange);
      }

      if (run.source.type === "tab") {
        this.lengthFromLastTab = 0;
      } else {
        this.lengthFromLastTab += run.range.xLength();
      }
    }
  }

  public toResult(textBlock: TextBlock): LineLayoutResult {
    return {
      sourceParagraphIndex: textBlock.paragraphs.indexOf(this.source),
      runs: this.runs.map((x) => x.toResult(this.source)),
      range: this.range.toJSON(),
      justificationRange: this.justificationRange.toJSON(),
      offsetFromDocument: this.offsetFromDocument,
    };
  }
}

/**
 * Describes the layout of a text block as a collection of lines containing runs.
 * Computes the visual layout of the text block, including word wrapping, justification, and margins.
 * Provides access to the computed lines, ranges, and utilities for converting to result objects.
 * @beta
 */
export class TextBlockLayout {
  public source: TextBlock;

  /** @internal: This is primarily for debugging purposes. This is the range of text geometry */
  public textRange = new Range2d();

  /** The range including margins of the [[TextBlock]]. */
  public range = new Range2d();
  public lines: LineLayout[] = [];
  private _context: LayoutContext;

  public constructor(source: TextBlock, context: LayoutContext) {
    this._context = context;
    this.source = source;

    if (source.width > 0) {
      this.textRange.low.x = 0;
      this.textRange.high.x = source.width;
    }

    this.populateLines(context);
    this.justifyLines();
    this.applyMargins(source.margins);
  }

  public toResult(): TextBlockLayoutResult {
    return {
      lines: this.lines.map((x) => x.toResult(this.source)),
      range: this.range.toJSON(),
    };
  }

  /** Compute a string representation, primarily for debugging purposes. */
  public stringify(): string {
    return this.lines.map((line) => line.stringify()).join("\n");
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

    const doWrap = doc.width > 0;
    let curLine = new LineLayout(doc.paragraphs[0]);
    for (let i = 0; i < doc.paragraphs.length; i++) {
      const paragraph = doc.paragraphs[i];
      if (i > 0) {
        curLine = this.flushLine(context, curLine, paragraph);
      }

      let runs = paragraph.runs.map((run) => RunLayout.create(run, context));
      if (doWrap) {
        runs = runs.map((run) => run.split(context)).flat();
      }

      for (const run of runs) {
        if ("linebreak" === run.source.type) {
          curLine.append(run);
          curLine = this.flushLine(context, curLine);
          continue;
        }

        // If this is a tab, we need to apply the tab shift first, and then we can treat it like a text run.
        applyTabShift(run, curLine, context);

        // If our width is not set (doWrap is false), then we don't have to compute word wrapping, so just append the run, and continue.
        if (!doWrap) {
          curLine.append(run);
          continue;
        }

        // Next, determine if we can append this run to the current line without exceeding the document width
        const runWidth = run.range.xLength();
        const lineWidth = curLine.range.xLength();

        // If true, then no word wrapping is required, so we can append to the current line.
        if (runWidth + lineWidth < doc.width || Geometry.isAlmostEqualNumber(runWidth + lineWidth, doc.width, Geometry.smallMetricDistance)) {
          curLine.append(run);
          continue;
        }

        // Do word wrapping
        if (curLine.runs.length === 0) {
          curLine.append(run);

          // Lastly, flush line
          curLine = this.flushLine(context, curLine);
        } else {
          // First, flush line
          curLine = this.flushLine(context, curLine);

          // Recompute tab shift if applicable
          applyTabShift(run, curLine, context);

          curLine.append(run);
        }
      }
    }

    if (curLine.runs.length > 0) {
      this.flushLine(context, curLine);
    }
  }

  private justifyLines(): void {
    // We don't want to justify empty text, or a single line of text whose width is 0. By default text is already left justified.
    if (this.lines.length < 1 || (this.lines.length === 1 && this.source.width === 0) || "left" === this.source.justification) {
      return;
    }

    // This is the minimum width of the document's bounding box.
    const docWidth = this.source.width;

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

    if (minOffset < 0) {
      // Shift left to accommodate lines that exceeded the document's minimum width.
      this.textRange.low.x += minOffset;
      this.textRange.high.x += minOffset;
    }
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
    this.textRange.extendRange(line.range.cloneTranslated(lineOffset));

    this.lines.push(line);
    return new LineLayout(nextParagraph);
  }

  private applyMargins(margins: TextBlockMargins) {
    this.range = this.textRange.clone();

    if (this.range.isNull)
      return;

    // Disregard negative margins.
    const right = margins.right >= 0 ? margins.right : 0;
    const left = margins.left >= 0 ? margins.left : 0;
    const top = margins.top >= 0 ? margins.top : 0;
    const bottom = margins.bottom >= 0 ? margins.bottom : 0;

    const xHigh = this.textRange.high.x + right;
    const yHigh = this.textRange.high.y + top;
    const xLow = this.textRange.low.x - left;
    const yLow = this.textRange.low.y - bottom;

    this.range.extendXY(xHigh, yHigh);
    this.range.extendXY(xLow, yLow);
  }
}
