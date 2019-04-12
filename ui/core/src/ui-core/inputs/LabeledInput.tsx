/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";

import { Input, InputProps } from "./Input";
import { LabeledComponentProps, MessagedComponentProps } from "./LabeledComponentProps";

/** Properties for [[LabeledInput]] components
 * @beta
 */
export interface LabeledInputProps extends InputProps, LabeledComponentProps, MessagedComponentProps { }

/** Text input wrapper that provides additional styling and labeling
 * @beta
 */
export class LabeledInput extends React.Component<LabeledInputProps> {
  public render(): JSX.Element {
    const { label, status, className, style,
      inputClassName, inputStyle,
      labelClassName, labelStyle,
      message, messageClassName, messageStyle,
      ...props } = this.props;

    return (
      <label style={style} className={classnames(
        "uicore-inputs-labeled-input",
        { disabled: this.props.disabled },
        status,
        className,
      )}>
        {label &&
          <div className={classnames("label", labelClassName)}> {label} </div>
        }
        <div className={classnames("input", { "with-icon": !!status })}>
          <Input disabled={this.props.disabled} className={inputClassName} style={inputStyle} {...props} />
          {status &&
            <i className={classnames("icon", `icon-status-${status}`)} />
          }
        </div>
        {message &&
          <div className={classnames("message", messageClassName)} style={messageStyle}>{message}</div>
        }
      </label>
    );
  }
}
