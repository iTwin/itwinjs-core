/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Settings */

import * as React from "react";
import { connect } from "react-redux";
import { ModalFrontstageInfo } from "../frontstage/FrontstageManager";
import { UiFramework } from "../UiFramework";
import { Toggle } from "@bentley/ui-core";
import { OverallContentActions } from "../overallcontent/state";
import "./Settings.scss";

/** Modal frontstage displaying the active settings. */
export class SettingsModalFrontstage implements ModalFrontstageInfo {
  public title: string = UiFramework.i18n.translate("UiFramework:settingsStage.settings");
  public get content(): React.ReactNode { return (<SettingsPage />); }
}

interface SettingsPageProps {
  theme: string;
  setTheme: (theme: string) => any;
}

function mapStateToProps(state: any) {
  const frameworkState = state[UiFramework.frameworkStateKey];  // since app sets up key, don't hard-code name
  if (!frameworkState)
    return undefined;

  return { theme: frameworkState.overallContentState.theme };
}

const mapDispatch = {
  setTheme: OverallContentActions.setTheme,
};

/** SettingsPageComponent displaying the active settings. */
class SettingsPageComponent extends React.Component<SettingsPageProps> {
  private _themeTitle: string = UiFramework.i18n.translate("UiFramework:settingsStage.themeTitle");
  private _themeDescription: string = UiFramework.i18n.translate("UiFramework:settingsStage.themeDescription");

  private _onThemeChange = () => {
    const theme = this._isLightTheme() ? "dark" : "light";
    this.props.setTheme(theme);
  }

  private _isLightTheme(): boolean {
    return (this.props.theme === "light");
  }

  public render(): React.ReactNode {
    const isLightTheme = this._isLightTheme();
    const _theme: string = UiFramework.i18n.translate((isLightTheme) ? "UiFramework:settingsStage.light" : "UiFramework:settingsStage.dark");
    return (
      <div className="settings">
        <div className="settings-item">
          <div className="panel left-panel">
            <span className="title">{this._themeTitle}</span>
            <span className="description">{this._themeDescription}</span>
          </div>
          <div className="panel right-panel">
            <Toggle isOn={isLightTheme} showCheckmark={false} onChange={this._onThemeChange.bind(this)} />
            {_theme}
          </div>
        </div>
      </div>
    );
  }
}

/** SettingsPage React component that is Redux connected. */
export const SettingsPage = connect(mapStateToProps, mapDispatch)(SettingsPageComponent); // tslint:disable-line:variable-name
