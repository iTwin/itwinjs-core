/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { BasePropertyEditorParams, ColorEditorParams, ImageCheckBoxParams, PropertyEditorParams, PropertyEditorParamTypes } from "./EditorParams";

/**
 * Information about an enumeration choice
 * @beta
 */
export interface EnumerationChoice {
  label: string;
  value: string | number;
}

/**
 * Information about a set of enumeration choices
 * @beta
 */
export interface EnumerationChoicesInfo {
  choices: Promise<EnumerationChoice[]> | EnumerationChoice[];
  isStrict?: boolean;
  maxDisplayedRows?: number;
}

/**
 * Property renderer identification and customization attributes
 * @beta
 */
export interface PropertyRendererInfo {
  name: string;
}

/**
 * Information about a Property Editor
 * @beta
 */
export interface PropertyEditorInfo {
  /** Editor name used in addition to the typename to find the registered property editor */
  name?: string;
  /** Editor params provided to the property editor */
  params?: PropertyEditorParams[];
}

/**
 * Information about a Property Converter
 * @beta
 */
export interface PropertyConverterInfo {
  /** Converter name used in addition to the typename to find the registered property converter */
  name?: string;
  /** map of options for type converter */
  options?: { [key: string]: any };
}

/**
 * [[PropertyDescription]] contains metadata about a Property
 * @beta
 */
export interface PropertyDescription {
  /** Name of the property description */
  name: string;
  /** Display label for the property description */
  displayLabel: string;
  /** Type name used to determine applicable Type Converter and Property Editor */
  typename: string;
  /** Additional information for enumerations */
  enum?: EnumerationChoicesInfo;
  /** Information for property renderer customization */
  renderer?: PropertyRendererInfo;
  /** Information for a property editor */
  editor?: PropertyEditorInfo;
  /** Information for a property converter */
  converter?: PropertyConverterInfo;
  /** Quantity type key used to look up formatting and parsing specs. This is typically either the name of a quantity type used by a tool
   *  or the full name of a KOQ (schema:koq).
   * @alpha
   */
  quantityType?: string;
  /** Get the custom DataController by this name and register it with the property editor */
  dataController?: string;
}

/** Helper class the builds property descriptions that specify specific PropertyEditors
 * @alpha
 */
export class PropertyDescriptionHelper {
  public static buildWeightPickerDescription(name: string, label: string, additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    return {
      name,
      displayLabel: label,
      typename: "number",
      editor: {
        name: "weight-picker",
        params: additionalParams,
      },
    };
  }

  public static buildTextEditorDescription(name: string, label: string, additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    const editor = {
      params: additionalParams,
    };

    return {
      name,
      displayLabel: label,
      typename: "string",
      editor,
    };
  }

  public static buildEnumPicklistEditorDescription(name: string, label: string,
    choices: Promise<EnumerationChoice[]> | EnumerationChoice[],
    additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    const editor = additionalParams.length ? {
      params: additionalParams,
    } : undefined;

    return {
      name,
      displayLabel: label,
      typename: "enum",
      editor,
      enum: {
        choices,
      },
    };
  }

  public static buildColorPickerDescription(name: string, label: string, colorValues: number[], numColumns: number,
    additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    const editorParams = [
      {
        type: PropertyEditorParamTypes.ColorData,
        colorValues,
        numColumns,
      } as ColorEditorParams,
      ...additionalParams,
    ];

    return {
      name,
      displayLabel: label,
      typename: "number",
      editor: {
        name: "color-picker",
        params: editorParams,
      },
    };
  }

  public static buildToggleDescription(name: string, label: string, additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    return {
      name,
      displayLabel: label,
      typename: "boolean",
      editor: {
        name: "toggle",
        params: additionalParams,
      },
    };
  }

  public static buildImageCheckBoxDescription(name: string, label: string, imageOff: string, imageOn: string, additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    const editorParams = [{
      type: PropertyEditorParamTypes.CheckBoxImages,
      imageOff,
      imageOn,
    } as ImageCheckBoxParams, ...additionalParams];

    return {
      name,
      displayLabel: label,
      typename: "boolean",
      editor: {
        name: "image-check-box",
        params: editorParams,
      },
    };
  }

  public static buildCheckboxDescription(name: string, label: string, additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    const editor = {
      params: additionalParams,
    };

    return {
      name,
      displayLabel: label,
      typename: "boolean",
      editor,
    };
  }
}
