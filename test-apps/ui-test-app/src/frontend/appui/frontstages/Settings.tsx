/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Settings */

import * as React from "react";
import { Toggle } from "@bentley/ui-core";
import { UiFramework, ColorTheme, ModalFrontstageInfo } from "@bentley/ui-framework";
import "./Settings.scss";

/** Modal frontstage displaying the active settings.
 * @alpha
 */
export class SettingsModalFrontstage implements ModalFrontstageInfo {
  public title: string = UiFramework.i18n.translate("SampleApp:settingsStage.settings");
  public get content(): React.ReactNode { return (<SettingsPage />); }
}

/** SettingsPage displaying the active settings. */
class SettingsPage extends React.Component {
  private _themeTitle: string = UiFramework.i18n.translate("SampleApp:settingsStage.themeTitle");
  private _themeDescription: string = UiFramework.i18n.translate("SampleApp:settingsStage.themeDescription");

  private _onThemeChange = () => {
    const theme = this._isLightTheme() ? ColorTheme.Dark : ColorTheme.Light;
    UiFramework.setColorTheme(theme);
  }

  private _isLightTheme(): boolean {
    return (UiFramework.getColorTheme() === ColorTheme.Light);
  }

  public render(): React.ReactNode {
    const isLightTheme = this._isLightTheme();
    const _theme: string = UiFramework.i18n.translate((isLightTheme) ? "SampleApp:settingsStage.light" : "SampleApp:settingsStage.dark");
    return (
      <div className="uifw-settings">
        <div className="uifw-settings-item">
          <div className="panel left-panel">
            <span className="title">{this._themeTitle}</span>
            <span className="description">{this._themeDescription}</span>
          </div>
          <div className="panel right-panel">
            <Toggle isOn={isLightTheme} showCheckmark={false} onChange={this._onThemeChange} />
            {_theme}
          </div>
        </div>
      </div>
    );
  }
}
