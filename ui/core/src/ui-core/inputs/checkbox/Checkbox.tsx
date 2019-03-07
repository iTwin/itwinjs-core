/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";
import { InputStatus } from "../InputStatus";
import { Omit } from "../../utils/typeUtils";

import "./checkbox.scss";

/** Properties for [[Checkbox]] React component */
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Text that will be shown next to the checkbox. */
  label?: string;
  /** Input status like: "Success", "Warning" or "Error" */
  status?: InputStatus;
}

/** A React component that renders a simple checkbox with label */
// tslint:disable-next-line:variable-name
export const Checkbox: React.FunctionComponent<CheckboxProps> = (props) => {
  const { label, status, ...inputProps } = props;

  return (
    <span className={classnames(
      "core-checkbox",
      { disabled: inputProps.disabled },
      status,
      inputProps.className,
    )}>
      <input {...inputProps} type={"checkbox"} />
      {label && <span className={"core-checkbox-label"}> {label} </span>}
    </span>
  );
};
