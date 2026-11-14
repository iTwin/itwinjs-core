/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  FontType, LeaderAttachment, ParagraphProps, RunProps, TerminatorShape, TextAnnotationFillColor, TextAnnotationFrameShape, TextAnnotationLeaderProps,
  TextAnnotationProps, TextBlockProps, TextLeaderStyleProps, TextStyleColor, TextStyleSettingsProps,
} from "@itwin/core-common";
import type { LegacyTextAnnotationConversion, LegacyTextAnnotationIssue } from "../../annotations/TextAnnotationElement";

/** A color in the legacy annotation JSON produced by the native addon.
 * `rgba.value` is a [ColorDef]($common) TBGR value.
 * @internal
 */
export type LegacyColor = { type: "byCategory" } | { type: "rgba", value: number } | { type: "viewBackground" };

/** A legacy text style, fully resolved by the native addon (document, paragraph, and run styles plus overrides).
 * Lengths are in meters.
 * @internal
 */
export interface LegacyTextStyle {
  color: LegacyColor;
  font?: { name: string, type: "truetype" | "rsc" | "shx" };
  height: number;
  lineSpacingFactor: number;
  widthFactor: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderlined: boolean;
  stackedFractionScale: number;
  stackedFractionType: "horizontal" | "diagonal";
  subScriptOffsetFactor: number;
  subScriptScale: number;
  superScriptOffsetFactor: number;
  superScriptScale: number;
}

/** @internal */
export type LegacyRun = (
  | { type: "text", content: string, subSuperScript: "none" | "sub" | "super" }
  | { type: "fraction", numerator: string, denominator: string }
  | { type: "lineBreak" }
) & { style: LegacyTextStyle };

/** @internal */
export interface LegacyTextBlock {
  /** In meters; 0 means unbounded. */
  documentWidth: number;
  justification: "left" | "center" | "right";
  paragraphs: Array<{ runs: LegacyRun[] }>;
}

/** @internal */
export interface LegacyFrame {
  type: "invisibleBox" | "box" | "circle" | "ellipse";
  /** Factor of the first run's text height. */
  horizontalPadding: number;
  /** Factor of the first run's text height. */
  verticalPadding: number;
  isFillEnabled: boolean;
  fillColor: LegacyColor;
  /** 0 (opaque) to 1 (fully transparent). */
  fillTransparency: number;
  isStrokeEnabled: boolean;
  isStrokeCloud: boolean;
  strokeColor: LegacyColor;
  /** Line weight index. */
  strokeWeight: number;
  cloudBulgeFactor: number;
  cloudDiameterFactor: number;
}

/** @internal */
export interface LegacyLeader {
  sourceAttachment: { type: "byId", id: number };
  /** Meters, annotation-local. */
  targetPoint: [number, number, number];
  lineType: "none" | "straight" | "curved";
  lineColor: LegacyColor;
  lineWeight: number;
  terminatorType: "none" | "openArrow" | "closedArrow";
  terminatorColor: LegacyColor;
  terminatorWeight: number;
  /** Factor of the first character's height. */
  terminatorScaleFactor: number;
}

/** @internal */
export interface LegacyRange2d {
  low: [number, number];
  high: [number, number];
}

/** The ID-free JSON that the native addon decodes from a legacy `BisCore:TextAnnotationData` aspect.
 * @internal
 */
export interface LegacyTextAnnotationJson {
  version: number;
  textBlock?: LegacyTextBlock;
  frame?: LegacyFrame;
  leaders: LegacyLeader[];
  /** Best-effort layout computed by the legacy layout code; omitted if layout failed. Meters, annotation-local. */
  layout?: {
    textRange: LegacyRange2d;
    frameRange?: LegacyRange2d;
    leaderSourcePoints: Array<[number, number, number]>;
  };
  issues: LegacyTextAnnotationIssue[];
}

/** The version of [[LegacyTextAnnotationJson]] understood by [[convertLegacyTextAnnotationJson]].
 * @internal
 */
export const LEGACY_TEXT_ANNOTATION_JSON_VERSION = 1;

/** Arguments supplied to [[convertLegacyTextAnnotationJson]].
 * @internal
 */
export interface ConvertLegacyTextAnnotationArgs {
  json: LegacyTextAnnotationJson;
  /** The `scaleFactor` of the [Drawing]($backend) containing the element, or 1.
   * Modern annotations scale their text by this factor, whereas legacy text is stored at its displayed size.
   */
  scaleFactor?: number;
}

