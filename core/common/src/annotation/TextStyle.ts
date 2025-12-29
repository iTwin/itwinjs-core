/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { DeepReadonlyObject, DeepRequiredObject } from "@itwin/core-bentley";
import { ColorDef, ColorDefProps } from "../ColorDef";
import { FontFamilySelector, FontType } from "../Fonts";

/** Predefined markers for list items in text annotations.
 * These values control the appearance of list item markers (e.g., bullet, circle, square, dash, number) that denote the start of a list item in a list.
 * @beta
 */
export enum ListMarkerEnumerator {
  /** English Alphabet */
  Letter = "A",
  RomanNumeral = "I",
  Number = "1",
  Bullet = "•",
  Circle = "○",
  Square = "■",
  /** EM Dash */
  Dash = "–",
}

/** A settings to specify how to mark or denote the start of a list item in a [[List]].
 * @beta
 */
export interface ListMarker {
  /** This can be either one of the predefined markers in [[ListMarkerEnumerator]], or any arbitrary string. */
  enumerator: ListMarkerEnumerator | string,
  /** The punctuation to follow the enumerator. */
  terminator?: "parenthesis" | "period",
  /** Whether to use upper or lower case for alphabetic or roman numeral enumerators. Ignored if [[enumerator]] is not alphabetic or roman numeral. */
  case?: "upper" | "lower",
}

/** Set of predefined shapes that can be computed and drawn around the margins of a [[TextBlock]]
 * @beta
*/
export const textAnnotationFrameShapes = ["none", "line", "rectangle", "circle", "equilateralTriangle", "diamond", "square", "pentagon", "hexagon", "octagon", "capsule", "roundedRectangle"] as const;

/** Describes a predefined shape that can be computed and drawn around the margins of a [[TextBlock]]
 * @beta
*/
export type TextAnnotationFrameShape = typeof textAnnotationFrameShapes[number];

/** Set of predefined shapes that can be used as terminators for leaders in a [[TextAnnotation]]
 * @beta
*/
export const terminatorShapes = ["openArrow", "closedArrow", "closedArrowFilled", "circle", "circleFilled", "slash", "none"] as const;

/** Describes a predefined shape that can be used as a terminator for leaders in a [[TextAnnotation]]
 * @beta
*/
export type TerminatorShape = typeof terminatorShapes[number];

/**
 * Describes what color to use when filling the frame around a [[TextBlock]].
 * If `background` is specified, [[GeometryParams.BackgroundFill]] will be set to `BackgroundFill.Outline`.
 * If `none` is specified, no fill will be applied.
 * @beta
 */
export type TextAnnotationFillColor = TextStyleColor | "background" | "none";

/** Describes the margins around the content inside a [[TextBlock]], measured in meters.
 * All margins default to zero if `undefined`.
 * @beta
 */
export interface TextBlockMargins {
  /** The left margin measured in meters. Must be a positive number >= 0. Negative values are disregarded */
  left?: number;
  /** The right margin measured in meters. Must be a positive number >= 0. Negative values are disregarded */
  right?: number;
  /** The top margin measured in meters. Must be a positive number >= 0. Negative values are disregarded */
  top?: number;
  /** The bottom margin measured in meters. Must be a positive number >= 0. Negative values are disregarded */
  bottom?: number;
};

/** Describes the relative alignment of text.
 * @beta
*/
export type TextJustification = "left" | "center" | "right";

/** Specifies how to separate the numerator and denominator of a [[FractionRun]], by either a horizontal or diagonal bar.
 * @see [[TextStyleSettingsProps.stackedFractionType]] and [[TextStyleSettings.stackedFractionType]].
 * @beta
 */
export type StackedFractionType = "horizontal" | "diagonal";

/** Describes the color in which to draw the text in a [[TextRun]].
 * "subcategory" indicates that the text should be drawn using the color of the [SubCategory]($backend) specified by the [GeometryStream]($docs/learning/common/GeometryStream.md) hosting the
 * text.
 * @beta
 */
export type TextStyleColor = ColorDefProps | "subcategory";

