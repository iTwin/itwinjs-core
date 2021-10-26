/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import * as React from "react";
import { CommonProps } from "@itwin/core-react";
import { UiIModelComponents } from "../../UiIModelComponents";
import { ScientificType } from "@itwin/core-quantity";
import { Select, SelectOption } from "@itwin/itwinui-react";

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
  const formatOptions = React.useRef<SelectOption<ScientificType>[]>([
    { value: ScientificType.Normalized, label: UiIModelComponents.translate("QuantityFormat.scientific-type.normalized") },
    { value: ScientificType.ZeroNormalized, label: UiIModelComponents.translate("QuantityFormat.scientific-type.zero-normalized") },
  ]);

  const handleOnChange = React.useCallback((newValue: ScientificType) => {
    onChange && onChange(newValue);
  }, [onChange]);

  return (
    <Select options={formatOptions.current} value={type} onChange={handleOnChange} {...otherProps} />
  );
}
