/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import type {
  BasePropertyEditorParams, ColorEditorParams, ImageCheckBoxParams, PropertyEditorParams, RangeEditorParams, SuppressLabelEditorParams} from "./EditorParams";
import { PropertyEditorParamTypes,
} from "./EditorParams";
import { StandardEditorNames } from "./StandardEditorNames";
import { StandardTypeNames } from "./StandardTypeNames";

// cSpell:ignore Picklist

/**
 * Information about an enumeration choice
 * @public
 */
export interface EnumerationChoice {
  label: string;
  value: string | number;
}

/**
 * Information about a set of enumeration choices
 * @public
 */
export interface EnumerationChoicesInfo {
  choices: Promise<EnumerationChoice[]> | EnumerationChoice[];
  isStrict?: boolean;
  maxDisplayedRows?: number;
}

/**
 * Property renderer identification and customization attributes
 * @public
 */
export interface PropertyRendererInfo {
  name: string;
}

/**
 * Information about a Property Editor
 * @public
 */
export interface PropertyEditorInfo {
  /** Editor name used in addition to the typename to find the registered property editor */
  name?: string;
  /** Editor params provided to the property editor */
  params?: PropertyEditorParams[];
}

/**
 * Information about a Property Converter
 * @public
 */
export interface PropertyConverterInfo {
  /** Converter name used in addition to the typename to find the registered property converter */
  name?: string;
  /** map of options for type converter */
  options?: { [key: string]: any };
}

/**
 * [[PropertyDescription]] contains metadata about a Property
 * @public
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
  /**
   * Should property label for composite (struct & array) properties be rendered.
   * @alpha
   */
  hideCompositePropertyLabel?: boolean;
}

/** Helper class that builds property descriptions for specific PropertyEditors and processes descriptions.
 * @public
 */
export class PropertyDescriptionHelper {
  /** Builds a number description with a "weight-picker" editor name
   * @public
   */
  public static buildWeightPickerDescription(name: string, label: string, additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    return {
      name,
      displayLabel: label,
      typename: StandardTypeNames.Number,
      editor: {
        name: StandardEditorNames.WeightPicker,
        params: additionalParams,
      },
    };
  }

  /** Builds an editor that uses [NumberInput]($core-react) control
   * @public
   */
  public static buildNumberEditorDescription(name: string, label: string, overrideParams?: RangeEditorParams, additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    const editorParams = [{
      type: PropertyEditorParamTypes.Range,
      step: 1,
      precision: 0,
      ...overrideParams,
    } as RangeEditorParams, ...additionalParams];

    const editor = {
      name: StandardEditorNames.NumericInput,
      params: editorParams,
    };

    return {
      name,
      displayLabel: label,
      typename: StandardTypeNames.Number,
      editor,
    };
  }

  /** Builds a string description
   * @public
   */
  public static buildTextEditorDescription(name: string, label: string, additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    const editor = {
      params: additionalParams,
    };

    return {
      name,
      displayLabel: label,
      typename: StandardTypeNames.String,
      editor,
    };
  }

  /** Builds an enum description
   * @public
   */
  public static buildEnumPicklistEditorDescription(name: string, label: string,
    choices: Promise<EnumerationChoice[]> | EnumerationChoice[],
    additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    const editor = additionalParams.length ? {
      params: additionalParams,
    } : undefined;

    return {
      name,
      displayLabel: label,
      typename: StandardTypeNames.Enum,
      editor,
      enum: {
        choices,
      },
    };
  }

  /** Builds a number description for a tool settings or dialog property that will display a "color-picker" control.
   * @public
   */
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
      typename: StandardTypeNames.Number,
      editor: {
        name: StandardEditorNames.ColorPicker,
        params: editorParams,
      },
    };
  }

  /** Builds a boolean description for a tool settings or dialog property that will display a "toggle" control.
   * @public
   */
  public static buildToggleDescription(name: string, label: string, additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    return {
      name,
      displayLabel: label,
      typename: StandardTypeNames.Boolean,
      editor: {
        name: StandardEditorNames.Toggle,
        params: additionalParams,
      },
    };
  }

  /** Builds a boolean description for a tool settings or dialog property that will display a "image-check-box" control.
   * @public
   */
  public static buildImageCheckBoxDescription(name: string, label: string, imageOff: string, imageOn: string, additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    const editorParams = [{
      type: PropertyEditorParamTypes.CheckBoxImages,
      imageOff,
      imageOn,
    } as ImageCheckBoxParams, ...additionalParams];

    return {
      name,
      displayLabel: label,
      typename: StandardTypeNames.Boolean,
      editor: {
        name: StandardEditorNames.ImageCheckBox,
        params: editorParams,
      },
    };
  }

  /** Builds a boolean description for a tool settings or dialog property that will display a checkbox control.
   * @public
   */
  public static buildCheckboxDescription(name: string, label: string, additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    const editor = {
      params: additionalParams,
    };

    return {
      name,
      displayLabel: label,
      typename: StandardTypeNames.Boolean,
      editor,
    };
  }

  /** Builds a property description for a tool settings or dialog `lock` property. This will create a checkbox control with no label.
   * @public
   */
  public static buildLockPropertyDescription(name: string, additionalParams: BasePropertyEditorParams[] = []): PropertyDescription {
    const defaultParams = {
      type: PropertyEditorParamTypes.SuppressEditorLabel,
      suppressLabelPlaceholder: true,
    } as SuppressLabelEditorParams;

    const editor = {
      params: [defaultParams, ...additionalParams],
    };

    return {
      name,
      displayLabel: "",
      typename: StandardTypeNames.Boolean,
      editor,
    };
  }

  /** Bumps an enum property description value
   * @public
   */
  public static async bumpEnumProperty(description: PropertyDescription, value: string | number): Promise<string | number> {
    let choices: EnumerationChoice[] | undefined;

    if (description.enum) {
      if (description.enum.choices instanceof Promise) {
        choices = await description.enum.choices;
      } else {
        choices = description.enum.choices;
      }
    }

    if (!choices || choices.length === 0)
      return value;

    let choiceIndex = choices.findIndex((choice) => choice.value === value);
    if (choiceIndex < 0)
      return value;

    choiceIndex++;
    if (choiceIndex >= choices.length)
      choiceIndex = 0;

    const newValue = choices[choiceIndex].value;
    return newValue;
  }
}
