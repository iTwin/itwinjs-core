/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";

import { Select, SelectProps } from "./Select";
import { LabeledComponentProps, MessagedComponentProps } from "./LabeledComponentProps";

/** Properties for [[LabeledSelect]] components
 * @public
 */
export interface LabeledSelectProps extends SelectProps, LabeledComponentProps, MessagedComponentProps { }

/** Dropdown wrapper that allows for additional styling and labelling
 * @public
 */
export class LabeledSelect extends React.PureComponent<LabeledSelectProps> {
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
          <div className={classnames("label", labelClassName)} style={labelStyle}> {label} </div>
        }
        <Select disabled={this.props.disabled} className={inputClassName} style={inputStyle} {...props} />
        {message &&
          <div className={classnames("message", messageClassName)} style={messageStyle}>{message}</div>
        }
      </label>
    );
  }
}
