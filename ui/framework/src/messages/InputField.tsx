/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as classnames from "classnames";
import "./InputField.scss";
import { Div, withOnOutsideClick } from "@bentley/ui-core";
import CommonProps from "@bentley/ui-ninezone/lib/utilities/Props";
import MessageButton from "@bentley/ui-ninezone/lib/footer/message/content/Button";
import Status from "@bentley/ui-ninezone/lib/footer/message/content/status/Status";
import { StatusMessage } from "@bentley/ui-ninezone/lib/footer/message/content/status/Message";
import StatusMessageLayout from "@bentley/ui-ninezone/lib/footer/message/content/status/Layout";

// tslint:disable-next-line:variable-name
const DivWithOnOutsideClick = withOnOutsideClick(Div);

/** Properties of [[InputField]] component. */
export interface InputFieldProps extends CommonProps {
  /** Parent of message. */
  target: Element;
  /** Message content. */
  children: React.ReactNode;
  /** Function that will close the message */
  onClose: () => void;
}

/** InputField message is a popup error message that appears under invalid user input. */
export class InputField extends React.Component<InputFieldProps> {
  public render(): React.ReactNode {
    return ReactDOM.createPortal(this._getErrorMessage(), this.props.target);
  }

  /**
   * Provides a message to display inside of the portal.
   */
  private _getErrorMessage(): React.ReactNode {
    const className = classnames(
      "nz-popup-message-inputField",
      this.props.className);

    return (
      <DivWithOnOutsideClick
        className={className}
        style={this.props.style}
        // TODO: dismiss onOutsideClick without immediately dismissing message
        children={
          < StatusMessage
            className="nz-popup-message-inputField"
            status={Status.Error}
            icon={
              < i className="icon icon-status-error-hollow" />
            }
          >
            <StatusMessageLayout
              className="message-inputField-content"
              label={this.props.children}
              buttons={
                <MessageButton onClick={this.props.onClose}>
                  <i className="icon icon-close" />
                </MessageButton>
              }
            />
          </StatusMessage>
        }
      />
    );
  }
}

export default InputField;
