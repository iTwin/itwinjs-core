/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ConditionalBooleanValue, StatusBarSection } from "@itwin/appui-abstract";
import {
  ActivityCenterField, ConfigurableUiManager, FooterModeField, MessageCenterField, SnapModeField, StatusBarComposer, StatusBarItem,
  StatusBarItemUtilities, StatusBarWidgetControl, StatusBarWidgetControlArgs, ToolAssistanceField, withMessageCenterFieldProps, withStatusFieldProps,
} from "@itwin/appui-react";
import { FooterSeparator } from "@itwin/appui-layout-react";
import { SampleAppIModelApp, SampleAppUiActionId } from "../..";

export class SmallStatusBarWidgetControl extends StatusBarWidgetControl {
  private _statusBarItems: StatusBarItem[] | undefined;

  private get statusBarItems(): StatusBarItem[] {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const ToolAssistance = withStatusFieldProps(ToolAssistanceField);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const MessageCenter = withMessageCenterFieldProps(MessageCenterField);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const SnapMode = withMessageCenterFieldProps(SnapModeField);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const ActivityCenter = withStatusFieldProps(ActivityCenterField);
    // eslint-disable-next-line @typescript-eslint/naming-convention
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
