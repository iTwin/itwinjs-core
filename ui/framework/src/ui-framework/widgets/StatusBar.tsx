/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { StatusBarFieldId, StatusBarWidgetControl } from "./StatusBarWidgetControl";

import {
  Footer,
  Toast as ToastMessage,
  Message,
  MessageLayout,
  MessageButton, Status, MessageHyperlink, MessageProgress,
} from "@bentley/ui-ninezone";
import { NotifyMessageDetails, OutputMessageType } from "@bentley/imodeljs-frontend";

import { MessageContainer, MessageSeverity, SmallText, CommonProps } from "@bentley/ui-core";

import { MessageManager, MessageAddedEventArgs, ActivityMessageEventArgs } from "../messages/MessageManager";
import { UiFramework } from "../UiFramework";
import { UiShowHideManager } from "../utils/UiShowHideManager";
import { MessageDiv } from "../messages/MessageSpan";

import "./StatusBar.scss";

// tslint:disable-next-line: variable-name
const MessageLabel = (props: { message: HTMLElement | string }): JSX.Element => {
  return <MessageDiv className="uifw-statusbar-message-label" message={props.message} />;
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
export interface StatusBarProps extends CommonProps {
  widgetControl?: StatusBarWidgetControl;
  isInFooterMode: boolean;
}

/** Status Bar React component.
 * @public
 */
export class StatusBar extends React.Component<StatusBarProps, StatusBarState> {
  private _toastTarget = React.createRef<HTMLDivElement>();

  constructor(props: StatusBarProps) {
    super(props);
  }
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

    // istanbul ignore else
    if (widgetControl && widgetControl.getReactNode) {
      footerSections = widgetControl.getReactNode({
        isInFooterMode: this.props.isInFooterMode,
        openWidget: this.state.openWidget,
        toastTargetRef: this._toastTarget,
        onOpenWidget: this._handleOpenWidget,
      });
    }

    return (
      <Footer
        messages={this.getFooterMessage()}
        isInFooterMode={this.props.isInFooterMode}
        onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
      >
        {footerSections}
      </Footer>
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
    this.setState({
      visibleMessage,
      activityMessageInfo: args,
      isActivityMessageVisible: args.restored ? true : this.state.isActivityMessageVisible,
    });
  }

  /**
   * Hides ActivityMessage after cancellation
   */
  private _handleActivityMessageCancelledEvent = () => {
    this.setState({
      isActivityMessageVisible: false,
    });
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
            animateOutTo={this._toastTarget}
            onAnimatedOut={() => this._hideMessages()}
            timeout={2500}
            content={
              <Message
                status={StatusBar.severityToStatus(severity)}
                icon={
                  <i className={`icon ${MessageContainer.getIconClassName(severity, true)}`} />
                }
              >
                <MessageLayout>
                  <MessageLabel message={this.state.messageDetails.briefMessage} />
                  {this.state.messageDetails.detailedMessage &&
                    <>
                      <br />
                      <MessageLabel message={this.state.messageDetails.detailedMessage} />
                    </>
                  }
                </MessageLayout>
              </Message>
            }
          />
        );
      }
      case (StatusBarMessageType.Sticky): {
        return (
          <Message
            status={StatusBar.severityToStatus(severity)}
            icon={
              <i className={`icon ${MessageContainer.getIconClassName(severity, true)}`} />
            }
          >
            <MessageLayout
              buttons={
                <MessageButton onClick={this._hideMessages}>
                  <i className="icon icon-close" />
                </MessageButton>
              }
            >
              <MessageLabel message={this.state.messageDetails.briefMessage} />
              {this.state.messageDetails.detailedMessage &&
                <>
                  <br />
                  <MessageLabel message={this.state.messageDetails.detailedMessage} />
                </>
              }
            </MessageLayout>
          </Message>
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
    // istanbul ignore next
    if (!this.state.activityMessageInfo)
      return null;

    const messageDetails = this.state.activityMessageInfo.details;
    const percentComplete = UiFramework.translate("activityCenter.percentComplete");
    return (
      <Message
        status={Status.Information}
        icon={
          <i className="icon icon-info-hollow" />
        }
      >
        <MessageLayout
          buttons={
            (messageDetails && messageDetails.supportsCancellation) ?
              <div>
                <MessageHyperlink onClick={this._cancelActivityMessage}>Cancel</MessageHyperlink>
                <span>&nbsp;</span>
                <MessageButton onClick={this._dismissActivityMessage}>
                  <i className="icon icon-close" />
                </MessageButton>
              </div> :
              <MessageButton onClick={this._dismissActivityMessage}>
                <i className="icon icon-close" />
              </MessageButton>
          }
          progress={
            (messageDetails && messageDetails.showProgressBar) &&
            <MessageProgress
              status={Status.Information}
              progress={this.state.activityMessageInfo.percentage}
            />
          }
        >
          <div>
            {<MessageLabel message={this.state.activityMessageInfo.message} />}
            {
              (messageDetails && messageDetails.showPercentInMessage) &&
              <SmallText>{this.state.activityMessageInfo.percentage + percentComplete}</SmallText>
            }
          </div>
        </MessageLayout>
      </Message>
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
    this.setState({
      isActivityMessageVisible: false,
    });
  }

  private _handleOpenWidget = (openWidget: StatusBarFieldId) => {
    this.setState({
      openWidget,
    });
  }

  private _hideMessages = () => {
    this.setVisibleMessage(StatusBarMessageType.None);
  }

  private setVisibleMessage(visibleMessage: StatusBarMessageType, messageDetails?: NotifyMessageDetails) {
    this.setState({
      visibleMessage,
      messageDetails,
    });
  }
}
