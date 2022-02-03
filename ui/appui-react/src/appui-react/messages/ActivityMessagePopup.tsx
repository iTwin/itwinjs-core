/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import "./ActivityMessagePopup.scss";
import * as React from "react";
import classnames from "classnames";
import type { ActivityMessageEventArgs} from "../messages/MessageManager";
import { MessageManager } from "../messages/MessageManager";
import type { CommonProps } from "@itwin/core-react";
import { ActivityMessage } from "./ActivityMessage";

/** Properties for [[ActivityMessagePopup]] component
 * @public
 */
export interface ActivityMessagePopupProps extends CommonProps {
  cancelActivityMessage?: () => void;
  dismissActivityMessage?: () => void;
}

/** Activity Message Popup React component
 * @public
 */
export function ActivityMessagePopup(props: ActivityMessagePopupProps) {
  const [activityMessageInfo, setActivityMessageInfo] = React.useState<ActivityMessageEventArgs | undefined>(undefined);
  const [isActivityMessageVisible, setIsActivityMessageVisible] = React.useState(false);

  React.useEffect(() => {
    const handleActivityMessageUpdatedEvent = (args: ActivityMessageEventArgs) => {
      setActivityMessageInfo(args);
      if (args.restored)
        setIsActivityMessageVisible(true);
    };

    return MessageManager.onActivityMessageUpdatedEvent.addListener(handleActivityMessageUpdatedEvent);
  }, [isActivityMessageVisible]);

  React.useEffect(() => {
    const handleActivityMessageCancelledEvent = () => {
      setActivityMessageInfo(undefined);
      setIsActivityMessageVisible(false);
    };

    return MessageManager.onActivityMessageCancelledEvent.addListener(handleActivityMessageCancelledEvent);
  }, []);

  const cancelActivityMessage = React.useCallback(() => {
    MessageManager.endActivityMessage(false);
    props.cancelActivityMessage && props.cancelActivityMessage();
  }, [props]);

  const dismissActivityMessage = React.useCallback(() => {
    setIsActivityMessageVisible(false);
    props.dismissActivityMessage && props.dismissActivityMessage();
  }, [props]);

  if (!activityMessageInfo || !isActivityMessageVisible)
    return null;

  return (
    <div className={classnames("uifw-centered-popup", props.className)} style={props.style}>
      <ActivityMessage
        activityMessageInfo={activityMessageInfo}
        cancelActivityMessage={cancelActivityMessage}
        dismissActivityMessage={dismissActivityMessage}
      />
    </div>
  );
}
