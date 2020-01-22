/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { FormatterSpec, ParserSpec, QuantityStatus } from "@bentley/imodeljs-quantity";
import { IModelApp } from "../IModelApp";
import { QuantityType } from "../QuantityFormatter";
import { CustomFormattedNumberParams, IconEditorParams, ParseResults, PropertyEditorParamTypes } from "./EditorParams";
import { PropertyDescription, PropertyEditorInfo } from "./Description";

/**
 * Base Quantity Property Description
 * @beta
 */
export abstract class BaseQuantityDescription implements PropertyDescription {
  private _formatterSpec?: FormatterSpec;
  private _parserSpec?: ParserSpec;

  public name: string;
  public displayLabel: string;
  public typename: string;
  public editor: PropertyEditorInfo;

  constructor(name: string, displayLabel: string, iconSpec?: string) {
    this.name = name;
    this.displayLabel = displayLabel;
    this.typename = "number";
    this.editor = {
      name: "number-custom",
      params: [{
        type: PropertyEditorParamTypes.CustomFormattedNumber,
        formatFunction: this.format,
        parseFunction: this.parse,
      } as CustomFormattedNumberParams,
      ],
    };

    if (iconSpec) {
      const params: IconEditorParams = {
        type: PropertyEditorParamTypes.Icon,
        definition: { iconSpec },
      };
      this.editor.params!.push(params);
    }
  }

  public format = (numberValue: number): string => {
    if (this.formatterSpec) {
      return IModelApp.quantityFormatter.formatQuantity(numberValue, this.formatterSpec);
    }
    return numberValue.toFixed(2);
  }

  public parse = (userInput: string): ParseResults => {
    if (this.parserSpec) {
      const parseResult = IModelApp.quantityFormatter.parseIntoQuantityValue(userInput, this.parserSpec);
      if (parseResult.status === QuantityStatus.Success) {
        return { value: parseResult.value };
      } else {
        return { parseError: this.parseError };
      }
    }

    const rtnValue = Number.parseFloat(userInput);
    if (Number.isNaN(rtnValue)) {
      return { parseError: this.parseError };
    } else {
      return { value: rtnValue };
    }
  }

  public get formatterSpec(): FormatterSpec | undefined {
    if (this._formatterSpec)
      return this._formatterSpec;

    const formatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(this.quantityType);
    if (formatterSpec) {
      this._formatterSpec = formatterSpec;
      return formatterSpec;
    }

    return undefined;
  }

  public get parserSpec(): ParserSpec | undefined {
    if (this._parserSpec)
      return this._parserSpec;

    const parserSpec = IModelApp.quantityFormatter.findParserSpecByQuantityType(this.quantityType);
    if (parserSpec) {
      this._parserSpec = parserSpec;
      return parserSpec;
    }

    return undefined;
  }

  public abstract get quantityType(): QuantityType;

  public abstract get parseError(): string;

}
