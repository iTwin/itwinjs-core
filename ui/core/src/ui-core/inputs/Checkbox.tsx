/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";
import { InputStatus } from "./InputStatus";
import "./index.scss";

/** Properties for [[Checkbox]] component */
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  status?: InputStatus;
}

/** Simple input checkbox */
export class Checkbox extends React.Component<CheckboxProps> {
  public render(): JSX.Element {
    return (
      <label className={classnames(
        "uicore-inputs-checkbox",
        { disabled: this.props.disabled },
        this.props.status,
        this.props.className,
      )}>
        <input {...this.props} disabled={this.props.disabled} type={"checkbox"} />
        {this.props.label && <span className={"label"}> {this.props.label} </span>}
      </label>
    );
  }
}
export default Checkbox;
