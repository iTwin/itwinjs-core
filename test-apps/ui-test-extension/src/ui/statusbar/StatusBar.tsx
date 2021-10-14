/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { StatusBarSection } from "@itwin/appui-abstract";
import {
  FooterModeField, MessageCenterField, SectionsStatusField, SelectionInfoField,
  SelectionScopeField, StatusBarComposer, StatusBarItem,
  StatusBarItemUtilities, StatusBarWidgetControl, StatusBarWidgetControlArgs, TileLoadingIndicator, ToolAssistanceField, withMessageCenterFieldProps, withStatusFieldProps,
} from "@itwin/appui-react";
import { FooterSeparator } from "@itwin/appui-layout-react";

/* eslint-disable @typescript-eslint/naming-convention */
const ToolAssistance = withStatusFieldProps(ToolAssistanceField);
const MessageCenter = withMessageCenterFieldProps(MessageCenterField);
const Sections = withStatusFieldProps(SectionsStatusField);
const TileLoadIndicator = withStatusFieldProps(TileLoadingIndicator);
const SelectionScope = withStatusFieldProps(SelectionScopeField);
const SelectionInfo = withStatusFieldProps(SelectionInfoField);

const FooterOnlyDisplay = withStatusFieldProps(FooterModeField);
/* eslint-enable @typescript-eslint/naming-convention */

export class ExtensionStatusBarWidgetControl extends StatusBarWidgetControl {
  private _statusBarItems?: StatusBarItem[];

  public getReactNode(_args: StatusBarWidgetControlArgs): React.ReactNode {
    return (
      <StatusBarComposer items={this._items} />
    );
  }

  private get _footerModeOnlySeparator(): React.ReactNode {
    return (<FooterOnlyDisplay> <FooterSeparator /> </FooterOnlyDisplay>);
  }

  private get _items(): StatusBarItem[] {
    if (!this._statusBarItems) {
      const statusBarItems: StatusBarItem[] = [];

      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 10, <MessageCenter />));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("PreToolAssistance", StatusBarSection.Left, 15, this._footerModeOnlySeparator));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("ToolAssistance", StatusBarSection.Left, 20, <ToolAssistance />));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("PostToolAssistance", StatusBarSection.Left, 25, this._footerModeOnlySeparator));

      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("Sections", StatusBarSection.Center, 35, <Sections />));

      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("TileLoadIndicator", StatusBarSection.Right, 10, <TileLoadIndicator />));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("SelectionScope", StatusBarSection.Right, 20, <SelectionScope />));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("SelectionInfo", StatusBarSection.Right, 30, <SelectionInfo />));

      this._statusBarItems = statusBarItems;
    }
    return this._statusBarItems;
  }
}
