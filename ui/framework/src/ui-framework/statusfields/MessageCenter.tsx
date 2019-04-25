/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";

import { NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";

import { UiFramework } from "../UiFramework";

import { StatusBarFieldId } from "../widgets/StatusBarWidgetControl";
import { MessageManager } from "../messages/MessageManager";
import {
  MessageCenter, MessageCenterTab, MessageCenterMessage, MessageCenterDialog,
  TitleBarButton, FooterPopup,
} from "@bentley/ui-ninezone";
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
}

/** Properties of [[MessageCenterField]] component.
 * @public
 */
export interface MessageCenterFieldProps extends StatusFieldProps {
  /** Message center dialog target. */
  targetRef?: React.Ref<HTMLElement>;
}

/** Message Center Field React component.
 * @public
 */
export class MessageCenterField extends React.Component<MessageCenterFieldProps, MessageCenterState> {
  private _className: string;
  private _target: React.MutableRefObject<HTMLDivElement | null> = {
    current: null,
  };
  private _indicator = React.createRef<HTMLDivElement>();

  public readonly state: Readonly<MessageCenterState> = {
    activeTab: MessageCenterActiveTab.AllMessages,
  };

  constructor(p: MessageCenterFieldProps) {
    super(p);

    const instance = this.constructor;
    this._className = instance.name;
  }

  public render(): React.ReactNode {
    const messageCount = MessageManager.messages.length;
    const footerMessages = (
      <>
        <MessageCenter
          className={this.props.className}
          style={this.props.style}
          indicatorRef={this._indicator}
          isInFooterMode={this.props.isInFooterMode}
          label={this.props.isInFooterMode ? UiFramework.i18n.translate("UiFramework:messageCenter.messages") : undefined}
          onClick={this._handleMessageIndicatorClick}
          targetRef={this._handleTargetRef}
        >
          {messageCount.toString()}
        </MessageCenter>
        <FooterPopup
          isOpen={this.props.openWidget === this._className}
          onClose={this._handleClose}
          onOutsideClick={this._handleOutsideClick}
          target={this._target}
        >
          <MessageCenterDialog
            buttons={
              <>
                <TitleBarButton title={UiFramework.i18n.translate("UiFramework:messageCenter.export")}>
                  <i className={"icon icon-export"} />
                </TitleBarButton>
                <TitleBarButton onClick={this._handleCloseMessageIndicatorClick} title={UiFramework.i18n.translate("UiCore:dialog.close")}>
                  <i className={"icon icon-close"} />
                </TitleBarButton>
              </>
            }
            prompt={UiFramework.i18n.translate("UiFramework:messageCenter.prompt")}
            tabs={
              <>
                <MessageCenterTab
                  isActive={this.state.activeTab === MessageCenterActiveTab.AllMessages}
                  onClick={() => this._changeActiveTab(MessageCenterActiveTab.AllMessages)}
                >
                  {UiFramework.i18n.translate("UiFramework:messageCenter.all")}
                </MessageCenterTab>
                <MessageCenterTab
                  isActive={this.state.activeTab === MessageCenterActiveTab.Problems}
                  onClick={() => this._changeActiveTab(MessageCenterActiveTab.Problems)}
                >
                  {UiFramework.i18n.translate("UiFramework:messageCenter.problems")}
                </MessageCenterTab>
              </>
            }
            title={UiFramework.i18n.translate("UiFramework:messageCenter.messages")}
          >
            {this.getMessages()}
          </MessageCenterDialog>
        </FooterPopup>
      </>
    );

    return footerMessages;
  }

  private _handleTargetRef = (instance: HTMLDivElement | null) => {
    if (typeof this.props.targetRef === "function")
      this.props.targetRef(instance);
    else if (this.props.targetRef)
      (this.props.targetRef as React.MutableRefObject<HTMLElement | null>).current = instance;
    this._target.current = instance;
  }

  private _handleClose = () => {
    this.setOpenWidget(null);
  }

  private _handleOutsideClick = (e: MouseEvent) => {
    if (!this._indicator.current ||
      !(e.target instanceof Node) ||
      this._indicator.current.contains(e.target))
      return;

    this._handleClose();
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
          >
            <span dangerouslySetInnerHTML={{ __html: message }} />
            {details.detailedMessage &&
              <>
                <br />
                <span className="uicore-text-small" dangerouslySetInnerHTML={{ __html: details.detailedMessage }} />
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
    this.props.onOpenWidget(openWidget);
  }
}
