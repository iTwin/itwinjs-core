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
import { StatusBarFieldId } from "../statusbar/StatusBarWidgetControl";
import { UiFramework } from "../UiFramework";
import { StatusFieldProps } from "./StatusFieldProps";

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
  openWidget: string | null;
}

/** Properties for withMessageCenterFieldProps HOC.
 * @public
 */
export interface MessageCenterFieldProps extends StatusFieldProps {
  /** Message center dialog target.
   * @deprecated Use `MessageManager.registerAnimateOutToElement` to register this ref in the related component.
  */
  targetRef?: React.Ref<HTMLElement>;
}

/** Message Center Field React component.
 * @public
 */
export class MessageCenterField extends React.Component<MessageCenterFieldProps, MessageCenterState> {
  private _className: string;
  private _indicator = React.createRef<HTMLDivElement>();
  private _title = UiFramework.translate("messageCenter.messages");
  private _unloadMessagesUpdatedHandler?: () => void;
  private _removeOpenMessagesCenterHandler?: () => void;

  constructor(p: MessageCenterFieldProps) {
    super(p);

    const instance = this.constructor;
    this._className = instance.name;

    this.state = {
      activeTab: MessageCenterActiveTab.AllMessages,
      target: null,
      messageCount: MessageManager.messages.length,
      // eslint-disable-next-line deprecation/deprecation
      openWidget: p.openWidget ?? null,
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
    this.setOpenWidget(this._className);
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
          ref={this._handleTargetRef}
        >
          <MessageCenter
            indicatorRef={this._indicator}
            // eslint-disable-next-line deprecation/deprecation
            isInFooterMode={this.props.isInFooterMode ?? true}
            // eslint-disable-next-line deprecation/deprecation
            label={(this.props.isInFooterMode ?? true) ? this._title : undefined}
            onClick={this._handleMessageIndicatorClick}
          >
            {this.state.messageCount.toString()}
          </MessageCenter>
        </div>
        <FooterPopup // eslint-disable-line deprecation/deprecation
          isOpen={(this.props.openWidget ?? this.state.openWidget) === this._className} // eslint-disable-line deprecation/deprecation
          onClose={this._handleClose}
          onOutsideClick={this._handleOutsideClick}
          target={this.state.target}
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

  private _handleTargetRef = (target: HTMLDivElement | null) => {
    // eslint-disable-next-line deprecation/deprecation
    const ref = this.props.targetRef;
    if (typeof ref === "function")
      ref(target);
    else if (ref)
      (ref as React.MutableRefObject<HTMLElement | null>).current = target;
    this.setState({ target });
  };

  private _handleClose = () => {
    this.setOpenWidget(null);
  };

  private _handleOutsideClick = (e: MouseEvent) => {
    if (!this._indicator.current ||
      !(e.target instanceof Node) ||
      this._indicator.current.contains(e.target))
      return;

    this._handleClose();
  };

  private _handleMessageIndicatorClick = () => {
    // eslint-disable-next-line deprecation/deprecation
    const isOpen = (this.props.openWidget ?? this.state.openWidget) === this._className;
    if (isOpen)
      this.setOpenWidget(null);
    else
      this.setOpenWidget(this._className);
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

  private setOpenWidget(openWidget: StatusBarFieldId) {
    // eslint-disable-next-line deprecation/deprecation
    this.props.onOpenWidget?.(openWidget);
    this.setState({openWidget});
  }
}
