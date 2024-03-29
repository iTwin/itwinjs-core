/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { ColorDefProps } from "../ColorDef";
import { FontId } from "../Fonts";

export type StackedFractionType = "horizontal" | "diagonal";

export interface TextStyleSettingsProps {
  /** Default: use subcategory color */
  color?: ColorDefProps | "subcategory";
  /** Default: 0 (no font specified). */
  font?: FontId | string;
  /** Default: 1.0 */
  height?: number;
  /** Default: 0.5 */
  lineSpacingFactor?: number;
  /** Default: false */
  isBold?: boolean;
  /** Default: false */
  isItalic?: boolean;
  /** Default: false */
  isUnderlined?: boolean;
  /** Default: 0.7 */
  stackedFractionScale?: number;
  /** Default: "horizontal" */
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

export class TextStyleSettings {
  public readonly color: ColorDefProps | "subcategory";
  public readonly font: FontId | string;
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

  public static defaultProps: Readonly<Required<TextStyleSettingsProps>> = {
    color: "subcategory",
    font: 0,
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
  
  public static defaults: TextStyleSettings = new TextStyleSettings({ });

  private constructor(props: TextStyleSettingsProps, defaults?: Required<TextStyleSettingsProps>) {
    if (!defaults) {
      defaults = TextStyleSettings.defaultProps;
    }

    this.color = props.color ?? defaults.color;
    this.font = props.font ?? defaults.font;
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

  public clone(alteredProps?: TextStyleSettingsProps): TextStyleSettings {
    return alteredProps ? new TextStyleSettings(alteredProps, this) : this;
  }

  public static fromJSON(props: TextStyleSettingsProps | undefined): TextStyleSettings {
    return props ? new TextStyleSettings(props) : TextStyleSettings.defaults;
  }
}

Object.freeze(TextStyleSettings.defaultProps);
Object.freeze(TextStyleSettings.defaults);

export interface TextStyleProps {
  name: string;
  settings?: TextStyleSettingsProps;
}

export class TextStyle {
  public readonly name: string;
  public readonly settings: TextStyleSettings;

  private constructor(name: string, settings: TextStyleSettings) {
    this.name = name;
    this.settings = settings;
  }

  public static fromJSON(json: TextStyleProps): TextStyle {
    return TextStyle.create(json.name, TextStyleSettings.fromJSON(json.settings));
  }

  public static create(name: string, settings: TextStyleSettings): TextStyle {
    return new TextStyle(name, settings);
  }

  public clone(alteredSettings: TextStyleSettingsProps): TextStyle {
    return TextStyle.create(this.name, this.settings.clone(alteredSettings));
  }
}

