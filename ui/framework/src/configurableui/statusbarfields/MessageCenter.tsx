/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";

import { NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";

import "../configurableui.scss";

import UiFramework from "../../UiFramework";

import { StatusBarFieldId, IStatusBar } from "../StatusBarWidgetControl";
import { MessageManager } from "../MessageManager";

import MessageCenterIndicator from "@bentley/ui-ninezone/lib/footer/message-center/Indicator";
import MessageCenterTab from "@bentley/ui-ninezone/lib/footer/message-center/Tab";
import MessageCenterMessage from "@bentley/ui-ninezone/lib/footer/message-center/Message";
import MessageCenter, { MessageCenterButton } from "@bentley/ui-ninezone/lib/footer/message-center/MessageCenter";

export interface MessageCenterProps {
  statusBar: IStatusBar;
  isInFooterMode: boolean;
  openWidget: StatusBarFieldId;
}

export enum MessageCenterActiveTab {
  AllMessages,
  Problems,
}

export interface MessageCenterState {
  activeTab: MessageCenterActiveTab;
}

/** Message Center Field React component.
 */
export class MessageCenterField extends React.Component<MessageCenterProps, MessageCenterState> {
  private _className: string;
  private _element: any;

  public readonly state: Readonly<MessageCenterState> = {
    activeTab: MessageCenterActiveTab.AllMessages,
  };

  constructor(p: MessageCenterProps) {
    super(p);

    const instance = this.constructor;
    this._className = instance.name;
  }

  public render(): React.ReactNode {
    const messageCount = MessageManager.Messages.length;
    const footerMessages = (
      <MessageCenterIndicator
        ref={(element: any) => { this._element = element; }}
        label={UiFramework.i18n.translate("UiFramework:messageCenter.messages")}
        isLabelVisible={this.props.isInFooterMode}
        balloonText={messageCount.toString()}
        onIndicatorClick={this.handleMessageIndicatorClick}
        dialog={
          <MessageCenter
            isOpen={this.props.openWidget === this._className}
            title={UiFramework.i18n.translate("UiFramework:messageCenter.messages")}
            buttons={
              <>
                <MessageCenterButton>
                  <i className={"icon icon-export"} />
                </MessageCenterButton>
                <MessageCenterButton onClick={this.handleCloseMessageIndicatorClick}>
                  <i className={"icon icon-close"} />
                </MessageCenterButton>
              </>
            }
            tabs={
              <>
                <MessageCenterTab
                  isOpen={this.state.activeTab === MessageCenterActiveTab.AllMessages}
                  onClick={() => this.changeActiveTab(MessageCenterActiveTab.AllMessages)}
                >
                  {UiFramework.i18n.translate("UiFramework:messageCenter.all")}
                </MessageCenterTab>
                <MessageCenterTab
                  isOpen={this.state.activeTab === MessageCenterActiveTab.Problems}
                  onClick={() => this.changeActiveTab(MessageCenterActiveTab.Problems)}
                >
                  {UiFramework.i18n.translate("UiFramework:messageCenter.problems")}
                </MessageCenterTab>
              </>
            }
            messages={this.getMessages()}
          />
        }
      />
    );

    this.props.statusBar.setFooterMessages(this._element);

    return footerMessages;
  }

  private handleMessageIndicatorClick = () => {
    const isOpen = this.props.openWidget === this._className;
    if (isOpen)
      this.setOpenWidget(null);
    else
      this.setOpenWidget(this._className);
  }

  private handleCloseMessageIndicatorClick = () => {
    this.setOpenWidget(null);
  }

  private changeActiveTab = (tab: MessageCenterActiveTab) => {
    this.setState((_prevState) => {
      return {
        activeTab: tab,
      };
    });
  }

  private getMessages(): React.ReactChild[] {
    const messages = MessageManager.Messages.slice(0).reverse();
    const tabRows: React.ReactChild[] = new Array<React.ReactChild>();

    messages.forEach((details: NotifyMessageDetails, index: number) => {
      if (this.state.activeTab === MessageCenterActiveTab.AllMessages || this.isProblemStatus(details.priority)) {

        const iconClassName = MessageManager.getIconClassName(details);

        tabRows.push(
          <MessageCenterMessage
            key={index.toString()}
            icon={<i className={iconClassName} />}
            content={<span>{details.briefMessage}</span>}
          />,
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
    this.props.statusBar.setOpenWidget(openWidget);
  }

}
