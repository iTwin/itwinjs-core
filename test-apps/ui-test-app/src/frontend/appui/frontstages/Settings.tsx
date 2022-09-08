/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Settings
 */

import "./Settings.scss";
import * as React from "react";
import { FrameworkAccuDraw, UiFramework } from "@itwin/appui-react";
import { TargetOptionsContext } from "@itwin/appui-layout-react/lib/cjs/appui-layout-react/target/TargetOptions";
import { ToggleSwitch } from "@itwin/itwinui-react";
import { SampleAppIModelApp } from "../../index";

/** UiSettingsPage displaying the active settings. */
export class AccudrawSettingsPageComponent extends React.Component {
  private _accuDrawNotificationsTitle: string = UiFramework.localization.getLocalizedString("SampleApp:settingsStage.accuDrawNotificationsTitle");
  private _accuDrawNotificationsDescription: string = UiFramework.localization.getLocalizedString("SampleApp:settingsStage.accuDrawNotificationsDescription");

  private _onAccuDrawNotificationsChange = async () => {
    FrameworkAccuDraw.displayNotifications = !FrameworkAccuDraw.displayNotifications;
  };

  public override render(): React.ReactNode {
    return (
      <div className="uifw-settings">
        <SettingsItem title={this._accuDrawNotificationsTitle} description={this._accuDrawNotificationsDescription}
          settingUi={<ToggleSwitch checked={FrameworkAccuDraw.displayNotifications} onChange={this._onAccuDrawNotificationsChange} />}
        />
      </div>
    );
  }
}

interface SettingsItemProps {
  title: string;
  description: string;
  settingUi: React.ReactNode;
}

function SettingsItem(props: SettingsItemProps) {
  const { title, description, settingUi } = props;

  return (
    <div className="uifw-settings-item">
      <div className="panel left-panel">
        <span className="title">{title}</span>
        <span className="description">{description}</span>
      </div>
      <div className="panel right-panel">
        {settingUi}
      </div>
    </div>
  );
}

export function TargetSettingsPageComponent() {
  const targetOptions = React.useContext(TargetOptionsContext);
  return (
    <div className="uifw-settings">
      <SettingsItem
        title="Use 2.0 targets"
        description="Display widget drop targets when dragging"
        settingUi={<ToggleSwitch checked={targetOptions.version === "2"} onChange={() => {
          SampleAppIModelApp.setTargetVersion(targetOptions.version === "2" ? "1" : "2");
        }} />}
      />
    </div>
  );
}
