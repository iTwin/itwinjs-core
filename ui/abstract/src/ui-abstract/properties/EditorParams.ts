/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

/**
 * Enum for Property Editor Param Types
 * @beta
 */
export enum PropertyEditorParamTypes {
  ButtonGroupData = "UiAbstract-ButtonGroupData",
  CheckBoxIcons = "UiAbstract-CheckBoxIcons",
  Icon = "UiAbstract-Icon",
  InputEditorSize = "UiAbstract-InputEditorSize",
  ColorData = "UiAbstract-ColorData",
  CustomFormattedNumber = "UiAbstract-CustomFormattedNumber",
  IconListData = "UiAbstract-IconListData",
  // JSON = "UiAbstract-JSON",
  // MultilineText = "UiAbstract-MultilineText",
  // Range = "UiAbstract-Range",
  // Slider = "UiAbstract-Slider",
  // SuppressUnitLabel = "UiAbstract-SuppressUnitLabel",
  SuppressEditorLabel = "UiAbstract-SuppressEditorLabel",
}

/**
 * Base interface for Property Editor Params
 * @beta
 */
export interface BasePropertyEditorParams {
  type: string;
}

/**
 * Parameters used by PropertyEditors that use HTML <input> element.
 * @beta
 */
export interface InputEditorSizeParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.InputEditorSize;
  /** Optionally define the width in characters. */
  size?: number;
  /** Optionally define the maximum number of characters allowed. */
  maxLength?: number;
}

/** InputEditorSizeParams type guard.
 * @beta
 */
export const isInputEditorSizeParams = (item: BasePropertyEditorParams): item is InputEditorSizeParams => {
  return item.type === PropertyEditorParamTypes.InputEditorSize;
};

/**
 * Parameters used to populate color type editor with a specific set of colors. If not specified the Color
 * Editor will show a default palette of 16 colors.
 * @beta
 */
export interface ColorEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.ColorData;
  /** array of color values to show in color picker popup. Use [[ColorByName]] enum values. Values should be 32-bit integer in the form 0xBBGGRR. */
  colorValues: number[];
  /** number of columns to show in color picker popup. The value of 4 is used if not defined. */
  numColumns?: number;
}

/** ColorEditorParams type guard.
 * @beta
 */
export const isColorEditorParams = (item: BasePropertyEditorParams): item is ColorEditorParams => {
  return item.type === PropertyEditorParamTypes.ColorData;
};

/**
 * Parameters used to populate icon type editor with a specific set of icons.
 * @beta
 */
export interface IconListEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.IconListData;
  /** active icon shown in the button */
  iconValue: string;
  /** array of icon (svg) names to show in icon picker popup. */
  iconValues: string[];
  /** number of columns to show in icon picker popup. The value of 4 is used if not defined. */
  numColumns?: number;
}

/** IconListEditorParams type guard.
 * @beta
 */
export const isIconListEditorParams = (item: BasePropertyEditorParams): item is IconListEditorParams => {
  return item.type === PropertyEditorParamTypes.IconListData;
};

/**
 * Information about an icon displayed next to a property editor.
 * @beta
 */
export interface IconDefinition {
  /** Icon specification. The value is the name of an icon WebFont entry, or if specifying an SVG symbol, use `svg:` prefix. */
  iconSpec: string;
  /** Function to determine if the item is enabled. */
  isEnabledFunction?: () => boolean;
}

/**
 * Parameters used by EnumButtonGroupEditor to define icons in button group.
 * @beta
 */
export interface ButtonGroupEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.ButtonGroupData;
  buttons: IconDefinition[];
}

/** ButtonGroupEditorParams type guard.
 * @beta
 */
export const isButtonGroupEditorParams = (item: BasePropertyEditorParams): item is ButtonGroupEditorParams => {
  return item.type === PropertyEditorParamTypes.ButtonGroupData;
};

/**
 * Parameters used to suppress the label for a type editor in the ToolSettings widget.
 * @beta
 */
