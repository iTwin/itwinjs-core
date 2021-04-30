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
import { StatusMessage } from "./StatusMessageManager";
import { ActivityMessageEventArgs } from "./MessageManager";
import { OutputMessageType } from "@bentley/imodeljs-frontend";
import { ToastMessage } from "./ToastMessage";
import { StickyMessage } from "./StickyMessage";
import { ActivityMessage } from "./ActivityMessage";
import { useLayoutResizeObserver } from "@bentley/ui-core";

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
  const messages = props.messages;
  const maxHeight = Math.floor(window.innerHeight * 0.66);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [, height] = useLayoutResizeObserver(containerRef);
  if (!(props.activityMessageInfo && props.isActivityMessageVisible) && props.messages.length === 0)
    return null;

  return (
    <div className={classnames("uifw-statusbar-messages-container", (height ?? 10 >= maxHeight) && /* istanbul ignore next */ "uifw-scrollable")}>
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
