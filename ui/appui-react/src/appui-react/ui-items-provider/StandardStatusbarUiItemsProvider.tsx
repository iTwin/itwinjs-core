/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StandardUiItemsProvider
 */

import * as React from "react";
import { CommonStatusBarItem, StatusBarSection, UiItemsProvider } from "@itwin/appui-abstract";
import { FooterSeparator } from "@itwin/appui-layout-react";
import { StatusBarItemUtilities } from "../statusbar/StatusBarItemUtilities";
import { ToolAssistanceField } from "../statusfields/toolassistance/ToolAssistanceField";
import { MessageCenterField } from "../statusfields/MessageCenter";
import { ActivityCenterField } from "../statusfields/ActivityCenter";
import { SnapModeField } from "../statusfields/SnapMode";
import { SelectionInfoField } from "../statusfields/SelectionInfo";
import { TileLoadingIndicator } from "../statusfields/tileloading/TileLoadingIndicator";
import { SelectionScopeField } from "../statusfields/SelectionScope";

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
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.MessageCenter", StatusBarSection.Left, 10, <MessageCenterField />));
    }
    // istanbul ignore else
    if (!this._defaultItems || this._defaultItems.toolAssistance) {
      if (!this._defaultItems || this._defaultItems.preToolAssistanceSeparator)
        statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.PreToolAssistance", StatusBarSection.Left, 15, <FooterSeparator />));

      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.ToolAssistance", StatusBarSection.Left, 20, <ToolAssistanceField />));

      if (!this._defaultItems || this._defaultItems.postToolAssistanceSeparator)
        statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.PostToolAssistance", StatusBarSection.Left, 25, <FooterSeparator />));
    }
    // istanbul ignore else
    if (this._defaultItems?.activityCenter) {
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.ActivityCenter", StatusBarSection.Left, 30, <ActivityCenterField />));
    }
    // istanbul ignore else
    if (!this._defaultItems || this._defaultItems.accuSnapModePicker) {
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.SnapMode", StatusBarSection.Center, 10, <SnapModeField />));
    }

    // istanbul ignore else
    if (!this._defaultItems || this._defaultItems.tileLoadIndicator) {
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.TileLoadIndicator", StatusBarSection.Right, 10, <TileLoadingIndicator />));
    }

    // istanbul ignore else
    if (!this._defaultItems || this._defaultItems.selectionScope) {
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.SelectionScope", StatusBarSection.Right, 20, <SelectionScopeField />));
    }

    // istanbul ignore else
    if (!this._defaultItems || this._defaultItems.selectionInfo) {
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.SelectionInfo", StatusBarSection.Right, 30, <SelectionInfoField />));
    }

    return statusBarItems;
  }
}
