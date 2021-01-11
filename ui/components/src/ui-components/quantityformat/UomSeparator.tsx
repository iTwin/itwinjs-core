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

/** Properties of [[UomSeparatorSelector]] component.
 * @alpha
 */
export interface UomSeparatorSelectorProps extends CommonProps {
  separator: string;
  onChange: (value: string) => void;
}

/** Component use to set Quantity Format UOM separator, this is the character to put between the magnitude and
 * the unit label.
 * @alpha
 */
export function UomSeparatorSelector(props: UomSeparatorSelectorProps) {
  const { separator, onChange, ...otherProps } = props;
  const uomDefaultEntries = React.useRef<SelectOption[]>([
    { value: "", label: UiComponents.translate("QuantityFormat.none") },
    { value: " ", label: UiComponents.translate("QuantityFormat.space") },
    { value: "-", label: UiComponents.translate("QuantityFormat.dash") },
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
    <Select options={separatorOptions} value={separator} onChange={handleOnChange} {...otherProps} />
  );
}
