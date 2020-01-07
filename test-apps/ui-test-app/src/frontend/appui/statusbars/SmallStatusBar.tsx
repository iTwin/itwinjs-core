/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  ConfigurableUiManager, ConfigurableCreateInfo, UiFramework,
  StatusBarWidgetControl, StatusBarWidgetControlArgs, StatusBarComposer,
} from "@bentley/ui-framework";

export class SmallStatusBarWidgetControl extends StatusBarWidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public getReactNode(_args: StatusBarWidgetControlArgs): React.ReactNode {
    const itemsManager = UiFramework.statusBarManager.getItemsManager("small");
    if (itemsManager)
      return (
        <StatusBarComposer itemsManager={itemsManager} />
      );
    return null;
  }
}

ConfigurableUiManager.registerControl("SmallStatusBar", SmallStatusBarWidgetControl);
