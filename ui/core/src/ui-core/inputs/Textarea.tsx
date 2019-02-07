/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";
import "./index.scss";

/** Properties for [[Textarea]] component */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** textarea rows
   * Default: 3
   */
  rows?: number;
}

/** Basic textarea component */
export class Textarea extends React.Component<TextareaProps> {
  public static defaultProps: Partial<TextareaProps> = {
    rows: 3,
  };
  public render(): JSX.Element {
    return (
      <textarea {...this.props}
        rows={this.props.rows}
        className={classnames("uicore-inputs-textarea", this.props.className)} />
    );
  }
}
export default Textarea;
