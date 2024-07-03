/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Range2dProps, XAndY } from "@itwin/core-geometry";
import { FontId } from "../Fonts";
import { TextStyleSettingsProps } from "./TextStyle";

/**
 * The offset of a grapheme in a text run.
 * @beta
 */
export interface GraphemeOffset {
  /** The character index that the grapheme starts at */
  charOffset: number;
  /** The offset from the start of the run to the start of the grapheme */
  graphemeOffset: number;
}

/**
 * Represents a single run in a [[LineLayoutResult]].
 * @note Get the text content of the RunLayoutResult using a combination of the `sourceRunIndex`, `characterOffset`, and `characterCount`.
 * @beta
 */
export interface RunLayoutResult {
  /** The index of the Run this RunLayoutResult was generated from in [[Paragraph.runs]]. */
  sourceRunIndex: number;
  /** The ID of the font for the run. */
  fontId: FontId;
  /**
   * The number of characters from the source [[Run]] that have already appeared in the layout.
   * @note A single source [[TextRun]] can be split into multiple lines to respect the [[TextBlock.width]].
  */
  characterOffset: number;
  /** The number of characters in the RunLayoutResult. */
  characterCount: number;
  /** The offset of the RunLayoutResult from the top and left of the [[LineLayoutResult]] */
  offsetFromLine: XAndY;
  /** Bounding box enclosing this RunLayoutResult's content. */
  range: Range2dProps;
  /** The [[TextStyleSettings]] for the run. */
  textStyle: TextStyleSettingsProps;
  /** Bounding box used when justifying the run. This may be smaller than [[range]]. */
  justificationRange?: Range2dProps;
  /** The range containing the contents of the [[FractionRun]]'s numerator. */
  numeratorRange?: Range2dProps;
  /** The range containing the contents of the [[FractionRun]]'s denominator. */
  denominatorRange?: Range2dProps;
  /** Offsets for each grapheme in a text run. Empty if the run is not a text run. */
  graphemeOffsets: GraphemeOffset[];
}

/**
 * Represents a single line in a [[TextBlockLayoutResult]].
 * @beta
 */
export interface LineLayoutResult {
  /** The index of the paragraph this LineLayoutResult was generated from in [[TextBlock.paragraphs]]. */
  sourceParagraphIndex: number;
  /** The runs contained in the line. */
  runs: RunLayoutResult[];
  /** The range containing the contents of the line. */
  range: Range2dProps;
  /** Bounding box used when justifying the line. This may be smaller than [[range]]. */
  justificationRange: Range2dProps;
  /** The offset of the line from the top and left of the [[TextBlock]]. */
  offsetFromDocument: XAndY;
}

/**
 * Represents the result of laying out a [[TextBlock]]'s contents into a series of lines containing runs.
 * @see [computeLayoutTextBlockResult]($backend) to lay out a `TextBlock`.
 * @beta
 */
export interface TextBlockLayoutResult {
  /** The laid out lines of a [[TextBlock]]. */
  lines: LineLayoutResult[];
  /** The range containing the contents of a [[TextBlock]]. */
  range: Range2dProps;
}
