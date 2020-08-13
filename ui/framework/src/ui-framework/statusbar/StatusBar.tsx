/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import "./StatusBar.scss";
import classnames from "classnames";
import * as React from "react";
import ReactResizeDetector from "react-resize-detector";
import { OutputMessageType } from "@bentley/imodeljs-frontend";
import { CommonDivProps, CommonProps, Div, Icon, IconProps, MessageSeverity, SmallText, UiCore } from "@bentley/ui-core";
import { Footer, Message, MessageButton, MessageHyperlink, MessageLayout, MessageProgress, Status } from "@bentley/ui-ninezone";
import { ActivityMessageEventArgs, MessageAddedEventArgs, MessageManager } from "../messages/MessageManager";
import { MessageDiv } from "../messages/MessageSpan";
import { NotifyMessageDetailsType, NotifyMessageType } from "../messages/ReactNotifyMessageDetails";
import { SafeAreaContext } from "../safearea/SafeAreaContext";
import { UiFramework } from "../UiFramework";
import { UiShowHideManager } from "../utils/UiShowHideManager";
import { StatusBarFieldId, StatusBarWidgetControl, StatusBarWidgetControlArgs } from "./StatusBarWidgetControl";
import { ToastMessage } from "./ToastMessage";
import { StickyMessage } from "./StickyMessage";

// cspell:ignore safearea

/** Interface for StatusBar Message */
interface StatusBarMessage {
  id: string;
  messageDetails: NotifyMessageDetailsType;
  severity: MessageSeverity;
}

/** Manager for StatusBar messages */
class StatusBarMessageManager {
  private _messages: ReadonlyArray<StatusBarMessage> = [];
  private _messageId: number = 0;

  public initialize() {
    this._messages = [];
    this._messageId = 0;
  }

  public get messages() { return this._messages; }

  public add(messageDetails: NotifyMessageDetailsType): void {
    const id = this._messageId.toString();
    const severity = MessageManager.getSeverity(messageDetails);

    const messages = this._messages.slice();
    messages.splice(0, 0, { id, messageDetails, severity });  // Insert at beginning
    this._messages = messages;

    this._messageId++;

    /** Remove Sticky messages beyond the max displayed */
    const stickyMessages = this._messages.filter((message) => message.messageDetails.msgType === OutputMessageType.Sticky);
    if (stickyMessages.length > MessageManager.maxDisplayedStickyMessages) {
      const removeMessages = stickyMessages.slice(MessageManager.maxDisplayedStickyMessages);
      for (const removeMessage of removeMessages) {
        this.remove(removeMessage.id);
      }
    }
  }

  public remove(id: string): boolean {
    let result = false;
    const foundIndex = this._messages.findIndex((message: StatusBarMessage) => message.id === id);

    // istanbul ignore else
    if (foundIndex >= 0) {
      const messages = this._messages.slice();
      messages.splice(foundIndex, 1);
      this._messages = messages;
      result = true;
    }

    return result;
  }
}

/** State for the [[StatusBar]] React component
 * @internal
 */
interface StatusBarState {
  openWidget: StatusBarFieldId;
  messages: ReadonlyArray<StatusBarMessage>;
  activityMessageInfo: ActivityMessageEventArgs | undefined;
  isActivityMessageVisible: boolean;
  toastTarget: HTMLElement | null;
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
  private _messageManager = new StatusBarMessageManager();

  public static severityToStatus(severity: MessageSeverity): Status {
    let status = Status.Information;

    switch (severity) {
      case MessageSeverity.None:
        status = Status.Success;
        break;
      case MessageSeverity.Information:
        status = Status.Information;
        break;
      case MessageSeverity.Warning:
        status = Status.Warning;
        break;
      case MessageSeverity.Error:
      case MessageSeverity.Fatal:
        status = Status.Error;
        break;
    }

    return status;
  }

  /** @internal */
  public readonly state: Readonly<StatusBarState> = {
    openWidget: null,
    messages: [],
    activityMessageInfo: undefined,
    isActivityMessageVisible: false,
    toastTarget: null,
  };

