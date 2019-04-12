/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as classnames from "classnames";
import { CommonProps, withOnOutsideClick } from "@bentley/ui-core";
import { MessageButton, Status, Message, MessageLayout } from "@bentley/ui-ninezone";
import "./InputField.scss";

// tslint:disable-next-line:variable-name
const DivWithOnOutsideClick = withOnOutsideClick((props: React.HTMLProps<HTMLDivElement>) => (<div {...props} />));

/** Properties of [[InputFieldMessage]] component.
 * @beta
 */
export interface InputFieldMessageProps extends CommonProps {
  /** Parent of message. */
  target: Element;
  /** Message content. */
  children: React.ReactNode;
  /** Function that will close the message */
  onClose: () => void;
}

/** InputField message is a popup error message that appears under invalid user input.
 * @beta
 */
export class InputFieldMessage extends React.Component<InputFieldMessageProps> {
  public render(): React.ReactNode {
    return ReactDOM.createPortal(this._getErrorMessage(), this.props.target);
  }

  /**
   * Provides a message to display inside of the portal.
   */
  private _getErrorMessage(): React.ReactNode {
    const className = classnames(
      "uifw-popup-message-inputField",
      this.props.className);

    return (
      <DivWithOnOutsideClick
        className={className}
        style={this.props.style}
        // TODO: dismiss onOutsideClick without immediately dismissing message
        children={
          <Message
            className="uifw-popup-message-inputField"
            status={Status.Error}
            icon={
              <i className="icon icon-status-error-hollow" />
            }
          >
            <MessageLayout
              buttons={
                <MessageButton onClick={this.props.onClose}>
                  <i className="icon icon-close" />
                </MessageButton>
              }
              className="uifw-message-inputField-content"
            >
              {this.props.children}
            </MessageLayout>
          </Message>
        }
      />
    );
  }
}
