/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";
import classnames = require("classnames");
import { OutputMessagePriority } from "@bentley/imodeljs-frontend";
import { Popup, Position } from "@bentley/ui-core";

import { MessageManager, InputFieldMessageEventArgs } from "../messages/MessageManager";
import { MessageDiv } from "./MessageSpan";

import "./InputField.scss";

/** Properties of [[InputFieldMessage]] component.
 * @beta
 */
interface InputFieldMessageProps {
  showCloseButton?: boolean;
}

/** [[InputFieldMessage]] state.
 * @internal
 */
interface InputFieldMessageState {
  isVisible: boolean;
  priority: OutputMessagePriority;
  message: HTMLElement | string;
  detailedMessage?: HTMLElement | string;
  inputFieldElement?: HTMLElement;
  showCloseButton?: boolean;
}

/** InputField message pops up near pointer when attempting an invalid interaction.
 * @public
 */
export class InputFieldMessage extends React.PureComponent<InputFieldMessageProps, InputFieldMessageState> {
  public readonly state: Readonly<InputFieldMessageState> = {
    message: "",
    isVisible: false,
    priority: OutputMessagePriority.None,
    showCloseButton: !!this.props.showCloseButton,
  };

  public render(): React.ReactNode {
    const { isVisible, inputFieldElement, message, priority, detailedMessage, showCloseButton } = this.state;

    if (!inputFieldElement || !message) {
      return null;
    }

    let iconClassName = "";
    switch (priority) {
      case OutputMessagePriority.Warning:
        iconClassName = "icon-status-warning";
        break;
      case OutputMessagePriority.Error:
        iconClassName = "icon-status-error";
        break;
      case OutputMessagePriority.Info:
        iconClassName = "icon-info";
        break;
    }

    return (
      <Popup
        isOpen={isVisible}
        position={Position.BottomLeft}
        onClose={this._onInputMessageClose}
        target={inputFieldElement}>
        <div className="uifw-popup-message-inputField">
          <div className="uifw-popup-message-inputField-content">
            <div className="uifw-popup-message-inputField-primary">
              {iconClassName &&
                <span className="uifw-popup-message-icon"> <i className={classnames("icon", iconClassName)} /> </span>
              }
              <span className="uifw-popup-message-text">
                <MessageDiv className="uifw-popup-message-brief" message={message} />
                {detailedMessage &&
                  <MessageDiv className="uifw-popup-message-detailed" message={detailedMessage} />
                }
              </span>
            </div>
          </div>
          {showCloseButton && <div className="uifw-popup-message-close" onClick={this._onInputMessageClose}>
            <i className="icon icon-close" />
          </div>}
        </div>
      </Popup>);
  }

  public componentDidMount(): void {
    MessageManager.onInputFieldMessageAddedEvent.addListener(this._handleInputFieldMessageAddedEvent);
    MessageManager.onInputFieldMessageRemovedEvent.addListener(this._handleInputFieldMessageRemovedEvent);
  }

  public componentWillUnmount(): void {
    MessageManager.onInputFieldMessageAddedEvent.removeListener(this._handleInputFieldMessageAddedEvent);
    MessageManager.onInputFieldMessageRemovedEvent.removeListener(this._handleInputFieldMessageRemovedEvent);
  }

  private _onInputMessageClose = () => {
    this.setState({ isVisible: false });
  }

  private _handleInputFieldMessageAddedEvent = (args: InputFieldMessageEventArgs) => {
    this.setState({
      inputFieldElement: args.target as HTMLElement,
      message: args.messageText,
      isVisible: true,
      priority: args.priority,
      detailedMessage: args.detailedMessage,
    });
  }

  private _handleInputFieldMessageRemovedEvent = () => {
    this.setState({ isVisible: false });
  }
}
