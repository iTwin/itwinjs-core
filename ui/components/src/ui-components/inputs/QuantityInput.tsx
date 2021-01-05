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
import { UiComponents } from "../UiComponents";

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
      return IModelApp.quantityFormatter.formatQuantity(value, formatterSpec);
    }
    // istanbul ignore next
    return value.toFixed(2);
  }, [formatterSpec]);

  const parseString = React.useCallback((userInput: string): ParseResults => {
    // istanbul ignore else
    if (parserSpec) {
      const parseResult = IModelApp.quantityFormatter.parseIntoQuantityValue(userInput, parserSpec);
      // istanbul ignore else
      if (parseResult.status === QuantityStatus.Success) {
        return { value: parseResult.value };
      } else {
        return { parseError: `${UiComponents.translate("QuantityInput.NoParserDefined")}${parseResult.status}` };
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

    IModelApp.quantityFormatter.onActiveUnitSystemChanged.addListener(handleUnitSystemChanged);
    return () => {
      IModelApp.quantityFormatter.onActiveUnitSystemChanged.removeListener(handleUnitSystemChanged);
    };
  }, [quantityType]);

  return <ParsedInput data-testid="components-quantity-input" ref={ref} style={style} className={classNames}
    onChange={onQuantityChange} initialValue={initialValue} readonly={readonly} formatValue={formatValue} parseString={parseString} />;
}
