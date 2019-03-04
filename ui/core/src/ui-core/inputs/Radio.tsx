/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";
import { InputStatus } from "./InputStatus";

/** Properties for [[Radio]] component */
export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  status?: InputStatus;
}

/** Basic radio input component */
export class Radio extends React.Component<RadioProps> {
  public render(): JSX.Element {
    return (
      <label className={classnames(
        "uicore-inputs-radio",
        { disabled: this.props.disabled },
        this.props.status,
        this.props.className,
      )}>
        <input {...this.props} disabled={this.props.disabled} type={"radio"} />
        <span className={"label"}> {this.props.label} </span>
      </label>
    );
  }
}
export default Radio;
