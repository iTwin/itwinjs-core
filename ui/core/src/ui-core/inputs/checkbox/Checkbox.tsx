/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";
import { InputStatus } from "../InputStatus";
import { Omit } from "../../utils/typeUtils";
import { CommonProps } from "../../utils/Props";

/** Properties for [[Checkbox]] React component
 * @public
 */
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">, CommonProps {
  /** Text that will be shown next to the checkbox. */
  label?: string;
  /** Input status like: "Success", "Warning" or "Error" */
  status?: InputStatus;
  /** Custom CSS class name for the checkbox input element */
  inputClassName?: string;
  /** Custom CSS Style for the checkbox input element */
  inputStyle?: React.CSSProperties;
  /** Custom CSS class name for the label element */
  labelClassName?: string;
  /** Custom CSS Style for the label element */
  labelStyle?: React.CSSProperties;
}

/** A React component that renders a simple checkbox with label
 * @public
 */
export class Checkbox extends React.Component<CheckboxProps> {
  private _id: string = "";

  constructor(props: CheckboxProps) {
    super(props);

    if (props.id)
      this._id = props.id;
    else
      this._id = `core-checkbox-${Math.random().toString().replace(/0\./, "")}`;
  }

  /** @internal */
  public render() {
    const { label, status, className, style, inputClassName, inputStyle, labelClassName, labelStyle, id, ...inputProps } = this.props;
    const classNames = classnames(
      "core-checkbox",
      inputProps.disabled && "disabled",
      status,
      className,
    );

    return (
      <span className={classNames} style={style} >
        <input id={this._id} className={inputClassName} style={inputStyle} {...inputProps} type="checkbox" />
        {label && <label htmlFor={this._id} className={classnames("core-checkbox-label", labelClassName)} style={labelStyle}> {label} </label>}
      </span>
    );
  }
}
