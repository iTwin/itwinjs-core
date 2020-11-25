/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import { MessageContainer, MessageSeverity } from "@bentley/ui-core";
import { Message, MessageLayout, Toast } from "@bentley/ui-ninezone";
import { NotifyMessageDetailsType } from "../messages/ReactNotifyMessageDetails";
import { StatusBar } from "../statusbar/StatusBar";
import { HollowIcon } from "./HollowIcon";
import { MessageLabel } from "./MessageLabel";

/** Properties for a [[ToastMessage]]
 * @beta
 */
export interface ToastMessageProps {
  id: string;
  messageDetails: NotifyMessageDetailsType;
  severity: MessageSeverity;
  toastTarget: HTMLElement | null;
  closeMessage: (id: string) => void;
}

/** Toast Message React component
 * @beta
 */
export function ToastMessage(props: ToastMessageProps) {
  const { id, messageDetails, severity, toastTarget, closeMessage } = props;

  return (
    <Toast
      animateOutTo={toastTarget}
      onAnimatedOut={() => closeMessage(id)}
      timeout={messageDetails.displayTime.milliseconds}
      content={
        <Message
          status={StatusBar.severityToStatus(severity)}
          icon={
            <HollowIcon iconSpec={MessageContainer.getIconClassName(severity, true)} />
          }
        >
          <MessageLayout>
            <MessageLabel message={messageDetails.briefMessage} className="uifw-statusbar-message-brief" />
            {messageDetails.detailedMessage &&
              <MessageLabel message={messageDetails.detailedMessage} className="uifw-statusbar-message-detailed" />
            }
          </MessageLayout>
        </Message>
      }
    />
  );
}
