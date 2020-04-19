/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import * as React from "react";
import classnames from "classnames";
import { CommonProps } from "../utils/Props";

/** Properties for [[Textarea]] component
 * @public
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, CommonProps {
  /** textarea rows
   * Default: 3
   */
  rows?: number;
}

/** Basic textarea component
 * @public
 */
export class Textarea extends React.PureComponent<TextareaProps> {
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
