/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { CustomFormattedNumberParams, IconEditorParams, ParseResults, PropertyEditorParamTypes } from "../properties/EditorParams";
import { PropertyDescription, PropertyEditorInfo } from "../properties/Description";

/**
 * Base Quantity Property Description
 * @beta
 */
export abstract class BaseQuantityDescription implements PropertyDescription {
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

    // istanbul ignore else
    if (iconSpec) {
      const params: IconEditorParams = {
        type: PropertyEditorParamTypes.Icon,
        definition: { iconSpec },
      };
      this.editor.params!.push(params);
    }
  }

  protected abstract formatValue(numberValue: number): string;

  public format = (numberValue: number): string => {
    return this.formatValue(numberValue);
  }
  protected abstract parseString(userInput: string): ParseResults;

  public parse = (userInput: string): ParseResults => {
    return this.parseString(userInput);
  }

  public abstract get quantityType(): string;

  public abstract get parseError(): string;

}
