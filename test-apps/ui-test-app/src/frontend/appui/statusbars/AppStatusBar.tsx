/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./AppStatusBar.scss";
import * as React from "react";
import { ConditionalBooleanValue } from "@itwin/appui-abstract";
import {
  ActivityCenterField, AnyStatusBarItem, ClearEmphasisStatusField, MessageCenterField, SectionsStatusField, SelectionInfoField,
  SelectionScopeField, SnapModeField, StatusBarComposer, StatusBarItemUtilities, StatusBarSection, StatusBarSeparator, StatusBarWidgetControl, StatusBarWidgetControlArgs,
  TileLoadingIndicator, ToolAssistanceField, UiFramework, ViewAttributesStatusField,
} from "@itwin/appui-react";
import { SampleAppIModelApp, SampleAppUiActionId } from "../..";
import { DisplayStyleField } from "../statusfields/DisplayStyleField";

export class AppStatusBarWidgetControl extends StatusBarWidgetControl {
  private _statusBarItems: AnyStatusBarItem[] | undefined;

  public get statusBarItems(): AnyStatusBarItem[] {
    if (!this._statusBarItems) {
      const isHiddenCondition = new ConditionalBooleanValue(() => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);

      this._statusBarItems = [
        StatusBarItemUtilities.createCustomItem("ToolAssistance", StatusBarSection.Left, 10, <ToolAssistanceField style={{ minWidth: "21em" }} />),
        StatusBarItemUtilities.createCustomItem("ToolAssistanceSeparator", StatusBarSection.Left, 15, <StatusBarSeparator />),
        StatusBarItemUtilities.createCustomItem("MessageCenter", StatusBarSection.Left, 20, <MessageCenterField />),
        StatusBarItemUtilities.createCustomItem("MessageCenterSeparator", StatusBarSection.Left, 25, <StatusBarSeparator />),
        StatusBarItemUtilities.createCustomItem("DisplayStyle", StatusBarSection.Center, 40, <DisplayStyleField />),
        StatusBarItemUtilities.createCustomItem("ActivityCenter", StatusBarSection.Center, 10, <ActivityCenterField />),
        StatusBarItemUtilities.createCustomItem("ViewAttributes", StatusBarSection.Center, 60, <ViewAttributesStatusField />),
        StatusBarItemUtilities.createCustomItem("Sections", StatusBarSection.Center, 50, <SectionsStatusField hideWhenUnused={true} />),
        // eslint-disable-next-line deprecation/deprecation
        StatusBarItemUtilities.createCustomItem("ClearEmphasis", StatusBarSection.Center, 40, <ClearEmphasisStatusField hideWhenUnused={true} />),
        StatusBarItemUtilities.createCustomItem("SnapMode", StatusBarSection.Center, 30, <SnapModeField />, { isHidden: isHiddenCondition }),
        StatusBarItemUtilities.createCustomItem("TileLoadIndicator", StatusBarSection.Right, 10, <TileLoadingIndicator />),
        StatusBarItemUtilities.createCustomItem("SelectionInfo", StatusBarSection.Right, 30, <SelectionInfoField />),
        StatusBarItemUtilities.createCustomItem("SelectionScope", StatusBarSection.Right, 20, <SelectionScopeField />),
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

UiFramework.controls.register("AppStatusBar", AppStatusBarWidgetControl);