  public render(): React.ReactNode {
    let footerSections: React.ReactNode = null;
    const widgetControl = this.props.widgetControl;

    // istanbul ignore else
    if (widgetControl && widgetControl.getReactNode) {
      footerSections = widgetControl.getReactNode({
        isInFooterMode: this.props.isInFooterMode,
        openWidget: this.state.openWidget,
        toastTargetRef: this._handleToastTargetRef,
        onOpenWidget: this._handleOpenWidget,
      });
    }

    return (
      <StatusBarContext.Provider value={{
        isInFooterMode: this.props.isInFooterMode,
        openWidget: this.state.openWidget,
        toastTargetRef: this._handleToastTargetRef,
        onOpenWidget: this._handleOpenWidget,
      }}>
        <SafeAreaContext.Consumer>
          {(safeAreaInsets) => (
            <Footer
              className={this.props.className}
              messages={this.getFooterMessages()}
              isInFooterMode={this.props.isInFooterMode}
              onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
              safeAreaInsets={safeAreaInsets}
              style={this.props.style}
            >
              {footerSections}
            </Footer>
          )}
        </SafeAreaContext.Consumer>
      </StatusBarContext.Provider>
    );
  }

  public componentDidMount() {
    this._messageManager.initialize();
    MessageManager.onMessageAddedEvent.addListener(this._handleMessageAddedEvent);
    MessageManager.onActivityMessageUpdatedEvent.addListener(this._handleActivityMessageUpdatedEvent);
    MessageManager.onActivityMessageCancelledEvent.addListener(this._handleActivityMessageCancelledEvent);
    MessageManager.onMessagesUpdatedEvent.addListener(this._handleMessagesUpdatedEvent);
  }

  public componentWillUnmount() {
    MessageManager.onMessageAddedEvent.removeListener(this._handleMessageAddedEvent);
    MessageManager.onActivityMessageUpdatedEvent.removeListener(this._handleActivityMessageUpdatedEvent);
    MessageManager.onActivityMessageCancelledEvent.removeListener(this._handleActivityMessageCancelledEvent);
    MessageManager.onMessagesUpdatedEvent.removeListener(this._handleMessagesUpdatedEvent);
  }

  private _handleMessageAddedEvent = (args: MessageAddedEventArgs) => {
    this._messageManager.add(args.message);

    this.setState({ messages: this._messageManager.messages });
  }

  /** Respond to clearing the message list */
  private _handleMessagesUpdatedEvent = () => {
    if (MessageManager.messages.length === 0) {
      this._messageManager.initialize();
      this.setState({ messages: this._messageManager.messages });
    }
  }

  /**
   * Sets state of the status bar to updated values reflecting activity progress.
   * @param args  New values to set for ActivityMessage
   */
  private _handleActivityMessageUpdatedEvent = (args: ActivityMessageEventArgs) => {
    this.setState((prevState) => ({
      activityMessageInfo: args,
      isActivityMessageVisible: args.restored ? true : prevState.isActivityMessageVisible,
    }));
  }

  /**
   * Hides ActivityMessage after cancellation
   */
  private _handleActivityMessageCancelledEvent = () => {
    this.setState({
      isActivityMessageVisible: false,
    });
  }

  private getFooterMessages(): React.ReactNode {
    if (!(this.state.activityMessageInfo && this.state.isActivityMessageVisible) && this.state.messages.length === 0)
      return null;

    const messages = this.state.messages;
    const maxHeight = Math.floor(window.innerHeight * 0.66);

    return (
      <ReactResizeDetector handleHeight
        render={({ height }) => (
          <div className={classnames("uifw-statusbar-messages-container", (height >= maxHeight) && /* istanbul ignore next */ "uifw-scrollable")}>
            <ul className="uifw-statusbar-message-list">
              {messages.length > 0 &&
                messages.map((message: StatusBarMessage) => {
                  let messageNode = null;
                  if (message.messageDetails.msgType === OutputMessageType.Toast) {
                    messageNode = (
                      <li key={message.id}>
                        <ToastMessage id={message.id} messageDetails={message.messageDetails} severity={message.severity}
                          closeMessage={this._closeMessage} toastTarget={this.state.toastTarget} />
                      </li>
                    );
                  } else if (message.messageDetails.msgType === OutputMessageType.Sticky) {
                    messageNode = (
                      <li key={message.id}>
                        <StickyMessage id={message.id} messageDetails={message.messageDetails} severity={message.severity}
                          closeMessage={this._closeMessage} />
                      </li>
                    );
                  }
                  return messageNode;
                })
              }
              {(this.state.activityMessageInfo && this.state.isActivityMessageVisible) &&
                <li key="activity-message">
                  {this.getActivityMessage()}
                </li>
              }
            </ul>
          </div>
        )}
      />
    );
  }