type IssueSink = (code: string, message: string, path?: string) => void;

/** Converts the JSON decoded from a legacy `BisCore:TextAnnotationData` aspect into [TextAnnotationProps]($common).
 * All legacy style information is expressed as style overrides, so the result contains no element IDs.
 * @internal
 */
export function convertLegacyTextAnnotationJson(args: ConvertLegacyTextAnnotationArgs): LegacyTextAnnotationConversion {
  const { json } = args;
  if (json.version !== LEGACY_TEXT_ANNOTATION_JSON_VERSION)
    throw new Error(`Unsupported legacy text annotation JSON version ${json.version}. Expected ${LEGACY_TEXT_ANNOTATION_JSON_VERSION}.`);

  const scaleFactor = args.scaleFactor !== undefined && args.scaleFactor > 0 ? args.scaleFactor : 1;
  const issues: LegacyTextAnnotationIssue[] = (json.issues ?? []).map((issue) => ({ ...issue }));
  const addIssue: IssueSink = (code, message, path) => issues.push(path !== undefined ? { code, message, path } : { code, message });

  const runs = json.textBlock?.paragraphs.flatMap((paragraph) => paragraph.runs) ?? [];
  // Legacy frame padding and leader terminator size are relative to the first run's height, as are modern block-level settings.
  const baseStyle = runs.length > 0 ? runs[0].style : undefined;
  const legacyHeight = baseStyle?.height ?? 0;

  const blockOverrides: TextStyleSettingsProps = baseStyle ? convertStyle(baseStyle, scaleFactor, addIssue, "textBlock") : {};
  if (baseStyle) {
    blockOverrides.lineSpacingFactor = baseStyle.lineSpacingFactor;
    // Legacy text has no separate paragraph spacing; paragraphs are separated like lines.
    blockOverrides.paragraphSpacingFactor = baseStyle.lineSpacingFactor;
    blockOverrides.widthFactor = baseStyle.widthFactor;
    if (!baseStyle.font)
      addIssue("noFont", "No font could be resolved for the text, so none is specified. A font must be set before the annotation can be written to an element.", "textBlock");
  }

  if (json.textBlock)
    blockOverrides.justification = json.textBlock.justification;

  if (json.frame)
    convertFrame(json.frame, blockOverrides, addIssue);

  const textBlock: TextBlockProps = {
    styleOverrides: blockOverrides,
    children: json.textBlock?.paragraphs.map((paragraph, paragraphIndex) => convertParagraph(paragraph.runs, paragraphIndex, blockOverrides, baseStyle, scaleFactor, addIssue)) ?? [],
  };

  if (json.textBlock && json.textBlock.documentWidth > 0)
    textBlock.width = json.textBlock.documentWidth / scaleFactor;

  const textAnnotation: TextAnnotationProps = {
    textBlock,
    // Legacy annotations are anchored at the top-left of their text, as are modern annotations by default.
    anchor: { vertical: "top", horizontal: "left" },
  };

  // The element's origin is approximately the top-left of the legacy text range, whereas the modern anchor is the top-left of the
  // text range expanded by the margins.
  if (json.layout) {
    const margins = blockOverrides.margins;
    const left = json.layout.textRange.low[0] - (margins?.left ?? 0) * legacyHeight;
    const top = json.layout.textRange.high[1] + (margins?.top ?? 0) * legacyHeight;
    if (left !== 0 || top !== 0)
      textAnnotation.offset = [left, top, 0];
  }

  if (json.frame) {
    const leaders = json.leaders.map((leader, index) => convertLeader(leader, index, json.frame, addIssue));
    if (leaders.length > 0)
      textAnnotation.leaders = leaders;
  } else {
    // Legacy annotations only display leaders attached to a frame.
    json.leaders.forEach((_leader, index) => addIssue("leaderWithoutFrame", "The leader is not displayed because the legacy annotation has no frame. It is omitted.", `leaders[${index}]`));
  }

  return { textAnnotation, issues };
}

function convertColor(color: LegacyColor, addIssue: IssueSink, path: string, what: string): TextStyleColor {
  switch (color.type) {
    case "rgba":
      return color.value;
    case "viewBackground":
      addIssue("viewBackgroundColor", `The ${what} uses the view background color, which is not supported. The subcategory color is used instead.`, path);
      return "subcategory";
    default:
      return "subcategory";
  }
}

