/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";

import { Textarea, TextareaProps } from "./Textarea";
import { LabeledComponentProps, MessagedComponentProps } from "./LabeledComponentProps";

/** Properties for [[LabeledTextarea]] component
 * @public
 */
export interface LabeledTextareaProps extends TextareaProps, LabeledComponentProps, MessagedComponentProps { }

/** Textarea wrapper that allows for additional styling and labelling
 * @public
 */
export class LabeledTextarea extends React.PureComponent<LabeledTextareaProps> {
  public render(): JSX.Element {
    const { label, status, className, style,
      inputClassName, inputStyle,
      labelClassName, labelStyle,
      message, messageClassName, messageStyle,
      ...props } = this.props;

    return (
      <label style={this.props.style} className={classnames(
        "uicore-inputs-labeled-textarea",
        { disabled: this.props.disabled },
        this.props.status,
        this.props.className,
      )}>
        {label &&
          <div className={classnames("label", labelClassName)}> {label} </div>
        }
        <Textarea disabled={this.props.disabled} className={inputClassName} style={inputStyle} {...props} />
        {message &&
          <div className={classnames("message", messageClassName)} style={messageStyle}>{message}</div>
        }
      </label>
    );
  }
}
