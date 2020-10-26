/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { DockedToolSettings, ToolSettingsStateContext } from "@bentley/ui-ninezone";
import { ToolSetting, ToolSettingProps } from "./ToolSetting";

export interface ToolSettingsProps {
  readonly settings: ReadonlyArray<ToolSettingProps>;
}

function PanelContainer(props: { children?: React.ReactNode }) {
  return <div className="nzdemo-panel-container">{props.children}</div>;
}

export default function ToolSettings(props: ToolSettingsProps) {
  const toolSettingsState = React.useContext(ToolSettingsStateContext);
  if (toolSettingsState.type !== "docked")
    return null;
  return (
    <DockedToolSettings
      panelContainer={PanelContainer}
    >
      <ToolSettingWrapper>
        <ToolSetting
          id="Custom"
          type="checkbox"
        />
      </ToolSettingWrapper>
      {props.settings.map((setting) => {
        return (
          <ToolSettingWrapper
            key={setting.id}
          >
            <ToolSetting
              {...setting}
            />
          </ToolSettingWrapper>
        );
      })}
    </DockedToolSettings>
  );
}

function ToolSettingWrapper(props: { children?: React.ReactNode }) {
  return <>{props.children}</>;
}
