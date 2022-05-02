/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import { Icon, UiCore } from "@itwin/core-react";
import {
  Message,
  MessageButton,
  MessageHyperlink,
  MessageLayout,
  MessageProgress,
  Status,
} from "@itwin/appui-layout-react";
import { Small } from "@itwin/itwinui-react";
import { UiFramework } from "../UiFramework";
import { ActivityMessageEventArgs } from "../messages/MessageManager";
import { MessageLabel } from "./MessageLabel";
import { HollowIcon } from "./HollowIcon";

/** Properties for a [[ActivityMessage]]
 * @public
 */
export interface ActivityMessageProps {
  activityMessageInfo: ActivityMessageEventArgs;
  cancelActivityMessage: () => void;
  dismissActivityMessage: () => void;
}

/** Activity Message React component
 * @public
 */
export function ActivityMessage(props: ActivityMessageProps) {
  const messageDetails = props.activityMessageInfo.details;
  const [percentCompleteLabel] = React.useState(UiFramework.translate("activityCenter.percentComplete"));
  const [cancelLabel] = React.useState(UiCore.translate("dialog.cancel"));

  return (
    <Message // eslint-disable-line deprecation/deprecation
      status={Status.Information}
      icon={<HollowIcon iconSpec="icon-info-hollow" />}
    >
      <MessageLayout
        buttons={(messageDetails && messageDetails.supportsCancellation) ? (
          <div>
            <MessageHyperlink onClick={props.cancelActivityMessage}>
              {cancelLabel}
            </MessageHyperlink>
            <span>&nbsp;</span>
            <MessageButton onClick={props.dismissActivityMessage}>
              <Icon iconSpec="icon-close" />
            </MessageButton>
          </div>
        ) : (
          <MessageButton onClick={props.dismissActivityMessage}>
            <Icon iconSpec="icon-close" />
          </MessageButton>
        )}
        progress={(messageDetails && messageDetails.showProgressBar) &&
            <MessageProgress
              status={Status.Information}
              progress={props.activityMessageInfo.percentage}
            />
        }
      >
        <div>
          <MessageLabel message={props.activityMessageInfo.message} className="uifw-statusbar-message-brief" />
          {(messageDetails && messageDetails.showPercentInMessage) &&
            <Small>{props.activityMessageInfo.percentage + percentCompleteLabel}</Small>
          }
        </div>
      </MessageLayout>
    </Message>
  );
}
