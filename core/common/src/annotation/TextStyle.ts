/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { ColorDefProps } from "../ColorDef";

/** Specifies how to separate the numerator and denominator of a [[FractionRun]], by either a horizontal or diagonal bar.
 * @see [[TextStyleSettingsProps.stackedFractionType]] and [[TextStyleSettings.stackedFractionType]].
 * @beta
 * @preview
 * @extensions
 */
export type StackedFractionType = "horizontal" | "diagonal";

/** Describes the color in which to draw the text in a [[TextRun]].
 * "subcategory" indicates that the text should be drawn using the color of the [SubCategory]($backend) specified by the [GeometryStream]($docs/learning/common/GeometryStream.md) hosting the
 * text.
 * @beta
 * @preview
 * @extensions
 */
export type TextStyleColor = ColorDefProps | "subcategory";

/** Serves both as the JSON representation of a [[TextStyleSettings]], and a way for a [[TextBlockComponent]] to selectively override aspects of a [[TextStyle]]'s properties.
 * @beta
 * @preview
 * @extensions
 */
export interface TextStyleSettingsProps {
  /** The color of the text.
   * Default: "subcategory".
   */
  color?: TextStyleColor;
  /** The name of a font stored in a [Workspace]($backend), used to draw the contents of a [[TextRun]].
   * Default: "" (an invalid font name).
   * @note Font names must be unique within a workspace. Uniqueness is semi-case-insensitive per [SQLite's NOCASE collating function](https://www.sqlite.org/datatype3.html#collating_sequences): namely,
   * the letters A through Z are compared without regard to case, so that "Arial", "arial", and "ARiaL" all refer to the same font.
   * ###TODO obtain clarity on collation rules.
   */
  fontName?: string;
  /** The height each line of text, in meters. Many other settings use the line height as the basis for computing their own values.
   * For example, the height and offset from baseline of a subscript [[TextRun]]  are compuated as lineHeight * [[subScriptScale]] and
   * lineHeight * [[subScriptOffsetFactor]], respectively.
   * Default: 1.0. */
  lineHeight?: number;
  /** Multiplier used to compute the vertical distance between two lines of text.
   * The distance is computed in meters as lineSpacingFactor * [[lineHeight]].
   * Default: 0.5.
   */
  lineSpacingFactor?: number;
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
   * The height is computed in meters as stackedFractionScale * [[lineHeight]].
   * Default: 0.7.
   */
  stackedFractionScale?: number;
  /** Specifies how to separate the numerator and denominator of a [[FractionRun]].
   * Default: "horizontal".
   */
  stackedFractionType?: StackedFractionType;
  /** Multiplier used to compute the vertical offset from the baseline for a subscript [[TextRun]].
   * The offset is computed in meters as subScriptOffsetFactor * [[lineHeight]].
   * Default: -0.15.
   */
  subScriptOffsetFactor?: number;
  /** Multiplier used to compute the height of a subscript [[TextRun]].
   * The height is computed as subScriptScale * [[lineHeight]].
   * Default: 2/3
   */
  subScriptScale?: number;
  /** Multiplier used to compute the vertical offset from the baseline for a super [[TextRun]].
   * The offset is computed in meters as superScriptOffsetFactor * [[lineHeight]].
   * Default: -0.5.
   */
  superScriptOffsetFactor?: number;
  /** Multiplier used to compute the height of a superscript [[TextRun]].
   * The height is computed as superScriptScale * [[lineHeight]].
   * Default: 2/3
   */
  superScriptScale?: number;
  /** A scale applied to the width of each glyph.
   * Default: 1.0
   */
  widthFactor?: number;
}

/** A description of the formatting to be applied to a [[TextBlockComponent]].
 * Named instances of these settings can be stored as [[TextStyle]]s in a [Workspace]($backend).
 * @note This is an immutable type. Use [[clone]] to create a modified copy.
 * @see [[TextStyleSettingsProps]] for documentation of each of the settings.
 * @beta
 * @preview
 * @extensions
 */