function convertFontType(type: "truetype" | "rsc" | "shx"): FontType {
  switch (type) {
    case "rsc": return FontType.Rsc;
    case "shx": return FontType.Shx;
    default: return FontType.TrueType;
  }
}

/** Converts the run-level properties of a legacy style. Block-level properties are handled separately. */
function convertStyle(style: LegacyTextStyle, scaleFactor: number, addIssue: IssueSink, path: string): TextStyleSettingsProps {
  const props: TextStyleSettingsProps = {
    color: convertColor(style.color, addIssue, path, "text"),
    textHeight: style.height / scaleFactor,
    isBold: style.isBold,
    isItalic: style.isItalic,
    isUnderlined: style.isUnderlined,
    stackedFractionScale: style.stackedFractionScale,
    stackedFractionType: style.stackedFractionType,
    subScriptOffsetFactor: style.subScriptOffsetFactor,
    subScriptScale: style.subScriptScale,
    superScriptOffsetFactor: style.superScriptOffsetFactor,
    superScriptScale: style.superScriptScale,
  };

  if (style.font)
    props.font = { name: style.font.name, type: convertFontType(style.font.type) };

  return props;
}

function convertParagraph(
  runs: LegacyRun[],
  paragraphIndex: number,
  blockOverrides: TextStyleSettingsProps,
  baseStyle: LegacyTextStyle | undefined,
  scaleFactor: number,
  addIssue: IssueSink,
): ParagraphProps {
  const children: RunProps[] = runs.map((run, runIndex) => {
    const path = `textBlock.paragraphs[${paragraphIndex}].runs[${runIndex}]`;
    if (baseStyle) {
      if (run.style.lineSpacingFactor !== baseStyle.lineSpacingFactor)
        addIssue("blockLevelStyleVaries", "The run's line spacing differs from the first run's. The first run's line spacing is used.", path);
      if (run.style.widthFactor !== baseStyle.widthFactor)
        addIssue("blockLevelStyleVaries", "The run's width factor differs from the first run's. The first run's width factor is used.", path);
    }

    // The block's style was derived from the first run, so only report color issues for that run once.
    const runIssues: IssueSink = (paragraphIndex === 0 && runIndex === 0) ? () => { } : addIssue;
    const styleOverrides = diffStyle(convertStyle(run.style, scaleFactor, runIssues, path), blockOverrides);

    let props: RunProps;
    switch (run.type) {
      case "text":
        props = { type: "text", content: run.content };
        if (run.subSuperScript === "sub")
          props.baselineShift = "subscript";
        else if (run.subSuperScript === "super")
          props.baselineShift = "superscript";
        break;
      case "fraction":
        props = { type: "fraction", numerator: run.numerator, denominator: run.denominator };
        break;
      default:
        props = { type: "linebreak" };
        break;
    }

    if (styleOverrides)
      props.styleOverrides = styleOverrides;

    return props;
  });

  return { children };
}

/** Returns the properties of `style` whose values differ from `base`, or undefined if none differ. */
function diffStyle(style: TextStyleSettingsProps, base: TextStyleSettingsProps): TextStyleSettingsProps | undefined {
  const result: TextStyleSettingsProps = {};
  let hasDifferences = false;
  for (const [key, value] of Object.entries(style)) {
    if (JSON.stringify(value) !== JSON.stringify((base as Record<string, unknown>)[key])) {
      (result as Record<string, unknown>)[key] = value;
      hasDifferences = true;
    }
  }

  return hasDifferences ? result : undefined;
}

function convertFrame(frame: LegacyFrame, blockOverrides: TextStyleSettingsProps, addIssue: IssueSink): void {
  const path = "frame";
  const horizontal = Math.max(0, frame.horizontalPadding);
  const vertical = Math.max(0, frame.verticalPadding);
  blockOverrides.margins = { left: horizontal, right: horizontal, top: vertical, bottom: vertical };

  let shape: TextAnnotationFrameShape;
  switch (frame.type) {
    case "box":
      shape = "rectangle";
      break;
    case "circle":
      shape = "circle";
      break;
    case "ellipse":
      shape = "circle";
      addIssue("frameEllipse", "Elliptical frames are not supported. A circular frame is used instead.", path);
      break;
    default:
      shape = "none";
      break;
  }

  if (shape !== "none" && !frame.isFillEnabled && !frame.isStrokeEnabled)
    shape = "none";

  if (shape === "none") {
    blockOverrides.frame = { shape };
    return;
  }

  let fillColor: TextAnnotationFillColor = "none";
  if (frame.isFillEnabled) {
    fillColor = frame.fillColor.type === "viewBackground" ? "background" : convertColor(frame.fillColor, addIssue, path, "frame fill");
    if (frame.fillTransparency > 0)
      addIssue("frameFillTransparency", "Frame fill transparency is not supported. The fill is opaque.", path);
  }

  if (!frame.isStrokeEnabled)
    addIssue("frameStrokeDisabled", "Frames without an outline are not supported. The outline is drawn.", path);

  if (frame.isStrokeEnabled && frame.isStrokeCloud)
    addIssue("frameCloud", "Cloud frame outlines are not supported. A plain outline is used instead.", path);

  blockOverrides.frame = {
    shape,
    fillColor,
    borderColor: convertColor(frame.strokeColor, addIssue, path, "frame outline"),
    borderWeight: frame.strokeWeight,
  };
}

