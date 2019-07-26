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
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onClick">, CommonProps {
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
  /**
   * Event called when checkbox is clicked on. This is a good event to
   * use for preventing the action from bubbling to component's parents.
   */
  onClick?: (e: React.MouseEvent) => void;
}

/** A React component that renders a simple checkbox with label
 * @public
 */
export class Checkbox extends React.PureComponent<CheckboxProps> {
  private _onCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  }
  public render() {
    const { status, className, inputClassName, inputStyle, labelClassName, labelStyle, onClick, ...inputProps } = this.props;
    const checkBoxClass = classnames("core-checkbox", status, className);
    return (
      <label className={checkBoxClass} onClick={onClick}>
        <input type="checkbox" {...inputProps} className={inputClassName} style={inputStyle} onClick={this._onCheckboxClick} />
        <span className={classnames("core-checkbox-label", labelClassName)} style={labelStyle}>{this.props.label}</span>
      </label>
    );
  }
}
