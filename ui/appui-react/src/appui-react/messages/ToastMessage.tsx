/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import { MessageSeverity } from "@itwin/appui-abstract";
import { MessageLayout, Toast } from "@itwin/appui-layout-react";
import { ToastPresentation } from "@itwin/itwinui-react/cjs/core/Toast/Toast";
import { NotifyMessageDetailsType } from "../messages/ReactNotifyMessageDetails";
import { MessageLabel } from "./MessageLabel";
import { getToastCategory } from "./getToastCategory";

/** Properties for a [[ToastMessage]]
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
 */
export function ToastMessage(props: ToastMessageProps) {
  const { id, messageDetails, severity, toastTarget, closeMessage } = props;
  const category = getToastCategory(severity);

  return (
    <Toast // eslint-disable-line deprecation/deprecation
      animateOutTo={toastTarget}
      onAnimatedOut={() => closeMessage(id)}
      timeout={messageDetails.displayTime.milliseconds}
      content={
        <ToastPresentation
          category={category}
          content={
            <MessageLayout>
              <MessageLabel message={messageDetails.briefMessage} className="uifw-statusbar-message-brief" />
              {messageDetails.detailedMessage &&
                <MessageLabel message={messageDetails.detailedMessage} className="uifw-statusbar-message-detailed" />
              }
            </MessageLayout>
          }
        />
      }
    />
  );
}