/**
 * Describes how to draw the frame around a [[TextAnnotation]].
 * The frame can be a simple line, a filled shape, or both.
 * If only a subset of properties are specified, the others will be set to their default value.
 * @beta
 */
export interface TextFrameStyleProps {
  /** Shape of the frame. Default: "none" */
  shape?: TextAnnotationFrameShape;
  /** The color to fill the shape of the text frame. This fill is applied using [[FillDisplay.Blanking]]. Default: "none" */
  fillColor?: TextAnnotationFillColor;
  /** The color of the text frame's outline. Default: black */
  borderColor?: TextStyleColor;
  /** This will be used to set the [[GeometryParams.weight]] property of the frame (in pixels). Default: 1px */
  borderWeight?: number;
};

/** Properties describing the appearance of [[TextAnnotationLeader]] in a [[TextAnnotation]].
 * Used when producing geometry for [[TextAnnotation]].
 * @beta
 */
export interface TextLeaderStyleProps {
  /** The color of the leader.
   * If `inherit` is specified, the [[TextAnnotationLeader]] will use the color specified in the parent [[TextStyleSettings]]`.
   * Default: "inherit".
   */
  color?: TextStyleColor | "inherit";
  /** Whether to use an elbow in the leader.
   * Default: false
   */
  wantElbow?: boolean;
  /** Multiplier used to compute length of the elbow in the leader.
   * The elbowLength is computed in meters as elbowLength * [[textHeight]].
   * Default: 1.0
   */
  elbowLength?: number;
  /**
   * The shape of the leader terminator.
   * Default:"openArrow"
   */
  terminatorShape?: TerminatorShape;
  /** Multiplier to compute height of the leader terminator.
   * The terminator height is computed in meters as terminatorHeight * [[textHeight]].
   * Default: 1.0
   */
  terminatorHeightFactor?: number;
  /** Multiplier to compute width of the leader terminator.
   * The terminator width is computed in meters as terminatorWidth * [[textHeight]].
   * Default: 1.0
   */
  terminatorWidthFactor?: number;
}

/** Serves both as the JSON representation of a [[TextStyleSettings]], and a way for a [[TextBlockComponent]] to selectively override aspects of a [AnnotationTextStyle]($backend)'s properties.
 * @beta
 */
export interface TextStyleSettingsProps {
  /** The color of the text.
   * Default: "subcategory".
   */
  color?: TextStyleColor;
  /** The font stored in an iModel, used to draw the contents of a [[TextRun]].
   * Default: { name: "" } (an invalid font name).
   */
  font?: FontFamilySelector;
  /** The height of the text, in meters. Many other settings use the text height as the basis for computing their own values.
   * For example, the height and offset from baseline of a subscript [[TextRun]]  are computed as textHeight * [[subScriptScale]] and
   * textHeight * [[subScriptOffsetFactor]], respectively.
   * Default: 1.0. */
  textHeight?: number;
  /** Multiplier used to compute the vertical distance between two lines of text.
   * The distance is computed in meters as lineSpacingFactor * [[textHeight]].
   * Default: 0.5.
   */
  lineSpacingFactor?: number;
  /** Multiplier used to compute the vertical distance between two paragraphs of text.
   * The distance is computed in meters as paragraphSpacingFactor * [[textHeight]].
   * Default: 0.5.
   */
  paragraphSpacingFactor?: number;
  /** Specifies whether the content of a [[TextRun]] should be rendered **bold**.
   * Default: false.
   */
  isBold?: boolean;
  /** Specifies whether the content of a [[TextRun]] should be rendered in *italics*.
   * Default: false.
   */
  isItalic?: boolean;
  /** Specifies whether the content of a [[TextRun]] should be underlined.
   * Default: false.
   */
  isUnderlined?: boolean;
  /** Multiplier used to compute the height of both the numerator and denominator of a [[FractionRun]].
   * The height is computed in meters as stackedFractionScale * [[textHeight]].
   * Default: 0.7.
   */
  stackedFractionScale?: number;
  /** Specifies how to separate the numerator and denominator of a [[FractionRun]].
   * Default: "horizontal".
   */
  stackedFractionType?: StackedFractionType;
  /** Multiplier used to compute the vertical offset from the baseline for a subscript [[TextRun]].
   * The offset is computed in meters as subScriptOffsetFactor * [[textHeight]].
   * Default: -0.15.
   */
  subScriptOffsetFactor?: number;
  /** Multiplier used to compute the height of a subscript [[TextRun]].
   * The height is computed as subScriptScale * [[textHeight]].
   * Default: 2/3
   */
  subScriptScale?: number;
  /** Multiplier used to compute the vertical offset from the baseline for a super [[TextRun]].
   * The offset is computed in meters as superScriptOffsetFactor * [[textHeight]].
   * Default: -0.5.
   */
  superScriptOffsetFactor?: number;
  /** Multiplier used to compute the height of a superscript [[TextRun]].
   * The height is computed as superScriptScale * [[textHeight]].
   * Default: 2/3
   */
  superScriptScale?: number;
  /** A scale applied to the width of each glyph.
   * Default: 1.0
   */
  widthFactor?: number;

