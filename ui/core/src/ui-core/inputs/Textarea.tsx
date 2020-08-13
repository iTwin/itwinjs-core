/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../utils/Props";

/** Properties for [[Textarea]] component
 * @public
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, CommonProps {
  /** Number of textarea rows. Default is 3. */
  rows?: number;
  /** Indicates whether to set focus to the textarea element */
  setFocus?: boolean;
}

/** Basic textarea component
 * @public
 */
export class Textarea extends React.PureComponent<TextareaProps> {
  public static defaultProps: Partial<TextareaProps> = {
    rows: 3,
  };

  private _textareaElement = React.createRef<HTMLTextAreaElement>();

  public componentDidMount() {
    if (this.props.setFocus && this._textareaElement.current) {
      this._textareaElement.current.focus();
      this._textareaElement.current.select();
    }
  }

  public render(): JSX.Element {
    const { className, style, rows, setFocus, ...props } = this.props; // eslint-disable-line @typescript-eslint/no-unused-vars

    return (
      <textarea {...props}
        ref={this._textareaElement}
        rows={this.props.rows}
        className={classnames("uicore-inputs-textarea", className)} style={style} />
    );
  }
}
