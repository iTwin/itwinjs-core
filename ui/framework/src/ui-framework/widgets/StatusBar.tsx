/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { StatusBarFieldId, IStatusBar, StatusBarWidgetControl } from "./StatusBarWidgetControl";

import {
  Footer,
  Activity as ActivityMessage,
  Toast as ToastMessage,
  Sticky as StickyMessage,
  StatusMessage,
  MessageLayout as StatusMessageLayout,
  MessageButton, Status, Hyperlink, Progress,
} from "@bentley/ui-ninezone";
import { NotifyMessageDetails, OutputMessageType } from "@bentley/imodeljs-frontend";

import { MessageContainer, MessageSeverity, SmallText } from "@bentley/ui-core";

import { MessageManager, MessageAddedEventArgs, ActivityMessageEventArgs } from "../messages/MessageManager";
import { UiFramework } from "../UiFramework";

import "./StatusBar.scss";

// tslint:disable-next-line: variable-name
const MessageLabel = (props: { text: string }) => {
  return (
    <div
      className="uifw-statusbar-message-label"
      dangerouslySetInnerHTML={{ __html: props.text }} />
  );
};

/** Enum for StatusBar Message Type
 * @internal
 */
enum StatusBarMessageType {
  None,
  Activity,
  Toast,
  Sticky,
}

/** State for the [[StatusBar]] React component
 * @internal
 */
interface StatusBarState {
  openWidget: StatusBarFieldId;
  visibleMessage: StatusBarMessageType;
  messageDetails: NotifyMessageDetails | undefined;
  activityMessageInfo: ActivityMessageEventArgs | undefined;
  isActivityMessageVisible: boolean;
  toastMessageKey: number;
}

/** Properties for the [[StatusBar]] React component
 * @public
 */
export interface StatusBarProps {
  widgetControl?: StatusBarWidgetControl;
  isInFooterMode: boolean;
}

/** Status Bar React component.
 * @public
 */
export class StatusBar extends React.Component<StatusBarProps, StatusBarState> implements IStatusBar {
  private _footerMessages: any;

  public static severityToStatus(severity: MessageSeverity): Status {
    switch (severity) {
      case MessageSeverity.Error:
      case MessageSeverity.Fatal:
      case MessageSeverity.Warning:
        return Status.Error;
    }
    return Status.Information;
  }

  /** @internal */
  public readonly state: Readonly<StatusBarState> = {
    openWidget: null,
    visibleMessage: StatusBarMessageType.None,
    messageDetails: undefined,
    activityMessageInfo: undefined,
    isActivityMessageVisible: false,
    toastMessageKey: 0,
  };

  public render(): React.ReactNode {
    let footerSections: React.ReactNode = null;
    const widgetControl = this.props.widgetControl;
    if (widgetControl && widgetControl.getReactNode) {
      footerSections = widgetControl.getReactNode(this, this.props.isInFooterMode, this.state.openWidget);
    }

    return (
      <Footer
        message={this.getFooterMessage()}
        indicators={footerSections}
        isInFooterMode={this.props.isInFooterMode}
      />
    );
  }

  public componentDidMount() {
    MessageManager.onMessageAddedEvent.addListener(this._handleMessageAddedEvent);
    MessageManager.onActivityMessageUpdatedEvent.addListener(this._handleActivityMessageUpdatedEvent);
    MessageManager.onActivityMessageCancelledEvent.addListener(this._handleActivityMessageCancelledEvent);
  }

  public componentWillUnmount() {
    MessageManager.onMessageAddedEvent.removeListener(this._handleMessageAddedEvent);
    MessageManager.onActivityMessageUpdatedEvent.removeListener(this._handleActivityMessageUpdatedEvent);
    MessageManager.onActivityMessageCancelledEvent.removeListener(this._handleActivityMessageCancelledEvent);
  }

  private _handleMessageAddedEvent = (args: MessageAddedEventArgs) => {
    let statusbarMessageType: StatusBarMessageType = StatusBarMessageType.None;

    switch (args.message.msgType) {
      case OutputMessageType.Toast:
        statusbarMessageType = StatusBarMessageType.Toast;
        break;
      case OutputMessageType.Sticky:
        statusbarMessageType = StatusBarMessageType.Sticky;
        break;
    }

    this.setVisibleMessage(statusbarMessageType, args.message);

    if (args.message.msgType === OutputMessageType.Toast) {
      this.setState((prevState) => ({ toastMessageKey: prevState.toastMessageKey + 1 }));
    }
  }

  /**
   * Sets state of the status bar to updated values reflecting activity progress.
   * @param args  New values to set for ActivityMessage
   */
  private _handleActivityMessageUpdatedEvent = (args: ActivityMessageEventArgs) => {
    const visibleMessage = StatusBarMessageType.Activity;
    this.setState((_prevState) => ({
      visibleMessage,
      activityMessageInfo: args,
      isActivityMessageVisible: args.restored ? true : this.state.isActivityMessageVisible,
    }));
  }

