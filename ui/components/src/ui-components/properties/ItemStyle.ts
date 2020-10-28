/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { CSSProperties } from "react";

/** Converts a color value from a number to an HTML/CSS hex string */
const colorDecimalToHex = (decimal: number) => `#${decimal.toString(16).padStart(6, "0")}`;

/** Style properties for styled item like [[CellItem]] and [[TreeNodeItem]]
 * @public
 */
export interface ItemStyle {
  /** Is text bolded */
  isBold?: boolean;
  /** Is text italic */
  isItalic?: boolean;
  /** Color overrides for styled item */
  colorOverrides?: ItemColorOverrides;
}

/** Color overrides for styled item
 * @public
 */
export interface ItemColorOverrides {
  /** Text/foreground color */
  color?: number;
  /** Background color */
  backgroundColor?: number;
  /** Selected item text/foreground color */
  colorSelected?: number;
  /** Selected item background color */
  backgroundColorSelected?: number;
}

function getBackgroundColor(isSelected: boolean, colorOverrides?: ItemColorOverrides) {
  if (!colorOverrides)
    return undefined;

  if (isSelected)
    return colorOverrides.backgroundColorSelected !== undefined
      ? colorDecimalToHex(colorOverrides.backgroundColorSelected)
      : undefined;

  if (colorOverrides.backgroundColor)
    return colorDecimalToHex(colorOverrides.backgroundColor);

  return undefined;
}

function getForegroundColor(isSelected: boolean, colorOverrides?: ItemColorOverrides) {
  if (!colorOverrides)
    return undefined;

  if (isSelected)
    return colorOverrides.colorSelected !== undefined
      ? colorDecimalToHex(colorOverrides.colorSelected)
      : undefined;

  if (colorOverrides.color)
    return colorDecimalToHex(colorOverrides.color);

  return undefined;
}

/**
 * Style provider for stylable items like [[CellItem]] and [[TreeNodeItem]]
 * @public
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ItemStyleProvider = {
  /**
   * Create CSS style from [[ItemStyle]]
   */
  createStyle: ({ colorOverrides, isBold, isItalic }: ItemStyle, isSelected?: boolean): CSSProperties => ({
    color: getForegroundColor(!!isSelected, colorOverrides),
    backgroundColor: getBackgroundColor(!!isSelected, colorOverrides),
    fontWeight: isBold ? "bold" : undefined,
    fontStyle: isItalic ? "italic" : undefined,
  }),
};

/**
 * Style provider for table rows
 * @public
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const TableRowStyleProvider = {
  /**
   * Create CSS style from [[ItemStyle]]
   */
  createStyle: ({ color, backgroundColor }: ItemColorOverrides): CSSProperties => ({
    color: color ? colorDecimalToHex(color) : undefined,
    backgroundColor: backgroundColor ? colorDecimalToHex(backgroundColor) : undefined,
  }),
};
