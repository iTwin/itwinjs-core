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
import { StatusBarWidgetControl } from "./StatusBarWidgetControl";
import { CustomActivityMessageRenderer } from "../messages/ActivityMessage";

// cspell:ignore safearea

/** State for the [[StatusBar]] React component
 * @internal
 */
interface StatusBarState {
  activityMessageInfo: ActivityMessageEventArgs | undefined;
}

/** Properties for the [[StatusBar]] React component
 * @public
 */
export interface StatusBarProps extends CommonProps {
  widgetControl?: StatusBarWidgetControl;
}

/** Message type for the [[StatusBar]] React component
 * @internal
 */
interface StatusBarMessage {
  close: () => void;
  id: string;
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
      activityMessageInfo: undefined,
    };
  }

  public override render(): React.ReactNode {
    return (
      <SafeAreaContext.Consumer>
        {(safeAreaInsets) => (
          <Footer // eslint-disable-line deprecation/deprecation
            className={this.props.className}
            messages={this.getFooterMessages()}
            onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
            safeAreaInsets={safeAreaInsets}
            style={this.props.style}
          >
            {this.props.widgetControl?.getReactNode?.() ?? null}
          </Footer>
        )}
      </SafeAreaContext.Consumer>
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

  private _handleMessageAddedEvent = (_args: MessageAddedEventArgs) => {
    this._updateMessages();
    const messagesToAdd = MessageManager.activeMessageManager.messages.filter((msg) => !this.messages.find((m) => m.id === msg.id));
    messagesToAdd.forEach((msg) => {
      const displayedMessage = MessageManager.displayMessage(msg.messageDetails, { onRemove: () => this._closeMessage(msg.id) });
      if(!!displayedMessage)
        this.messages.push({close: displayedMessage.close, id: msg.id});
    });
  };

  private _updateMessages = () => {
    const updatedMessages = [...this.messages];
    this.messages.forEach((m) => {
      if (!MessageManager.activeMessageManager.messages.some((msg) => m.id === msg.id)) {
        m.close();
        const index = updatedMessages.findIndex((msg) => msg.id === m.id);
        updatedMessages.splice(index, 1);
      }
    });
    this.messages = updatedMessages;
  };

  /** Respond to clearing the message list */
  private _handleMessagesUpdatedEvent = () => {
    this._updateMessages();
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

  private _closeMessage = (id: string) => {
    MessageManager.activeMessageManager.remove(id);
    MessageManager.updateMessages();
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
