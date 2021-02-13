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

/** Properties of [[DecimalSeparatorSelector]] component.
 * @internal
 */
export interface DecimalSeparatorSelectorProps extends CommonProps {
  separator: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/** Component use to set Decimal Separator
 * @internal
 */
export function DecimalSeparatorSelector(props: DecimalSeparatorSelectorProps) {
  const { separator, onChange, ...otherProps } = props;
  const options = React.useRef<SelectOption[]>([
    { value: ".", label: UiComponents.translate("QuantityFormat.decimal_separator.point") },
    { value: ",", label: UiComponents.translate("QuantityFormat.decimal_separator.comma") },
  ]);

  const handleOnChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    onChange && onChange(e.target.value);
  }, [onChange]);

  return (
    <Select options={options.current} value={separator} onChange={handleOnChange} {...otherProps} />
  );
}
