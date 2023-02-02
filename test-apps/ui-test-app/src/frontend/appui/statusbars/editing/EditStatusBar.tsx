/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./EditStatusBar.scss";
import * as React from "react";
import {
  ActivityCenterField, AnyStatusBarItem, ClearEmphasisStatusField, ConfigurableUiManager, MessageCenterField, SectionsStatusField, SelectionInfoField,
  SelectionScopeField, SnapModeField, StatusBarComposer, StatusBarItemUtilities, StatusBarSection, StatusBarSeparator, StatusBarWidgetControl, StatusBarWidgetControlArgs,
  TileLoadingIndicator, ToolAssistanceField, ViewAttributesStatusField,
} from "@itwin/appui-react";
import { DisplayStyleField } from "../../statusfields/DisplayStyleField";
import { PushPullStatusField } from "../../statusfields/editing/PushPullStatusField";

export class EditStatusBarWidgetControl extends StatusBarWidgetControl {
  private _statusBarItems: AnyStatusBarItem[] | undefined;

  public get statusBarItems(): AnyStatusBarItem[] {
    if (!this._statusBarItems) {
      this._statusBarItems = [
        StatusBarItemUtilities.createCustomItem("ToolAssistance", StatusBarSection.Left, 10, <ToolAssistanceField />),
        StatusBarItemUtilities.createCustomItem("ToolAssistanceSeparator", StatusBarSection.Left, 15, <StatusBarSeparator />),
        StatusBarItemUtilities.createCustomItem("MessageCenter", StatusBarSection.Left, 20, <MessageCenterField />),
        StatusBarItemUtilities.createCustomItem("MessageCenterSeparator", StatusBarSection.Left, 25, <StatusBarSeparator />),
        StatusBarItemUtilities.createCustomItem("DisplayStyle", StatusBarSection.Center, 10, <DisplayStyleField />),
        StatusBarItemUtilities.createCustomItem("ActivityCenter", StatusBarSection.Center, 20, <ActivityCenterField />),
        StatusBarItemUtilities.createCustomItem("PushPull", StatusBarSection.Center, 30, <PushPullStatusField />),
        StatusBarItemUtilities.createCustomItem("ViewAttributes", StatusBarSection.Center, 40, <ViewAttributesStatusField />),
        StatusBarItemUtilities.createCustomItem("Sections", StatusBarSection.Center, 50, <SectionsStatusField hideWhenUnused={true} />),
        // eslint-disable-next-line deprecation/deprecation
        StatusBarItemUtilities.createCustomItem("ClearEmphasis", StatusBarSection.Center, 60, <ClearEmphasisStatusField hideWhenUnused={true} />),
        StatusBarItemUtilities.createCustomItem("SnapMode", StatusBarSection.Center, 70, <SnapModeField />),
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

ConfigurableUiManager.registerControl("EditStatusBar", EditStatusBarWidgetControl);
