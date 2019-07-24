/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { SampleAppIModelApp, SampleAppUiActionId } from "../../index";

import {
  ConfigurableUiManager, ConfigurableCreateInfo, StatusBarWidgetControl, ActivityCenterField,
  MessageCenterField, SnapModeField, BooleanSyncUiListener, SelectionInfoField,
  StatusBarWidgetControlArgs, SelectionScopeField, SyncUiEventId, ContentViewManager, ToolAssistanceField,
} from "@bentley/ui-framework";
import { FooterSeparator } from "@bentley/ui-ninezone";

import { ShadowField } from "../statusfields/ShadowField";

import "./AppStatusBar.scss";

export class AppStatusBarWidgetControl extends StatusBarWidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public getReactNode({ isInFooterMode, onOpenWidget, openWidget, toastTargetRef }: StatusBarWidgetControlArgs): React.ReactNode {
    return (
      <div className="statusbar-space-between">
        <div className="statusbar-left">
          <ToolAssistanceField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
        </div>
        <div className="statusbar-center">
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
        </div>
        <div className="statusbar-right">
          <BooleanSyncUiListener defaultValue={false} eventIds={[SyncUiEventId.ActiveContentChanged]} boolFunc={(): boolean => ContentViewManager.isContent3dView(ContentViewManager.getActiveContentControl())}>
            {(isVisible: boolean) => isVisible && <>
              <ShadowField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
              {isInFooterMode && <FooterSeparator />}
            </>}
          </BooleanSyncUiListener>
          <SelectionScopeField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
          <SelectionInfoField isInFooterMode={isInFooterMode} />
        </div>
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);
