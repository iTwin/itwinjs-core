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

export interface TextStyleProperties {
  /** Default: use subcategory color */
  color?: ColorDefProps;
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

export type FullTextStyleProperties = TextStyleProperties & Required<Omit<TextStyleProperties, "color">>;

export namespace TextStyleProperties {
  export function cloneWithDefaults(props: TextStyleProperties): FullTextStyleProperties {
    return {
      color: props.color,
      font: props.font ?? 0,
      height: props.height ?? 1,
      lineSpacingFactor: props.lineSpacingFactor ?? 0.5,
      isBold: true === props.isBold,
      isItalic: true === props.isItalic,
      isUnderlined: true === props.isUnderlined,
      stackedFractionScale: props.stackedFractionScale ?? 0.7,
      stackedFractionType: props.stackedFractionType ?? "horizontal",
      subScriptOffsetFactor: props.subScriptOffsetFactor ?? -0.15,
      subScriptScale: props.subScriptScale ?? 2 / 3,
      superScriptOffsetFactor: props.superScriptOffsetFactor ?? 0.5,
      superScriptScale: props.superScriptScale ?? 2 / 3,
      widthFactor: props.widthFactor ?? 1,
    };
  }
}

export interface TextStyleProps {
  name: string;
  properties?: TextStyleProperties;
}

export class TextStyle {
  public name: string;
  public properties: FullTextStyleProperties;

  private constructor(name: string, properties: FullTextStyleProperties) {
    this.name = name;
    this.properties = properties;
  }

  public static fromJSON(json: TextStyleProps): TextStyle {
    return TextStyle.create(json.name, json.properties);
  }

  public static create(name: string, properties?: TextStyleProperties): TextStyle {
    return new TextStyle(name, TextStyleProperties.cloneWithDefaults(properties ?? { }));
  }
}

