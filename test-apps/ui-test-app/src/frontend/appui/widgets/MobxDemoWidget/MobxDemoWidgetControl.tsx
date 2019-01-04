/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { WidgetControl, ConfigurableCreateInfo } from "@bentley/ui-framework";

import { Provider as MobxProvider } from "mobx-react";
import { MobxDemoModel } from "./MobxDemoModel";
import { MobxDemoViewController } from "./MobxDemoViewController";

export class MobxDemoWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const model = new MobxDemoModel();

    this.reactElement = (
      <MobxProvider model={model}>
        <MobxDemoViewController />
      </MobxProvider>
    );
  }
}
