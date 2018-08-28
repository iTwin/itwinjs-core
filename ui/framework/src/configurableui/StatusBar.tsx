/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { ReactNode } from "react";

// import { OutputMessageType } from "@bentley/imodeljs-frontend";

import { ZoneDef } from "./ZoneDef";
import { StatusBarFieldId, IStatusBar, StatusBarWidgetControl } from "./StatusBarWidgetControl";

import Footer from "@bentley/ui-ninezone/lib/footer/Footer";
import ActivityMessage from "@bentley/ui-ninezone/lib/footer/message/Activity";
import ModalMessage from "@bentley/ui-ninezone/lib/footer/message/Modal";
import ModalMessageDialog from "@bentley/ui-ninezone/lib/footer/message/content/dialog/Dialog";
import DialogScrollableContent from "@bentley/ui-ninezone/lib/footer/message/content/dialog/content/Scrollable";
import DialogButtonsContent from "@bentley/ui-ninezone/lib/footer/message/content/dialog/content/Buttons";
import ToastMessage, { Stage as ToastMessageStage } from "@bentley/ui-ninezone/lib/footer/message/Toast";
import StickyMessage from "@bentley/ui-ninezone/lib/footer/message/Sticky";
import StatusMessageContent from "@bentley/ui-ninezone/lib/footer/message/content/status/Message";
import StatusMessageLayout from "@bentley/ui-ninezone/lib/footer/message/content/status/Layout";
import MessageLabel from "@bentley/ui-ninezone/lib/footer/message/content/Label";
import MessageButton from "@bentley/ui-ninezone/lib/footer/message/content/Button";
import MessageStatus from "@bentley/ui-ninezone/lib/footer/message/content/status/Status";
// import TemporaryMessage from "@bentley/ui-ninezone/messages/Temporary";
import { BlueButton as Button } from "@bentley/bwc/lib/buttons/BlueButton";
import { NotifyMessageDetails, OutputMessageType } from "@bentley/imodeljs-frontend/lib/frontend";

import StatusMessage from "@bentley/ui-ninezone/lib/footer/message/content/status/Message";
import Status from "@bentley/ui-ninezone/lib/footer/message/content/status/Status";
import StatusLayout from "@bentley/ui-ninezone/lib/footer/message/content/status/Layout";
import Label from "@bentley/ui-ninezone/lib/footer/message/content/Label";
import Hyperlink from "@bentley/ui-ninezone/lib/footer/message/content/Hyperlink";
import Progress from "@bentley/ui-ninezone/lib/footer/message/content/Progress";

import { MessageContainer, MessageSeverity } from "@bentley/ui-core";

import { MessageManager, MessageAddedEventArgs, ActivityMessageEventArgs } from "./MessageManager";
import { UiFramework } from "../UiFramework";

export enum StatusBarMessageType {
  None,
  Activity,
  Modal,
  Toast,
  Sticky,
}

export interface StatusBarState {
  openWidget: StatusBarFieldId;
  visibleMessage: StatusBarMessageType;
  messageDetails: NotifyMessageDetails | undefined;
  activityMessageInfo: ActivityMessageEventArgs | undefined;
  isActivityMessageVisible: boolean;
  toastMessageStage: ToastMessageStage;
}

export interface StatusBarProps {
  zoneDef: ZoneDef;
  isInFooterMode: boolean;
}

/** Status Bar React component.
 */
export class StatusBar extends React.Component<StatusBarProps, StatusBarState> implements IStatusBar {
  private _footerMessages: any;

  public static severityToStatus(severity: MessageSeverity): MessageStatus {
    switch (severity) {
      case MessageSeverity.Error:
      case MessageSeverity.Fatal:
      case MessageSeverity.Warning:
        return MessageStatus.Error;
    }
    return MessageStatus.Information;
  }

  /** hidden */
  public readonly state: Readonly<StatusBarState> = {
    openWidget: null,
    visibleMessage: StatusBarMessageType.None,
    messageDetails: undefined,
    activityMessageInfo: undefined,
    isActivityMessageVisible: true,
    toastMessageStage: ToastMessageStage.Visible,
  };

  public render(): ReactNode {
    let footerSections: React.ReactNode = null;
    const widgetDef = this.props.zoneDef.getOnlyWidgetDef();
    if (widgetDef) {
      const widgetControl: StatusBarWidgetControl = widgetDef.widgetControl as StatusBarWidgetControl;
      if (widgetControl && widgetControl.getReactNode) {
        footerSections = widgetControl.getReactNode(this, this.props.isInFooterMode, this.state.openWidget);
      }
    }

    return (
      <Footer
        message={this.getFooterMessage()}
        indicators={footerSections}
        isInWidgetMode={!this.props.isInFooterMode}
      />
    );
  }

  public componentDidMount() {
    MessageManager.MessageAddedEvent.addListener(this._handleMessageAddedEvent);
    MessageManager.ActivityMessageAddedEvent.addListener(this._handleActivityMessageAddedEvent);
    MessageManager.ActivityMessageCanceledEvent.addListener(this._handleActivityMessageCanceledEvent);
  }

