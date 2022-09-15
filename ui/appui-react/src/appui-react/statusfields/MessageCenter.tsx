/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import { OutputMessagePriority } from "@itwin/core-frontend";
import { FooterPopup, MessageCenter, MessageCenterDialog, MessageCenterMessage, MessageCenterTab } from "@itwin/appui-layout-react";
import { MessageManager } from "../messages/MessageManager";
import { MessageSpan } from "../messages/MessageSpan";
import { NotifyMessageDetailsType } from "../messages/ReactNotifyMessageDetails";
import { UiFramework } from "../UiFramework";
import { CommonProps } from "@itwin/core-react";

/** Enum for the [[MessageCenterField]] active tab
 * @internal
 */
enum MessageCenterActiveTab {
  AllMessages,
  Problems,
}

/** State for the [[MessageCenterField]] React component
 * @internal
 */
interface MessageCenterState {
  activeTab: MessageCenterActiveTab;
  target: HTMLDivElement | null;
  messageCount: number;
  isOpen: boolean;
}

/** Message Center Field React component.
 * @public
 */
export class MessageCenterField extends React.Component<CommonProps, MessageCenterState> {
  private _indicator = React.createRef<HTMLDivElement>();
  private _title = UiFramework.translate("messageCenter.messages");
  private _unloadMessagesUpdatedHandler?: () => void;
  private _removeOpenMessagesCenterHandler?: () => void;

  constructor(p: CommonProps) {
    super(p);

    this.state = {
      activeTab: MessageCenterActiveTab.AllMessages,
      target: null,
      messageCount: MessageManager.messages.length,
      isOpen: false,
    };
  }

  /** @internal */
  public override componentDidMount() {
    this._unloadMessagesUpdatedHandler = MessageManager.onMessagesUpdatedEvent.addListener(this._handleMessagesUpdatedEvent, this);
    this._removeOpenMessagesCenterHandler = MessageManager.onOpenMessageCenterEvent.addListener(this._handleOpenMessageCenterEvent, this);
    MessageManager.registerAnimateOutToElement(this._indicator.current);
  }

  /** @internal */
  public override componentWillUnmount() {
    // istanbul ignore else
    if (this._unloadMessagesUpdatedHandler) {
      this._unloadMessagesUpdatedHandler();
      this._unloadMessagesUpdatedHandler = undefined;
    }
    // istanbul ignore else
    if (this._removeOpenMessagesCenterHandler) {
      this._removeOpenMessagesCenterHandler();
      this._removeOpenMessagesCenterHandler = undefined;
    }
  }

  private _handleMessagesUpdatedEvent = () => {
    // istanbul ignore else
    if (this._unloadMessagesUpdatedHandler)
      this.setState({ messageCount: MessageManager.messages.length });
  };

  private _handleOpenMessageCenterEvent = () => {
    this.setIsOpen(true);
  };

  public override render(): React.ReactNode {
    const tooltip = `${this.state.messageCount} ${this._title}`;
    const divStyle = { ...this.props.style, height: "100%" };
    const footerMessages = (
      <>
        <div
          className={this.props.className}
          style={divStyle}
          title={tooltip}
        >
          <MessageCenter
            indicatorRef={this._indicator}
            label={this._title}
            onClick={this._handleMessageIndicatorClick}
          >
            {this.state.messageCount.toString()}
          </MessageCenter>
        </div>
        <FooterPopup
          isOpen={this.state.isOpen}
          onClose={this._handleClose}
          onOutsideClick={this._handleOutsideClick}
          target={this._indicator.current}
        >
          <MessageCenterDialog
            prompt={UiFramework.translate("messageCenter.prompt")}
            tabs={
              <>
                <MessageCenterTab
                  isActive={this.state.activeTab === MessageCenterActiveTab.AllMessages}
                  onClick={() => this._changeActiveTab(MessageCenterActiveTab.AllMessages)}
                >
                  {UiFramework.translate("messageCenter.all")}
                </MessageCenterTab>
                <MessageCenterTab
                  isActive={this.state.activeTab === MessageCenterActiveTab.Problems}
                  onClick={() => this._changeActiveTab(MessageCenterActiveTab.Problems)}
                >
                  {UiFramework.translate("messageCenter.errors")}
                </MessageCenterTab>
              </>
            }
            title={this._title}
          >
            {this.getMessages()}
          </MessageCenterDialog>
        </FooterPopup>
      </>
    );

    return footerMessages;
  }

  private _handleClose = () => {
    this.setIsOpen(false);
  };

  private _handleOutsideClick = (e: MouseEvent) => {
    if (!this._indicator.current ||
      !(e.target instanceof Node) ||
      this._indicator.current.contains(e.target))
      return;

    this._handleClose();
  };

  private _handleMessageIndicatorClick = () => {
    this.setIsOpen(!this.state.isOpen);
  };

  private _changeActiveTab = (tab: MessageCenterActiveTab) => {
    this.setState({ activeTab: tab });
  };

  private getMessages(): React.ReactChild[] {
    const messages = MessageManager.messages.slice(0).reverse();
    const tabRows: React.ReactChild[] = new Array<React.ReactChild>();

    messages.forEach((details: NotifyMessageDetailsType, index: number) => {
      /* istanbul ignore else */
      if (this.state.activeTab === MessageCenterActiveTab.AllMessages || this.isProblemStatus(details.priority)) {

        const iconClassName = MessageManager.getIconClassName(details);
        const message = details.briefMessage;

        tabRows.push(
          <MessageCenterMessage
            key={index.toString()}
            icon={<i className={iconClassName} />}
          >
            <MessageSpan message={message} />
            {details.detailedMessage &&
              <>
                <br />
                <MessageSpan className="uicore-text-small" message={details.detailedMessage} />
              </>
            }
          </MessageCenterMessage>,
        );
      }
    });

    return tabRows;
  }

  private isProblemStatus(priority: OutputMessagePriority): boolean {
    // See priority values in DgnPlatform defined in NotificationManager

    if (priority === OutputMessagePriority.Error || priority === OutputMessagePriority.Fatal)
      return true;

    return false;
  }

  private setIsOpen(isOpen: boolean) {
    this.setState({isOpen});
  }
}
