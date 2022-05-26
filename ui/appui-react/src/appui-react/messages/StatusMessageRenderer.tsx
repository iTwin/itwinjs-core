/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import "./StatusMessageRenderer.scss";
import * as React from "react";
import { ActivityMessageEventArgs, MessageAddedEventArgs, MessageManager } from "./MessageManager";
import { CommonProps } from "@itwin/core-react";
import { useActivityMessage } from "./ActivityMessage";

/** Properties for [[StatusMessageRenderer]] component
 * @public
 */
export interface StatusMessageRendererProps extends CommonProps {
  closeMessage?: (id: string) => void;
  cancelActivityMessage?: () => void;
  dismissActivityMessage?: () => void;
}

/** Message Popup React component that renders one or more Toast or Sticky messages and an Activity message without a StatusBar.
 * @note This component was formerly named MessageRenderer in previous releases.
 * @public
 * @deprecated Use `toaster` from iTwinui-react to display status messages.
 */
export function StatusMessageRenderer(props: StatusMessageRendererProps) {
  const messages = React.useRef<{close: () => void}[]>([]);
  const [activityMessageInfo, setActivityMessageInfo] = React.useState<ActivityMessageEventArgs | undefined>(undefined);
  const lastToastId = React.useRef(0);

  React.useEffect(() => {
    const handleMessageAddedEvent = ({ message }: MessageAddedEventArgs) => {
      const displayedMessage = MessageManager.displayMessage(
        message,
        { onRemove: () => props.closeMessage?.(lastToastId.current.toString()) },
        { placement: "top", order: "descending" }
      );
      if(!!displayedMessage) {
        messages.current.push(displayedMessage);
        ++lastToastId.current;
      }
    };

    return MessageManager.onMessageAddedEvent.addListener(handleMessageAddedEvent);
  }, [props]);

  React.useEffect(() => {
    /** Respond to clearing the message list */
    const handleMessagesUpdatedEvent = () => {
      messages.current.forEach((message) => message.close());
      messages.current = [];
    };

    return MessageManager.onMessagesUpdatedEvent.addListener(handleMessagesUpdatedEvent);
  }, []);

  React.useEffect(() => {
    const handleActivityMessageUpdatedEvent = (args: ActivityMessageEventArgs) => {
      setActivityMessageInfo(args);
    };

    return MessageManager.onActivityMessageUpdatedEvent.addListener(handleActivityMessageUpdatedEvent);
  }, []);

  React.useEffect(() => {
    const handleActivityMessageCancelledEvent = () => {
      setActivityMessageInfo(undefined);
    };

    return MessageManager.onActivityMessageCancelledEvent.addListener(handleActivityMessageCancelledEvent);
  }, []);

  const cancelActivityMessage = React.useCallback(() => {
    MessageManager.endActivityMessage(false);
    props.cancelActivityMessage && props.cancelActivityMessage();
  }, [props]);

  const dismissActivityMessage = React.useCallback(() => {
    props.dismissActivityMessage && props.dismissActivityMessage();
  }, [props]);

  useActivityMessage({activityMessageInfo, cancelActivityMessage, dismissActivityMessage});

  return null;
}
