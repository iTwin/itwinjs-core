/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import * as React from "react";
import type { CommonProps } from "@itwin/core-react";
import { UiIModelComponents } from "../../UiIModelComponents";
import { ShowSignOption } from "@itwin/core-quantity";
import type { SelectOption } from "@itwin/itwinui-react";
import { Select } from "@itwin/itwinui-react";

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
  const options = React.useRef<SelectOption<ShowSignOption>[]>([
    { value: ShowSignOption.NoSign, label: UiIModelComponents.translate("QuantityFormat.sign_option.noSign") },
    { value: ShowSignOption.OnlyNegative, label: UiIModelComponents.translate("QuantityFormat.sign_option.onlyNegative") },
    { value: ShowSignOption.SignAlways, label: UiIModelComponents.translate("QuantityFormat.sign_option.signAlways") },
    { value: ShowSignOption.NegativeParentheses, label: UiIModelComponents.translate("QuantityFormat.sign_option.negativeParentheses") },
  ]);

  const handleOnChange = React.useCallback((newValue: ShowSignOption) => {
    onChange && onChange(newValue);
  }, [onChange]);

  return (
    <Select options={options.current} value={signOption} onChange={handleOnChange} size="small" {...otherProps} />
  );
}
