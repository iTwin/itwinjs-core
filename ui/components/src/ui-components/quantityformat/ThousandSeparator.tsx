/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import * as React from "react";
import { CommonProps, Select, SelectOption } from "@bentley/ui-core";
import { UiComponents } from "../UiComponents";

/** Properties of [[ThousandSeparatorSelector]] component.
 * @alpha
 */
export interface ThousandSeparatorSelectorProps extends CommonProps {
  separator: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** Component use to set Quantity Format thousand group separator.
 * @alpha
 */
export function ThousandSeparatorSelector(props: ThousandSeparatorSelectorProps) {
  const { separator, disabled, onChange, ...otherProps } = props;
  const uomDefaultEntries = React.useRef<SelectOption[]>([
    { value: ",", label: UiComponents.translate("QuantityFormat.thousand_separator.comma") },
    { value: ".", label: UiComponents.translate("QuantityFormat.thousand_separator.point") },
  ]);

  const handleOnChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    onChange && onChange(e.target.value);
  }, [onChange]);

  const separatorOptions = React.useMemo(() => {
    const completeListOfEntries: SelectOption[] = [];
    if (undefined === uomDefaultEntries.current.find((option) => option.value as string === separator)) {
      completeListOfEntries.push({ value: separator, label: separator });
    }
    completeListOfEntries.push(...uomDefaultEntries.current);
    return completeListOfEntries;
  }, [separator]);

  return (
    <Select options={separatorOptions} disabled={disabled} value={separator} onChange={handleOnChange} {...otherProps} />
  );
}