export class TextStyleSettings {
  /** The color of the text. */
  public readonly color: TextStyleColor;
  /** The name of a font stored in a [Workspace]($backend), used to draw the contents of a [[TextRun]].
   * @note Font names must be unique within a workspace. Uniqueness is semi-case-insensitive per [SQLite's NOCASE collating function](https://www.sqlite.org/datatype3.html#collating_sequences): namely,
   * the letters A through Z are compared without regard to case, so that "Arial", "arial", and "ARiaL" all refer to the same font.
   * ###TODO obtain clarity on collation rules.
   */
  public readonly fontName: string;
  /** The height each line of text, in meters. Many other settings use the line height as the basis for computing their own values.
   * For example, the height and offset from baseline of a subscript [[TextRun]]  are compuated as lineHeight * [[subScriptScale]] and
   * lineHeight * [[subScriptOffsetFactor]], respectively.
   */
  public readonly lineHeight: number;
  /** Multiplier used to compute the vertical distance between two lines of text.
   * The distance is computed in meters as lineSpacingFactor * [[lineHeight]].
   */
  public readonly lineSpacingFactor: number;
  /** Specifies whether the content of a [[TextRun]] should be rendered **bold**. */
  public readonly isBold: boolean;
  /** Specifies whether the content of a [[TextRun]] should be rendered in *italics*. */
  public readonly isItalic: boolean;
  /** Specifies whether the content of a [[TextRun]] should be underlined. */
  public readonly isUnderlined: boolean;
  /** Multiplier used to compute the height of both the numerator and denominator of a [[FractionRun]].
   * The height is computed in meters as stackedFractionScale * [[lineHeight]].
   */
  public readonly stackedFractionScale: number;
  /** Specifies how to separate the numerator and denominator of a [[FractionRun]]. */
  public readonly stackedFractionType: StackedFractionType;
  /** Multiplier used to compute the vertical offset from the baseline for a subscript [[TextRun]].
   * The offset is computed in meters as subScriptOffsetFactor * [[lineHeight]].
   */
  public readonly subScriptOffsetFactor: number;
  /** Multiplier used to compute the height of a subscript [[TextRun]].
   * The height is computed as subScriptScale * [[lineHeight]].
   */
  public readonly subScriptScale: number;
  /** Multiplier used to compute the vertical offset from the baseline for a super [[TextRun]].
   * The offset is computed in meters as superScriptOffsetFactor * [[lineHeight]].
   */
  public readonly superScriptOffsetFactor: number;
  /** Multiplier used to compute the height of a superscript [[TextRun]].
   * The height is computed as superScriptScale * [[lineHeight]].
   */
  public readonly superScriptScale: number;
  /** Multiplier used to compute the width of each glyph.
   * The width in meters is computed as widthFactor * [[lineHeight]].
   * ###TODO Obtain clarity.
   */
  public readonly widthFactor: number;

  /** A fully-populated JSON representation of the default settings. */
  public static defaultProps: Readonly<Required<TextStyleSettingsProps>> = {
    color: "subcategory",
    fontName: "",
    lineHeight: 1,
    lineSpacingFactor: 0.5,
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
  };

  /** Settings initialized to all default values. */
  public static defaults: TextStyleSettings = new TextStyleSettings({ });

  private constructor(props: TextStyleSettingsProps, defaults?: Required<TextStyleSettingsProps>) {
    if (!defaults) {
      defaults = TextStyleSettings.defaultProps;
    }

    this.color = props.color ?? defaults.color;
    this.fontName = props.fontName ?? defaults.fontName;
    this.lineHeight = props.lineHeight ?? defaults.lineHeight;
    this.lineSpacingFactor = props.lineSpacingFactor ?? defaults.lineSpacingFactor;
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
  }

  /** Create a copy of these settings, modified according to the properties defined by `alteredProps`. */
  public clone(alteredProps?: TextStyleSettingsProps): TextStyleSettings {
    return alteredProps ? new TextStyleSettings(alteredProps, this) : this;
  }

  /** Create settings from their JSON representation. */
  public static fromJSON(props?: TextStyleSettingsProps): TextStyleSettings {
    return props ? new TextStyleSettings(props) : TextStyleSettings.defaults;
  }

  public equals(other: TextStyleSettings): boolean {
    return this.color === other.color && this.fontName === other.fontName
      && this.lineHeight === other.lineHeight && this.lineSpacingFactor === other.lineSpacingFactor && this.widthFactor === other.widthFactor
      && this.isBold === other.isBold && this.isItalic === other.isItalic && this.isUnderlined === other.isUnderlined
      && this.stackedFractionType === other.stackedFractionType && this.stackedFractionScale === other.stackedFractionScale
      && this.subScriptOffsetFactor === other.subScriptOffsetFactor && this.subScriptScale === other.subScriptScale
      && this.superScriptOffsetFactor === other.superScriptOffsetFactor && this.superScriptScale === other.superScriptScale;
  }
}

Object.freeze(TextStyleSettings.defaultProps);
Object.freeze(TextStyleSettings.defaults);

/** The JSON representation of a [[TextStyle]].
 * @beta
 * @preview
 * @extensions
 */
export interface TextStyleProps {
  /** The name of the style. */
  name: string;
  /** The settings defined for the style. Any omitted properties will use their default values, as described by [[TextStyleSettingsProps]]. */
  settings?: TextStyleSettingsProps;
}

/** ###TODO
 * @note This is an immutable type. Use [[clone]] to create a modified copy.
 * @beta
 * @preview
 * @extensions
 */
export class TextStyle {
  public readonly name: string;
  public readonly settings: TextStyleSettings;

  private constructor(name: string, settings: TextStyleSettings) {
    this.name = name;
    this.settings = settings;
  }

  /** Create a style from its JSON representation. */
  public static fromJSON(json: TextStyleProps): TextStyle {
    return TextStyle.create(json.name, TextStyleSettings.fromJSON(json.settings));
  }

  /** Create a new style. */
  public static create(name: string, settings: TextStyleSettings): TextStyle {
    return new TextStyle(name, settings);
  }

  /** Create a copy of this style with the same name, and settings modified according to the properties defined by `alteredSettings`. */
  public clone(alteredSettings: TextStyleSettingsProps): TextStyle {
    return TextStyle.create(this.name, this.settings.clone(alteredSettings));
  }

  public equals(other: TextStyle): boolean {
    return this.name === other.name && this.settings.equals(other.settings);
  }
}