  /** Properties describing appearance of leaders in a [[TextAnnotation]]
   * Used when producing geometry for [[TextAnnotation]]
   * Default: {color:"subcategory", wantElbow:"false",elbowLength:1, terminatorShape:"openArrow",terminatorWidthFactor:1, terminatorHeightFactor:1}.
   */
  leader?: TextLeaderStyleProps;
  /** The size (in meters) used to calculate the tab stops in a run.
   * These are equally spaced from the left edge of the TextBlock.
   * [[tabInterval]] is also used in lists to compute the offset of each child or [[Paragraph]].
   * The [[listMarker]] is right justified on [[indentation]] + [[tabInterval]]*(depth - 1/2).
   * [[Paragraph]]s will start at [[indentation]] + [[tabInterval]]*depth.
   * Default: 4 meters.
   */
  tabInterval?: number;
  /**
   * A description of the frame around the text annotation.
   * Used when producing geometry for [[TextAnnotation]]s.
   * Default: {shape: "none", fill: "none", border: black, borderWeight: 1} for no frame.
   */
  frame?: TextFrameStyleProps;
  /** Multiplier used to calculate the margins to surround the document content.
   * Margins are computed in meters as margins * [[textHeight]].
   * Default: 0 margins on all sides */
  margins?: TextBlockMargins;
  /** The offset (in meters) from the left edge of the text block to the start of the line of text.
   * In lists, the indentation is added to offset of list items.
   * The [[listMarker]] is right justified on [[indentation]] + [[tabInterval]]*(depth - 1/2).
   * [[Paragraph]]s will start at [[indentation]] + [[tabInterval]]*depth.
   * Default: 0 meters.
   */
  indentation?: number;
  /** The marker used to indicate the start of a list item.
   * Default: "1.".
   */
  listMarker?: ListMarker;
  /** The alignment of the text content.
   * Default: "left". */
  justification?: TextJustification;
}

function deepFreeze<T>(obj: T) {
  if (obj === null || typeof obj !== "object" || Object.isFrozen(obj))
    return;
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (value && typeof value === "object") {
      deepFreeze(value);
    }
  });
  Object.freeze(obj);
}

/** A description of the formatting to be applied to a [[TextBlockComponent]].
 * Named instances of these settings can be stored as [AnnotationTextStyle]($backend)s in an iModel.
 * @note This is an immutable type. Use [[clone]] to create a modified copy.
 * @see [[TextStyleSettingsProps]] for documentation of each of the settings.
 * @beta
 */
