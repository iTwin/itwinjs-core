/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { SampleAppIModelApp, SampleAppUiActionId } from "../../index";

import {
  ConfigurableUiManager, ConfigurableCreateInfo, StatusBarWidgetControl, IStatusBar,
  StatusBarFieldId, ActivityCenterField, MessageCenterField, SnapModeField, PromptField,
  BooleanSyncUiListener, SelectionInfoField,
} from "@bentley/ui-framework";
import { FooterSeparator } from "@bentley/ui-ninezone";

import { ToolAssistanceField } from "../statusfields/ToolAssistance";
import { SelectionScopeField } from "../statusfields/SelectionScope";

import "./AppStatusBar.scss";

export class AppStatusBarWidgetControl extends StatusBarWidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public getReactNode(statusBar: IStatusBar, isInFooterMode: boolean, openWidget: StatusBarFieldId): React.ReactNode {

    return (
      <div className="statusbar-space-between">
        <div className="statusbar-left">
          <BooleanSyncUiListener eventIds={[SampleAppUiActionId.setTestProperty]} boolFunc={(): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE"}>
            {(isVisible: boolean) => isVisible && <>
              <PromptField isInFooterMode={isInFooterMode} />
              {isInFooterMode && <FooterSeparator />}
            </>}
          </BooleanSyncUiListener>
        </div>
        <div className="statusbar-center">
          <BooleanSyncUiListener eventIds={[SampleAppUiActionId.setTestProperty]} boolFunc={(): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE"}>
            {(isVisible: boolean) => isVisible && <>
              <ToolAssistanceField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
              {isInFooterMode && <FooterSeparator />}
            </>}
          </BooleanSyncUiListener>
          <ActivityCenterField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
          {isInFooterMode && <FooterSeparator />}
          <MessageCenterField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
          {isInFooterMode && <FooterSeparator />}
          <BooleanSyncUiListener eventIds={[SampleAppUiActionId.setTestProperty]} boolFunc={(): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE"}>
            {(isVisible: boolean) => isVisible && <>
              <SnapModeField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
              {isInFooterMode && <FooterSeparator />}
            </>}
          </BooleanSyncUiListener>
        </div>
        <div className="statusbar-right">
          <SelectionScopeField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
          <SelectionInfoField isInFooterMode={isInFooterMode} />
        </div>
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);