export interface SuppressLabelEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.SuppressEditorLabel;
  /** if false then an empty placeholder label is created. This is sometimes necessary to align editor in proper column */
  suppressLabelPlaceholder?: boolean;
}

/** SuppressLabelEditorParams type guard.
 * @beta
 */
export const isSuppressLabelEditorParams = (item: BasePropertyEditorParams): item is SuppressLabelEditorParams => {
  return item.type === PropertyEditorParamTypes.SuppressEditorLabel;
};

// /**
//  * Parameters used by PropertyEditors that support JSON.
//  * @alpha
//  */
// export interface JsonEditorParams extends BasePropertyEditorParams {
//   type: PropertyEditorParamTypes.JSON;
//   json: any;
// }
//
// /**
//  * Parameters used by PropertyEditors that support defining a minimum and maximum value.
//  * @alpha
//  */
// export interface RangeEditorParams extends BasePropertyEditorParams {
//   type: PropertyEditorParamTypes.Range;
//   /** Optionally define the minimum value. */
//   minimum?: number;
//   /** Optionally define the maximum value. */
//   maximum?: number;
// }
//
// /**
//  * Parameters used to indicate that a Slider should be presented for the property
//  * and to specify the values needed by the slider.
//  * @alpha
//  */
// export interface SliderEditorParams extends BasePropertyEditorParams {
//   type: PropertyEditorParamTypes.Slider;
//   /** Defines the minimum value. */
//   minimum: number;
//   /** Defines the maximum value. */
//   maximum: number;
//   /** Show buttons at intervals, requires NumButtons to be set. */
//   intervals?: boolean;
//   /** Number of interval buttons to display */
//   numButtons?: number;
//   /** If Vertical is set, the slider will display in a vertical orientation, default is to draw Horizontally. */
//   vertical?: boolean;
//   /** Since slider must work with integer values define factor used to produce a integer (0.1=10, 0.01=100, 0.001=1000). */
//   valueFactor?: number;
// }
//
// /**
//  * Parameter that is used to indicate that a multiline text editor should be created.
//  * The number of rows specified will determine the height of the editor control.
//  * @alpha
//  */
// export interface MultilineTextEditorParams extends BasePropertyEditorParams {
//   type: PropertyEditorParamTypes.MultilineText;
//   heightInRows: number;
// }
//
/**
 * Parameters used to display an icon next to property editor.
 * @alpha
 */
export interface IconEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.Icon;
  definition: IconDefinition;
}
//
// /**
//  * Parameters used with boolean properties to indicate icon overrides.
//  * @alpha
//  */
// export interface CheckBoxIconsEditorParams extends BasePropertyEditorParams {
//   type: PropertyEditorParamTypes.CheckBoxIcons;
//   onIconDefinition?: IconDefinition;
//   offIconDefinition?: IconDefinition;
// }
//
// /**
//  * Parameter used to suppress Unit labels
//  * @alpha
//  */
// export interface SuppressUnitLabelEditorParams extends BasePropertyEditorParams {
//   type: PropertyEditorParamTypes.SuppressUnitLabel;
// }

/**
 * defines Results of parsing a string input by a user into its desired value type
 * @beta
 */
export interface ParseResults {
  value?: string | number | boolean | {} | string[] | Date | [] | undefined;
  parseError?: string;
}

/**
 * Parameters used with properties that want to control parsing and formatting.
 * @beta
 */
export interface CustomFormattedNumberParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.CustomFormattedNumber;
  formatFunction: (numberValue: number) => string;
  parseFunction: (stringValue: string) => ParseResults;
}

/** CustomFormattedNumberParams type guard.
 * @beta
 */
export const isCustomFormattedNumberParams = (item: BasePropertyEditorParams): item is CustomFormattedNumberParams => {
  return item.type === PropertyEditorParamTypes.CustomFormattedNumber;
};

/**
 * Type definition for Property Editor params
 * @beta
 */
export type PropertyEditorParams = BasePropertyEditorParams;
