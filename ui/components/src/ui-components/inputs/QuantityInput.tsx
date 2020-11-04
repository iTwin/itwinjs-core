/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import * as React from "react";
import classnames from "classnames";
import { CommonProps } from "@bentley/ui-core";
import { ParseResults } from "@bentley/ui-abstract";
import { QuantityStatus } from "@bentley/imodeljs-quantity";
import { IModelApp, QuantityType } from "@bentley/imodeljs-frontend";
import { ParsedInput } from "./ParsedInput";

/** Props for [[QuantityInput]] control
 * @beta
 */
export interface QuantityProps extends CommonProps {
  /** Initial magnitude in 'persistence' units. See `getUnitByQuantityType` in [QuantityFormatter]($imodeljs-frontend) */
  initialValue: number;
  /** Type of quantity being input. */
  quantityType: QuantityType;
  /** Function to call in the quantity value is changed. The value returned will be in 'persistence' units. */
  onQuantityChange: (newQuantityValue: number) => void;
  /** Set to `true` if value is for display only */
  readonly?: boolean;
}

/** Input control that allows users to input a quantity and show the formatted string that represents the value.
 * @beta
 */
export function QuantityInput({ initialValue, quantityType, readonly, className, style, onQuantityChange }: QuantityProps) {
  const [formatterSpec, setFormatterSpec] = React.useState(() => IModelApp.quantityFormatter.findFormatterSpecByQuantityType(quantityType));
  const [parserSpec, setParserSpec] = React.useState(() => IModelApp.quantityFormatter.findParserSpecByQuantityType(quantityType));

  const formatValue = React.useCallback((value: string | number | boolean | {} | string[] | Date | []) => {
    if (typeof value === "number") {
      if (formatterSpec) {
        return IModelApp.quantityFormatter.formatQuantity(value, formatterSpec);
      }
      return value.toFixed(2);
    }
    return value.toString();
  }, [formatterSpec]);

  const parseString = (userInput: string): ParseResults => {
    if (parserSpec) {
      const parseResult = IModelApp.quantityFormatter.parseIntoQuantityValue(userInput, parserSpec);
      if (parseResult.status === QuantityStatus.Success) {
        return { value: parseResult.value };
      } else {
        return { parseError: "Parse Error" };
      }
    }
    return { parseError: "no parser defined" };
  };

  const handleQuantityChange = React.useCallback((newValue: string | number | boolean | {} | string[] | Date | []) => {
    if (typeof newValue === "number")
      onQuantityChange && onQuantityChange(newValue);
  }, [onQuantityChange]);
  const classNames = classnames(className, "components-quantity-input");

  React.useEffect(() => {
    const handleUnitSystemChanged = ((): void => {
      setFormatterSpec(IModelApp.quantityFormatter.findFormatterSpecByQuantityType(quantityType));
      setParserSpec(IModelApp.quantityFormatter.findParserSpecByQuantityType(quantityType));
    });

    IModelApp.quantityFormatter.onActiveUnitSystemChanged.addListener(handleUnitSystemChanged);
    return () => {
      IModelApp.quantityFormatter.onActiveUnitSystemChanged.removeListener(handleUnitSystemChanged);
    };
  }, [quantityType]);

  return <ParsedInput data-testid="components-quantity-input" style={style} className={classNames}
    onChange={handleQuantityChange} initialValue={initialValue} readonly={readonly} formatValue={formatValue} parseString={parseString} />
}
