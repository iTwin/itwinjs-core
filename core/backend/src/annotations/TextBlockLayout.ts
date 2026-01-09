/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { BaselineShift, FieldRun, FontId, FontType, FractionRun, getMarkerText, LineLayoutResult, List, Paragraph, Run, RunLayoutResult, StructuralTextBlockComponent, TabRun, TextBlock, TextBlockComponent, TextBlockLayoutResult, TextBlockMargins, TextRun, TextStyleSettings, TextStyleSettingsProps } from "@itwin/core-common";
import { Geometry, Range2d, WritableXAndY } from "@itwin/core-geometry";
import { IModelDb } from "../IModelDb";
import { assert, Id64String, NonFunctionPropertiesOf } from "@itwin/core-bentley";
import * as LineBreaker from "linebreak";
import { AnnotationTextStyle } from "./TextAnnotationElement";


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
  textHeight: number;
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

/** @internal chiefly for tests. */
export type FindTextStyle = (id: Id64String) => TextStyleSettings;

/** @internal */
function createFindTextStyleImpl(iModel: IModelDb): FindTextStyle {
  return function findTextStyleImpl(id: Id64String): TextStyleSettings {
    const annotationTextStyle = iModel.elements.tryGetElement<AnnotationTextStyle>(id);
    if (annotationTextStyle && annotationTextStyle instanceof AnnotationTextStyle) {
      return annotationTextStyle.settings;
    }

    return TextStyleSettings.fromJSON();
  };
}

/**
 * Base interface for arguments supplied to [[computeLayoutTextBlockResult]] and [[computeGraphemeOffsets]].
 * @beta
 */
export interface LayoutTextArgs {
  /** The iModel from which to obtain fonts and [[AnnotationTextStyle]]s when laying out glyphs. */
  iModel: IModelDb;
  /** The text style resolver used to resolve effective text styles during layout. */
  textStyleResolver: TextStyleResolver;
  /** @internal chiefly for tests, by default uses IModelJsNative.DgnDb.computeRangesForText. */
  computeTextRange?: ComputeRangesForTextLayout;
  /** @internal chiefly for tests, by default uses IModelDb.fontMap. */
  findFontId?: FindFontId;
}

/**
 * Arguments supplied to [[computeLayoutTextBlockResult]].
 * @beta
 */
export interface LayoutTextBlockArgs extends LayoutTextArgs {
  /** The text block whose extents are to be computed. */
  textBlock: TextBlock;
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

  return new TextBlockLayout(args.textBlock, new LayoutContext(args.textStyleResolver, computeTextRange, findFontId));
}

/**
 * Gets the result of laying out the the contents of a TextBlock into a series of lines containing runs.
 * The visual layout accounts for the [[AnnotationTextStyle]]s, fonts, and [TextBlock.width]($common). It applies word-wrapping if needed.
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
export interface ComputeGraphemeOffsetsArgs extends LayoutTextArgs {
  /** The TextBlockComponent for which to compute grapheme offsets. */
  source: TextBlockComponent;
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
  const { source, runLayoutResult, graphemeCharIndexes, iModel } = args;
  const findFontId = args.findFontId ?? ((name, type) => iModel.fonts.findId({ name, type }) ?? 0);
  const computeTextRange = args.computeTextRange ?? ((x) => iModel.computeRangesForText(x));

  if (!(source instanceof TextRun) || runLayoutResult.characterCount === 0) {
    return [];
  }

  const style = TextStyleSettings.fromJSON(runLayoutResult.textStyle);

  const layoutContext = new LayoutContext(args.textStyleResolver, computeTextRange, findFontId);
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

/**
 * Applies block level settings (lineSpacingFactor, paragraphSpacingFactor, widthFactor, frame, margins, justification, and leader) to a [TextStyleSettings]($common).
 * These must be set on the block, as they are meaningless on individual paragraphs/runs.
 * However, leaders are a special case and can override the block's leader settings.
 * Setting `isLeader` to `true` makes the [TextBlock]($common) settings not override the leader's settings.
 * @internal
 */
