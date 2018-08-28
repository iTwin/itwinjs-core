/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ValidationTextbox */

import * as React from "react";
import * as classnames from "classnames";

import "./ValidationTextbox.scss";

/** Property interface for ValidationTextbox */
export interface ValidationTextboxProps {
  /** value to set ValidationTextbox to initially */
  initialValue?: string;
  /** placeholder value to show in gray before anything is entered in */
  placeholder?: string;
  /** triggered when the content of ValidationTextbox is changed. Return true if valid */
  onValueChanged?: (value: string) => boolean;
  /** listens for <Enter> keypresses */
  onEnterPressed?: () => void;
  /** listens for <Esc> keypresses */
  onEscPressed?: () => void;
  /** width of ValidationTextbox, measured in em */
  size?: number;
}

/**
 * Input box that validates text based on provided criteria. Defaults to checking
 * for empty if no method for onValueChanged is provided.
 */
export class ValidationTextbox extends React.Component<ValidationTextboxProps> {
  private _inputElement: HTMLInputElement | null = null;
  private _isValid: boolean = true;

  /** @hidden */
  public render(): React.ReactNode {
    const sizeStyle = {
      width: this.props.size ? this.props.size.toString() + "em" : "12em",
    };

    const validClassNames = classnames(
      "ValidationTextbox-input",
    );

    const invalidClassNames = classnames(
      "ValidationTextbox-input",
      "ValidationTextbox-invalid",
    );

    return (
      <div
        className={"ValidationTextbox"}
        style={sizeStyle}>
        <input
          className={this._isValid ? validClassNames : invalidClassNames}
          ref={(el) => { this._inputElement = el; }}
          onChange={this._validateText}
          onKeyUp={this._validateText}
          onPaste={this._validateText}
          onCut={this._validateText}
          onClick={this._validateText}
          placeholder={this.props.placeholder ? this.props.placeholder : ""}
          style={sizeStyle}
        />
      </div>
    );
  }

  private _validateText = (event?: any): void => {
    this._isValid = false;
    let value = "";

    if (this._inputElement)
      value = this._inputElement.value;

    if (this.props.onValueChanged)
      this._isValid = this.props.onValueChanged(value);
    else
      this._isValid = value ? true : false;

    this.setState((_prevState) => {
      return {
        value,
      };
    });

    if (event && event.keyCode) {
      switch (event.keyCode) {
        case 27:
          if (this.props.onEscPressed) this.props.onEscPressed();
          break;
        case 13:
          if (this.props.onEnterPressed) this.props.onEnterPressed();
          break;
      }
    }
  }
}

export default ValidationTextbox;
