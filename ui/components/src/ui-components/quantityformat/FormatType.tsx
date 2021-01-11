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
import { FormatType } from "@bentley/imodeljs-quantity";

/** Properties of [[FormatTypeSelector]] component.
 * @alpha
 */
export interface FormatTypeSelectorProps extends CommonProps {
  type: FormatType;
  onChange: (value: FormatType) => void;
}

/** Component use to set Quantity Format UOM separator, this is the character to put between the magnitude and
 * the unit label.
 * @alpha
 */
export function FormatTypeSelector(props: FormatTypeSelectorProps) {
  const { type, onChange, ...otherProps } = props;
  const formatOptions = React.useRef<SelectOption[]>([
    { value: FormatType.Decimal, label: UiComponents.translate("QuantityFormat.decimal") },
    { value: FormatType.Scientific, label: UiComponents.translate("QuantityFormat.scientific") },
    { value: FormatType.Station, label: UiComponents.translate("QuantityFormat.station") },
    { value: FormatType.Fractional, label: UiComponents.translate("QuantityFormat.fractional") },
  ]);

  const handleOnChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    onChange && onChange(FormatType.Decimal); // e.target.value
  }, [onChange]);

  return (
    <Select options={formatOptions.current} value={type} onChange={handleOnChange} {...otherProps} />
  );
}
