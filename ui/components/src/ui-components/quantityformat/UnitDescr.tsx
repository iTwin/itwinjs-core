/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import * as React from "react";
import { CommonProps, Input } from "@bentley/ui-core";
import classNames from "classnames";

/** Properties of [[UnitDescr]] component.
 * @alpha
 */
export interface UnitDescrProps extends CommonProps {
  name: string;
  label: string;
  index: number;
  onChange: (value: string, index: number) => void;
}

/** Component use to set Quantity Format thousand group separator.
 * @alpha
 */
export function UnitDescr(props: UnitDescrProps) {
  const { name, label, index, onChange, ...otherProps } = props;

  const handleOnChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    onChange && onChange(e.target.value, index);
  }, [index, onChange]);

  return (
    <>
      <span className={classNames("uicore-label", "uicore-disabled")}>{name}</span>
      <Input value={label} onChange={handleOnChange} {...otherProps} />
    </>
  );
}
