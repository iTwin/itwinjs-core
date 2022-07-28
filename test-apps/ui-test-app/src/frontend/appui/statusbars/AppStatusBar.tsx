/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./AppStatusBar.scss";
import * as React from "react";
import { ConditionalBooleanValue, StatusBarSection } from "@itwin/appui-abstract";
import {
  ActivityCenterField, ClearEmphasisStatusField, ConfigurableUiManager, MessageCenterField, SectionsStatusField, SelectionInfoField,
  SelectionScopeField, SnapModeField, StatusBarComposer, StatusBarItem, StatusBarItemUtilities, StatusBarWidgetControl, StatusBarWidgetControlArgs,
  TileLoadingIndicator, ToolAssistanceField, ViewAttributesStatusField,
} from "@itwin/appui-react";
import { FooterSeparator } from "@itwin/appui-layout-react";
import { SampleAppIModelApp, SampleAppUiActionId } from "../..";
import { DisplayStyleField } from "../statusfields/DisplayStyleField";

export class AppStatusBarWidgetControl extends StatusBarWidgetControl {
  private _statusBarItems: StatusBarItem[] | undefined;

  public get statusBarItems(): StatusBarItem[] {
    if (!this._statusBarItems) {
      const isHiddenCondition = new ConditionalBooleanValue(() => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);

      this._statusBarItems = [
        StatusBarItemUtilities.createStatusBarItem("ToolAssistance", StatusBarSection.Left, 10, <ToolAssistanceField style={{ minWidth: "21em" }} />),
        StatusBarItemUtilities.createStatusBarItem("ToolAssistanceSeparator", StatusBarSection.Left, 15, (<FooterSeparator />)),
        StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 20, <MessageCenterField />),
        StatusBarItemUtilities.createStatusBarItem("MessageCenterSeparator", StatusBarSection.Left, 25, (<FooterSeparator />)),
        StatusBarItemUtilities.createStatusBarItem("DisplayStyle", StatusBarSection.Center, 40, <DisplayStyleField />),
        StatusBarItemUtilities.createStatusBarItem("ActivityCenter", StatusBarSection.Center, 10, <ActivityCenterField />),
        StatusBarItemUtilities.createStatusBarItem("ViewAttributes", StatusBarSection.Center, 60, <ViewAttributesStatusField />),
        StatusBarItemUtilities.createStatusBarItem("Sections", StatusBarSection.Center, 50, <SectionsStatusField hideWhenUnused={true} />),
        // eslint-disable-next-line deprecation/deprecation
        StatusBarItemUtilities.createStatusBarItem("ClearEmphasis", StatusBarSection.Center, 40, <ClearEmphasisStatusField hideWhenUnused={true} />),
        StatusBarItemUtilities.createStatusBarItem("SnapMode", StatusBarSection.Center, 30, <SnapModeField />, { isHidden: isHiddenCondition }),
        StatusBarItemUtilities.createStatusBarItem("TileLoadIndicator", StatusBarSection.Right, 10, <TileLoadingIndicator />),
        StatusBarItemUtilities.createStatusBarItem("SelectionInfo", StatusBarSection.Right, 30, <SelectionInfoField />),
        StatusBarItemUtilities.createStatusBarItem("SelectionScope", StatusBarSection.Right, 20, <SelectionScopeField />),
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

ConfigurableUiManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);
