/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  ConfigurableUiManager,
  ConfigurableCreateInfo,
  WidgetControl,
  IModelConnectedModelsTree,
} from "@bentley/ui-framework";

export class VisibilityTreeWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactNode = <IModelConnectedModelsTree />;
  }
}

ConfigurableUiManager.registerControl("VisibilityTreeWidget", VisibilityTreeWidgetControl);
