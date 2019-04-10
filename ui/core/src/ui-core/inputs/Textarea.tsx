/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";
import { CommonProps } from "../utils/Props";

/** Properties for [[Textarea]] component
 * @beta
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, CommonProps {
  /** textarea rows
   * Default: 3
   */
  rows?: number;
}

/** Basic textarea component
 * @beta
 */
export class Textarea extends React.Component<TextareaProps> {
  public static defaultProps: Partial<TextareaProps> = {
    rows: 3,
  };
  public render(): JSX.Element {
    const { className, style, ...props } = this.props;

    return (
      <textarea {...props}
        rows={this.props.rows}
        className={classnames("uicore-inputs-textarea", className)} style={style} />
    );
  }
}
