/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

/**
 * Enumeration for Property Editor Param Types
 */
export enum PropertyEditorParamTypes {
  ButtonGroupData,
  CheckBoxIcons,
  Icon,
  InputEditorSize,
  JSON,
  MultilineText,
  Range,
  Slider,
  SuppressUnitLabel,
  SuppressEditorLabel,
}

/**
 * Base interface for Property Editor Params
 */
export interface BasePropertyEditorParams {
  type: PropertyEditorParamTypes;
}

/**
 * Parameters used by PropertyEditors that support JSON.
 */
export interface JsonEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.JSON;
  json: any;
}

/**
 * Parameters used by PropertyEditors that support defining a minimum and maximum value.
 */
export interface RangeEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.Range;
  /** Optionally define the minimum value. */
  minimum?: number;
  /** Optionally define the maximum value. */
  maximum?: number;
}

/**
 * Parameters used by PropertyEditors that use HTML <input> element.
 */
export interface InputEditorSizeParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.InputEditorSize;
  /** Optionally define the width in characters. */
  size?: number;
  /** Optionally define the maximum number of characters allowed. */
  maxLength?: number;
}

/**
 * Parameters used to indicate that a Slider should be presented for the property
 * and to specify the values needed by the slider.
 */
export interface SliderEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.Slider;
  /** Defines the minimum value. */
  minimum: number;
  /** Defines the maximum value. */
  maximum: number;
  /** Show buttons at intervals, requires NumButtons to be set. */
  intervals?: boolean;
  /** Number of interval buttons to display */
  numButtons?: number;
  /** If Vertical is set, the slider will display in a vertical orientation, default is to draw Horizontally. */
  vertical?: boolean;
  /** Since slider must work with integer values define factor used to produce a integer (0.1=10, 0.01=100, 0.001=1000). */
  valueFactor?: number;
}

/**
 * Parameter that is used to indicate that a multiline text editor should be created.
 * The number of rows specified will determine the height of the editor control.
 */
export interface MultilineTextEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.MultilineText;
  heightInRows: number;
}

/**
 * Information about an icon displayed next to a property editor.
 */
export interface IconDefinition {
  /** icon class name. */
  iconClass: string;
  isEnabledFunction?: () => boolean;
}

/**
 * Parameters used by EnumButtonGroupEditor to define icons in button group.
 */
export interface ButtonGroupEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.ButtonGroupData;
  buttons: IconDefinition[];
}

/**
 * Parameters used to display an icon next to property editor.
 */
export interface IconEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.Icon;
  definition: IconDefinition;
}

/**
 * Parameters used with boolean properties to indicate icon overrides.
 */
export interface CheckBoxIconsEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.CheckBoxIcons;
  onIconDefinition?: IconDefinition;
  offIconDefinition?: IconDefinition;
}

/**
 * Parameter used to suppress Unit labels
 */
export interface SuppressUnitLabelEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.SuppressUnitLabel;
}

/**
 * Parameters used to suppress the label for a type editor in the ToolSettings widget.
 */
export interface SuppressLabelEditorParams extends BasePropertyEditorParams {
  type: PropertyEditorParamTypes.SuppressEditorLabel;
  /** if false then an empty placeholder label is created. This is sometimes necessary to align editor in proper column */
  suppressLabelPlaceholder?: boolean;
}

/**
 * Type definition for all Property Editor params
 */
export type PropertyEditorParams = JsonEditorParams | RangeEditorParams | SliderEditorParams | ButtonGroupEditorParams
  | MultilineTextEditorParams | IconEditorParams | CheckBoxIconsEditorParams | SuppressUnitLabelEditorParams
  | SuppressLabelEditorParams | InputEditorSizeParams;
