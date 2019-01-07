/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";

import "../configurableui.scss";

import { StatusBarFieldId, IStatusBar } from "../StatusBarWidgetControl";

import { Status, MessageLayout, Progress } from "@bentley/ui-ninezone";
import { MessageManager, ActivityMessageEventArgs } from "../MessageManager";
import { UiFramework } from "../../UiFramework";

/** Properties for the [[ActivityCenterField]] component */
export interface ActivityCenterProps {
  statusBar: IStatusBar;
  isInFooterMode: boolean;
  openWidget: StatusBarFieldId;
}

/** State for the [[ActivityCenterField]] component */
export interface ActivityCenterState {
  title: string;
  percentage: number;
  isActivityMessageVisible: boolean;
}

/** Activity Center Field React component.
 */
export class ActivityCenterField extends React.Component<ActivityCenterProps, ActivityCenterState> {
  private _element: any;

  constructor(p: ActivityCenterProps) {
    super(p);
    this.state = {
      title: "",
      percentage: 0,
      isActivityMessageVisible: true,
    };
  }

  public componentDidMount() {
    MessageManager.onActivityMessageUpdatedEvent.addListener(this._handleActivityMessageEvent);
    MessageManager.onActivityMessageCancelledEvent.addListener(this._handleActivityMessageCancelledEvent);
  }

  public componentWillUnmount() {
    MessageManager.onActivityMessageUpdatedEvent.removeListener(this._handleActivityMessageEvent);
    MessageManager.onActivityMessageCancelledEvent.removeListener(this._handleActivityMessageCancelledEvent);
  }

  private _handleActivityMessageEvent = (args: ActivityMessageEventArgs) => {
    this.setState((_prevState) => ({
      title: args.message,
      percentage: args.percentage,
      isActivityMessageVisible: true,
    }));
  }

  private _handleActivityMessageCancelledEvent = () => {
    this.setState((_prevState) => ({
      isActivityMessageVisible: false,
    }));
  }

  private _openActivityMessage = () => {
    MessageManager.setupActivityMessageValues(this.state.title, this.state.percentage, true);
  }

  public render(): React.ReactNode {
    let footerMessages: React.ReactNode;
    const isPercentageValid = (this.state.percentage > 0 && this.state.percentage < 100);
    if (this.state.isActivityMessageVisible && isPercentageValid) {
      const moreDetails = UiFramework.i18n.translate("UiFramework:activityCenter.moreDetails");
      const tooltip = this.state.title + " - " + moreDetails;

      footerMessages = (
        <div className="centered open-activity-message" onClick={this._openActivityMessage} title={tooltip}>
          <MessageLayout
            progress={
              <Progress
                status={Status.Information}
                progress={this.state.percentage}
              />
            }
          />
        </div>
      );
    } else {
      footerMessages = <div />;
    }
    this.props.statusBar.setFooterMessages(this._element);
    return footerMessages;
  }
}
