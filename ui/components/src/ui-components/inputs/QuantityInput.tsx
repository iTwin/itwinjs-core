/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import classnames from "classnames";
import * as React from "react";
import { IModelApp, QuantityFormatsChangedArgs, QuantityTypeArg } from "@bentley/imodeljs-frontend";
import { Parser } from "@bentley/imodeljs-quantity";
import { ParseResults } from "@bentley/ui-abstract";
import { CommonProps } from "@bentley/ui-core";
import { ParsedInput } from "./ParsedInput";
import { UiComponents } from "../UiComponents";

/** Props for [[QuantityInput]] control
 * @beta
 */
export interface QuantityProps extends CommonProps {
  /** Initial magnitude in 'persistence' units. See `getPersistenceUnitByQuantityType` in [QuantityFormatter]($imodeljs-frontend) */
  initialValue: number;
  /** Type of quantity being input. */
  quantityType: QuantityTypeArg;
  /** Function to call in the quantity value is changed. The value returned will be in 'persistence' units. */
  onQuantityChange: (newQuantityValue: number) => void;
  /** Set to `true` if value is for display only */
  readonly?: boolean;
  /** Provides ability to return reference to HTMLInputElement */
  ref?: React.Ref<HTMLInputElement>;
}

/** Input control that allows users to input a quantity and show the formatted string that represents the value.
 * @beta
 */
export function QuantityInput({ initialValue, quantityType, readonly, className, style, onQuantityChange, ref }: QuantityProps) {
  const [formatterSpec, setFormatterSpec] = React.useState(() => IModelApp.quantityFormatter.findFormatterSpecByQuantityType(quantityType));
  const [parserSpec, setParserSpec] = React.useState(() => IModelApp.quantityFormatter.findParserSpecByQuantityType(quantityType));

  const formatValue = React.useCallback((value: number) => {
    // istanbul ignore else
    if (formatterSpec) {
      return formatterSpec.applyFormatting(value);
    }
    // istanbul ignore next
    return value.toFixed(2);
  }, [formatterSpec]);

  const parseString = React.useCallback((userInput: string): ParseResults => {
    // istanbul ignore else
    if (parserSpec) {
      const parseResult = IModelApp.quantityFormatter.parseToQuantityValue(userInput, parserSpec);
      // istanbul ignore else
      if (Parser.isParsedQuantity(parseResult)) {
        return { value: parseResult.value };
      } else {
        const statusId = Parser.isParseError(parseResult) ? parseResult.error.toString() : "Unknown";
        return { parseError: `${UiComponents.translate("QuantityInput.NoParserDefined")}${statusId}` };
      }
    }
    // istanbul ignore next
    return { parseError: UiComponents.translate("QuantityInput.NoParserDefined") };
  }, [parserSpec]);

  const classNames = classnames(className, "components-quantity-input");

  React.useEffect(() => {
    const handleUnitSystemChanged = ((): void => {
      setFormatterSpec(IModelApp.quantityFormatter.findFormatterSpecByQuantityType(quantityType));
      setParserSpec(IModelApp.quantityFormatter.findParserSpecByQuantityType(quantityType));
    });

    IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.addListener(handleUnitSystemChanged);
    return () => {
      IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.removeListener(handleUnitSystemChanged);
    };
  }, [quantityType]);

  React.useEffect(() => {
    const handleUnitSystemChanged = ((args: QuantityFormatsChangedArgs): void => {
      const quantityKey = IModelApp.quantityFormatter.getQuantityTypeKey(quantityType);
      // istanbul ignore else
      if (args.quantityType === quantityKey) {
        setFormatterSpec(IModelApp.quantityFormatter.findFormatterSpecByQuantityType(quantityType));
        setParserSpec(IModelApp.quantityFormatter.findParserSpecByQuantityType(quantityType));
      }
    });

    IModelApp.quantityFormatter.onQuantityFormatsChanged.addListener(handleUnitSystemChanged);
    return () => {
      IModelApp.quantityFormatter.onQuantityFormatsChanged.removeListener(handleUnitSystemChanged);
    };
  }, [quantityType]);

  return <ParsedInput data-testid="components-quantity-input" ref={ref} style={style} className={classNames}
    onChange={onQuantityChange} initialValue={initialValue} readonly={readonly} formatValue={formatValue} parseString={parseString} />;
}
