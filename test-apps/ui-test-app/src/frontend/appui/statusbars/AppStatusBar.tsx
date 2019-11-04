/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { SampleAppIModelApp, SampleAppUiActionId } from "../../index";

import {
  ConfigurableUiManager, ConfigurableCreateInfo, StatusBarWidgetControl, ActivityCenterField,
  MessageCenterField, SnapModeField, BooleanSyncUiListener, SelectionInfoField,
  StatusBarWidgetControlArgs, SelectionScopeField, ToolAssistanceField, StatusBarSpaceBetween,
  StatusBarLeftSection, StatusBarCenterSection, StatusBarRightSection, ViewAttributesStatusField, SectionsStatusField,
} from "@bentley/ui-framework";

import { DisplayStyleField } from "../statusfields/DisplayStyleField";

import "./AppStatusBar.scss";

export class AppStatusBarWidgetControl extends StatusBarWidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public getReactNode({ isInFooterMode, onOpenWidget, openWidget, toastTargetRef }: StatusBarWidgetControlArgs): React.ReactNode {
    return (
      <StatusBarSpaceBetween>
        <StatusBarLeftSection>
          <ToolAssistanceField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
        </StatusBarLeftSection>
        <StatusBarCenterSection>
          <ActivityCenterField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
          <MessageCenterField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} targetRef={toastTargetRef} />
          <BooleanSyncUiListener eventIds={[SampleAppUiActionId.setTestProperty]} boolFunc={(): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE"}>
            {(isVisible: boolean) => isVisible && <>
              <SnapModeField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
            </>}
          </BooleanSyncUiListener>
          <DisplayStyleField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
          <SectionsStatusField />
          <ViewAttributesStatusField />
        </StatusBarCenterSection>
        <StatusBarRightSection>
          <SelectionScopeField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
          <SelectionInfoField isInFooterMode={isInFooterMode} />
        </StatusBarRightSection>
      </StatusBarSpaceBetween>
    );
  }
}

ConfigurableUiManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);
