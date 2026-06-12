/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { FormatterSpec, Parser, ParserSpec } from "@itwin/core-quantity";
import {
  BaseQuantityDescription, type CustomFormattedNumberParams, ParseResults, type PropertyDescription, PropertyEditorParamTypes, StandardEditorNames, StandardTypeNames,
} from "@itwin/appui-abstract";
import { IModelApp } from "../IModelApp";
import { QuantityType } from "../quantity-formatting/QuantityFormatter";

/** Properties for [createQuantityDescription]($frontend).
 * @beta
 */
export interface CreateQuantityDescriptionProps {
  /** Programmatic property name. */
  name: string;
  /** User-facing property label. */
  displayLabel: string;
  /** KindOfQuantity name used to resolve formatting and parsing behavior. */
  kindOfQuantityName: string;
  /** Persistence unit name for values stored in the property. */
  persistenceUnitName: string;
  /** Optional parse failure message override shown when the input cannot be converted.
   *
   * If omitted, [createQuantityDescription]($frontend) falls back to a generic parse error message.
   */
  parseError?: string;
}

/** Creates a quantity-aware [PropertyDescription]($appui-abstract) for tool settings and other UI property flows.
 *
 * The returned description uses a `NumberCustom` editor with synchronous formatting and parsing callbacks backed by the
 * active [IModelApp.quantityFormatter]($frontend). Formatting falls back to `numberValue.toFixed(2)` until specs are available.
 *
 * @beta
 */
export function createQuantityDescription(props: CreateQuantityDescriptionProps): PropertyDescription {
  const { name, displayLabel, kindOfQuantityName, persistenceUnitName } = props;
  const parseError = props.parseError ?? IModelApp.localization.getLocalizedString("iModelJs:Properties.UnableToParseValue");
  const formatSpecHandle = IModelApp.quantityFormatter.getFormatSpecHandle(kindOfQuantityName, persistenceUnitName);
  const editorParams: CustomFormattedNumberParams[] = [{
    type: PropertyEditorParamTypes.CustomFormattedNumber,
    formatFunction: (numberValue: number): string => {
      const formatterSpec = formatSpecHandle.formatterSpec;
      return formatterSpec ? IModelApp.quantityFormatter.formatQuantity(numberValue, formatterSpec) : numberValue.toFixed(2);
    },
    parseFunction: (userInput: string) => {
      const parseResult = formatSpecHandle.parserSpec?.parseToQuantityValue(userInput);
      return parseResult && parseResult.ok ? { value: parseResult.value } : { parseError };
    },
  }];

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
 * @deprecated in 5.11.0. This appui-based quantity description API is deprecated. Use [createQuantityDescription]($frontend) to build a plain [PropertyDescription]($appui-abstract) with synchronous quantity formatting callbacks backed by [IModelApp.quantityFormatter]($frontend).
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
 * @deprecated in 5.11.0. This appui-based quantity description API is deprecated. Use [createQuantityDescription]($frontend) to build a plain [PropertyDescription]($appui-abstract) with synchronous quantity formatting callbacks backed by [IModelApp.quantityFormatter]($frontend).
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