function applyBlockSettings(target: TextStyleSettings, source: TextStyleSettings | TextStyleSettingsProps, isLeader: boolean = false): TextStyleSettings {
  if (source === target) {
    return target;
  }

  const lineSpacingFactor = source.lineSpacingFactor ?? target.lineSpacingFactor;
  const paragraphSpacingFactor = source.paragraphSpacingFactor ?? target.paragraphSpacingFactor;
  const widthFactor = source.widthFactor ?? target.widthFactor;
  const justification = source.justification ?? target.justification;
  const frame = source.frame ?? target.frame;
  const margins = source.margins ?? target.margins;
  const leader = source.leader ?? target.leader;

  const leaderShouldChange = !isLeader && !target.leaderEquals(leader);

  if (lineSpacingFactor !== target.lineSpacingFactor ||
    paragraphSpacingFactor !== target.paragraphSpacingFactor ||
    widthFactor !== target.widthFactor ||
    justification !== target.justification ||
    !target.frameEquals(frame) ||
    !target.marginsEqual(margins) ||
    leaderShouldChange
  ) {
    const cloneProps: TextStyleSettingsProps = {
      lineSpacingFactor,
      paragraphSpacingFactor,
      widthFactor,
      justification,
      frame,
      margins,
    };

    if (leaderShouldChange) {
      cloneProps.leader = leader;
    }

    target = target.clone(cloneProps);
  }

  return target;
}

/**
 * Arguments used when constructing a [[TextStyleResolver]].
 * @beta
 */
export interface TextStyleResolverArgs {
  /** The text block whose styles are being resolved. */
  textBlock: TextBlock;
  /** The ID of the [[AnnotationTextStyle]] to apply. */
  textStyleId: Id64String;
  /** The iModel from which to obtain [[AnnotationTextStyle]]s when resolving styles. */
  iModel: IModelDb;
  /** @internal chiefly for tests, by default looks up an [[AnnotationTextStyle]] in the iModel by ID. */
  findTextStyle?: FindTextStyle;
}

/**
 * Resolves the effective style of TextBlockComponents and Leaders, taking into account overrides of the instance and its parent(s).
 * @beta
 */
export class TextStyleResolver {
  /** The resolved style of the TextBlock. */
  public readonly blockSettings: TextStyleSettings;

  public constructor(args: TextStyleResolverArgs) {
    const findTextStyle = args.findTextStyle ?? createFindTextStyleImpl(args.iModel);
    this.blockSettings = findTextStyle(args.textStyleId);

    if (args.textBlock.styleOverrides)
      this.blockSettings = this.blockSettings.clone(args.textBlock.styleOverrides);
  }

  /**
   * Resolves the effective text style settings for a given TextBlockComponent, applying block-level overrides.
   */
  public resolveSettings(overrides: TextStyleSettingsProps, isLeader: boolean = false): TextStyleSettings {
    let settings = this.blockSettings;

    if (overrides)
      settings = settings.clone(overrides);

    return applyBlockSettings(settings, this.blockSettings, isLeader);
  }

  public resolveMarkerText(overrides: TextStyleSettingsProps, index: number): string {
    const markerSettings = overrides.listMarker ?? this.blockSettings.listMarker;
    return getMarkerText(markerSettings, index);
  }

  /**
   * Computes the indentation based on its style and nesting depth.
   */
  public resolveIndentation(styleOverrides: TextStyleSettingsProps, depth: number): number {
    const overrides = this.resolveSettings(styleOverrides);
    const indentation = overrides.indentation;
    const tabInterval = overrides.tabInterval;
    return indentation + tabInterval * depth;
  }
}

class LayoutContext {
  private readonly _fontIds = new Map<string, FontId>();

  public constructor(public readonly textStyleResolver: TextStyleResolver, private readonly _computeTextRange: ComputeRangesForTextLayout, private readonly _findFontId: FindFontId) { }

  public findFontId(name: string, type?: FontType): FontId {
    let fontId = this._fontIds.get(name);
    if (undefined === fontId) {
      this._fontIds.set(name, fontId = this._findFontId(name, type));
    }

    return fontId;
  }

