/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import "./StatusBar.scss";
import * as React from "react";
import { CommonDivProps, CommonProps, Div } from "@itwin/core-react";
import { Footer } from "@itwin/appui-layout-react";
import { ActivityMessageEventArgs, MessageAddedEventArgs, MessageManager } from "../messages/MessageManager";
import { SafeAreaContext } from "../safearea/SafeAreaContext";
import { UiShowHideManager } from "../utils/UiShowHideManager";
import { StatusBarFieldId, StatusBarWidgetControl, StatusBarWidgetControlArgs } from "./StatusBarWidgetControl";
import { CustomActivityMessageRenderer } from "../messages/ActivityMessage";
import { NotifyMessageDetailsType } from "../messages/ReactNotifyMessageDetails";

// cspell:ignore safearea

/** State for the [[StatusBar]] React component
 * @internal
 */
interface StatusBarState {
  openWidget: StatusBarFieldId;
  activityMessageInfo: ActivityMessageEventArgs | undefined;
}

/** Properties for the [[StatusBar]] React component
 * @public
 */
export interface StatusBarProps extends CommonProps {
  widgetControl?: StatusBarWidgetControl;
  isInFooterMode: boolean;
}

/** Message type for the [[StatusBar]] React component
 * @internal
 */
interface StatusBarMessage {
  close: () => void;
  details: NotifyMessageDetailsType;
}

/** Status Bar React component.
 * @public
 */
export class StatusBar extends React.Component<StatusBarProps, StatusBarState> {
  private messages: StatusBarMessage[] = [];

  /** @internal */
  constructor(props: StatusBarProps) {
    super(props);

    this.state = {
      openWidget: null,
      activityMessageInfo: undefined,
    };
  }

  public override render(): React.ReactNode {
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
            <Footer // eslint-disable-line deprecation/deprecation
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

  public override componentDidMount() {
    MessageManager.onMessageAddedEvent.addListener(this._handleMessageAddedEvent);
    MessageManager.onActivityMessageUpdatedEvent.addListener(this._handleActivityMessageUpdatedEvent);
    MessageManager.onActivityMessageCancelledEvent.addListener(this._handleActivityMessageCancelledEvent);
    MessageManager.onMessagesUpdatedEvent.addListener(this._handleMessagesUpdatedEvent);

    MessageManager.updateMessages();
  }

  public override componentWillUnmount() {
    MessageManager.onMessageAddedEvent.removeListener(this._handleMessageAddedEvent);
    MessageManager.onActivityMessageUpdatedEvent.removeListener(this._handleActivityMessageUpdatedEvent);
    MessageManager.onActivityMessageCancelledEvent.removeListener(this._handleActivityMessageCancelledEvent);
    MessageManager.onMessagesUpdatedEvent.removeListener(this._handleMessagesUpdatedEvent);
  }

  private _handleMessageAddedEvent = ({ message }: MessageAddedEventArgs) => {
    const displayedMessage = MessageManager.displayMessage(message);
    if(!!displayedMessage)
      this.messages.push({close: displayedMessage.close, details: message});
  };

  /** Respond to clearing the message list */
  private _handleMessagesUpdatedEvent = () => {
    const updatedMessages: StatusBarMessage[] = [];
    this.messages.forEach((m) => {
      const existingMessage = MessageManager.messages.find((msg) => m.details.briefMessage === msg.briefMessage);
      if (existingMessage) {
        updatedMessages.push({close: m.close, details: existingMessage});
      } else {
        m.close();
      }
    });
    this.messages = updatedMessages;
  };

  /**
   * Sets state of the status bar to updated values reflecting activity progress.
   * @param args  New values to set for ActivityMessage
   */
  private _handleActivityMessageUpdatedEvent = (args: ActivityMessageEventArgs) => {
    this.setState({
      activityMessageInfo: args,
    });
  };

  /**
   * Hides ActivityMessage after cancellation
   */
  private _handleActivityMessageCancelledEvent = () => {
    this.setState({
      activityMessageInfo: undefined,
    });
  };

  private getFooterMessages(): React.ReactNode {
    return (
      <CustomActivityMessageRenderer settings={{placement: "bottom"}} activityMessageInfo={this.state.activityMessageInfo} cancelActivityMessage={this._cancelActivityMessage} />
    );
  }

  /**
   * Ends canceled process and dismisses ActivityMessage
   */
  private _cancelActivityMessage = () => {
    MessageManager.endActivityMessage(false);
  };

  private _handleOpenWidget = (openWidget: StatusBarFieldId) => {
    this.setState({
      openWidget,
    });
  };

  private _handleToastTargetRef = (toastTarget: HTMLElement | null) => {
    MessageManager.registerAnimateOutRef(toastTarget);
  };
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
