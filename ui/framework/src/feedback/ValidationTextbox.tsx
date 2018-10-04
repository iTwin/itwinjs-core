/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ValidationTextbox */

import * as React from "react";
// import * as ReactDOM from "react-dom";
import * as classnames from "classnames";

import "./ValidationTextbox.scss";

// import { XAndY } from "@bentley/geometry-core";b
import { MessageManager } from "../configurableui";
// import Css from "@bentley/ui-ninezone/lib/utilities/Css";

export enum InputStatus {
  Valid = 0,
  Invalid = 1,
}

/** Property interface for ValidationTextbox */
export interface ValidationTextboxProps {
  /** value to set ValidationTextbox to initially */
  initialValue?: string;
  /** placeholder value to show in gray before anything is entered in */
  placeholder?: string;
  /** triggered when the content of ValidationTextbox is changed. Return true if valid */
  onValueChanged?: (value: string) => InputStatus;
  /** listens for <Enter> keypresses */
  onEnterPressed?: () => void;
  /** listens for <Esc> keypresses */
  onEscPressed?: () => void;
  /** width of ValidationTextbox, measured in em */
  size?: number;
  /** Error message to display */
  errorText?: string;
}

/**
 * Input box that validates text based on provided criteria. Defaults to checking
 * for empty if no method for onValueChanged is provided.
 */
export class ValidationTextbox extends React.Component<ValidationTextboxProps> {
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
          onChange={this._validateText}
          onKeyUp={this._validateText}
          onPaste={this._validateText}
          onCut={this._validateText}
          onBlur={this._validateText}
          placeholder={this.props.placeholder ? this.props.placeholder : ""}
          style={sizeStyle}
        />
        {this.props.children}
      </div>
    );
  }

  /**
   * Determines if value is valid and resolves any defined functions.
   * Also will show or hide error message if defined.
   * @param event   Button press event that triggers validation
   */
  private _validateText = (event?: any): void => {
    this._isValid = false;
    let value = "";

    if (event.target)
      value = event.target.value;

    this._calculateIsValid(value);

    if (this.props.errorText)
      this._isValid ? this._hideErrorMessage() : this._showErrorMessage(event.target);

    this.setState((_prevState) => {
      return {
        value,
      };
    });

    this._manageKeyCodeEvent(event);
  }

  /**
   * Determines if value provided is valid by calling user defined
   * function. If no function is provided, the default criteria for
   * validity is if the value has been defined.
   * @param value   The value provided in textbox
   */
  private _calculateIsValid(value: string) {
    if (this.props.onValueChanged)
      this._isValid = (this.props.onValueChanged(value) === InputStatus.Valid) ? true : false;
    else
      this._isValid = value ? true : false;
  }

  /** Hides error message */
  private _hideErrorMessage() {
    MessageManager.hideInputFieldMessage();
  }

  /** Displays error message. */
  private _showErrorMessage(target: Element) {
    MessageManager.displayInputFieldMessage(target, this.props.errorText!);
    return;
  }

  /**
   * Manages special key codes by calling user defined functions
   * @param event   Button press event
   */
  private _manageKeyCodeEvent(event: any) {
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
