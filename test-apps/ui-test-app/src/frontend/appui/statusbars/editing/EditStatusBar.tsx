/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./EditStatusBar.scss";
import * as React from "react";
import { StatusBarSection } from "@itwin/appui-abstract";
import {
  ActivityCenterField, ClearEmphasisStatusField, ConfigurableUiManager, FooterModeField, MessageCenterField, SectionsStatusField, SelectionInfoField,
  SelectionScopeField, SnapModeField, StatusBarComposer, StatusBarItem, StatusBarItemUtilities, StatusBarWidgetControl, StatusBarWidgetControlArgs,
  TileLoadingIndicator, ToolAssistanceField, ViewAttributesStatusField, withMessageCenterFieldProps, withStatusFieldProps,
} from "@itwin/appui-react";
import { FooterSeparator } from "@itwin/appui-layout-react";
import { DisplayStyleField } from "../../statusfields/DisplayStyleField";
import { PushPullStatusField } from "../../statusfields/editing/PushPullStatusField";

// eslint-disable-next-line @typescript-eslint/naming-convention
const ToolAssistance = withStatusFieldProps(ToolAssistanceField);
// eslint-disable-next-line @typescript-eslint/naming-convention
const MessageCenter = withMessageCenterFieldProps(MessageCenterField);
// eslint-disable-next-line @typescript-eslint/naming-convention
const SnapMode = withMessageCenterFieldProps(SnapModeField);
// eslint-disable-next-line @typescript-eslint/naming-convention
const DisplayStyle = withStatusFieldProps(DisplayStyleField);
// eslint-disable-next-line @typescript-eslint/naming-convention
const ActivityCenter = withStatusFieldProps(ActivityCenterField);
// eslint-disable-next-line @typescript-eslint/naming-convention
const ViewAttributes = withStatusFieldProps(ViewAttributesStatusField);
// eslint-disable-next-line @typescript-eslint/naming-convention
const Sections = withStatusFieldProps(SectionsStatusField);
// eslint-disable-next-line @typescript-eslint/naming-convention
const SelectionInfo = withStatusFieldProps(SelectionInfoField);
// eslint-disable-next-line @typescript-eslint/naming-convention
const SelectionScope = withStatusFieldProps(SelectionScopeField);
// eslint-disable-next-line
const ClearEmphasis = withStatusFieldProps(ClearEmphasisStatusField);
// eslint-disable-next-line @typescript-eslint/naming-convention
const TileLoadIndicator = withStatusFieldProps(TileLoadingIndicator);
// eslint-disable-next-line @typescript-eslint/naming-convention
const FooterMode = withStatusFieldProps(FooterModeField);
// eslint-disable-next-line @typescript-eslint/naming-convention
const PushPull = withStatusFieldProps(PushPullStatusField);

export class EditStatusBarWidgetControl extends StatusBarWidgetControl {
  private _statusBarItems: StatusBarItem[] | undefined;

  public get statusBarItems(): StatusBarItem[] {
    if (!this._statusBarItems) {
      this._statusBarItems = [
        StatusBarItemUtilities.createStatusBarItem("ToolAssistance", StatusBarSection.Left, 10, <ToolAssistance />),
        StatusBarItemUtilities.createStatusBarItem("ToolAssistanceSeparator", StatusBarSection.Left, 15, (<FooterMode> <FooterSeparator /> </FooterMode>)),
        StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 20, <MessageCenter />),
        StatusBarItemUtilities.createStatusBarItem("MessageCenterSeparator", StatusBarSection.Left, 25, (<FooterMode> <FooterSeparator /> </FooterMode>)),
        StatusBarItemUtilities.createStatusBarItem("DisplayStyle", StatusBarSection.Center, 10, <DisplayStyle />),
        StatusBarItemUtilities.createStatusBarItem("ActivityCenter", StatusBarSection.Center, 20, <ActivityCenter />),
        StatusBarItemUtilities.createStatusBarItem("PushPull", StatusBarSection.Center, 30, <PushPull />),
        StatusBarItemUtilities.createStatusBarItem("ViewAttributes", StatusBarSection.Center, 40, <ViewAttributes />),
        StatusBarItemUtilities.createStatusBarItem("Sections", StatusBarSection.Center, 50, <Sections hideWhenUnused={true} />),
        StatusBarItemUtilities.createStatusBarItem("ClearEmphasis", StatusBarSection.Center, 60, <ClearEmphasis hideWhenUnused={true} />),
        StatusBarItemUtilities.createStatusBarItem("SnapMode", StatusBarSection.Center, 70, <SnapMode />),
        StatusBarItemUtilities.createStatusBarItem("TileLoadIndicator", StatusBarSection.Right, 10, <TileLoadIndicator />),
        StatusBarItemUtilities.createStatusBarItem("SelectionInfo", StatusBarSection.Right, 30, <SelectionInfo />),
        StatusBarItemUtilities.createStatusBarItem("SelectionScope", StatusBarSection.Right, 20, <SelectionScope />),
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
