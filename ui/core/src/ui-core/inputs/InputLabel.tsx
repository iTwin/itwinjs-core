/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import * as React from "react";
import * as classnames from "classnames";

import { LabeledComponentProps, MessagedComponentProps } from "./LabeledComponentProps";
import { CommonProps } from "../utils/Props";

/** Properties for [[InputLabel]] components
 * @public
 */
export interface InputLabelProps extends LabeledComponentProps, MessagedComponentProps, CommonProps {
  disabled?: boolean;
}

/** Text input wrapper that provides additional styling and labeling
 * @public
 */
export class InputLabel extends React.PureComponent<InputLabelProps> {
  public render(): JSX.Element {
    const { label, status, className, style,
      labelClassName, labelStyle,
      message, messageClassName, messageStyle } = this.props;

    return (
      <label style={style} className={classnames(
        "uicore-inputs-labeled-input",
        { disabled: this.props.disabled },
        status,
        className,
      )}>
        {label &&
          <div className={classnames("label", labelClassName)} style={labelStyle}> {label} </div>
        }
        <div className={classnames("input", { "with-icon": !!status })}>
          {this.props.children}
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
