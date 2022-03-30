/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StandardUiItemsProvider
 */

import * as React from "react";
import { BaseUiItemsProvider, CommonStatusBarItem, StatusBarSection, UiItemsManager } from "@itwin/appui-abstract";
import { FooterSeparator } from "@itwin/appui-layout-react";
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
 * @public
 */
export class StandardStatusbarItemsProvider extends BaseUiItemsProvider {
  constructor(providerId: string, private _defaultItems?: DefaultStatusbarItems, isSupportedStage?: (stageId: string, stageUsage: string, stageAppData?: any) => boolean) {
    super(providerId, isSupportedStage);
  }

  /**
  * static function to register the StandardStatusbarItemsProvider
  * @param providerId - unique identifier for this instance of the provider. This is required in case separate packages want
  * to set up custom stage with their own subset of standard status bar items.
  * @param defaultItems - if undefined all available item are provided to stage except for activityCenter. If defined only those
  * specific tool buttons are shown.
  * @param isSupportedStage - optional function that will be called to determine if tools should be added to current stage. If not set and
  * the current stage's `usage` is set to `StageUsage.General` then the provider will add items to frontstage.
  */
  public static register(providerId: string, defaultItems?: DefaultStatusbarItems, isSupportedStage?: (stageId: string, stageUsage: string, stageAppData?: any) => boolean) {
    const provider = new StandardStatusbarItemsProvider(providerId, defaultItems, isSupportedStage);
    UiItemsManager.register(provider);
    return provider;
  }

  public override provideStatusBarItemsInternal(_stageId: string, _stageUsage: string, _stageAppData?: any): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];
    if (!this._defaultItems || this._defaultItems.messageCenter) {
      const MessageCenter = withMessageCenterFieldProps(MessageCenterField);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.MessageCenter", StatusBarSection.Left, 10, <MessageCenter />));
    }
    if (!this._defaultItems || this._defaultItems.toolAssistance) {
      if (!this._defaultItems || this._defaultItems.preToolAssistanceSeparator)
        statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.PreToolAssistance", StatusBarSection.Left, 15, <FooterSeparator />));

      const ToolAssistance = withStatusFieldProps(ToolAssistanceField);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.ToolAssistance", StatusBarSection.Left, 20, <ToolAssistance />));

      if (!this._defaultItems || this._defaultItems.postToolAssistanceSeparator)
        statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.PostToolAssistance", StatusBarSection.Left, 25, <FooterSeparator />));
    }
    if (this._defaultItems?.activityCenter) {
      const ActivityCenter = withStatusFieldProps(ActivityCenterField);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.ActivityCenter", StatusBarSection.Left, 30, <ActivityCenter />));
    }
    if (!this._defaultItems || this._defaultItems.accuSnapModePicker) {
      const SnapMode = withMessageCenterFieldProps(SnapModeField);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.SnapMode", StatusBarSection.Center, 10, <SnapMode />));
    }

    if (!this._defaultItems || this._defaultItems.tileLoadIndicator) {
      const TileLoadIndicator = withStatusFieldProps(TileLoadingIndicator);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.TileLoadIndicator", StatusBarSection.Right, 10, <TileLoadIndicator />));
    }

    if (!this._defaultItems || this._defaultItems.selectionScope) {
      const SelectionScope = withStatusFieldProps(SelectionScopeField);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.SelectionScope", StatusBarSection.Right, 20, <SelectionScope />));
    }

    if (!this._defaultItems || this._defaultItems.selectionInfo) {
      const SelectionInfo = withStatusFieldProps(SelectionInfoField);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.SelectionInfo", StatusBarSection.Right, 30, <SelectionInfo />));
    }

    return statusBarItems;
  }
}
