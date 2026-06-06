/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Parser } from "@itwin/core-quantity";
import {
  type CustomFormattedNumberParams, type IconEditorParams, type ParseResults, type PropertyDescription, type PropertyEditorParams, PropertyEditorParamTypes, StandardEditorNames, StandardTypeNames,
} from "@itwin/appui-abstract";
import { IModelApp } from "../../IModelApp";

interface CreateQuantityDescriptionProps {
  name: string;
  displayLabel: string;
  kindOfQuantityName: string;
  persistenceUnitName: string;
  iconSpec?: string;
  parseError: string;
}

export function createQuantityDescription(props: CreateQuantityDescriptionProps): PropertyDescription {
  const { name, displayLabel, iconSpec, kindOfQuantityName, persistenceUnitName, parseError } = props;
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

  if (iconSpec) {
    const params: IconEditorParams = {
      type: PropertyEditorParamTypes.Icon,
      definition: { iconSpec },
    };
    editorParams.push(params);
  }

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
