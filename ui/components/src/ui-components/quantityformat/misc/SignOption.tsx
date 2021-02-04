/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import * as React from "react";
import { CommonProps, Select, SelectOption } from "@bentley/ui-core";
import { UiComponents } from "../../UiComponents";
import { ShowSignOption } from "@bentley/imodeljs-quantity";

/** Properties of [[SignOptionSelector]] component.
 * @internal
 */
export interface SignOptionSelectorProps extends CommonProps {
  signOption: ShowSignOption;
  onChange: (value: ShowSignOption) => void;
}

/** Component use to set Sign option.
 * @internal
 */
export function SignOptionSelector(props: SignOptionSelectorProps) {
  const { signOption, onChange, ...otherProps } = props;
  const options = React.useRef<SelectOption[]>([
    { value: ShowSignOption.NoSign, label: UiComponents.translate("QuantityFormat.sign_option.noSign") },
    { value: ShowSignOption.OnlyNegative, label: UiComponents.translate("QuantityFormat.sign_option.onlyNegative") },
    { value: ShowSignOption.SignAlways, label: UiComponents.translate("QuantityFormat.sign_option.signAlways") },
    { value: ShowSignOption.NegativeParentheses, label: UiComponents.translate("QuantityFormat.sign_option.negativeParentheses") },
  ]);

  const handleOnChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    const newValue = Number.parseInt(e.target.value, 10);
    onChange && onChange(newValue as ShowSignOption); //
  }, [onChange]);

  return (
    <Select options={options.current} value={signOption} onChange={handleOnChange} {...otherProps} />
  );
}
