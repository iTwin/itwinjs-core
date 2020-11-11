/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Settings
 */

import "./Settings.scss";
import * as React from "react";
import { connect } from "react-redux";
import { Dispatch } from "redux";
import { OptionType, ThemedSelect, ThemedSelectProps, Toggle } from "@bentley/ui-core";
import { ColorTheme, ModalFrontstageInfo, SyncUiEventDispatcher, SYSTEM_PREFERRED_COLOR_THEME, UiFramework, UiShowHideManager } from "@bentley/ui-framework";
import { RootState, SampleAppActions, SampleAppIModelApp, SampleAppUiActionId } from "../..";

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
  frameworkVersion: string;
  onToggleFrameworkVersion: () => void;
}

function isOptionType(value: OptionType | ReadonlyArray<OptionType>): value is OptionType {
  if (Array.isArray(value))
    return false;
  return true;
}

/** SettingsPage displaying the active settings. */
class SettingsPageComponent extends React.Component<SettingsPageProps> {
  private _themeTitle: string = UiFramework.i18n.translate("SampleApp:settingsStage.themeTitle");
  private _themeDescription: string = UiFramework.i18n.translate("SampleApp:settingsStage.themeDescription");
  private _autoHideTitle: string = UiFramework.i18n.translate("SampleApp:settingsStage.autoHideTitle");
  private _autoHideDescription: string = UiFramework.i18n.translate("SampleApp:settingsStage.autoHideDescription");
  private _dragInteractionTitle: string = UiFramework.i18n.translate("SampleApp:settingsStage.dragInteractionTitle");
  private _dragInteractionDescription: string = UiFramework.i18n.translate("SampleApp:settingsStage.dragInteractionDescription");
  private _useNewUiTitle: string = UiFramework.i18n.translate("SampleApp:settingsStage.newUiTitle");
  private _useNewUiDescription: string = UiFramework.i18n.translate("SampleApp:settingsStage.newUiDescription");
  private _useProximityOpacityTitle: string = UiFramework.i18n.translate("SampleApp:settingsStage.useProximityOpacityTitle");
  private _useProximityOpacityDescription: string = UiFramework.i18n.translate("SampleApp:settingsStage.useProximityOpacityDescription");
  private _snapWidgetOpacityTitle: string = UiFramework.i18n.translate("SampleApp:settingsStage.snapWidgetOpacityTitle");
  private _snapWidgetOpacityDescription: string = UiFramework.i18n.translate("SampleApp:settingsStage.snapWidgetOpacityDescription");
  private _darkLabel = UiFramework.i18n.translate("SampleApp:settingsStage.dark");
  private _lightLabel = UiFramework.i18n.translate("SampleApp:settingsStage.light");
  private _systemPreferredLabel = UiFramework.i18n.translate("SampleApp:settingsStage.systemPreferred");

  private _defaultThemeOption = { label: this._systemPreferredLabel, value: SYSTEM_PREFERRED_COLOR_THEME };
  private _themeOptions: Array<OptionType> = [
    this._defaultThemeOption,
    { label: this._lightLabel, value: ColorTheme.Light },
    { label: this._darkLabel, value: ColorTheme.Dark },
  ];

  private _getDefaultThemeOption() {
    const theme = UiFramework.getColorTheme();
    for (const option of this._themeOptions) {
      if (option.value === theme)
        return option;
    }
    return this._defaultThemeOption;
  }

  private _onThemeChange: ThemedSelectProps["onChange"] = async (value) => {
    if (!value)
      return;
    if (!isOptionType(value))
      return;

    UiFramework.setColorTheme(value.value);

    await SampleAppIModelApp.appUiSettings.colorTheme.saveSetting(SampleAppIModelApp.uiSettings);
  };

  private _onAutoHideChange = async () => {
    UiShowHideManager.autoHideUi = !UiShowHideManager.autoHideUi;

    await SampleAppIModelApp.appUiSettings.autoHideUi.saveSetting(SampleAppIModelApp.uiSettings);
  };

  private _onUseProximityOpacityChange = async () => {
    UiShowHideManager.useProximityOpacity = !UiShowHideManager.useProximityOpacity;

    await SampleAppIModelApp.appUiSettings.useProximityOpacity.saveSetting(SampleAppIModelApp.uiSettings);
  };

  private _onSnapWidgetOpacityChange = async () => {
    UiShowHideManager.snapWidgetOpacity = !UiShowHideManager.snapWidgetOpacity;

    await SampleAppIModelApp.appUiSettings.snapWidgetOpacity.saveSetting(SampleAppIModelApp.uiSettings);
  };

  public render(): React.ReactNode {
    return (
      <div className="uifw-settings">
        <div className="uifw-settings-item">
          <div className="panel left-panel">
            <span className="title">{this._themeTitle}</span>
            <span className="description">{this._themeDescription}</span>
          </div>
          <div className="panel right-panel">
            <div className="select-container">
              <ThemedSelect
                defaultValue={this._getDefaultThemeOption()}
                isSearchable={false}
                onChange={this._onThemeChange}
                options={this._themeOptions}
              />
            </div>
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
        <div className="uifw-settings-item">
          <div className="panel left-panel">
            <span className="title">{this._useNewUiTitle}</span>
            <span className="description">{this._useNewUiDescription}</span>
          </div>
          <div className="panel right-panel">
            <Toggle isOn={this.props.frameworkVersion === "2"} showCheckmark={false} onChange={this.props.onToggleFrameworkVersion} />
          </div>
        </div>
        <div className="uifw-settings-item">
          <div className="panel left-panel">
            <span className="title">{this._useProximityOpacityTitle}</span>
            <span className="description">{this._useProximityOpacityDescription}</span>
          </div>
          <div className="panel right-panel">
            <Toggle isOn={UiShowHideManager.useProximityOpacity} showCheckmark={false} onChange={this._onUseProximityOpacityChange} />
          </div>
        </div>
        <div className="uifw-settings-item">
          <div className="panel left-panel">
            <span className="title">{this._snapWidgetOpacityTitle}</span>
            <span className="description">{this._snapWidgetOpacityDescription}</span>
          </div>
          <div className="panel right-panel">
            <Toggle isOn={UiShowHideManager.snapWidgetOpacity} showCheckmark={false} onChange={this._onSnapWidgetOpacityChange} />
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: RootState) {
  return { dragInteraction: state.sampleAppState.dragInteraction, frameworkVersion: state.sampleAppState.frameworkVersion };
}

function mapDispatchToProps(dispatch: Dispatch) {
  return {
    onToggleDragInteraction: async () => {
      dispatch(SampleAppActions.toggleDragInteraction());
      await SampleAppIModelApp.appUiSettings.dragInteraction.saveSetting(SampleAppIModelApp.uiSettings);
    },
    onToggleFrameworkVersion: async () => {
      dispatch(SampleAppActions.toggleFrameworkVersion());
      SyncUiEventDispatcher.dispatchSyncUiEvent(SampleAppUiActionId.toggleFrameworkVersion);
      await SampleAppIModelApp.appUiSettings.frameworkVersion.saveSetting(SampleAppIModelApp.uiSettings);
    },
    dispatch,
  };
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const SettingsPage = connect(mapStateToProps, mapDispatchToProps)(SettingsPageComponent);
