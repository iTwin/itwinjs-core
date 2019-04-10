/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";

import { Input, InputProps } from "./Input";
import { InputStatus } from "./InputStatus";

/** Properties for [[LabeledInput]] components
 * @beta
 */
export interface LabeledInputProps extends InputProps {
  label: string;
  status?: InputStatus;
  message?: string;
}

/** Text input wrapper that provides additional styling and labeling
 * @beta
 */
export class LabeledInput extends React.Component<LabeledInputProps> {
  public render(): JSX.Element {
    return (
      <label className={classnames(
        "uicore-inputs-labeled-input",
        { disabled: this.props.disabled },
        this.props.status,
        this.props.className,
      )}>
        <div className={"label"}> {this.props.label} </div>
        {this.props.label &&
          <div className={"label"}> {this.props.label} </div>}
        <div className={classnames("input", { "with-icon": !!this.props.status })}>
          <Input disabled={this.props.disabled} {...this.props} />
          {this.props.status &&
            <i className={classnames("icon", `icon-status-${this.props.status}`)} />
          }
        </div>
        {this.props.message &&
          <div className={"message"}>{this.props.message}</div>
        }
      </label>
    );
  }
}
