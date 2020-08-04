/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { StatusBarSection } from "@bentley/ui-abstract";
import {
  FooterModeField, MessageCenterField, SectionsStatusField, SelectionInfoField,
  SelectionScopeField, StatusBarComposer, StatusBarItem,
  StatusBarItemUtilities, StatusBarWidgetControl, StatusBarWidgetControlArgs, TileLoadingIndicator, ToolAssistanceField, withMessageCenterFieldProps, withStatusFieldProps,
} from "@bentley/ui-framework";
import { FooterSeparator } from "@bentley/ui-ninezone";

// tslint:disable-next-line: variable-name
const ToolAssistance = withStatusFieldProps(ToolAssistanceField);
// tslint:disable-next-line: variable-name
const MessageCenter = withMessageCenterFieldProps(MessageCenterField);
// tslint:disable-next-line: variable-name
const Sections = withStatusFieldProps(SectionsStatusField);
// tslint:disable-next-line: variable-name
const TileLoadIndicator = withStatusFieldProps(TileLoadingIndicator);
// tslint:disable-next-line: variable-name
const SelectionScope = withStatusFieldProps(SelectionScopeField);
// tslint:disable-next-line: variable-name
const SelectionInfo = withStatusFieldProps(SelectionInfoField);

// tslint:disable-next-line: variable-name
const FooterOnlyDisplay = withStatusFieldProps(FooterModeField);

export class ExtensionStatusBarWidgetControl extends StatusBarWidgetControl {
  private _statusBarItems?: StatusBarItem[];

  public getReactNode(_args: StatusBarWidgetControlArgs): React.ReactNode {
    return (
      <StatusBarComposer items={this.items} />
    );
  }

  private get footerModeOnlySeparator(): React.ReactNode {
    return (<FooterOnlyDisplay> <FooterSeparator /> </FooterOnlyDisplay>);
  }

  private get items(): StatusBarItem[] {
    if (!this._statusBarItems) {
      const statusBarItems: StatusBarItem[] = [];

      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 10, <MessageCenter />));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("PreToolAssistance", StatusBarSection.Left, 15, this.footerModeOnlySeparator));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("ToolAssistance", StatusBarSection.Left, 20, <ToolAssistance />));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("PostToolAssistance", StatusBarSection.Left, 25, this.footerModeOnlySeparator));

      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("Sections", StatusBarSection.Center, 35, <Sections />));

      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("TileLoadIndicator", StatusBarSection.Right, 10, <TileLoadIndicator />));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("SelectionScope", StatusBarSection.Right, 20, <SelectionScope />));
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("SelectionInfo", StatusBarSection.Right, 30, <SelectionInfo />));

      this._statusBarItems = statusBarItems;
    }
    return this._statusBarItems;
  }
}
