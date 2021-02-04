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

/** Properties of [[StationSizeSelector]] component.
 * @internal
 */
export interface StationSizeSelectorProps extends CommonProps {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

/** Component use to set Station size (number of digits from right until '+').
 * @internal
 */
export function StationSizeSelector(props: StationSizeSelectorProps) {
  const { value, disabled, onChange, ...otherProps } = props;
  const separatorOptions = React.useRef<SelectOption[]>([
    { value: 2, label: UiComponents.translate("QuantityFormat.station_size.two") },
    { value: 3, label: UiComponents.translate("QuantityFormat.station_size.three") },
  ]);

  const handleOnChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    onChange && onChange(Number.parseInt(e.target.value, 10));
  }, [onChange]);

  return (
    <Select options={separatorOptions.current} disabled={disabled} value={value} onChange={handleOnChange} {...otherProps} />
  );
}
