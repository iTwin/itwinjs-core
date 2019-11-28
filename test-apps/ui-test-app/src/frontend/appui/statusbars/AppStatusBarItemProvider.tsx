/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { FooterSeparator } from "@bentley/ui-ninezone";
import { ViewsStatusField } from "@bentley/saved-views";
import {
  ToolAssistanceField, ActivityCenterField, MessageCenterField,
  SnapModeField, ViewAttributesStatusField, SectionsStatusField,
  SelectionScopeField, SelectionInfoField, ClearEmphasisStatusField, StatusFieldProps,
  StatusBarItem, StatusBarSection, StatusBarItemUtilities, withStatusFieldProps, withMessageCenterFieldProps,
  BooleanSyncUiListener, TileLoadingIndicator, FooterModeField, useActiveIModelConnection,
} from "@bentley/ui-framework";
import { DisplayStyleField } from "../statusfields/DisplayStyleField";
import { SampleAppUiActionId, SampleAppIModelApp } from "../..";

// tslint:disable-next-line: variable-name
const ToolAssistance = withStatusFieldProps(ToolAssistanceField);
// tslint:disable-next-line: variable-name
const MessageCenter = withMessageCenterFieldProps(MessageCenterField);
// tslint:disable-next-line: variable-name
const SnapMode = withMessageCenterFieldProps(SnapModeField);
// tslint:disable-next-line: variable-name
const DisplayStyle = withStatusFieldProps(DisplayStyleField);
// tslint:disable-next-line: variable-name
const ActivityCenter = withStatusFieldProps(ActivityCenterField);
// tslint:disable-next-line: variable-name
const ViewAttributes = withStatusFieldProps(ViewAttributesStatusField);
// tslint:disable-next-line: variable-name
const Sections = withStatusFieldProps(SectionsStatusField);
// tslint:disable-next-line: variable-name
const SelectionInfo = withStatusFieldProps(SelectionInfoField);
// tslint:disable-next-line: variable-name
const SelectionScope = withStatusFieldProps(SelectionScopeField);
// tslint:disable-next-line: variable-name
const ClearEmphasis = withStatusFieldProps(ClearEmphasisStatusField);
// tslint:disable-next-line: variable-name
const TileLoadIndicator = withStatusFieldProps(TileLoadingIndicator);
// tslint:disable-next-line: variable-name
const FooterMode = withStatusFieldProps(FooterModeField);

// tslint:disable-next-line: variable-name
const ConnectedViewsStatusField: React.FC<StatusFieldProps> = (_props) => {
  const activeIModelConnection = useActiveIModelConnection();
  return (
    <ViewsStatusField showThumbnails={true} showSavedViews={true} displaySuccess={true} displayErrors={true} allowShareViewOnCreate={true}
      iModelConnection={activeIModelConnection} />
  );
};

// tslint:disable-next-line: variable-name
const SavedViewsStatusField = withStatusFieldProps(ConnectedViewsStatusField);

export class AppStatusBarItemProvider {
  public static readonly id = "ui-test-app.AppStatusBarItemProvider";
  private _statusBarItems: ReadonlyArray<StatusBarItem> | undefined = undefined;

  public get statusBarItems(): ReadonlyArray<StatusBarItem> {
    if (!this._statusBarItems) {
      this._statusBarItems = [
        StatusBarItemUtilities.createStatusBarItem("ToolAssistance", StatusBarSection.Left, 10, <ToolAssistance />),
        StatusBarItemUtilities.createStatusBarItem("ToolAssistanceSeparator", StatusBarSection.Left, 15, (
          <FooterMode> <FooterSeparator /> </FooterMode>
        )),

        StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 20, <MessageCenter />),
        StatusBarItemUtilities.createStatusBarItem("MessageCenterSeparator", StatusBarSection.Left, 25, (
          <FooterMode> <FooterSeparator /> </FooterMode>
        )),

        StatusBarItemUtilities.createStatusBarItem("DisplayStyle", StatusBarSection.Center, 40, <DisplayStyle />),
        StatusBarItemUtilities.createStatusBarItem("ActivityCenter", StatusBarSection.Center, 10, <ActivityCenter />),
        StatusBarItemUtilities.createStatusBarItem("ViewAttributes", StatusBarSection.Center, 60, <ViewAttributes />),
        StatusBarItemUtilities.createStatusBarItem("Sections", StatusBarSection.Center, 50, <Sections hideWhenUnused={true} />),
        StatusBarItemUtilities.createStatusBarItem("ClearEmphasis", StatusBarSection.Center, 40, <ClearEmphasis hideWhenUnused={true} />),

        StatusBarItemUtilities.createStatusBarItem("SnapMode", StatusBarSection.Center, 30, (
          <BooleanSyncUiListener eventIds={[SampleAppUiActionId.setTestProperty]} boolFunc={(): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE"}>
            {(isVisible: boolean) => isVisible && <SnapMode />}
          </BooleanSyncUiListener>
        )),

        StatusBarItemUtilities.createStatusBarItem("SavedViews", StatusBarSection.Center, 35, <SavedViewsStatusField />),
        StatusBarItemUtilities.createStatusBarItem("TileLoadIndicator", StatusBarSection.Right, 10, <TileLoadIndicator />),
        StatusBarItemUtilities.createStatusBarItem("SelectionInfo", StatusBarSection.Right, 30, <SelectionInfo />),
        StatusBarItemUtilities.createStatusBarItem("SelectionScope", StatusBarSection.Right, 20, <SelectionScope />),
      ];
    }
    return this._statusBarItems;
  }
}
