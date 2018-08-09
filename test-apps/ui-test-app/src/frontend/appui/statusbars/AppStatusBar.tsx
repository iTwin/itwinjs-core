/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ConfigurableUiManager } from "@bentley/ui-framework";
import { ConfigurableCreateInfo } from "@bentley/ui-framework";
import { StatusBarWidgetControl, IStatusBar, StatusBarFieldId } from "@bentley/ui-framework";
import { MessageCenterField } from "@bentley/ui-framework";

import { ToolAssistanceField } from "../statusfields/ToolAssistance";
import { SnapModeField } from "../statusfields/SnapMode";

class AppStatusBarWidgetControl extends StatusBarWidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public getReactNode(statusBar: IStatusBar, isInFooterMode: boolean, openWidget: StatusBarFieldId): React.ReactNode {
    return (
      <>
        <ToolAssistanceField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
        <MessageCenterField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
        <SnapModeField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
      </>
    );
  }
}

ConfigurableUiManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);
