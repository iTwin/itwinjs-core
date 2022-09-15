/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ConditionalBooleanValue, StatusBarSection } from "@itwin/appui-abstract";
import {
  ActivityCenterField, ConfigurableUiManager, MessageCenterField, SnapModeField, StatusBarComposer, StatusBarItem,
  StatusBarItemUtilities, StatusBarWidgetControl, ToolAssistanceField,
} from "@itwin/appui-react";
import { FooterSeparator } from "@itwin/appui-layout-react";
import { SampleAppIModelApp, SampleAppUiActionId } from "../..";

export class SmallStatusBarWidgetControl extends StatusBarWidgetControl {
  private _statusBarItems: StatusBarItem[] | undefined;

  private get statusBarItems(): StatusBarItem[] {
    if (!this._statusBarItems) {
      const isHiddenCondition = new ConditionalBooleanValue(() => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);

      this._statusBarItems = [
        StatusBarItemUtilities.createStatusBarItem("ToolAssistance", StatusBarSection.Left, 10, <ToolAssistanceField />),
        StatusBarItemUtilities.createStatusBarItem("ToolAssistanceSeparator", StatusBarSection.Left, 15, (<FooterSeparator />)),
        StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 20, <MessageCenterField />),
        StatusBarItemUtilities.createStatusBarItem("MessageCenterSeparator", StatusBarSection.Left, 25, (<FooterSeparator />)),
        StatusBarItemUtilities.createStatusBarItem("ActivityCenter", StatusBarSection.Left, 30, <ActivityCenterField />),
        StatusBarItemUtilities.createStatusBarItem("SnapMode", StatusBarSection.Center, 10, <SnapModeField />, { isHidden: isHiddenCondition }),
      ];
    }
    return this._statusBarItems;
  }

  public getReactNode(): React.ReactNode {
    return (
      <StatusBarComposer items={this.statusBarItems} />
    );
  }
}

ConfigurableUiManager.registerControl("SmallStatusBar", SmallStatusBarWidgetControl);
