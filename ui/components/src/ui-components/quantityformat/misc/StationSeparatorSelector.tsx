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

/** Properties of [[StationSeparatorSelector]] component.
 * @internal
 */
export interface StationSeparatorSelectorProps extends CommonProps {
  separator: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** Component use to setStation separator.
 * @internal
 */
export function StationSeparatorSelector(props: StationSeparatorSelectorProps) {
  const { separator, disabled, onChange, ...otherProps } = props;
  const uomDefaultEntries = React.useRef<SelectOption[]>([
    { value: "+", label: UiComponents.translate("QuantityFormat.station_separator.plus") },
    { value: "-", label: UiComponents.translate("QuantityFormat.station_separator.minus") },
    { value: " ", label: UiComponents.translate("QuantityFormat.station_separator.blank") },
    { value: "^", label: UiComponents.translate("QuantityFormat.station_separator.caret") },
  ]);

  const handleOnChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    onChange && onChange(e.target.value);
  }, [onChange]);

  const separatorOptions = React.useMemo(() => {
    const completeListOfEntries: SelectOption[] = [];
    // istanbul ignore next (only used if format already has a character that does not match standard options)
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
