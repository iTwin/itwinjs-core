/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import "./StatusMessagesContainer.scss";
import * as React from "react";
import classnames from "classnames";
import type { StatusMessage } from "./StatusMessageManager";
import type { ActivityMessageEventArgs } from "./MessageManager";
import { OutputMessageType } from "@itwin/core-frontend";
import { ToastMessage } from "./ToastMessage";
import { StickyMessage } from "./StickyMessage";
import { ActivityMessage } from "./ActivityMessage";
import { useLayoutResizeObserver } from "@itwin/core-react";

/** Properties for [[StatusMessagesContainer]] component
 * @internal
 */
export interface StatusMessagesContainerProps {
  messages: ReadonlyArray<StatusMessage>;
  activityMessageInfo: ActivityMessageEventArgs | undefined;
  isActivityMessageVisible: boolean;
  toastTarget: HTMLElement | null;
  closeMessage: (id: string) => void;
  cancelActivityMessage: () => void;
  dismissActivityMessage: () => void;
}

/** Component that renders one or more Toast, Sticky or Activity messages
 * @internal
 */
export function StatusMessagesContainer(props: StatusMessagesContainerProps) {
  const [containerElement, setContainerElement] = React.useState<HTMLDivElement | null>(null);
  const isMountedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isMountedRef.current && containerRef.current) {
      isMountedRef.current = true;
      setContainerElement(containerRef.current);
    }
  }, []);

  const messages = props.messages;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [, height] = useLayoutResizeObserver(containerElement);
  const [addScroll, setAddScroll] = React.useState(false);

  React.useLayoutEffect(() => {
    // istanbul ignore else
    if (containerElement) {
      // istanbul ignore next
      const windowHeight = containerElement.ownerDocument.defaultView?.innerHeight ?? 800;
      const maxHeight = Math.floor(windowHeight * .66);
      setAddScroll((height ?? 0) >= maxHeight);
    }
  }, [height, containerElement]);

  if (!(props.activityMessageInfo && props.isActivityMessageVisible) && props.messages.length === 0)
    return null;

  return (
    <div ref={containerRef} className={classnames("uifw-statusbar-messages-container", addScroll && "uifw-scrollable")}>
      <ul className="uifw-statusbar-message-list">
        {messages.length > 0 &&
          messages.map((message: StatusMessage) => {
            let messageNode = null;
            if (message.messageDetails.msgType === OutputMessageType.Toast) {
              messageNode = (
                <li key={message.id}>
                  <ToastMessage id={message.id} messageDetails={message.messageDetails} severity={message.severity}
                    closeMessage={props.closeMessage} toastTarget={props.toastTarget} />
                </li>
              );
            } else if (message.messageDetails.msgType === OutputMessageType.Sticky) {
              messageNode = (
                <li key={message.id}>
                  <StickyMessage id={message.id} messageDetails={message.messageDetails} severity={message.severity}
                    closeMessage={props.closeMessage} />
                </li>
              );
            }
            return messageNode;
          })
        }
        {(props.activityMessageInfo !== undefined && props.isActivityMessageVisible) &&
          <li key="activity-message">
            <ActivityMessage
              activityMessageInfo={props.activityMessageInfo}
              cancelActivityMessage={props.cancelActivityMessage}
              dismissActivityMessage={props.dismissActivityMessage}
            />
          </li>
        }
      </ul>
    </div>
  );

}