  /**
   * Returns ActivityMessage to display with most recent values
   * reflecting activity progress.
   */
  private getActivityMessage(): React.ReactNode {
    // istanbul ignore next
    if (!this.state.activityMessageInfo)
      return null;

    return (
      <ActivityMessage
        activityMessageInfo={this.state.activityMessageInfo}
        cancelActivityMessage={this._cancelActivityMessage}
        dismissActivityMessage={this._dismissActivityMessage}
      />
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

  private _closeMessage = (id: string) => {
    // istanbul ignore else
    if (this._messageManager.remove(id))
      this.setState({ messages: this._messageManager.messages });
  }

  private _handleToastTargetRef = (toastTarget: HTMLElement | null) => {
    this.setState({ toastTarget });
  }
}

/** StatusBar With Space Between Items React functional component
 * @public
 */
export function StatusBarSpaceBetween(props: CommonDivProps) {
  const { className, ...divProps } = props;
  return <Div {...divProps} mainClassName={className ? className : "uifw-statusbar-space-between"} />;
}

/** StatusBar Left Section React functional component
 * @public
 */
export function StatusBarLeftSection(props: CommonDivProps) {
  const { className, ...divProps } = props;
  return <Div {...divProps} mainClassName={className ? className : "uifw-statusbar-left"} />;
}

/** StatusBar Center Section React functional component
 * @public
 */
export function StatusBarCenterSection(props: CommonDivProps) {
  const { className, ...divProps } = props;
  return <Div {...divProps} mainClassName={className ? className : "uifw-statusbar-center"} />;
}

/** StatusBar Right Section React functional component
 * @public
 */
export function StatusBarRightSection(props: CommonDivProps) {
  const { className, ...divProps } = props;
  return <Div {...divProps} mainClassName={className ? className : "uifw-statusbar-right"} />;
}

/** Context providing values for StatusFieldProps and MessageCenterFieldProps
 *  @internal
 */
export const StatusBarContext = React.createContext<StatusBarWidgetControlArgs>({ // eslint-disable-line @typescript-eslint/naming-convention
  isInFooterMode: true,
  onOpenWidget: /* istanbul ignore next */ () => { },
  openWidget: "",
  toastTargetRef: { current: null },
});

/** Message String/Label
 * @internal
 */
export function MessageLabel(props: { message: NotifyMessageType, className: string }) {
  const classNames = classnames("uifw-statusbar-message-label", props.className);
  return <MessageDiv className={classNames} message={props.message} />;
}

/** Icon for Message
 * @internal
 */
export function HollowIcon(props: IconProps) {
  return (
    <span className="uifw-statusbar-hollow-icon">
      <Icon {...props} />
    </span>
  );
}

/** Properties for a [[ActivityMessage]] */
interface ActivityMessageProps {
  activityMessageInfo: ActivityMessageEventArgs;
  cancelActivityMessage: () => void;
  dismissActivityMessage: () => void;
}

/** Activity Message React component */
function ActivityMessage(props: ActivityMessageProps) {
  const messageDetails = props.activityMessageInfo.details;
  const [percentCompleteLabel] = React.useState(UiFramework.translate("activityCenter.percentComplete"));
  const [cancelLabel] = React.useState(UiCore.translate("dialog.cancel"));

  return (
    <Message
      status={Status.Information}
      icon={
        <HollowIcon iconSpec="icon-info-hollow" />
      }
    >
      <MessageLayout
        buttons={
          (messageDetails && messageDetails.supportsCancellation) ?
            <div>
              <MessageHyperlink onClick={props.cancelActivityMessage}>{cancelLabel}</MessageHyperlink>
              <span>&nbsp;</span>
              <MessageButton onClick={props.dismissActivityMessage}>
                <Icon iconSpec="icon-close" />
              </MessageButton>
            </div> :
            <MessageButton onClick={props.dismissActivityMessage}>
              <Icon iconSpec="icon-close" />
            </MessageButton>
        }
        progress={
          (messageDetails && messageDetails.showProgressBar) &&
          <MessageProgress
            status={Status.Information}
            progress={props.activityMessageInfo.percentage}
          />
        }
      >
        <div>
          {<MessageLabel message={props.activityMessageInfo.message} className="uifw-statusbar-message-brief" />}
          {
            (messageDetails && messageDetails.showPercentInMessage) &&
            <SmallText>{props.activityMessageInfo.percentage + percentCompleteLabel}</SmallText>
          }
        </div>
      </MessageLayout>
    </Message>
  );
}
