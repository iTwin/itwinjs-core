/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  ConfigurableUiManager,
  ConfigurableCreateInfo,
  WidgetControl,
  IModelConnectedVisibilityTree,
} from "@bentley/ui-framework";

export class VisibilityTreeWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactElement = <IModelConnectedVisibilityTree />;
  }
}

ConfigurableUiManager.registerControl("VisibilityTreeWidget", VisibilityTreeWidgetControl);
