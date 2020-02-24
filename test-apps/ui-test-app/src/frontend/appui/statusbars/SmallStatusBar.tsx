/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { FooterSeparator } from "@bentley/ui-ninezone";
import { StatusBarSection, ConditionalBooleanValue } from "@bentley/ui-abstract";
import {
  ConfigurableUiManager, ConfigurableCreateInfo, ToolAssistanceField, ActivityCenterField, MessageCenterField,
  SnapModeField, StatusBarItem, StatusBarItemUtilities,
  StatusBarWidgetControl, StatusBarWidgetControlArgs, StatusBarComposer,
  withStatusFieldProps, withMessageCenterFieldProps, FooterModeField,
} from "@bentley/ui-framework";

import { SampleAppUiActionId, SampleAppIModelApp } from "../..";

export class SmallStatusBarWidgetControl extends StatusBarWidgetControl {
  private _statusBarItems: StatusBarItem[] | undefined;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  private get statusBarItems(): StatusBarItem[] {
    // tslint:disable-next-line: variable-name
    const ToolAssistance = withStatusFieldProps(ToolAssistanceField);
    // tslint:disable-next-line: variable-name
    const MessageCenter = withMessageCenterFieldProps(MessageCenterField);
    // tslint:disable-next-line: variable-name
    const SnapMode = withMessageCenterFieldProps(SnapModeField);
    // tslint:disable-next-line: variable-name
    const ActivityCenter = withStatusFieldProps(ActivityCenterField);
    // tslint:disable-next-line: variable-name
    const FooterMode = withStatusFieldProps(FooterModeField);

    if (!this._statusBarItems) {
      const isHiddenCondition = new ConditionalBooleanValue(() => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);

      this._statusBarItems = [
        StatusBarItemUtilities.createStatusBarItem("ToolAssistance", StatusBarSection.Left, 10, <ToolAssistance />),
        StatusBarItemUtilities.createStatusBarItem("ToolAssistanceSeparator", StatusBarSection.Left, 15, (<FooterMode> <FooterSeparator /> </FooterMode>)),
        StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 20, <MessageCenter />),
        StatusBarItemUtilities.createStatusBarItem("MessageCenterSeparator", StatusBarSection.Left, 25, (<FooterMode> <FooterSeparator /> </FooterMode>)),
        StatusBarItemUtilities.createStatusBarItem("ActivityCenter", StatusBarSection.Left, 30, <ActivityCenter />),
        StatusBarItemUtilities.createStatusBarItem("SnapMode", StatusBarSection.Center, 10, <SnapMode />, { isHidden: isHiddenCondition }),
      ];
    }
    return this._statusBarItems;
  }

  public getReactNode(_args: StatusBarWidgetControlArgs): React.ReactNode {
    return (
      <StatusBarComposer items={this.statusBarItems} />
    );
  }
}

ConfigurableUiManager.registerControl("SmallStatusBar", SmallStatusBarWidgetControl);
