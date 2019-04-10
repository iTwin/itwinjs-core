/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";
import { InputStatus } from "./InputStatus";

/** Properties for [[Radio]] component
 * @beta
 */
export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  status?: InputStatus;
}

/** Basic radio input component
 * @beta
 */
export class Radio extends React.Component<RadioProps> {
  public render(): JSX.Element {
    const { label, disabled, status, className } = this.props;

    return (
      <label className={classnames(
        "uicore-inputs-radio",
        disabled && "disabled",
        status,
        className,
      )}>
        <input {...this.props} disabled={this.props.disabled} type={"radio"} />
        {label && <span className={"label"}> {this.props.label} </span>}
      </label>
    );
  }
}
