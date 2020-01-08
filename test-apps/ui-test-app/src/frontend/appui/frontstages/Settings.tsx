/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Settings */

import * as React from "react";
import { connect } from "react-redux";
import { Dispatch } from "redux";
import { Toggle } from "@bentley/ui-core";
import { UiFramework, ColorTheme, ModalFrontstageInfo, UiShowHideManager } from "@bentley/ui-framework";
import "./Settings.scss";
import { RootState, SampleAppActions } from "../..";

/** Modal frontstage displaying the active settings.
 * @alpha
 */
export class SettingsModalFrontstage implements ModalFrontstageInfo {
  public title: string = UiFramework.i18n.translate("SampleApp:settingsStage.settings");
  public get content(): React.ReactNode { return (<SettingsPage />); }
}

interface SettingsPageProps {
  dragInteraction: boolean;
  onToggleDragInteraction: () => void;
}

/** SettingsPage displaying the active settings. */
class SettingsPageComponent extends React.Component<SettingsPageProps> {
  private _themeTitle: string = UiFramework.i18n.translate("SampleApp:settingsStage.themeTitle");
  private _themeDescription: string = UiFramework.i18n.translate("SampleApp:settingsStage.themeDescription");
  private _autoHideTitle: string = UiFramework.i18n.translate("SampleApp:settingsStage.autoHideTitle");
  private _autoHideDescription: string = UiFramework.i18n.translate("SampleApp:settingsStage.autoHideDescription");
  private _dragInteractionTitle: string = UiFramework.i18n.translate("SampleApp:settingsStage.dragInteractionTitle");
  private _dragInteractionDescription: string = UiFramework.i18n.translate("SampleApp:settingsStage.dragInteractionDescription");

  private _onThemeChange = () => {
    const theme = this._isLightTheme() ? ColorTheme.Dark : ColorTheme.Light;
    UiFramework.setColorTheme(theme);
  }

  private _isLightTheme(): boolean {
    return (UiFramework.getColorTheme() === ColorTheme.Light);
  }

  private _onAutoHideChange = () => {
    UiShowHideManager.autoHideUi = !UiShowHideManager.autoHideUi;
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
        <div className="uifw-settings-item">
          <div className="panel left-panel">
            <span className="title">{this._autoHideTitle}</span>
            <span className="description">{this._autoHideDescription}</span>
          </div>
          <div className="panel right-panel">
            <Toggle isOn={UiShowHideManager.autoHideUi} showCheckmark={false} onChange={this._onAutoHideChange} />
          </div>
        </div>
        <div className="uifw-settings-item">
          <div className="panel left-panel">
            <span className="title">{this._dragInteractionTitle}</span>
            <span className="description">{this._dragInteractionDescription}</span>
          </div>
          <div className="panel right-panel">
            <Toggle isOn={this.props.dragInteraction} showCheckmark={false} onChange={this.props.onToggleDragInteraction} />
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: RootState) {
  return { dragInteraction: state.sampleAppState.dragInteraction };
}

function mapDispatchToProps(dispatch: Dispatch) {
  return {
    onToggleDragInteraction: () => dispatch(SampleAppActions.toggleDragInteraction()),
    dispatch,
  };
}

// tslint:disable-next-line: variable-name
const SettingsPage = connect(mapStateToProps, mapDispatchToProps)(SettingsPageComponent);
