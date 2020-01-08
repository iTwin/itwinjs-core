/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { FooterSeparator } from "@bentley/ui-ninezone";
import { StatusBarSection } from "@bentley/ui-abstract";
import {
  ToolAssistanceField, ActivityCenterField, MessageCenterField,
  SnapModeField, StatusBarItem, StatusBarItemUtilities,
  withStatusFieldProps, withMessageCenterFieldProps, BooleanSyncUiListener, FooterModeField,
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
// tslint:disable-next-line: variable-name
const FooterMode = withStatusFieldProps(FooterModeField);

export class SmallStatusBarItemProvider {
  public static readonly id = "ui-test-app.SmallStatusBarItemProvider";
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