/** Maps a legacy attachment ID to a key point on the modern frame.
 * Modern rectangle frames consist of four edges: bottom (left to right), right (bottom to top), top (right to left), and left (top to bottom).
 * Modern circular frames are a single counter-clockwise arc starting at the rightmost point.
 */
function convertAttachment(id: number, frame: LegacyFrame | undefined): LeaderAttachment {
  if (frame && (frame.type === "circle" || frame.type === "ellipse")) {
    // 0 = right, 1 = top, 2 = left, 3 = bottom
    const index = Math.min(Math.max(Math.trunc(id), 0), 3);
    return { mode: "KeyPoint", curveIndex: 0, fraction: index / 4 };
  }

  // 0 = right-mid, 1 = top-right, 2 = top-mid, 3 = top-left, 4 = left-mid, 5 = bottom-left, 6 = bottom-mid, 7 = bottom-right
  const boxKeyPoints: Array<{ curveIndex: number, fraction: number }> = [
    { curveIndex: 1, fraction: 0.5 },
    { curveIndex: 2, fraction: 0 },
    { curveIndex: 2, fraction: 0.5 },
    { curveIndex: 3, fraction: 0 },
    { curveIndex: 3, fraction: 0.5 },
    { curveIndex: 0, fraction: 0 },
    { curveIndex: 0, fraction: 0.5 },
    { curveIndex: 1, fraction: 0 },
  ];

  const keyPoint = boxKeyPoints[Math.min(Math.max(Math.trunc(id), 0), 7)];
  return { mode: "KeyPoint", ...keyPoint };
}

function convertTerminator(type: LegacyLeader["terminatorType"]): TerminatorShape {
  switch (type) {
    case "openArrow": return "openArrow";
    case "closedArrow": return "closedArrow";
    default: return "none";
  }
}

function convertLeader(leader: LegacyLeader, index: number, frame: LegacyFrame | undefined, addIssue: IssueSink): TextAnnotationLeaderProps {
  const path = `leaders[${index}]`;
  const style: TextLeaderStyleProps = {
    color: convertColor(leader.lineColor, addIssue, path, "leader line"),
    wantElbow: false,
    terminatorShape: convertTerminator(leader.terminatorType),
    terminatorHeightFactor: leader.terminatorScaleFactor,
    terminatorWidthFactor: leader.terminatorScaleFactor,
    showLeaders: true,
    showTerminators: leader.terminatorType !== "none",
    showTargetPoint: false,
  };

  if (leader.lineType === "curved") {
    addIssue("leaderCurved", "Curved leaders are not supported. A straight leader is used instead.", path);
  } else if (leader.lineType === "none") {
    style.showLeaders = false;
    if (leader.terminatorType !== "none")
      addIssue("leaderTerminatorWithoutLine", "Leader terminators without a leader line are not supported. The terminator is omitted.", path);
  }

  if (leader.terminatorType !== "none" && JSON.stringify(leader.terminatorColor) !== JSON.stringify(leader.lineColor))
    addIssue("leaderTerminatorColor", "Leader terminator colors that differ from the leader line color are not supported. The line color is used.", path);

  if (leader.lineWeight !== 0 || (leader.terminatorType !== "none" && leader.terminatorWeight !== 0))
    addIssue("leaderWeight", "Leader line weights are not supported. The element's weight is used.", path);

  return {
    startPoint: [...leader.targetPoint],
    attachment: convertAttachment(leader.sourceAttachment.id, frame),
    styleOverrides: { leader: style },
  };
}
