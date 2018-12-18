/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { SampleAppIModelApp, SampleAppUiActionId } from "../../index";

import {
  ConfigurableUiManager, ConfigurableCreateInfo, StatusBarWidgetControl, IStatusBar,
  StatusBarFieldId, ActivityCenterField, MessageCenterField, SnapModeField, PromptField,
  BooleanSyncUiListener,
} from "@bentley/ui-framework";

import { ToolAssistanceField } from "../statusfields/ToolAssistance";

export class AppStatusBarWidgetControl extends StatusBarWidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public getReactNode(statusBar: IStatusBar, isInFooterMode: boolean, openWidget: StatusBarFieldId): React.ReactNode {

    return (
      <>
        <BooleanSyncUiListener eventIds={[SampleAppUiActionId.setTestProperty]} boolFunc={(): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE"}>
          {(isVisible: boolean) => isVisible && <PromptField isInFooterMode={isInFooterMode} />}
        </BooleanSyncUiListener>
        <BooleanSyncUiListener eventIds={[SampleAppUiActionId.setTestProperty]} boolFunc={(): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE"}>
          {(isVisible: boolean) => isVisible && <ToolAssistanceField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />}
        </BooleanSyncUiListener>
        <ActivityCenterField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
        <MessageCenterField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
        <BooleanSyncUiListener eventIds={[SampleAppUiActionId.setTestProperty]} boolFunc={(): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE"}>
          {(isVisible: boolean) => isVisible && <SnapModeField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />}
        </BooleanSyncUiListener>
      </>
    );
  }
}

ConfigurableUiManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);
