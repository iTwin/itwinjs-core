/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";

import { NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";

import { UiFramework } from "../UiFramework";

import { StatusBarFieldId, IStatusBar } from "../widgets/StatusBarWidgetControl";
import { MessageManager } from "../messages/MessageManager";
import {
  MessageCenterIndicator, MessageCenterTab, MessageCenterMessage, MessageCenterDialog as MessageCenterDialogComponent,
  MessageCenterDialogContent as MessageCenterDialogContentComponent, MessageCenterButton, withContainIn, containHorizontally,
} from "@bentley/ui-ninezone";
import { withOnOutsideClick } from "@bentley/ui-core";

// tslint:disable-next-line: variable-name
const MessageCenterDialog = withOnOutsideClick(MessageCenterDialogComponent, undefined, false);
// tslint:disable-next-line: variable-name
const MessageCenterDialogContent = withContainIn(MessageCenterDialogContentComponent);

/** Properties for the [[MessageCenterField]] React component
 * @public
 */
export interface MessageCenterProps {
  statusBar: IStatusBar;
  isInFooterMode: boolean;
  openWidget: StatusBarFieldId;
}

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
}

/** Message Center Field React component.
 * @public
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
    const messageCount = MessageManager.messages.length;
    const footerMessages = (
      <MessageCenterIndicator
        ref={(element: any) => { this._element = element; }}
        label={this.props.isInFooterMode ? UiFramework.i18n.translate("UiFramework:messageCenter.messages") : undefined}
        balloonLabel={messageCount.toString()}
        onClick={this._handleMessageIndicatorClick}
        dialog={
          this.props.openWidget !== this._className ? undefined :
            <MessageCenterDialog
              content={
                <MessageCenterDialogContent
                  buttons={
                    <>
                      <MessageCenterButton title={UiFramework.i18n.translate("UiFramework:messageCenter.export")}>
                        <i className={"icon icon-export"} />
                      </MessageCenterButton>
                      <MessageCenterButton onClick={this._handleCloseMessageIndicatorClick} title={UiFramework.i18n.translate("UiCore:dialog.close")}>
                        <i className={"icon icon-close"} />
                      </MessageCenterButton>
                    </>
                  }
                  containFn={containHorizontally}
                  messages={this.getMessages()}
                  prompt={UiFramework.i18n.translate("UiFramework:messageCenter.prompt")}
                  tabs={
                    <>
                      <MessageCenterTab
                        isOpen={this.state.activeTab === MessageCenterActiveTab.AllMessages}
                        onClick={() => this._changeActiveTab(MessageCenterActiveTab.AllMessages)}
                      >
                        {UiFramework.i18n.translate("UiFramework:messageCenter.all")}
                      </MessageCenterTab>
                      <MessageCenterTab
                        isOpen={this.state.activeTab === MessageCenterActiveTab.Problems}
                        onClick={() => this._changeActiveTab(MessageCenterActiveTab.Problems)}
                      >
                        {UiFramework.i18n.translate("UiFramework:messageCenter.problems")}
                      </MessageCenterTab>
                    </>
                  }
                  title={UiFramework.i18n.translate("UiFramework:messageCenter.messages")}
                />
              }
              onOutsideClick={this._handleCloseMessageIndicatorClick}
            />
        }
      />
    );

    this.props.statusBar.setFooterMessages(this._element);

    return footerMessages;
  }

  private _handleMessageIndicatorClick = () => {
    const isOpen = this.props.openWidget === this._className;
    if (isOpen)
      this.setOpenWidget(null);
    else
      this.setOpenWidget(this._className);
  }

  private _handleCloseMessageIndicatorClick = () => {
    this.setOpenWidget(null);
  }

  private _changeActiveTab = (tab: MessageCenterActiveTab) => {
    this.setState((_prevState) => {
      return {
        activeTab: tab,
      };
    });
  }

  private getMessages(): React.ReactChild[] {
    const messages = MessageManager.messages.slice(0).reverse();
    const tabRows: React.ReactChild[] = new Array<React.ReactChild>();

    messages.forEach((details: NotifyMessageDetails, index: number) => {
      /* istanbul ignore else */
      if (this.state.activeTab === MessageCenterActiveTab.AllMessages || this.isProblemStatus(details.priority)) {

        const iconClassName = MessageManager.getIconClassName(details);
        const message = details.briefMessage;

        tabRows.push(
          <MessageCenterMessage
            key={index.toString()}
            icon={<i className={iconClassName} />}
            content={
              <>
                <span dangerouslySetInnerHTML={{ __html: message }} />
                {details.detailedMessage &&
                  <>
                    <br />
                    <span className="uicore-text-small" dangerouslySetInnerHTML={{ __html: details.detailedMessage }} />
                  </>
                }
              </>
            }
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
