/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormatting
 */

import { FormatProps } from "@itwin/core-quantity";

/** Properties that define an EditorSpec for editing a custom formatting property that is stored in the "custom" property in the FormatProps.
 * The editor controls will be automatically generated in the UI and are limited to a checkbox to set a boolean value, a text dropdown/select
 * component to pick a string value from a list of options, and a text input component that returns a string value.
 * @public
 */
export interface CustomFormatPropEditorSpec {
  editorType: "checkbox" | "text" | "select";
  label: string;
}

/** CheckboxFormatPropEditorSpec defines getter and setter method for a boolean property editor.
 * @public
 */
export interface CheckboxFormatPropEditorSpec extends CustomFormatPropEditorSpec {
  editorType: "checkbox";
  getBool: (props: FormatProps) => boolean;
  setBool: (props: FormatProps, isChecked: boolean) => FormatProps;
}

/** CheckboxFormatPropEditorSpec type guard.
 * @public
 */
export const isCheckboxFormatPropEditorSpec = (item: CustomFormatPropEditorSpec): item is CheckboxFormatPropEditorSpec => {
  return item.editorType === "checkbox";
};

/** TextInputFormatPropEditorSpec defines getter and setter method for a text input property editor.
 * @public
 */
export interface TextInputFormatPropEditorSpec extends CustomFormatPropEditorSpec {
  editorType: "text";
  getString: (props: FormatProps) => string;
  setString: (props: FormatProps, value: string) => FormatProps;
}

/** TextInputFormatPropEditorSpec type guard.
 * @public
 */
export const isTextInputFormatPropEditorSpec = (item: CustomFormatPropEditorSpec): item is TextInputFormatPropEditorSpec => {
  return item.editorType === "text";
};

/** TextSelectFormatPropEditorSpec defines getter and setter method for a Select/Dropdown property editor.
 * @public
 */
export interface TextSelectFormatPropEditorSpec extends CustomFormatPropEditorSpec {
  editorType: "select";
  selectOptions: { label: string; value: string }[];
  getString: (props: FormatProps) => string;
  setString: (props: FormatProps, value: string) => FormatProps;
}

/** TextSelectFormatPropEditorSpec type guard.
 * @public
 */
export const isTextSelectFormatPropEditorSpec = (item: CustomFormatPropEditorSpec): item is TextSelectFormatPropEditorSpec => {
  return item.editorType === "select";
};
