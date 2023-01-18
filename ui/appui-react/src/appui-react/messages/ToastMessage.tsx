/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import { MessageSeverity } from "@itwin/appui-abstract";
import {
  Message,
  MessageLayout,
  StatusHelpers,
  Toast,
} from "@itwin/appui-layout-react";
import { NotifyMessageDetailsType } from "../messages/ReactNotifyMessageDetails";
import { MessageLabel } from "./MessageLabel";
import { HollowIcon } from "./HollowIcon";
import { MessageContainer } from "@itwin/core-react";

/** Properties for a [[ToastMessage]]
 * @deprecated in 3.x. Props of a deprecated component.
 * @public
 */
export interface ToastMessageProps {
  id: string;
  messageDetails: NotifyMessageDetailsType;
  severity: MessageSeverity;
  toastTarget: HTMLElement | null;
  closeMessage: (id: string) => void;
}

/** Toast Message React component
 * @public
 * @deprecated in 3.x.
 */
export function ToastMessage(props: ToastMessageProps) { // eslint-disable-line deprecation/deprecation
  const { id, messageDetails, severity, toastTarget, closeMessage } = props;

  return (
    <Toast // eslint-disable-line deprecation/deprecation
      animateOutTo={toastTarget}
      onAnimatedOut={() => closeMessage(id)}
      timeout={messageDetails.displayTime.milliseconds}
      content={
        <Message // eslint-disable-line deprecation/deprecation
          status={StatusHelpers.severityToStatus(severity)}
          icon={
            <HollowIcon
              iconSpec={MessageContainer.getIconClassName(severity, true)}
            />
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
