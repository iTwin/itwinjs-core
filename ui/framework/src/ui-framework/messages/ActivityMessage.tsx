/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import { Icon, SmallText, UiCore } from "@bentley/ui-core";
import { Message, MessageButton, MessageHyperlink, MessageLayout, MessageProgress, Status } from "@bentley/ui-ninezone";
import { UiFramework } from "../UiFramework";
import { ActivityMessageEventArgs } from "../messages/MessageManager";
import { HollowIcon } from "./HollowIcon";
import { MessageLabel } from "./MessageLabel";

/** Properties for a [[ActivityMessage]]
 * @beta
 */
export interface ActivityMessageProps {
  activityMessageInfo: ActivityMessageEventArgs;
  cancelActivityMessage: () => void;
  dismissActivityMessage: () => void;
}

/** Activity Message React component
 * @beta
 */
export function ActivityMessage(props: ActivityMessageProps) {
  const messageDetails = props.activityMessageInfo.details;
  const [percentCompleteLabel] = React.useState(UiFramework.translate("activityCenter.percentComplete"));
  const [cancelLabel] = React.useState(UiCore.translate("dialog.cancel"));

  return (
    <Message
      status={Status.Information}
      icon={
        <HollowIcon iconSpec="icon-info-hollow" />
      }
    >
      <MessageLayout
        buttons={
          (messageDetails && messageDetails.supportsCancellation) ?
            <div>
              <MessageHyperlink onClick={props.cancelActivityMessage}>{cancelLabel}</MessageHyperlink>
              <span>&nbsp;</span>
              <MessageButton onClick={props.dismissActivityMessage}>
                <Icon iconSpec="icon-close" />
              </MessageButton>
            </div>
            :
            <MessageButton onClick={props.dismissActivityMessage}>
              <Icon iconSpec="icon-close" />
            </MessageButton>
        }
        progress={
          (messageDetails && messageDetails.showProgressBar) &&
          <MessageProgress
            status={Status.Information}
            progress={props.activityMessageInfo.percentage}
          />
        }
      >
        <div>
          {<MessageLabel message={props.activityMessageInfo.message} className="uifw-statusbar-message-brief" />}
          {
            (messageDetails && messageDetails.showPercentInMessage) &&
            <SmallText>{props.activityMessageInfo.percentage + percentCompleteLabel}</SmallText>
          }
        </div>
      </MessageLayout>
    </Message>
  );
}
