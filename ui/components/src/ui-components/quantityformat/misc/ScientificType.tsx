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
import { ScientificType } from "@bentley/imodeljs-quantity";

/** Properties of [[ScientificTypeSelector]] component.
 * @internal
 */
export interface ScientificTypeSelectorProps extends CommonProps {
  type: ScientificType;
  onChange: (value: ScientificType) => void;
  disabled?: boolean;
}

/** Component use to set Scientific type.
 * @internal
 */
export function ScientificTypeSelector(props: ScientificTypeSelectorProps) {
  const { type, onChange, ...otherProps } = props;
  const formatOptions = React.useRef<SelectOption[]>([
    { value: ScientificType.Normalized, label: UiComponents.translate("QuantityFormat.scientific-type.normalized") },
    { value: ScientificType.ZeroNormalized, label: UiComponents.translate("QuantityFormat.scientific-type.zero-normalized") },
  ]);

  const handleOnChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    const enumValue = parseInt(e.target.value, 10);
    onChange && onChange(enumValue as ScientificType);
  }, [onChange]);

  return (
    <Select options={formatOptions.current} value={type} onChange={handleOnChange} {...otherProps} />
  );
}
