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
 * @extensions
 */
export type StackedFractionType = "horizontal" | "diagonal";

/** Describes the color in which to draw the text in a [[TextRun]].
 * "subcategory" indicates that the text should be drawn using the color of the [SubCategory]($backend) specified by the [GeometryStream]($docs/learning/common/GeometryStream.md) hosting the
 * text.
 * @beta
 * @extensions
 */
export type TextStyleColor = ColorDefProps | "subcategory";

/** Serves both as the JSON representation of a [[TextStyleSettings]], and a way for a [[TextBlockComponent]] to selectively override aspects of a [[TextStyle]]'s properties.
 * @beta
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
   */
  fontName?: string;
  /** Default: 1.0 */
  height?: number;
  /** Default: 0.5 */
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
  /** Default: 0.7 */
  stackedFractionScale?: number;
  /** Specifies how to separate the numerator and denominator of a [[FractionRun]].
   * Default: "horizontal".
   */
  stackedFractionType?: StackedFractionType;
  /** Default: -0.15 */
  subScriptOffsetFactor?: number;
  /** Default: 2/3 */
  subScriptScale?: number;
  /** Default: 0.5 */
  superScriptOffsetFactor?: number;
  /** Default: 2/3 */
  superScriptScale?: number;
  /** Default: 1.0 */
  widthFactor?: number;
}

/** A description of the formatting to be applied to a [[TextBlockComponent]].
 * Named instances of these settings can be stored as [[TextStyle]]s in a [Workspace]($backend).
 * @note This is an immutable type. Use [[clone]] to create a modified copy.
 * @see [[TextStyleSettingsProps]] for documentation of each of the settings.
 * @beta
 * @extensions
 */
export class TextStyleSettings {
  public readonly color: TextStyleColor;
  public readonly fontName: string;
  public readonly height: number;
  public readonly lineSpacingFactor: number;
  public readonly isBold: boolean;
  public readonly isItalic: boolean;
  public readonly isUnderlined: boolean;
  public readonly stackedFractionScale: number;
  public readonly stackedFractionType: StackedFractionType;
  public readonly subScriptOffsetFactor: number;
  public readonly subScriptScale: number;
  public readonly superScriptOffsetFactor: number;
  public readonly superScriptScale: number;
  public readonly widthFactor: number;

  /** A fully-populated JSON representation of the default settings. */
  public static defaultProps: Readonly<Required<TextStyleSettingsProps>> = {
    color: "subcategory",
    fontName: "",
    height: 1,
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
    this.height = props.height ?? defaults.height;
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
}

Object.freeze(TextStyleSettings.defaultProps);
Object.freeze(TextStyleSettings.defaults);

/** The JSON representation of a [[TextStyle]].
 * @beta
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
}

