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

import { MessageContainer, MessageSeverity } from "@bentley/ui-core";

import { MessageManager, MessageAddedEventArgs } from "./MessageManager";
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

  public readonly state: Readonly<StatusBarState> = {
    openWidget: null,
    visibleMessage: StatusBarMessageType.None,
    messageDetails: undefined,
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
    MessageManager.MessageAddedEvent.addListener(this.handleMessageAddedEvent);
  }

  public componentWillUnmount() {
    MessageManager.MessageAddedEvent.removeListener(this.handleMessageAddedEvent);
  }

  private handleMessageAddedEvent = (args: MessageAddedEventArgs) => {
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
      // TODO - InputField and Pointer
    }

    this.setVisibleMessage(statusbarMessageType, args.message);

    if (args.message.msgType === OutputMessageType.Toast) {
      this.setState(() => ({ toastMessageStage: ToastMessageStage.Visible }));
    }
  }

  private getFooterMessage() {
    if (!this.state.messageDetails)
      return;

    const severity = MessageManager.getSeverity(this.state.messageDetails);
    switch (this.state.visibleMessage) {
      case (StatusBarMessageType.Activity): {
        return (
          <ActivityMessage>
            <i className="icon icon-activity" />
            TODO - Activity Message
            <Button onClick={this.hideMessages}>
              Cancel
            </Button>
          </ActivityMessage>
        );
      }
      case (StatusBarMessageType.Modal): {
        return (
          <ModalMessage
            dialog={
              <ModalMessageDialog
                content={
                  <DialogButtonsContent
                    buttons={
                      <Button onClick={this.hideMessages}>
                        {UiFramework.i18n.translate("UiCore:dialog.close")}
                      </Button>
                    }
                    content={
                      <DialogScrollableContent
                        content={
                          <MessageContainer severity={severity} >
                            {this.state.messageDetails.briefMessage}
                            {
                              this.state.messageDetails.detailedMessage && (
                                <p>
                                  {this.state.messageDetails.detailedMessage}
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
            onAnimatedOut={() => this.hideMessages()}
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
                  <MessageButton onClick={this.hideMessages}>
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

  public setOpenWidget(openWidget: StatusBarFieldId) {
    this.setState((_prevState, _props) => {
      return {
        openWidget,
      };
    });
  }

  private hideMessages = () => {
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
