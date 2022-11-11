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
import { ProgressLinear, Small, Text, toaster } from "@itwin/itwinui-react";
import { UiFramework } from "../UiFramework";
import { ActivityMessageEventArgs, MessageManager } from "../messages/MessageManager";
import { MessageLabel } from "./MessageLabel";
import { HollowIcon } from "./HollowIcon";
import { ToasterSettings } from "@itwin/itwinui-react/cjs/core/Toast/Toaster";

/** Properties for a [[ActivityMessage]]
 * @deprecated Props of a deprecated component.
 * @public
 */
export interface ActivityMessageProps {
  activityMessageInfo: ActivityMessageEventArgs;
  cancelActivityMessage: () => void;
  dismissActivityMessage: () => void;
}

/** Activity Message React component
 * @public
 * @deprecated
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

interface CustomActivityMessageProps {
  cancelActivityMessage?: () => void;
  dismissActivityMessage?: () => void;
  activityMessageInfo?: ActivityMessageEventArgs;
  settings?: ToasterSettings;
}

/**
 * Hook to render an Activity message.
 * @internal
 */
export function useActivityMessage({activityMessageInfo, dismissActivityMessage, cancelActivityMessage, settings}: CustomActivityMessageProps) {
  const [cancelLabel] = React.useState(UiCore.translate("dialog.cancel"));
  const recentToast = React.useRef<{close: () => void} | undefined>();
  React.useEffect(() => {
    toaster.setSettings(settings ?? {placement: "top"});
  }, [settings]);

  React.useEffect(() => {
    if (activityMessageInfo?.restored) {
      recentToast.current = toaster.informational(
        <CustomActivityMessageContent initialActivityMessageInfo={activityMessageInfo} />,
        { onRemove: dismissActivityMessage, type: "persisting", link: activityMessageInfo?.details?.supportsCancellation && cancelActivityMessage ? { title: cancelLabel, onClick: cancelActivityMessage } : undefined}
      );
    }
    if (!activityMessageInfo) {
      recentToast.current?.close();
    }
  }, [activityMessageInfo, cancelActivityMessage, cancelLabel, dismissActivityMessage]);
}

/**
 * Component wrapping the `useActivityMessage` hook to use in class components.
 * @internal
 */
export function CustomActivityMessageRenderer({activityMessageInfo, dismissActivityMessage, cancelActivityMessage, settings}: CustomActivityMessageProps) {
  useActivityMessage({activityMessageInfo, cancelActivityMessage, dismissActivityMessage, settings});

  return <></>;
}

/**
 * Component used to show and update activity message content.
 * @internal
 */
export function CustomActivityMessageContent({initialActivityMessageInfo}: {initialActivityMessageInfo: ActivityMessageEventArgs})  {
  const [percentCompleteLabel] = React.useState(UiFramework.translate("activityCenter.percentComplete"));
  const [activityMessageInfo, setActivityMessageInfo] = React.useState(initialActivityMessageInfo);

  React.useEffect(() => {
    const handleActivityMessageUpdatedEvent = (args: ActivityMessageEventArgs) => {
      setActivityMessageInfo(args);
    };

    return MessageManager.onActivityMessageUpdatedEvent.addListener(handleActivityMessageUpdatedEvent);
  }, []);

  return (
    <>
      {activityMessageInfo.message && <Text>{activityMessageInfo.message}</Text>}
      {!!activityMessageInfo.details?.showPercentInMessage &&
        <Small>{`${activityMessageInfo.percentage} ${percentCompleteLabel}`}</Small>
      }
      {activityMessageInfo.details?.showProgressBar && <ProgressLinear value={activityMessageInfo?.percentage} />}
    </>
  );
}
