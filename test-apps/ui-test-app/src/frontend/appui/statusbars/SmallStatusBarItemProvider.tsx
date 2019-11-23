/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  ToolAssistanceField, ActivityCenterField, MessageCenterField,
  SnapModeField, StatusBarItem, StatusBarSection, StatusBarItemUtilities,
  withStatusFieldProps, withMessageCenterFieldProps, BooleanSyncUiListener,
} from "@bentley/ui-framework";
import { SampleAppUiActionId, SampleAppIModelApp } from "../..";

// tslint:disable-next-line: variable-name
const ToolAssistance = withStatusFieldProps(ToolAssistanceField);
// tslint:disable-next-line: variable-name
const MessageCenter = withMessageCenterFieldProps(MessageCenterField);
// tslint:disable-next-line: variable-name
const SnapMode = withMessageCenterFieldProps(SnapModeField);
// tslint:disable-next-line: variable-name
const ActivityCenter = withStatusFieldProps(ActivityCenterField);

export class SmallStatusBarItemProvider {
  public static readonly id = "ui-test-app.SmallStatusBarItemProvider";
  private _statusBarItems: ReadonlyArray<StatusBarItem> | undefined = undefined;

  public get statusBarItems(): ReadonlyArray<StatusBarItem> {
    if (!this._statusBarItems) {
      this._statusBarItems = [
        StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 10, <MessageCenter />),
        StatusBarItemUtilities.createStatusBarItem("ToolAssistance", StatusBarSection.Left, 20, <ToolAssistance />),
        StatusBarItemUtilities.createStatusBarItem("ActivityCenter", StatusBarSection.Left, 30, <ActivityCenter />),

        StatusBarItemUtilities.createStatusBarItem("SnapMode", StatusBarSection.Center, 10, (
          <BooleanSyncUiListener eventIds={[SampleAppUiActionId.setTestProperty]} boolFunc={(): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE"}>
            {(isVisible: boolean) => isVisible && <SnapMode />}
          </BooleanSyncUiListener>
        )),
      ];
    }
    return this._statusBarItems;
  }
}
