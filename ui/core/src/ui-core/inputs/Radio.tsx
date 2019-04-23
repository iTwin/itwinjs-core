/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";
import { CommonProps } from "../utils/Props";
import { LabeledComponentProps } from "./LabeledComponentProps";

/** Properties for [[Radio]] component
 * @beta
 */
export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement>, CommonProps, LabeledComponentProps { }

/** Basic radio input component
 * @beta
 */
export class Radio extends React.PureComponent<RadioProps> {
  public render(): JSX.Element {
    const { label, disabled, status, className, style, inputStyle, inputClassName, ...props } = this.props;

    return (
      <label style={style} className={classnames(
        "uicore-inputs-radio",
        disabled && "disabled",
        status,
        className,
      )}>
        <input disabled={this.props.disabled} type={"radio"} className={inputClassName} style={inputStyle} {...props} />
        {label &&
          <span className={"label"}> {this.props.label} </span>
        }
      </label>
    );
  }
}
