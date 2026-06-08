/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { Parser } from "@itwin/core-quantity";
import {
  type CustomFormattedNumberParams, type ParseResults, type PropertyDescription, type PropertyEditorParams, PropertyEditorParamTypes, StandardEditorNames, StandardTypeNames,
} from "@itwin/appui-abstract";
import { IModelApp } from "../IModelApp";

/**
 * Properties for [[createQuantityDescription]].
 * @beta
 */
export interface CreateQuantityDescriptionProps {
  /** The property name. */
  name: string;
  /** The display label shown in tool settings. */
  displayLabel: string;
  /**
   * The EC full name of the [KindOfQuantity](https://www.itwinjs.org/bis/ec/kindofquantity/) this property represents,
   * e.g. `"DefaultToolsUnits.LENGTH"` or `"DefaultToolsUnits.ANGLE"`.
   * See the [Common KindOfQuantity Mappings](https://www.itwinjs.org/learning/frontend/quantity-formatting/definitions/formatsets/#common-kindofquantity-mappings)
   * documentation for standard measurements.
   */
  kindOfQuantityName: string;
  /**
   * The EC full name of the persistence unit for values stored in this property, e.g. `"Units.M"` or `"Units.RAD"`.
   * Use [getDefaultPersistenceUnit]($quantity) with the appropriate [Phenomena]($quantity) to look this up
   * programmatically rather than hardcoding a string.
   */
  persistenceUnitName: string;
  /** Localized error string returned when the user's input cannot be parsed. */
  parseError: string;
}

/**
 * Creates a quantity-aware [PropertyDescription]($appui-abstract) for use in tool settings and UI components.
 *
 * Obtains a [FormatSpecHandle]($quantity) from the active [QuantityFormatter]($frontend), which automatically
 * reflects the current unit system and formatter registry. The handle provides synchronous `format` and `parse`
 * callbacks suitable for [CustomFormattedNumberParams]($appui-abstract) — no subclassing required.
 *
 * @see [Quantity Property Descriptions](https://www.itwinjs.org/learning/frontend/quantity-formatting/usage/parsingandformatting/#quantity-property-descriptions)
 * @beta
 */
export function createQuantityDescription(props: CreateQuantityDescriptionProps): PropertyDescription {
  const { name, displayLabel, kindOfQuantityName, persistenceUnitName, parseError } = props;
  const formatSpecHandle = IModelApp.quantityFormatter.getFormatSpecHandle(kindOfQuantityName, persistenceUnitName);
  const editorParams: PropertyEditorParams[] = [{
    type: PropertyEditorParamTypes.CustomFormattedNumber,
    formatFunction: (numberValue: number): string => {
      return formatSpecHandle.format(numberValue);
    },
    parseFunction: (userInput: string): ParseResults => {
      const parserSpec = formatSpecHandle.parserSpec;
      const parseResult = parserSpec?.parseToQuantityValue(userInput);
      if (parseResult && Parser.isParsedQuantity(parseResult))
        return { value: parseResult.value };

      return { parseError };
    },
  } as CustomFormattedNumberParams];

  return {
    name,
    displayLabel,
    kindOfQuantityName,
    typename: StandardTypeNames.Number,
    editor: {
      name: StandardEditorNames.NumberCustom,
      params: editorParams,
    },
  };
}
