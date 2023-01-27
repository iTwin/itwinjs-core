/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StandardUiItemsProvider
 */

import * as React from "react";
import { CommonStatusBarItem, StatusBarSection, UiItemsProvider } from "@itwin/appui-abstract";
import { StatusBarItemUtilities } from "../statusbar/StatusBarItemUtilities";
import { ToolAssistanceField } from "../statusfields/toolassistance/ToolAssistanceField";
import { withStatusFieldProps } from "../statusbar/withStatusFieldProps";
import { MessageCenterField } from "../statusfields/MessageCenter";
import { withMessageCenterFieldProps } from "../statusbar/withMessageCenterFieldProps";
import { ActivityCenterField } from "../statusfields/ActivityCenter";
import { SnapModeField } from "../statusfields/SnapMode";
import { SelectionInfoField } from "../statusfields/SelectionInfo";
import { TileLoadingIndicator } from "../statusfields/tileloading/TileLoadingIndicator";
import { SelectionScopeField } from "../statusfields/SelectionScope";
import { StatusBarSeparator } from "../statusbar/Separator";

/* eslint-disable deprecation/deprecation */

/**
 * Defines what items to include from the provider. If any items are
 * specified then only those items will be added to statusbar.
 * @public
 */
export interface DefaultStatusbarItems {
  messageCenter?: boolean;
  preToolAssistanceSeparator?: boolean;
  toolAssistance?: boolean;
  postToolAssistanceSeparator?: boolean;
  activityCenter?: boolean;
  accuSnapModePicker?: boolean;
  tileLoadIndicator?: boolean;
  selectionScope?: boolean;
  selectionInfo?: boolean;
}

/**
 * Provide standard statusbar fields for the SimpleStatusbarWidget
 * @beta
 */
export class StandardStatusbarUiItemsProvider implements UiItemsProvider {
  public get id(): string { return "appui-react:StandardStatusbarUiItemsProvider"; }

  constructor(private _defaultItems?: DefaultStatusbarItems) { }

  public provideStatusBarItems(_stageId: string, _stageUsage: string, _stageAppData?: any): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];
    // istanbul ignore else
    if (!this._defaultItems || this._defaultItems.messageCenter) {
      // eslint-disable-next-line deprecation/deprecation
      const MessageCenter = withMessageCenterFieldProps(MessageCenterField);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.MessageCenter", StatusBarSection.Left, 10, <MessageCenter />));
    }
    // istanbul ignore else
    if (!this._defaultItems || this._defaultItems.toolAssistance) {
      if (!this._defaultItems || this._defaultItems.preToolAssistanceSeparator)
        statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.PreToolAssistance", StatusBarSection.Left, 15, <StatusBarSeparator />));

      // eslint-disable-next-line deprecation/deprecation
      const ToolAssistance = withStatusFieldProps(ToolAssistanceField);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.ToolAssistance", StatusBarSection.Left, 20, <ToolAssistance />));

      if (!this._defaultItems || this._defaultItems.postToolAssistanceSeparator)
        statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.PostToolAssistance", StatusBarSection.Left, 25, <StatusBarSeparator />));
    }
    // istanbul ignore else
    if (this._defaultItems?.activityCenter) {
      // eslint-disable-next-line deprecation/deprecation
      const ActivityCenter = withStatusFieldProps(ActivityCenterField);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.ActivityCenter", StatusBarSection.Left, 30, <ActivityCenter />));
    }
    // istanbul ignore else
    if (!this._defaultItems || this._defaultItems.accuSnapModePicker) {
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.SnapMode", StatusBarSection.Center, 10, <SnapModeField />));
    }

    // istanbul ignore else
    if (!this._defaultItems || this._defaultItems.tileLoadIndicator) {
      // eslint-disable-next-line deprecation/deprecation
      const TileLoadIndicator = withStatusFieldProps(TileLoadingIndicator);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.TileLoadIndicator", StatusBarSection.Right, 10, <TileLoadIndicator />));
    }

    // istanbul ignore else
    if (!this._defaultItems || this._defaultItems.selectionScope) {
      // eslint-disable-next-line deprecation/deprecation
      const SelectionScope = withStatusFieldProps(SelectionScopeField);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.SelectionScope", StatusBarSection.Right, 20, <SelectionScope />));
    }

    // istanbul ignore else
    if (!this._defaultItems || this._defaultItems.selectionInfo) {
      // eslint-disable-next-line deprecation/deprecation
      const SelectionInfo = withStatusFieldProps(SelectionInfoField);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.SelectionInfo", StatusBarSection.Right, 30, <SelectionInfo />));
    }

    return statusBarItems;
  }
}