export class TextStyleSettings {
  /** The color of the text. */
  public readonly color: TextStyleColor;
  /** The font stored in an iModel, used to draw the contents of a [[TextRun]].
   */
  public readonly font: Readonly<Required<FontFamilySelector>>;
  /** The height of the text, in meters. Many other settings use the text height as the basis for computing their own values.
   * For example, the height and offset from baseline of a subscript [[TextRun]]  are computed as textHeight * [[subScriptScale]] and
   * textHeight * [[subScriptOffsetFactor]], respectively.
   */
  public readonly textHeight: number;
  /** Multiplier used to compute the vertical distance between two lines of text.
   * The distance is computed in meters as lineSpacingFactor * [[textHeight]] of the [[TextBlock]].
   */
  public readonly lineSpacingFactor: number;
  /** Multiplier used to compute the vertical distance between two paragraphs of text.
   * The distance is computed in meters as paragraphSpacingFactor * the [[TextBlock]]'s [[textHeight]].
   */
  public readonly paragraphSpacingFactor: number;
  /** Specifies whether the content of a [[TextRun]] should be rendered **bold**. */
  public readonly isBold: boolean;
  /** Specifies whether the content of a [[TextRun]] should be rendered in *italics*. */
  public readonly isItalic: boolean;
  /** Specifies whether the content of a [[TextRun]] should be underlined. */
  public readonly isUnderlined: boolean;
  /** Multiplier used to compute the height of both the numerator and denominator of a [[FractionRun]].
   * The height is computed in meters as stackedFractionScale * [[textHeight]].
   */
  public readonly stackedFractionScale: number;
  /** Specifies how to separate the numerator and denominator of a [[FractionRun]]. */
  public readonly stackedFractionType: StackedFractionType;
  /** Multiplier used to compute the vertical offset from the baseline for a subscript [[TextRun]].
   * The offset is computed in meters as subScriptOffsetFactor * [[textHeight]].
   */
  public readonly subScriptOffsetFactor: number;
  /** Multiplier used to compute the height of a subscript [[TextRun]].
   * The height is computed as subScriptScale * [[textHeight]].
   */
  public readonly subScriptScale: number;
  /** Multiplier used to compute the vertical offset from the baseline for a super [[TextRun]].
   * The offset is computed in meters as superScriptOffsetFactor * [[textHeight]].
   */
  public readonly superScriptOffsetFactor: number;
  /** Multiplier used to compute the height of a superscript [[TextRun]].
   * The height is computed as superScriptScale * [[textHeight]].
   */
  public readonly superScriptScale: number;
  /** Multiplier used to compute the width of each glyph, relative to [[textHeight]]. */
  public readonly widthFactor: number;
  /** Properties describing appearance of leaders in a [[TextAnnotation]].
   * Used when producing geometry for [[TextAnnotation]].
   */
  public readonly leader: Readonly<Required<TextLeaderStyleProps>>;
  /** The size (in meters) used to calculate the tab stops in a run.
   * These are equally spaced from the left edge of the TextBlock.
   * [[tabInterval]] is also used in lists to compute the offset of each child or [[Paragraph]].
   * The [[listMarker]] is right justified on [[indentation]] + [[tabInterval]]*(depth - 1/2).
   * [[Paragraph]]s will start at [[indentation]] + [[tabInterval]]*depth.
   */
  public readonly tabInterval: number;
  /** The offset (in meters) from the left edge of the text block to the start of the line of text.
   * In lists, the indentation is added to offset of list items.
   * The [[listMarker]] is right justified on [[indentation]] + [[tabInterval]]*(depth - 1/2).
   * [[Paragraph]]s will start at [[indentation]] + [[tabInterval]]*depth.
   */
  public readonly indentation: number;
  /** The marker used to indicate the start of a list item.
   * Default: [[ListMarkerEnumerator.Number]].
   */
  public readonly listMarker: ListMarker;
  /** The frame settings of the [[TextAnnotation]]. */
  public readonly frame: Readonly<Required<TextFrameStyleProps>>;
  /** Multiplier used to calculate the margins to surround the document content. */
  public readonly margins: Readonly<Required<TextBlockMargins>>;
  /** The alignment of the text content. */
  public readonly justification: TextJustification;

