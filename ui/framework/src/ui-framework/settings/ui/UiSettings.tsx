/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Settings
 */

import "./Settings.scss";
import * as React from "react";
import { OptionType, Slider, ThemedSelect, Toggle } from "@bentley/ui-core";
import { UiFramework } from "../../UiFramework";
import { ColorTheme, SYSTEM_PREFERRED_COLOR_THEME } from "../../theme/ThemeManager";
import { UiShowHideManager } from "../../utils/UiShowHideManager";

function isOptionType(value: OptionType | ReadonlyArray<OptionType>): value is OptionType {
  if (Array.isArray(value))
    return false;
  return true;
}

/** UiSettingsPage displaying the active settings. */
export function UiSettingsPageComponent() {
  const themeTitle = React.useRef(UiFramework.translate("uiSettingsPage.themeTitle"));
  const themeDescription = React.useRef(UiFramework.translate("uiSettingsPage.themeDescription"));
  const autoHideTitle = React.useRef(UiFramework.translate("uiSettingsPage.autoHideTitle"));
  const autoHideDescription = React.useRef(UiFramework.translate("uiSettingsPage.autoHideDescription"));
  const dragInteractionTitle = React.useRef(UiFramework.translate("uiSettingsPage.dragInteractionTitle"));
  const dragInteractionDescription = React.useRef(UiFramework.translate("uiSettingsPage.dragInteractionDescription"));
  const useNewUiTitle = React.useRef(UiFramework.translate("uiSettingsPage.newUiTitle"));
  const useNewUiDescription = React.useRef(UiFramework.translate("uiSettingsPage.newUiDescription"));
  const useProximityOpacityTitle = React.useRef(UiFramework.translate("uiSettingsPage.useProximityOpacityTitle"));
  const useProximityOpacityDescription = React.useRef(UiFramework.translate("uiSettingsPage.useProximityOpacityDescription"));
  const snapWidgetOpacityTitle = React.useRef(UiFramework.translate("uiSettingsPage.snapWidgetOpacityTitle"));
  const snapWidgetOpacityDescription = React.useRef(UiFramework.translate("uiSettingsPage.snapWidgetOpacityDescription"));
  const darkLabel = React.useRef(UiFramework.translate("uiSettingsPage.dark"));
  const lightLabel = React.useRef(UiFramework.translate("uiSettingsPage.light"));
  const systemPreferredLabel = React.useRef(UiFramework.translate("uiSettingsPage.systemPreferred"));
  const widgetOpacityTitle = React.useRef(UiFramework.translate("uiSettingsPage.widgetOpacityTitle"));
  const widgetOpacityDescription = React.useRef(UiFramework.translate("uiSettingsPage.widgetOpacityDescription"));

  const defaultThemeOption = { label: systemPreferredLabel.current, value: SYSTEM_PREFERRED_COLOR_THEME };
  const themeOptions: Array<OptionType> = [
    defaultThemeOption,
    { label: lightLabel.current, value: ColorTheme.Light },
    { label: darkLabel.current, value: ColorTheme.Dark },
  ];

  const getDefaultThemeOption = () => {
    const theme = UiFramework.getColorTheme();
    for (const option of themeOptions) {
      if (option.value === theme)
        return option;
    }
    return defaultThemeOption;
  };

  const onThemeChange = React.useCallback(async (value) => {
    if (!value)
      return;
    if (!isOptionType(value))
      return;

    UiFramework.setColorTheme(value.value);

    // await SampleAppIModelApp.appUiSettings.colorTheme.saveSetting(SampleAppIModelApp.uiSettings);
  },[]);

  const onAutoHideChange = React.useCallback(async () => {
    UiShowHideManager.autoHideUi = !UiShowHideManager.autoHideUi;
    // await SampleAppIModelApp.appUiSettings.autoHideUi.saveSetting(SampleAppIModelApp.uiSettings);
  },[]);

  const onUseProximityOpacityChange = React.useCallback(async () => {
    UiShowHideManager.useProximityOpacity = !UiShowHideManager.useProximityOpacity;
    // await SampleAppIModelApp.appUiSettings.useProximityOpacity.saveSetting(SampleAppIModelApp.uiSettings);
  },[]);

  const onSnapWidgetOpacityChange = React.useCallback(async () => {
    UiShowHideManager.snapWidgetOpacity = !UiShowHideManager.snapWidgetOpacity;
    // await SampleAppIModelApp.appUiSettings.snapWidgetOpacity.saveSetting(SampleAppIModelApp.uiSettings);
  },[]);

  const onWidgetOpacityChange = React.useCallback(async (values: readonly number[]) => {
    if (values.length > 0) {
      UiFramework.setWidgetOpacity(values[0]);
      // await SampleAppIModelApp.appUiSettings.widgetOpacity.saveSetting(SampleAppIModelApp.uiSettings);
    }
  },[]);
  const onToggleFrameworkVersion =  React.useCallback(async () => {
    UiFramework.setUiVersion(UiFramework.uiVersion === "2"? "1" : "2");
    // await SampleAppIModelApp.appUiSettings.widgetOpacity.saveSetting(SampleAppIModelApp.uiSettings);
  },[]);

  const onToggleDragInteraction =  React.useCallback(async () => {
    UiFramework.setUseDragInteraction(!UiFramework.useDragInteraction);
    // await SampleAppIModelApp.appUiSettings.widgetOpacity.saveSetting(SampleAppIModelApp.uiSettings);
  },[]);

  return (
    <div className="uifw-settings">
      <SettingsItem title={themeTitle.current} description={themeDescription.current}
        settingUi={
          <div className="select-container">
            <ThemedSelect
              defaultValue={getDefaultThemeOption()}
              isSearchable={false}
              onChange={onThemeChange}
              options={themeOptions}
            />
          </div>
        }
      />
      <SettingsItem title={autoHideTitle.current} description={autoHideDescription.current}
        settingUi={ <Toggle isOn={UiShowHideManager.autoHideUi} showCheckmark={false} onChange={onAutoHideChange} /> }
      />
      <SettingsItem title={useNewUiTitle.current} description={useNewUiDescription.current}
        settingUi={ <Toggle isOn={UiFramework.uiVersion === "2"} showCheckmark={false} onChange={onToggleFrameworkVersion} /> }
      />
      {UiFramework.uiVersion === "2" && <>
        <SettingsItem title={dragInteractionTitle.current} description={dragInteractionDescription.current}
          settingUi={ <Toggle isOn={UiFramework.useDragInteraction} showCheckmark={false} onChange={onToggleDragInteraction} /> }
        />
        <SettingsItem title={useProximityOpacityTitle.current} description={useProximityOpacityDescription.current}
          settingUi={ <Toggle isOn={UiShowHideManager.useProximityOpacity} showCheckmark={false} onChange={onUseProximityOpacityChange} /> }
        />
        <SettingsItem title={snapWidgetOpacityTitle.current} description={snapWidgetOpacityDescription.current}
          settingUi={ <Toggle isOn={UiShowHideManager.snapWidgetOpacity} showCheckmark={false} onChange={onSnapWidgetOpacityChange} /> }
        />
      </>
      }
      <SettingsItem title={widgetOpacityTitle.current} description={widgetOpacityDescription.current}
        settingUi={
          <Slider  values={[UiFramework.getWidgetOpacity()]} step={0.05} showTooltip onChange={onWidgetOpacityChange}
            min={0} max={1.0} showMinMax formatMax={(v: number) => v.toFixed(1)}
            showTicks getTickValues={() => [0,.25,.50,.75,1]} />
        }
      />
    </div>
  );
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
