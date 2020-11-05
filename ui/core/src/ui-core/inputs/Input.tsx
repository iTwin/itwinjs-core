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

/** Properties for the [[Input]] component
 * @public
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, CommonProps {
  /** Indicates whether to set focus to the input element */
  setFocus?: boolean;
  nativeKeyHandler?: (e: KeyboardEvent) => void;
}

/** Basic text input, is a wrapper for the `<input type="text">` HTML element.
 * @public
 */
export class Input extends React.PureComponent<InputProps> {
  private _inputElement = React.createRef<HTMLInputElement>();
  private _nativeKeyHandler?: (e: KeyboardEvent) => void;

  public componentDidMount() {
    // istanbul ignore else
    if (this._inputElement.current) {
      // istanbul ignore else
      if (this.props.setFocus) {
        this._inputElement.current.focus();
        this._inputElement.current.select();
      }
      // Only use the native key handler if specified and no React key handler is specified
      // istanbul ignore else
      if (!this.props.onKeyPress && this.props.nativeKeyHandler) {
        this._inputElement.current.addEventListener("keydown", this.props.nativeKeyHandler);
        this._nativeKeyHandler = this.props.nativeKeyHandler;
      }
    }
  }

  public componentDidUpdate(prevProps: InputProps) {
    if (this.props.nativeKeyHandler !== prevProps.nativeKeyHandler && this._inputElement.current) {
      // istanbul ignore else
      if (this._nativeKeyHandler)
        this._inputElement.current.removeEventListener("keydown", this._nativeKeyHandler);
      // istanbul ignore else
      if (this.props.nativeKeyHandler)
        this._inputElement.current.addEventListener("keydown", this.props.nativeKeyHandler);
      this._nativeKeyHandler = this.props.nativeKeyHandler;
    }
  }
  public componentWillUnmount() {
    // Only use the native key handler if specified and no React key handler is specified
    // istanbul ignore else
    if (this._inputElement.current && this._nativeKeyHandler)
      this._inputElement.current.removeEventListener("keydown", this._nativeKeyHandler);
  }
  public render(): JSX.Element {
    const { className, style, setFocus, nativeKeyHandler, ...props } = this.props; // eslint-disable-line @typescript-eslint/no-unused-vars
    return (
      <input ref={this._inputElement} type="text" {...props}
        className={classnames("uicore-inputs-input", className)} style={style} />
    );
  }
}
