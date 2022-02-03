/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import type { PropertyDescription, PropertyEditorInfo } from "../properties/Description";
import type { CustomFormattedNumberParams, IconEditorParams, ParseResults} from "../properties/EditorParams";
import { PropertyEditorParamTypes } from "../properties/EditorParams";
import { StandardTypeNames } from "../properties/StandardTypeNames";
import { StandardEditorNames } from "../properties/StandardEditorNames";

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
    this.typename = StandardTypeNames.Number;
    this.editor = {
      name: StandardEditorNames.NumberCustom,
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
  };
  protected abstract parseString(userInput: string): ParseResults;

  public parse = (userInput: string): ParseResults => {
    return this.parseString(userInput);
  };

  public abstract get quantityType(): string;

  public abstract get parseError(): string;

}
