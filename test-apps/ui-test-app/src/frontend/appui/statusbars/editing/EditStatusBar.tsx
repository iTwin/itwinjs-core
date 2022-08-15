/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./EditStatusBar.scss";
import * as React from "react";
import { StatusBarSection } from "@itwin/appui-abstract";
import {
  ActivityCenterField, ClearEmphasisStatusField, ConfigurableUiManager, MessageCenterField, SectionsStatusField, SelectionInfoField,
  SelectionScopeField, SnapModeField, StatusBarComposer, StatusBarItem, StatusBarItemUtilities, StatusBarWidgetControl, StatusBarWidgetControlArgs,
  TileLoadingIndicator, ToolAssistanceField, ViewAttributesStatusField,
} from "@itwin/appui-react";
import { FooterSeparator } from "@itwin/appui-layout-react";
import { DisplayStyleField } from "../../statusfields/DisplayStyleField";
import { PushPullStatusField } from "../../statusfields/editing/PushPullStatusField";

export class EditStatusBarWidgetControl extends StatusBarWidgetControl {
  private _statusBarItems: StatusBarItem[] | undefined;

  public get statusBarItems(): StatusBarItem[] {
    if (!this._statusBarItems) {
      this._statusBarItems = [
        StatusBarItemUtilities.createStatusBarItem("ToolAssistance", StatusBarSection.Left, 10, <ToolAssistanceField />),
        StatusBarItemUtilities.createStatusBarItem("ToolAssistanceSeparator", StatusBarSection.Left, 15, (<FooterSeparator />)),
        StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 20, <MessageCenterField />),
        StatusBarItemUtilities.createStatusBarItem("MessageCenterSeparator", StatusBarSection.Left, 25, (<FooterSeparator />)),
        StatusBarItemUtilities.createStatusBarItem("DisplayStyle", StatusBarSection.Center, 10, <DisplayStyleField />),
        StatusBarItemUtilities.createStatusBarItem("ActivityCenter", StatusBarSection.Center, 20, <ActivityCenterField />),
        StatusBarItemUtilities.createStatusBarItem("PushPull", StatusBarSection.Center, 30, <PushPullStatusField />),
        StatusBarItemUtilities.createStatusBarItem("ViewAttributes", StatusBarSection.Center, 40, <ViewAttributesStatusField />),
        StatusBarItemUtilities.createStatusBarItem("Sections", StatusBarSection.Center, 50, <SectionsStatusField hideWhenUnused={true} />),
        // eslint-disable-next-line deprecation/deprecation
        StatusBarItemUtilities.createStatusBarItem("ClearEmphasis", StatusBarSection.Center, 60, <ClearEmphasisStatusField hideWhenUnused={true} />),
        StatusBarItemUtilities.createStatusBarItem("SnapMode", StatusBarSection.Center, 70, <SnapModeField />),
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

ConfigurableUiManager.registerControl("EditStatusBar", EditStatusBarWidgetControl);
