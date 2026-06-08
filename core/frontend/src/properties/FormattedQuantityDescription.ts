/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { FormatterSpec, Parser, ParserSpec } from "@itwin/core-quantity";
import {
  BaseQuantityDescription, type CustomFormattedNumberParams, type ParseResults, type PropertyDescription, type PropertyEditorParams, PropertyEditorParamTypes, StandardEditorNames, StandardTypeNames,
} from "@itwin/appui-abstract";
import { IModelApp } from "../IModelApp";
import { QuantityType } from "../quantity-formatting/QuantityFormatter";

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
 * callbacks suitable for [CustomFormattedNumberParams]($appui-abstract). No subclassing required.
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

/**
 * @deprecated in 5.11.0. Use [[createQuantityDescription]] to build a plain [PropertyDescription]($appui-abstract) with synchronous formatting callbacks backed by a [FormatSpecHandle]($quantity).
 * @beta
 */
export interface FormattedQuantityDescriptionArgs {
  name: string;
  displayLabel: string;
  iconSpec?: string;
  kindOfQuantityName?: string;
}

/**
 * Base Quantity Property Description
 * @deprecated in 5.11.0. Use [[createQuantityDescription]] to build a plain [PropertyDescription]($appui-abstract) with synchronous formatting callbacks backed by a [FormatSpecHandle]($quantity).
 * @beta
 */
export abstract class FormattedQuantityDescription extends BaseQuantityDescription {
  private _formatterSpec?: FormatterSpec;
  private _parserSpec?: ParserSpec;

  constructor(args: FormattedQuantityDescriptionArgs); // eslint-disable-line @typescript-eslint/no-deprecated
  constructor(name: string, displayLabel: string, iconSpec?: string, kindOfQuantityName?: string);
  constructor(argsOrName: FormattedQuantityDescriptionArgs | string, displayLabel?: string, iconSpec?: string, kindOfQuantityName?: string) { // eslint-disable-line @typescript-eslint/no-deprecated
    if (typeof argsOrName === "string") {
      // if argsOrName is a string, displayLabel must be defined.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      super(argsOrName, displayLabel!, iconSpec, kindOfQuantityName);
    } else {
      super(argsOrName.name, argsOrName.displayLabel, argsOrName.iconSpec, argsOrName.kindOfQuantityName);
    }
  }
  protected formatValue(numberValue: number): string {
    if (this.formatterSpec) {
      return IModelApp.quantityFormatter.formatQuantity(numberValue, this.formatterSpec);
    }
    return numberValue.toFixed(2);
  }

  protected parseString(userInput: string): ParseResults {
    if (this.parserSpec) {
      const parseResult = IModelApp.quantityFormatter.parseToQuantityValue(userInput, this.parserSpec);
      if (Parser.isParsedQuantity(parseResult)) {
        return { value: parseResult.value };
      } else {
        return { parseError: this.parseError };
      }
    }
    return { parseError: "no parser defined" };
  }

  public get formatterSpec(): FormatterSpec | undefined {
    if (this._formatterSpec)
      return this._formatterSpec;

    const formatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(this.formatterQuantityType);
    if (formatterSpec) {
      this._formatterSpec = formatterSpec;
      return formatterSpec;
    }

    return undefined;
  }

  public get parserSpec(): ParserSpec | undefined {
    if (this._parserSpec)
      return this._parserSpec;

    const parserSpec = IModelApp.quantityFormatter.findParserSpecByQuantityType(this.formatterQuantityType);
    if (parserSpec) {
      this._parserSpec = parserSpec;
      return parserSpec;
    }

    return undefined;
  }

  public abstract get formatterQuantityType(): QuantityType;

  public abstract override get parseError(): string;
}
