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
import { OptionType, Slider, ThemedSelect, ThemedSelectProps, Toggle } from "@bentley/ui-core";
import { ColorTheme, FrameworkAccuDraw, SyncUiEventDispatcher, SYSTEM_PREFERRED_COLOR_THEME, UiFramework, UiShowHideManager } from "@bentley/ui-framework";
import { RootState, SampleAppActions, SampleAppIModelApp, SampleAppUiActionId } from "../..";
interface UiSettingsPageProps {
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

/** UiSettingsPage displaying the active settings. */
class UiSettingsPageComponent extends React.Component<UiSettingsPageProps> {
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
  private _accuDrawNotificationsTitle: string = UiFramework.i18n.translate("SampleApp:settingsStage.accuDrawNotificationsTitle");
  private _accuDrawNotificationsDescription: string = UiFramework.i18n.translate("SampleApp:settingsStage.accuDrawNotificationsDescription");
  private _widgetOpacityTitle: string = UiFramework.i18n.translate("SampleApp:settingsStage.widgetOpacityTitle");
  private _widgetOpacityDescription: string = UiFramework.i18n.translate("SampleApp:settingsStage.widgetOpacityDescription");

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

  private _onAccuDrawNotificationsChange = async () => {
    FrameworkAccuDraw.displayNotifications = !FrameworkAccuDraw.displayNotifications;

    await SampleAppIModelApp.appUiSettings.accuDrawNotifications.saveSetting(SampleAppIModelApp.uiSettings);
  };

  private _onWidgetOpacityChange = async (values: readonly number[]) => {
    if (values.length > 0) {
      UiFramework.setWidgetOpacity(values[0]);
      await SampleAppIModelApp.appUiSettings.widgetOpacity.saveSetting(SampleAppIModelApp.uiSettings);
    }
  };

  public render(): React.ReactNode {
    return (
      <div className="uifw-settings">
        <SettingsItem title={this._themeTitle} description={this._themeDescription}
          settingUi={
            <div className="select-container">
              <ThemedSelect
                defaultValue={this._getDefaultThemeOption()}
                isSearchable={false}
                onChange={this._onThemeChange}
                options={this._themeOptions}
              />
            </div>
          }
        />
        <SettingsItem title={this._autoHideTitle} description={this._autoHideDescription}
          settingUi={ <Toggle isOn={UiShowHideManager.autoHideUi} showCheckmark={false} onChange={this._onAutoHideChange} /> }
        />
        <SettingsItem title={this._dragInteractionTitle} description={this._dragInteractionDescription}
          settingUi={ <Toggle isOn={this.props.dragInteraction} showCheckmark={false} onChange={this.props.onToggleDragInteraction} /> }
        />
        <SettingsItem title={this._useNewUiTitle} description={this._useNewUiDescription}
          settingUi={ <Toggle isOn={this.props.frameworkVersion === "2"} showCheckmark={false} onChange={this.props.onToggleFrameworkVersion} /> }
        />
        <SettingsItem title={this._useProximityOpacityTitle} description={this._useProximityOpacityDescription}
          settingUi={ <Toggle isOn={UiShowHideManager.useProximityOpacity} showCheckmark={false} onChange={this._onUseProximityOpacityChange} /> }
        />
        <SettingsItem title={this._snapWidgetOpacityTitle} description={this._snapWidgetOpacityDescription}
          settingUi={ <Toggle isOn={UiShowHideManager.snapWidgetOpacity} showCheckmark={false} onChange={this._onSnapWidgetOpacityChange} /> }
        />
        <SettingsItem title={this._accuDrawNotificationsTitle} description={this._accuDrawNotificationsDescription}
          settingUi={ <Toggle isOn={FrameworkAccuDraw.displayNotifications} showCheckmark={false} onChange={this._onAccuDrawNotificationsChange} /> }
        />
        <SettingsItem title={this._widgetOpacityTitle} description={this._widgetOpacityDescription}
          settingUi={
            <Slider  values={[UiFramework.getWidgetOpacity()]} step={0.01} showTooltip onChange={this._onWidgetOpacityChange}
              min={0} max={1.0} showMinMax formatMax={(v: number) => v.toFixed(1)}
              showTicks showTickLabels getTickCount={() => 10} formatTick={(v: number) => v.toFixed(1)}  />
          }
        />
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
export const ConnectedUiSettingsPage = connect(mapStateToProps, mapDispatchToProps)(UiSettingsPageComponent);

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