  public computeRangeForText(chars: string, style: TextStyleSettings, baselineShift: BaselineShift): TextLayoutRanges {
    if (chars.length === 0) {
      return {
        layout: new Range2d(0, 0, 0, style.textHeight),
        justification: new Range2d(),
      };
    }

    const fontId = this.findFontId(style.font.name, style.font.type);
    const { layout, justification } = this._computeTextRange({
      chars,
      fontId,
      baselineShift,
      bold: style.isBold,
      italic: style.isItalic,
      textHeight: style.textHeight,
      widthFactor: this.textStyleResolver.blockSettings.widthFactor,
    });

    if ("none" !== baselineShift) {
      const isSub = "subscript" === baselineShift;
      const scale = isSub ? style.subScriptScale : style.superScriptScale;
      const offsetFactor = isSub ? style.subScriptOffsetFactor : style.superScriptOffsetFactor;
      const offset = { x: 0, y: style.textHeight * offsetFactor };

      scaleRange(layout, scale);
      layout.cloneTranslated(offset, layout);

      scaleRange(justification, scale);
      justification.cloneTranslated(offset, justification);
    }

    return { layout, justification };
  }

  public computeRangeForTextRun(style: TextStyleSettings, run: TextRun | FieldRun, charOffset: number, numChars: number): TextLayoutRanges {
    let content: string;
    let baselineShift: BaselineShift;

    if (run.type === "text") {
      content = run.content;
      baselineShift = run.baselineShift;
    } else {
      content = run.cachedContent;
      baselineShift = "none";
    }

    return this.computeRangeForText(content.substring(charOffset, charOffset + numChars), style, baselineShift);
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

  public computeRangeForTabRun(style: TextStyleSettings, source: TabRun, lengthFromLastTab: number): Range2d {
    const interval = source.styleOverrides.tabInterval ?? style.tabInterval;
    const tabEndX = interval - lengthFromLastTab % interval;

    const range = new Range2d(0, 0, 0, style.textHeight);
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

  public static create(source: Run, context: LayoutContext, cumulativeOverrides: TextStyleSettingsProps): RunLayout {
    const style = context.textStyleResolver.resolveSettings(cumulativeOverrides);
    const fontId = context.findFontId(style.font.name, style.font.type);
    const charOffset = 0;
    const offsetFromLine = { x: 0, y: 0 };
    let numChars = 0;

    let range, justificationRange, numeratorRange, denominatorRange;

    switch (source.type) {
      case "field":
      case "text": {
        const content = source.type === "text" ? source.content : source.cachedContent;
        numChars = content.length;
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
        range = new Range2d(0, 0, 0, style.textHeight);
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

  public toResult(): RunLayoutResult {
    const result: RunLayoutResult = {
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
  public source: List | Run | Paragraph;
  public range = new Range2d(0, 0, 0, 0);
  public runRange = new Range2d(0, 0, 0, 0); // Range of all runs excluding marker.
  public justificationRange = new Range2d(0, 0, 0, 0);
  public offsetFromDocument: WritableXAndY;
  public depth: number;
  public lengthFromLastTab = 0; // Used to track the length from the last tab for tab runs.
  private _runs: RunLayout[] = [];
  private _marker?: RunLayout;

  public constructor(source: List | Run | Paragraph, style: TextStyleSettingsProps, context?: LayoutContext, depth: number = 0) {
    this.source = source;
    this.depth = depth;
    this.offsetFromDocument = { x: context?.textStyleResolver.resolveIndentation(style, depth) ?? 0, y: 0 };
  }

  /** Compute a string representation, primarily for debugging purposes. */
  public stringify(): string {
    const runs = this._runs.map((run) => run.stringify());
    return `${runs.join("")}`;
  }

  /** Gets the array of RunLayout objects contained in this line. */
  public get runs(): ReadonlyArray<RunLayout> { return this._runs; }
  /** Indicates whether this line contains any runs. */
  public get isEmpty() { return this._runs.length === 0; }
  /** Gets the last RunLayout in this line. */
  public get back(): RunLayout {
    assert(!this.isEmpty);
    return this._runs[this._runs.length - 1];
  }

  /**
   * Gets or sets the marker RunLayout for this line, used for lists.
   * A marker is the symbol or character that appears before each list item in a list, bullets, numbers, etc.
   * */
  public get marker(): RunLayout | undefined { return this._marker; }
  public set marker(value: RunLayout | undefined) { this._marker = value; }

  public append(run: RunLayout): void {
    this._runs.push(run);
    this.computeRanges();
  }

  /** Invoked every time a run is appended,. */
  private computeRanges(): void {
    this.runRange.low.setZero();
    this.runRange.high.setZero();
    this.lengthFromLastTab = 0;

    let lineHeight = 0;
    let tallestNonFractionRun: RunLayout | undefined;
    for (const run of this._runs) {
      const runHeight = run.range.yLength();
      lineHeight = Math.max(lineHeight, runHeight);
      if (run.source.type !== "fraction" && (!tallestNonFractionRun || runHeight > tallestNonFractionRun.range.yLength())) {
        tallestNonFractionRun = run;
      }
    }

    // // The baseline for the line is the bottom of the tallest non-fraction run, centered in the line.
    let baseline = 0;
    if (tallestNonFractionRun) {
      baseline = (lineHeight + tallestNonFractionRun.range.yLength()) / 2
    }

    for (const run of this._runs) {
      const runHeight = run.range.yLength();
      // Vertically align runs: normal text at baseline, fractions visually centered on text or line as appropriate.
      let yOffset = lineHeight - baseline;

      if (run.source.type === "fraction") {
        const denominatorHeight = run.denominatorRange?.yLength() ?? 0;
        if (tallestNonFractionRun && run.style.textHeight <= tallestNonFractionRun.style.textHeight) {
          // Shift fraction to baseline, then down by half the denominator height so it appears centered relative to any non-fraction text of the same height.
          yOffset = (lineHeight - baseline) - denominatorHeight / 2;
        } else {
          // If the fraction text height is greater than the largest non-fraction text, just center it in the line.
          yOffset = (lineHeight - runHeight) / 2;
        }
      }

      const runOffset = { x: this.runRange.high.x, y: yOffset };
      run.offsetFromLine = runOffset;

      const runLayoutRange = run.range.cloneTranslated(runOffset);
      this.runRange.extendRange(runLayoutRange);

      if ("linebreak" !== run.source.type) {
        const runJustificationRange = run.justificationRange?.cloneTranslated(runOffset);
        this.justificationRange.extendRange(runJustificationRange ?? runLayoutRange);
      }

      if ("tab" === run.source.type) {
        this.lengthFromLastTab = 0;
      } else {
        this.lengthFromLastTab += run.range.xLength();
      }
    }

    this.range.setFrom(this.runRange);

    if (this._marker) {
      const indentation = this.range.low.x;
      const x = indentation - (this._marker.style.tabInterval / 2) - this._marker.range.xLength();
      const runHeight = this._marker.range.yLength();
      const runOffset = {
        x,
        y: (lineHeight - runHeight) / 2 // Center the marker vertically in the line.
      };

      this._marker.offsetFromLine = runOffset;

      const markerRange = this._marker.range.cloneTranslated(this._marker.offsetFromLine);
      this.range.extendRange(markerRange);
    }
  }

  public toResult(): LineLayoutResult {
    return {
      runs: this.runs.map((x) => x.toResult()),
      marker: this.marker?.toResult(),
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
    this.justifyLines(context);
    this.applyMargins(context.textStyleResolver.blockSettings.margins, context.textStyleResolver.blockSettings.textHeight);
  }

  public toResult(): TextBlockLayoutResult {
    return {
      lines: this.lines.map((x) => x.toResult()),
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
    if (!doc.children || doc.children.length === 0) {
      return;
    }

    let curLine = new LineLayout(doc.children[0], doc.children[0].styleOverrides, context);
    let childIndex = 0;
    for (const child of doc.children) {
      curLine = this.populateComponent(child, childIndex++, context, doc.width, curLine, doc, doc.styleOverrides);
    }

    if (curLine.runs.length > 0) {
      this.flushLine(context, curLine, doc.styleOverrides);
    }
  }

  private populateComponent(
    component: Run | Paragraph | List,
    componentIndex: number,
    context: LayoutContext,
    docWidth: number,
    curLine: LineLayout,
    parent: StructuralTextBlockComponent,
    cumulativeOverrides: TextStyleSettingsProps,
    depth: number = 0
  ): LineLayout {
    cumulativeOverrides = { ...cumulativeOverrides, ...component.styleOverrides };

    switch (component.type) {
      case "list": {
        // If we have any runs in the current line, flush it before starting the list.
        if (curLine.runs.length > 0) {
          curLine = this.flushLine(context, curLine, cumulativeOverrides, component.children[0], true, depth + 1);
        } else {
          // If not, we need to apply the indentation for the list to the first line.
          curLine.offsetFromDocument.x = context.textStyleResolver.resolveIndentation(cumulativeOverrides, depth + 1);
          curLine.depth = depth + 1;
        }

        // Iterate through each list item, setting the marker and populating its contents.
        component.children.forEach((child, index) => {
          const markerContent = context.textStyleResolver.resolveMarkerText(cumulativeOverrides, index + 1);
          const markerRun = TextRun.create({ content: markerContent });
          curLine.marker = RunLayout.create(markerRun, context, cumulativeOverrides);

          curLine = this.populateComponent(child, index, context, docWidth, curLine, component, cumulativeOverrides, depth + 1);
        });

        // Lastly flush the line.
        const nextSibling = parent?.children[componentIndex + 1];
        if (curLine && nextSibling) {
          curLine = this.flushLine(context, curLine, cumulativeOverrides, nextSibling, true, depth);
        }
        break;
      }
      case "paragraph": {
        // Iterate through each paragraph child (either a list or a run), populating its contents.
        component.children.forEach((child, index) => {
          curLine = this.populateComponent(child, index, context, docWidth, curLine, component, cumulativeOverrides, depth);
        });

        // Lastly flush the line.
        const nextSibling = parent?.children[componentIndex + 1];
        if (curLine && nextSibling) {
          curLine = this.flushLine(context, curLine, cumulativeOverrides, nextSibling, true, depth);
        }
        break;
      }
      case "text":
      case "field": {
        const layout = RunLayout.create(component, context, cumulativeOverrides);

        // Text can be word-wrapped, so we need to split it into multiple runs if necessary.
        if (docWidth > 0) {
          layout.split(context).forEach(r => { curLine = this.populateRun(curLine, r, context, cumulativeOverrides, docWidth) });
        } else {
          curLine = this.populateRun(curLine, layout, context, cumulativeOverrides, docWidth);
        }
        break;
      }
      case "fraction":
      case "tab": {
        const layout = RunLayout.create(component, context, cumulativeOverrides);
        curLine = this.populateRun(curLine, layout, context, cumulativeOverrides, docWidth);
        break;
      }
      case "linebreak": {
        const layout = RunLayout.create(component, context, cumulativeOverrides);

        curLine.append(layout);
        curLine = this.flushLine(context, curLine, cumulativeOverrides, undefined, undefined, depth);
        break;
      }
      default: break;
    }

    return curLine;
  };

  private populateRun(curLine: LineLayout, run: RunLayout, context: LayoutContext, cumulativeOverrides: TextStyleSettingsProps, docWidth: number): LineLayout {
    // If this is a tab, we need to apply the tab shift first, and then we can treat it like a text run.
    applyTabShift(run, curLine, context);

    // If our width is not set, then we don't have to compute word wrapping, so just append the run, and continue.
    if (docWidth <= 0) {
      curLine.append(run);
      return curLine;
    }

    // If not, we need to determine if we can append this run to the current line without exceeding the document width or if we need to word wrap.
    const runWidth = run.justificationRange?.xLength() ?? run.range.xLength();
    const lineWidth = curLine.runRange.xLength();
    const newWidth = runWidth + lineWidth + curLine.offsetFromDocument.x;

    // If true, then no word wrapping is required, so we can append to the current line.
    if (newWidth < docWidth || Geometry.isAlmostEqualNumber(newWidth, docWidth, Geometry.smallMetricDistance)) {
      curLine.append(run);
      return curLine;
    }

    // If not, do word wrapping
    if (curLine.runs.length === 0) {
      curLine.append(run);

      // Lastly, flush line
      curLine = this.flushLine(context, curLine, cumulativeOverrides, undefined, undefined, curLine.depth);
    } else {
      // First, flush line
      curLine = this.flushLine(context, curLine, cumulativeOverrides, undefined, undefined, curLine.depth);

      // Recompute tab shift if applicable
      applyTabShift(run, curLine, context);

      curLine.append(run);
    }

    return curLine;
  };

  private flushLine(context: LayoutContext, curLine: LineLayout, cumulativeOverrides: TextStyleSettingsProps, next?: List | Run | Paragraph, newParagraph: boolean = false, depth: number = 0): LineLayout {
    next = next ?? curLine.source;

    // We want to guarantee that each layout line has at least one run.
    if (curLine.runs.length === 0) {
      if (this.lines.length === 0 || this._back.runs.length === 0) {
        return new LineLayout(next, cumulativeOverrides, context, depth);
      }

      if (curLine.source.type !== "linebreak") {
        const newLine = new LineLayout(next, cumulativeOverrides, context, depth);
        newLine.offsetFromDocument.y -= context.textStyleResolver.blockSettings.paragraphSpacingFactor * context.textStyleResolver.blockSettings.textHeight;
        return newLine;
      }

      const run = curLine.source.clone();
      curLine.append(RunLayout.create(run, context, cumulativeOverrides));
    }

    // Line origin is its baseline.
    const lineOffset = { ...curLine.offsetFromDocument }; // Start with the line's original offset, which includes indentation.
    lineOffset.y -= curLine.range.yLength(); // Shift down the baseline

    // Place it below any existing lines
    if (this.lines.length > 0) {
      lineOffset.y += this._back.offsetFromDocument.y;
      lineOffset.y -= context.textStyleResolver.blockSettings.lineSpacingFactor * context.textStyleResolver.blockSettings.textHeight;
    }

    curLine.offsetFromDocument = lineOffset;

    // Update document range from computed line range and position
    this.textRange.extendRange(curLine.range.cloneTranslated(lineOffset));

    this.lines.push(curLine);
    if (newParagraph) {
      const newLine = new LineLayout(next, cumulativeOverrides, context, depth);
      newLine.offsetFromDocument.y -= context.textStyleResolver.blockSettings.paragraphSpacingFactor * context.textStyleResolver.blockSettings.textHeight;
      return newLine;
    }
    return new LineLayout(next, cumulativeOverrides, context, depth);
  }

  private justifyLines(context: LayoutContext): void {
    // We don't want to justify empty text, or a single line of text whose width is 0. By default text is already left justified.
    if (this.lines.length < 1 || (this.lines.length === 1 && this.source.width === 0) || "left" === context.textStyleResolver.blockSettings.justification) {
      return;
    }

    // This is the minimum width of the document's bounding box.
    const docWidth = this.source.width;

    let minOffset = Number.MAX_VALUE;
    for (const line of this.lines) {
      const lineWidth = line.justificationRange.xLength() + line.offsetFromDocument.x;

      let offset = docWidth - lineWidth;
      if ("center" === context.textStyleResolver.blockSettings.justification) {
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

  private applyMargins(margins: Required<TextBlockMargins>, textHeight: number) {
    this.range = this.textRange.clone();

    if (this.range.isNull)
      return;

    // Disregard negative margins.
    const right = margins.right * textHeight >= 0 ? margins.right * textHeight : 0;
    const left = margins.left * textHeight >= 0 ? margins.left * textHeight : 0;
    const top = margins.top * textHeight >= 0 ? margins.top * textHeight : 0;
    const bottom = margins.bottom * textHeight >= 0 ? margins.bottom * textHeight : 0;

    const xHigh = this.textRange.high.x + right;
    const yHigh = this.textRange.high.y + top;
    const xLow = this.textRange.low.x - left;
    const yLow = this.textRange.low.y - bottom;

    this.range.extendXY(xHigh, yHigh);
    this.range.extendXY(xLow, yLow);
  }
}
