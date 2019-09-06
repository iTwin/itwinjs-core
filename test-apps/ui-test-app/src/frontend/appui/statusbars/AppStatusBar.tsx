/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { SampleAppIModelApp, SampleAppUiActionId } from "../../index";

import {
  ConfigurableUiManager, ConfigurableCreateInfo, StatusBarWidgetControl, ActivityCenterField,
  MessageCenterField, SnapModeField, BooleanSyncUiListener, SelectionInfoField,
  StatusBarWidgetControlArgs, SelectionScopeField, SyncUiEventId, ContentViewManager, ToolAssistanceField, StatusBarSpaceBetween, StatusBarLeftSection, StatusBarCenterSection, StatusBarRightSection,
} from "@bentley/ui-framework";
import { FooterSeparator } from "@bentley/ui-ninezone";

import { ShadowField } from "../statusfields/ShadowField";
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
          {isInFooterMode && <FooterSeparator />}
        </StatusBarLeftSection>
        <StatusBarCenterSection>
          <ActivityCenterField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
          {isInFooterMode && <FooterSeparator />}
          <MessageCenterField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} targetRef={toastTargetRef} />
          {isInFooterMode && <FooterSeparator />}
          <BooleanSyncUiListener eventIds={[SampleAppUiActionId.setTestProperty]} boolFunc={(): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE"}>
            {(isVisible: boolean) => isVisible && <>
              <SnapModeField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
              {isInFooterMode && <FooterSeparator />}
            </>}
          </BooleanSyncUiListener>
          <DisplayStyleField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
        </StatusBarCenterSection>
        <StatusBarRightSection>
          {isInFooterMode && <FooterSeparator />}
          <BooleanSyncUiListener defaultValue={false} eventIds={[SyncUiEventId.ActiveContentChanged]} boolFunc={(): boolean => ContentViewManager.isContent3dView(ContentViewManager.getActiveContentControl())}>
            {(isVisible: boolean) => isVisible && <>
              <ShadowField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
              {isInFooterMode && <FooterSeparator />}
            </>}
          </BooleanSyncUiListener>
          <SelectionScopeField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
          <SelectionInfoField isInFooterMode={isInFooterMode} />
        </StatusBarRightSection>
      </StatusBarSpaceBetween>
    );
  }
}

ConfigurableUiManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);
