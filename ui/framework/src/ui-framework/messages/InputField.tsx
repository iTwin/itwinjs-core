/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";
import { Popup, Position } from "@bentley/ui-core";
import { MessageManager, InputFieldMessageEventArgs } from "../messages/MessageManager";
import { OutputMessagePriority } from "@bentley/imodeljs-frontend";

import "./InputField.scss";
import { MessageDiv } from "./MessageSpan";

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

    return (
      <Popup
        isOpen={isVisible}
        position={Position.BottomLeft}
        onClose={this._onInputMessageClose}
        target={inputFieldElement}>
        <div className="uifw-popup-message-inputField">
          <div className="uifw-popup-message-inputField-content">
            <div className="uifw-popup-message-inputField-primary">
              {(priority === OutputMessagePriority.Warning) && <div className="icon icon-status-warning" />}
              {(priority === OutputMessagePriority.Error) && <div className="icon icon-status-error" />}
              {(priority === OutputMessagePriority.Info) && <div className="icon icon-info" />}
              {
                message && <MessageDiv className="uifw-popup-message-brief" message={message} />
              }
            </div>
            {
              detailedMessage && <MessageDiv className="uifw-popup-message-detailed" message={detailedMessage} />
            }
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
    this.setState((_prevState) => ({ isVisible: false }));
  }

  private _handleInputFieldMessageAddedEvent = (args: InputFieldMessageEventArgs) => {
    this.setState((_prevState) => ({
      inputFieldElement: args.target as HTMLElement,
      message: args.messageText,
      isVisible: true,
      priority: args.priority,
      detailedMessage: args.detailedMessage,
    }));
  }

  private _handleInputFieldMessageRemovedEvent = () => {
    this.setState((_prevState) => ({
      isVisible: false,
    }));
  }
}
