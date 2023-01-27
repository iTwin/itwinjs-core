/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ConditionalBooleanValue } from "@itwin/appui-abstract";
import {
  ActivityCenterField, AnyStatusBarItem, MessageCenterField, SnapModeField, StatusBarComposer,
  StatusBarItemUtilities, StatusBarSection, StatusBarSeparator, StatusBarWidgetControl, StatusBarWidgetControlArgs, ToolAssistanceField, UiFramework,
} from "@itwin/appui-react";
import { SampleAppIModelApp, SampleAppUiActionId } from "../..";

export class SmallStatusBarWidgetControl extends StatusBarWidgetControl {
  private _statusBarItems: AnyStatusBarItem[] | undefined;

  private get statusBarItems(): AnyStatusBarItem[] {
    if (!this._statusBarItems) {
      const isHiddenCondition = new ConditionalBooleanValue(() => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);

      this._statusBarItems = [
        StatusBarItemUtilities.createCustomItem("ToolAssistance", StatusBarSection.Left, 10, <ToolAssistanceField />),
        StatusBarItemUtilities.createCustomItem("ToolAssistanceSeparator", StatusBarSection.Left, 15, <StatusBarSeparator />),
        StatusBarItemUtilities.createCustomItem("MessageCenter", StatusBarSection.Left, 20, <MessageCenterField />),
        StatusBarItemUtilities.createCustomItem("MessageCenterSeparator", StatusBarSection.Left, 25, <StatusBarSeparator />),
        StatusBarItemUtilities.createCustomItem("ActivityCenter", StatusBarSection.Left, 30, <ActivityCenterField />),
        StatusBarItemUtilities.createCustomItem("SnapMode", StatusBarSection.Center, 10, <SnapModeField />, { isHidden: isHiddenCondition }),
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

UiFramework.controls.register("SmallStatusBar", SmallStatusBarWidgetControl);
