/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ConfigurableUiManager } from "@bentley/ui-framework";
import { ConfigurableCreateInfo } from "@bentley/ui-framework";
import { StatusBarWidgetControl, IStatusBar, StatusBarFieldId } from "@bentley/ui-framework";
import { ActivityCenterField } from "@bentley/ui-framework";
import { MessageCenterField, SnapModeField, PromptField } from "@bentley/ui-framework";

import { ToolAssistanceField } from "../statusfields/ToolAssistance";

class AppStatusBarWidgetControl extends StatusBarWidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public getReactNode(statusBar: IStatusBar, isInFooterMode: boolean, openWidget: StatusBarFieldId): React.ReactNode {
    return (
      <>
        <PromptField isInFooterMode={isInFooterMode} />
        <ToolAssistanceField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
        <ActivityCenterField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
        <MessageCenterField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
        <SnapModeField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
      </>
    );
  }
}

ConfigurableUiManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);
