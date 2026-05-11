/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { PropertyDescription, PropertyEditorInfo } from "../properties/Description";
import { CustomFormattedNumberParams, IconEditorParams, ParseResults, PropertyEditorParams, PropertyEditorParamTypes } from "../properties/EditorParams";
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
  public kindOfQuantityName?: string;

  constructor(name: string, displayLabel: string, iconSpec?: string, kindOfQuantityName?: string) {
    this.name = name;
    this.displayLabel = displayLabel;
    this.kindOfQuantityName = kindOfQuantityName;
    this.typename = StandardTypeNames.Number;

    const editorParams: PropertyEditorParams[] = [{
      type: PropertyEditorParamTypes.CustomFormattedNumber,
      formatFunction: this.format,
      parseFunction: this.parse,
    } as CustomFormattedNumberParams];

    this.editor = {
      name: StandardEditorNames.NumberCustom,
      params: editorParams,
    };

    // istanbul ignore else
    if (iconSpec) {
      const params: IconEditorParams = {
        type: PropertyEditorParamTypes.Icon,
        definition: { iconSpec },
      };
      editorParams.push(params);
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

  public abstract get parseError(): string;

}