  public componentWillUnmount() {
    MessageManager.MessageAddedEvent.removeListener(this._handleMessageAddedEvent);
    MessageManager.ActivityMessageAddedEvent.removeListener(this._handleActivityMessageAddedEvent);
    MessageManager.ActivityMessageCanceledEvent.removeListener(this._handleActivityMessageCanceledEvent);
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
      case OutputMessageType.Alert:
        statusbarMessageType = StatusBarMessageType.Modal;
        break;
      // TODO - Pointer
    }

    this.setVisibleMessage(statusbarMessageType, args.message);

    if (args.message.msgType === OutputMessageType.Toast) {
      this.setState(() => ({ toastMessageStage: ToastMessageStage.Visible }));
    }
  }

  /**
   * Sets state of the status bar to updated values reflecting activity progress.
   * @param args  New values to set for ActivityMessage
   */
  private _handleActivityMessageAddedEvent = (args: ActivityMessageEventArgs) => {
    const visibleMessage = StatusBarMessageType.Activity;
    this.setState((_prevState) => ({
      visibleMessage,
      activityMessageInfo: args,
      isActivityMessageVisible: args.restored ? true : this.state.isActivityMessageVisible,
    }));
  }

  /**
   * Hides ActivityMessage after cancelation
   */
  private _handleActivityMessageCanceledEvent = () => {
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
      case (StatusBarMessageType.Modal): {
        return (
          <ModalMessage
            dialog={
              <ModalMessageDialog
                content={
                  <DialogButtonsContent
                    buttons={
                      <Button onClick={this._hideMessages}>
                        {UiFramework.i18n.translate("UiCore:dialog.close")}
                      </Button>
                    }
                    content={
                      <DialogScrollableContent
                        content={
                          <MessageContainer severity={severity} >
                            {this.state.messageDetails!.briefMessage}
                            {
                              this.state.messageDetails!.detailedMessage && (
                                <p>
                                  {this.state.messageDetails!.detailedMessage}
                                </p>
                              )
                            }
                          </MessageContainer>
                        }
                      />
                    }
                  />
                }
              />
            }
          />
        );
      }
      case (StatusBarMessageType.Toast): {
        return (
          <ToastMessage
            stage={this.state.toastMessageStage}
            animateOutTo={this._footerMessages}
            onAnimatedOut={() => this._hideMessages()}
            timeout={2500}
            onStageChange={(stage: ToastMessageStage) => {
              this.setState((_prevState) => ({ toastMessageStage: stage }));
            }}
            content={
              <StatusMessageContent
                status={StatusBar.severityToStatus(severity)}
                icon={
                  <i className={`icon ${MessageContainer.getIconClassName(severity)}`} />
                }
              >
                <StatusMessageLayout
                  label={
                    <>
                      <MessageLabel text={this.state.messageDetails!.briefMessage} />
                      {this.state.messageDetails!.detailedMessage &&
                        <>
                          <br />
                          <MessageLabel text={this.state.messageDetails!.detailedMessage} />
                        </>
                      }
                    </>
                  }
                />
              </StatusMessageContent>
            }
          />
        );
      }
      case (StatusBarMessageType.Sticky): {
        return (
          <StickyMessage>
            <StatusMessageContent
              status={StatusBar.severityToStatus(severity)}
              icon={
                <i className={`icon ${MessageContainer.getIconClassName(severity)}`} />
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
            </StatusMessageContent>
          </StickyMessage>
        );
      }
    }

    return undefined;
  }

  /**
   * Returns ActvityMessage to display with most recent values
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
          <StatusLayout
            label={
              (messageDetails && messageDetails.showPercentInMessage) ?
                <div>
                  <Label text={this.state.activityMessageInfo!.title} />
                  <h6 className="body-text-dark">{this.state.activityMessageInfo!.percentage + percentComplete}</h6>
                </div> :
                <Label text={this.state.activityMessageInfo!.title} />
            }
            buttons={
              (messageDetails && messageDetails.supportsCancellation) ?
                <>
                  <Hyperlink text="Cancel"
                    onClick={this.cancelActivityMessage}
                  />
                  <MessageButton onClick={this.dismissActivityMessage}>
                    <i className="icon icon-close" />
                  </MessageButton>
                </> :
                <MessageButton onClick={this.dismissActivityMessage}>
                  <i className="icon icon-close" />
                </MessageButton>
            }
            progress={
              (!messageDetails || messageDetails.showProgressBar) &&
              <Progress
                status={Status.Information}
                progress={this.state.activityMessageInfo!.percentage}
              />
            }
          />
        </StatusMessage>
      </ActivityMessage>
    );
  }

  /**
   * Ends canceled process and dismisses ActivityMessage
   */
  private cancelActivityMessage = () => {
    MessageManager.endActivityMessage(false);
    this.dismissActivityMessage();
  }

  /**
   * Dismisses ActivityMessage
   */
  private dismissActivityMessage = () => {
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
