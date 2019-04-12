/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";

import { Select, SelectProps } from "./Select";
import { LabeledComponentProps, MessagedComponentProps } from "./LabeledComponentProps";

/** Properties for [[LabeledSelect]] components
 * @beta
 */
export interface LabeledSelectProps extends SelectProps, LabeledComponentProps, MessagedComponentProps { }

/** Dropdown wrapper that allows for additional styling and labelling
 * @beta
 */
export class LabeledSelect extends React.Component<LabeledSelectProps> {
  public render(): JSX.Element {
    const { label, status, className, style,
      inputClassName, inputStyle,
      labelClassName, labelStyle,
      message, messageClassName, messageStyle,
      ...props } = this.props;

    return (
      <label style={style} className={classnames(
        "uicore-inputs-labeled-select",
        { disabled: this.props.disabled },
        status,
        className,
      )}>
        {label &&
          <div className={classnames("label", labelClassName)}> {label} </div>
        }
        <Select disabled={this.props.disabled} className={inputClassName} style={inputStyle} {...props} />
        {message &&
          <div className={classnames("message", messageClassName)} style={messageStyle}>{message}</div>
        }
      </label>
    );
  }
}