  /**
   * Hides ActivityMessage after cancellation
   */
  private _handleActivityMessageCancelledEvent = () => {
    this.setState((_prevState) => ({
      isActivityMessageVisible: false,
    }));
  }

  private getFooterMessage() {
    if (this.state.activityMessageInfo && this.state.isActivityMessageVisible) {
      return this.getActivityMessage();
    }

    if (!this.state.messageDetails)
      return;

    const severity = MessageManager.getSeverity(this.state.messageDetails);
    switch (this.state.visibleMessage) {
      case (StatusBarMessageType.Toast): {
        return (
          <ToastMessage
            animateOutTo={this._footerMessages}
            onAnimatedOut={() => this._hideMessages()}
            timeout={2500}
            content={
              <StatusMessage
                status={StatusBar.severityToStatus(severity)}
                icon={
                  <i className={`icon ${MessageContainer.getIconClassName(severity, true)}`} />
                }
              >
                <StatusMessageLayout
                  label={
                    <>
                      <MessageLabel text={this.state.messageDetails.briefMessage} />
                      {this.state.messageDetails.detailedMessage &&
                        <>
                          <br />
                          <MessageLabel text={this.state.messageDetails.detailedMessage} />
                        </>
                      }
                    </>
                  }
                />
              </StatusMessage>
            }
          />
        );
      }
      case (StatusBarMessageType.Sticky): {
        return (
          <StickyMessage>
            <StatusMessage
              status={StatusBar.severityToStatus(severity)}
              icon={
                <i className={`icon ${MessageContainer.getIconClassName(severity, true)}`} />
              }
            >
              <StatusMessageLayout
                label={
                  <>
                    <MessageLabel text={this.state.messageDetails.briefMessage} />
                    {this.state.messageDetails.detailedMessage &&
                      <>
                        <br />
                        <MessageLabel text={this.state.messageDetails.detailedMessage} />
                      </>
                    }
                  </>
                }
                buttons={
                  <MessageButton onClick={this._hideMessages}>
                    <i className="icon icon-close" />
                  </MessageButton>
                }
              />
            </StatusMessage>
          </StickyMessage>
        );
      }
    }

    return undefined;
  }

  /**
   * Returns ActivityMessage to display with most recent values
   * reflecting activity progress.
   */
  private getActivityMessage(): React.ReactNode {
    const messageDetails = this.state.activityMessageInfo!.details;
    const percentComplete = UiFramework.i18n.translate("UiFramework:activityCenter.percentComplete");
    return (
      <ActivityMessage>
        <StatusMessage
          status={Status.Information}
          icon={
            <i className="icon icon-info-hollow" />
          }
        >
          <StatusMessageLayout
            label={
              <div>
                {this.state.activityMessageInfo && <MessageLabel text={this.state.activityMessageInfo.message} />}
                {
                  (messageDetails && messageDetails.showPercentInMessage) &&
                  <SmallText>{this.state.activityMessageInfo!.percentage + percentComplete}</SmallText>
                }
              </div>
            }
            buttons={
              (messageDetails && messageDetails.supportsCancellation) ?
                <>
                  <div>
                    <Hyperlink text="Cancel"
                      onClick={this._cancelActivityMessage}
                    />
                    <span>&nbsp;</span>
                    <MessageButton onClick={this._dismissActivityMessage}>
                      <i className="icon icon-close" />
                    </MessageButton>
                  </div>
                </> :
                <>
                  <MessageButton onClick={this._dismissActivityMessage}>
                    <i className="icon icon-close" />
                  </MessageButton>
                </>
            }
            progress={
              (messageDetails && messageDetails.showProgressBar) &&
              <Progress
                status={Status.Information}
                progress={this.state.activityMessageInfo!.percentage}
              />
            }
          />
        </StatusMessage>
      </ActivityMessage >
    );
  }

  /**
   * Ends canceled process and dismisses ActivityMessage
   */
  private _cancelActivityMessage = () => {
    MessageManager.endActivityMessage(false);
    this._dismissActivityMessage();
  }

  /**
   * Dismisses ActivityMessage
   */
  private _dismissActivityMessage = () => {
    this.setState((_prevState) => ({
      isActivityMessageVisible: false,
    }));
  }

  public setOpenWidget(openWidget: StatusBarFieldId) {
    this.setState((_prevState, _props) => {
      return {
        openWidget,
      };
    });
  }

  private _hideMessages = () => {
    this.setVisibleMessage(StatusBarMessageType.None);
  }

  private setVisibleMessage(visibleMessage: StatusBarMessageType, messageDetails?: NotifyMessageDetails) {
    this.setState((_prevState) => ({
      visibleMessage,
      messageDetails,
    }));
  }

  public setFooterMessages(element: any): void {
    this._footerMessages = element;
  }
}
