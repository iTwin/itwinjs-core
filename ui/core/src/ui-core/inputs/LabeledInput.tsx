/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import * as React from "react";
import classnames from "classnames";

import { Input, InputProps } from "./Input";
import { LabeledComponentProps, MessagedComponentProps } from "./LabeledComponentProps";

/** Properties for [[LabeledInput]] components
 * @public
 */
export interface LabeledInputProps extends InputProps, LabeledComponentProps, MessagedComponentProps { }

/** Text input wrapper that provides additional styling and labeling
 * @public
 */
export class LabeledInput extends React.PureComponent<LabeledInputProps> {
  public render(): JSX.Element {
    const { label, status, className, style,
      inputClassName, inputStyle,
      labelClassName, labelStyle,
      message, messageClassName, messageStyle,
      ...props } = this.props;

    return (
      <label style={style} className={classnames(
        "uicore-inputs-labeled-input",
        this.props.disabled && "uicore-disabled",
        status,
        className,
      )}>
        {label &&
          <div className={classnames("uicore-label", labelClassName)} style={labelStyle}> {label} </div>
        }
        <div className={classnames("input", { "with-icon": !!status })}>
          <Input disabled={this.props.disabled} className={inputClassName} style={inputStyle} {...props} />
          {status &&
            <i className={classnames("icon", `icon-status-${status}`)} />
          }
        </div>
        {message &&
          <div className={classnames("uicore-message", messageClassName)} style={messageStyle}>{message}</div>
        }
      </label>
    );
  }
}
