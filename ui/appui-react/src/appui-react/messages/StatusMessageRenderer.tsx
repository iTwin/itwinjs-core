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

/** Message type for the [[StatusMessageRenderer]] React component
 * @internal
 */
interface StatusMessageRendererrMessage {
  close: () => void;
  id: string;
}

/** Properties for [[StatusMessageRenderer]] component
 * @deprecated Props of a deprecated component.
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
export function StatusMessageRenderer({
  closeMessage,
  cancelActivityMessage: cancelActivityMessageProp,
  dismissActivityMessage,
}: StatusMessageRendererProps) { // eslint-disable-line deprecation/deprecation
  const messages = React.useRef<StatusMessageRendererrMessage[]>([]);
  const [activityMessageInfo, setActivityMessageInfo] = React.useState<ActivityMessageEventArgs | undefined>(undefined);

  const updateMessages = () => {
    const updatedMessages = [...messages.current];
    messages.current.forEach((m) => {
      if (!MessageManager.activeMessageManager.messages.some((msg) => m.id === msg.id)) {
        m.close();
        const index = updatedMessages.findIndex((msg) => msg.id === m.id);
        updatedMessages.splice(index, 1);
      }
    });

    messages.current = updatedMessages;
  };

  React.useEffect(() => {
    const handleMessageAddedEvent = ({ message }: MessageAddedEventArgs) => {
      updateMessages();
      const messagesToAdd = MessageManager.activeMessageManager.messages.filter((msg) => !messages.current.find((m) => m.id === msg.id));
      messagesToAdd.forEach((msg) => {
        const displayedMessage = MessageManager.displayMessage(
          message,
          { onRemove: () => onRemove(msg.id) },
          { placement: "top", order: "descending" }
        );
        if (!!displayedMessage)
          messages.current.push({ close: displayedMessage.close, id: msg.id });
      });
    };

    return MessageManager.onMessageAddedEvent.addListener(handleMessageAddedEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    /** Respond to clearing the message list */
    return MessageManager.onMessagesUpdatedEvent.addListener(updateMessages);
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

  const onRemove = React.useCallback((id: string) => {
    MessageManager.activeMessageManager.remove(id);
    MessageManager.updateMessages();
    closeMessage?.(id);
  }, [closeMessage]);

  const cancelActivityMessage = React.useCallback(() => {
    MessageManager.endActivityMessage(false);
    cancelActivityMessageProp && cancelActivityMessageProp();
  }, [cancelActivityMessageProp]);

  useActivityMessage({ activityMessageInfo, cancelActivityMessage, dismissActivityMessage });

  return <></>;
}
