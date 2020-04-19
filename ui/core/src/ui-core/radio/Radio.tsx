/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Radio
 */

import * as React from "react";
import classnames from "classnames";
import { CommonProps } from "../utils/Props";
import { LabeledComponentProps } from "../inputs/LabeledComponentProps";

/** Properties for [[Radio]] component
 * @public
 */
export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement>, CommonProps, LabeledComponentProps { }

/** Basic radio input component is a wrapper for the `<input type="radio">` HTML element.
 * @public
 */
export class Radio extends React.PureComponent<RadioProps> {
  public render(): JSX.Element {
    const { label, disabled, status, className, style, inputStyle, inputClassName, ...props } = this.props;

    return (
      <label style={style} className={classnames(
        "uicore-inputs-radio",
        disabled && "uicore-disabled",
        status,
        className,
      )}>
        <input disabled={this.props.disabled} type={"radio"} className={inputClassName} style={inputStyle} {...props} />
        {label &&
          <span className={"uicore-label"}> {this.props.label} </span>
        }
      </label>
    );
  }
}