  /** A fully-populated JSON representation of the default settings. A real `font` must be provided before use. */
  public static defaultProps: DeepReadonlyObject<DeepRequiredObject<TextStyleSettingsProps>> = {
    color: "subcategory",
    font: { name: "", type: FontType.TrueType },
    textHeight: 1,
    lineSpacingFactor: 0.5,
    paragraphSpacingFactor: 0.5,
    isBold: false,
    isItalic: false,
    isUnderlined: false,
    stackedFractionScale: 0.7,
    stackedFractionType: "horizontal",
    subScriptOffsetFactor: -0.15,
    subScriptScale: 2 / 3,
    superScriptOffsetFactor: 0.5,
    superScriptScale: 2 / 3,
    widthFactor: 1,
    leader: {
      color: "inherit",
      wantElbow: false,
      elbowLength: 1.0,
      terminatorShape: terminatorShapes[0],
      terminatorHeightFactor: 1.0,
      terminatorWidthFactor: 1.0,
    },
    tabInterval: 4,
    indentation: 0,
    listMarker: { enumerator: "1", terminator: "period", case: "lower" },
    frame: {
      shape: "none",
      fillColor: "none",
      borderColor: ColorDef.black.toJSON(),
      borderWeight: 1,
    },
    margins: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    },
    justification: "left",
  };

  /** Settings initialized to all default values. */
  public static defaults: TextStyleSettings = new TextStyleSettings({});

  private constructor(props: TextStyleSettingsProps, defaults?: Required<TextStyleSettingsProps>) {
    if (!defaults) {
      defaults = TextStyleSettings.defaultProps;
    }

    this.color = props.color ?? defaults.color;
    const font = {
      name: props.font?.name ?? defaults.font.name,
      type: props.font?.type ?? defaults.font.type,
    }
    this.font = Object.freeze(font) as Readonly<Required<FontFamilySelector>>;
    this.textHeight = props.textHeight ?? defaults.textHeight;
    this.lineSpacingFactor = props.lineSpacingFactor ?? defaults.lineSpacingFactor;
    this.paragraphSpacingFactor = props.paragraphSpacingFactor ?? defaults.paragraphSpacingFactor;
    this.isBold = props.isBold ?? defaults.isBold;
    this.isItalic = props.isItalic ?? defaults.isItalic;
    this.isUnderlined = props.isUnderlined ?? defaults.isUnderlined;
    this.stackedFractionScale = props.stackedFractionScale ?? defaults.stackedFractionScale;
    this.stackedFractionType = props.stackedFractionType ?? defaults.stackedFractionType;
    this.subScriptOffsetFactor = props.subScriptOffsetFactor ?? defaults.subScriptOffsetFactor;
    this.subScriptScale = props.subScriptScale ?? defaults.subScriptScale;
    this.superScriptOffsetFactor = props.superScriptOffsetFactor ?? defaults.superScriptOffsetFactor;
    this.superScriptScale = props.superScriptScale ?? defaults.superScriptScale;
    this.widthFactor = props.widthFactor ?? defaults.widthFactor;
    const leader = {
      color: props.leader?.color ?? defaults.leader.color,
      wantElbow: props.leader?.wantElbow ?? defaults.leader.wantElbow,
      elbowLength: props.leader?.elbowLength ?? defaults.leader.elbowLength,
      terminatorShape: props.leader?.terminatorShape ?? defaults.leader.terminatorShape,
      terminatorHeightFactor: props.leader?.terminatorHeightFactor ?? defaults.leader.terminatorHeightFactor,
      terminatorWidthFactor: props.leader?.terminatorWidthFactor ?? defaults.leader.terminatorWidthFactor,
    }
    this.leader = Object.freeze(leader) as Readonly<Required<TextLeaderStyleProps>>;
    this.tabInterval = props.tabInterval ?? defaults.tabInterval;
    this.indentation = props.indentation ?? defaults.indentation;
    this.listMarker = props.listMarker ?? defaults.listMarker;
    const frame = {
      shape: props.frame?.shape ?? defaults.frame.shape,
      fillColor: props.frame?.fillColor ?? defaults.frame.fillColor,
      borderColor: props.frame?.borderColor ?? defaults.frame.borderColor,
      borderWeight: props.frame?.borderWeight ?? defaults.frame.borderWeight,
    };
    // Cast to indicate to TypeScript that the frame properties are all defined
    this.frame = Object.freeze(frame) as Readonly<Required<TextFrameStyleProps>>;
    this.margins = Object.freeze({
      left: props.margins?.left ?? defaults.margins.left,
      right: props.margins?.right ?? defaults.margins.right,
      top: props.margins?.top ?? defaults.margins.top,
      bottom: props.margins?.bottom ?? defaults.margins.bottom,
    }) as Readonly<Required<TextBlockMargins>>;
    this.justification = props.justification ?? defaults.justification;
  }

  /** Create a copy of these settings, modified according to the properties defined by `alteredProps`. */
  public clone(alteredProps?: TextStyleSettingsProps): TextStyleSettings {
    return alteredProps ? new TextStyleSettings(alteredProps, this) : this;
  }

  /** Create settings from their JSON representation. */
  public static fromJSON(props?: TextStyleSettingsProps): TextStyleSettings {
    return props ? new TextStyleSettings(props) : TextStyleSettings.defaults;
  }

  public toJSON(): TextStyleSettingsProps {
    return structuredClone(this);
  }

  /** Compare two [[TextLeaderStyleProps]] for equality.
   * @param other The other leader style properties to compare against.
   * @returns true if the two leader styles are equal, false otherwise.
   */
  public leaderEquals(other: TextLeaderStyleProps): boolean {
    return this.leader.color === other.color && this.leader.wantElbow === other.wantElbow
      && this.leader.elbowLength === other.elbowLength && this.leader.terminatorShape === other.terminatorShape && this.leader.terminatorHeightFactor === other.terminatorHeightFactor
      && this.leader.terminatorWidthFactor === other.terminatorWidthFactor;
  }

  public frameEquals(other: TextFrameStyleProps): boolean {
    return this.frame?.shape === other.shape
      && this.frame?.fillColor === other.fillColor
      && this.frame?.borderColor === other.borderColor
      && this.frame?.borderWeight === other.borderWeight;
  }

  public marginsEqual(other: TextBlockMargins): boolean {
    return Object.entries(this.margins).every(([key, value]) =>
      value === (other as any)[key]
    );
  }

  public equals(other: TextStyleSettings): boolean {
    return this.color === other.color && this.font.name === other.font.name && this.font.type === other.font.type
      && this.textHeight === other.textHeight && this.widthFactor === other.widthFactor
      && this.lineSpacingFactor === other.lineSpacingFactor && this.paragraphSpacingFactor === other.paragraphSpacingFactor
      && this.isBold === other.isBold && this.isItalic === other.isItalic && this.isUnderlined === other.isUnderlined
      && this.stackedFractionType === other.stackedFractionType && this.stackedFractionScale === other.stackedFractionScale
      && this.subScriptOffsetFactor === other.subScriptOffsetFactor && this.subScriptScale === other.subScriptScale
      && this.superScriptOffsetFactor === other.superScriptOffsetFactor && this.superScriptScale === other.superScriptScale
      && this.tabInterval === other.tabInterval && this.indentation === other.indentation
      && this.listMarker.case === other.listMarker.case && this.listMarker.enumerator === other.listMarker.enumerator && this.listMarker.terminator === other.listMarker.terminator
      && this.justification === other.justification
      && this.leaderEquals(other.leader)
      && this.frameEquals(other.frame)
      && this.marginsEqual(other.margins);
  }

  /**
   * Returns a list of validation errors for this instance.
   *
   * A TextStyleSettings object may contain values that are invalid in all contexts.
   * If this method returns any error strings, using the settings will likely result in rendering failures or runtime exceptions.
   *
   * This method only checks for universally invalid values. Additional domain-specific validation may be required depending on the context in which these settings are used.
   *
   * @returns An array of error strings describing the invalid values, or an empty array if the settings are valid.
   */
  public getValidationErrors(): string[] {
    const errorMessages: string[] = [];
    if (this.font.name.trim() === "") {
      errorMessages.push("font name must be provided");
    }

    if (this.textHeight <= 0) {
      errorMessages.push("textHeight must be greater than 0");
    }

    if (this.stackedFractionScale <= 0) {
      errorMessages.push("stackedFractionScale must be greater than 0");
    }

    return errorMessages;
  }
}

deepFreeze(TextStyleSettings.defaultProps);
deepFreeze(TextStyleSettings.defaults);