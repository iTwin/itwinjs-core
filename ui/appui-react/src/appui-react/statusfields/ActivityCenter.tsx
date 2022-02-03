/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import classnames from "classnames";
import * as React from "react";
import { Centered } from "@itwin/core-react";
import { MessageLayout, MessageProgress, Status } from "@itwin/appui-layout-react";
import type { ActivityMessageEventArgs} from "../messages/MessageManager";
import { MessageManager } from "../messages/MessageManager";
import type { NotifyMessageType } from "../messages/ReactNotifyMessageDetails";
import { UiFramework } from "../UiFramework";
import type { StatusFieldProps } from "./StatusFieldProps";

/** State for the [[ActivityCenterField]] component
 * @internal
 */
interface ActivityCenterState {
  message: NotifyMessageType;
  percentage: number;
  isActivityMessageVisible: boolean;
}

/** Activity Center Field React component.
 * @public
 */
export class ActivityCenterField extends React.Component<StatusFieldProps, ActivityCenterState> {
  constructor(p: StatusFieldProps) {
    super(p);
    this.state = {
      message: "",
      percentage: 0,
      isActivityMessageVisible: true,
    };
  }

  public override componentDidMount() {
    MessageManager.onActivityMessageUpdatedEvent.addListener(this._handleActivityMessageEvent);
    MessageManager.onActivityMessageCancelledEvent.addListener(this._handleActivityMessageCancelledEvent);
  }

  public override componentWillUnmount() {
    MessageManager.onActivityMessageUpdatedEvent.removeListener(this._handleActivityMessageEvent);
    MessageManager.onActivityMessageCancelledEvent.removeListener(this._handleActivityMessageCancelledEvent);
  }

  private _handleActivityMessageEvent = (args: ActivityMessageEventArgs) => {
    this.setState({
      message: args.message,
      percentage: args.percentage,
      isActivityMessageVisible: true,
    });
  };

  private _handleActivityMessageCancelledEvent = () => {
    this.setState({
      isActivityMessageVisible: false,
    });
  };

  private _openActivityMessage = () => {
    MessageManager.setupActivityMessageValues(this.state.message, this.state.percentage, true);
  };

  public override render(): React.ReactNode {
    let footerMessages: React.ReactNode;
    const isPercentageValid = (this.state.percentage > 0 && this.state.percentage < 100);
    if (this.state.isActivityMessageVisible && isPercentageValid) {
      const moreDetails = UiFramework.translate("activityCenter.moreDetails");
      const tooltip = `${this.state.message}-${moreDetails}`;

      footerMessages = (
        <Centered className={classnames("open-activity-message", this.props.className)}
          style={this.props.style}
          onClick={this._openActivityMessage} title={tooltip}
        >
          <MessageLayout
            progress={
              <MessageProgress
                status={Status.Information}
                progress={this.state.percentage}
              />
            }
          />
        </Centered>
      );
    } else {
      footerMessages = <div />;
    }
    return footerMessages;
  }
}
