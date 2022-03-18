/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Settings
 */

// cSpell:ignore configurableui checkmark

import widowSettingsIconSvg from "@bentley/icons-generic/icons/window-settings.svg";
import "./UiSettingsPage.scss";
import * as React from "react";
import { SettingsTabEntry } from "@itwin/core-react";
import { UiFramework } from "../../UiFramework";
import { ColorTheme, SYSTEM_PREFERRED_COLOR_THEME } from "../../theme/ThemeManager";
import { UiShowHideManager } from "../../utils/UiShowHideManager";
import { SyncUiEventDispatcher, SyncUiEventId } from "../../syncui/SyncUiEventDispatcher";
import { IconSpecUtilities, UiSyncEventArgs } from "@itwin/appui-abstract";
import { Select, SelectOption, Slider, ToggleSwitch } from "@itwin/itwinui-react";

/** UiSettingsPage displaying the active UI settings. This page lets users set the following settings.
 *
 * - theme - Dark, Light, or based on OS preference.
 * - auto hide - Starts a timer and blanks out ui components that overlay content if there is no mouse movement for a period of time.
 * - drag interaction - If set, toolbar group buttons require a press and drag or a long press to open. In this mode a child action
 * item is shown as the group button and is activated when button is clicked. If a different child item is selected, it becomes the
 * active group button item.
 * - use proximity - Changes the opacity of toolbar from transparent to opaque as the mouse moves closer.
 * - snap widget opacity - triggers an abrupt change from transparent to opaque for tool and navigation widgets, instead of a gradual change based on mouse location.
 * - widget opacity - determines how transparent floating widgets in V2 and all widgets in V1 become when the mouse in not in them.
 * - UI version - if allowed by props, the UI version can be toggled between V1 and V2.
 *
 * @beta
 */
export function UiSettingsPage({ allowSettingUiFrameworkVersion }: { allowSettingUiFrameworkVersion: boolean }) {
  const themeTitle = React.useRef(UiFramework.translate("settings.uiSettingsPage.themeTitle"));
  const themeDescription = React.useRef(UiFramework.translate("settings.uiSettingsPage.themeDescription"));
  const autoHideTitle = React.useRef(UiFramework.translate("settings.uiSettingsPage.autoHideTitle"));
  const autoHideDescription = React.useRef(UiFramework.translate("settings.uiSettingsPage.autoHideDescription"));
  const dragInteractionTitle = React.useRef(UiFramework.translate("settings.uiSettingsPage.dragInteractionTitle"));
  const dragInteractionDescription = React.useRef(UiFramework.translate("settings.uiSettingsPage.dragInteractionDescription"));
  const useNewUiTitle = React.useRef(UiFramework.translate("settings.uiSettingsPage.newUiTitle"));
  const useNewUiDescription = React.useRef(UiFramework.translate("settings.uiSettingsPage.newUiDescription"));
  const useProximityOpacityTitle = React.useRef(UiFramework.translate("settings.uiSettingsPage.useProximityOpacityTitle"));
  const useProximityOpacityDescription = React.useRef(UiFramework.translate("settings.uiSettingsPage.useProximityOpacityDescription"));
  const snapWidgetOpacityTitle = React.useRef(UiFramework.translate("settings.uiSettingsPage.snapWidgetOpacityTitle"));
  const snapWidgetOpacityDescription = React.useRef(UiFramework.translate("settings.uiSettingsPage.snapWidgetOpacityDescription"));
  const darkLabel = React.useRef(UiFramework.translate("settings.uiSettingsPage.dark"));
  const lightLabel = React.useRef(UiFramework.translate("settings.uiSettingsPage.light"));
  const systemPreferredLabel = React.useRef(UiFramework.translate("settings.uiSettingsPage.systemPreferred"));
  const widgetOpacityTitle = React.useRef(UiFramework.translate("settings.uiSettingsPage.widgetOpacityTitle"));
  const widgetOpacityDescription = React.useRef(UiFramework.translate("settings.uiSettingsPage.widgetOpacityDescription"));
  const widgetIconTitle = React.useRef(UiFramework.translate("settings.uiSettingsPage.widgetIconTitle"));
  const widgetIconDescription = React.useRef(UiFramework.translate("settings.uiSettingsPage.widgetIconDescription"));

  const [theme, setTheme] = React.useState(() => UiFramework.getColorTheme());
  const [uiVersion, setUiVersion] = React.useState(() => UiFramework.uiVersion);
  const [useDragInteraction, setUseDragInteraction] = React.useState(() => UiFramework.useDragInteraction);
  const [showWidgetIcon, setShowWidgetIcon] = React.useState(() => UiFramework.showWidgetIcon);
  const [widgetOpacity, setWidgetOpacity] = React.useState(() => UiFramework.getWidgetOpacity());
  const [autoHideUi, setAutoHideUi] = React.useState(() => UiShowHideManager.autoHideUi);
  const [useProximityOpacity, setUseProximityOpacity] = React.useState(() => UiShowHideManager.useProximityOpacity);
  const [snapWidgetOpacity, setSnapWidgetOpacity] = React.useState(() => UiShowHideManager.snapWidgetOpacity);

  React.useEffect(() => {
    const syncIdsOfInterest = ["configurableui:set_theme", "configurableui:set_widget_opacity", "configurableui:set-show-widget-icon",
      "configurableui:set-drag-interaction", "configurableui:set-framework-version", SyncUiEventId.ShowHideManagerSettingChange];

    const handleSyncUiEvent = (args: UiSyncEventArgs) => {
      // istanbul ignore else
      if (syncIdsOfInterest.some((value: string): boolean => args.eventIds.has(value))) {
        if (UiFramework.getColorTheme() !== theme)
          setTheme(UiFramework.getColorTheme());
        if (UiShowHideManager.autoHideUi !== autoHideUi)
          setAutoHideUi(UiShowHideManager.autoHideUi);
        if (UiFramework.uiVersion !== uiVersion)
          setUiVersion(UiFramework.uiVersion);
        if (UiFramework.useDragInteraction !== useDragInteraction)
          setUseDragInteraction(UiFramework.useDragInteraction);
        if (UiFramework.showWidgetIcon !== showWidgetIcon)
          setShowWidgetIcon(UiFramework.showWidgetIcon);
        if (UiFramework.getWidgetOpacity() !== widgetOpacity)
          setWidgetOpacity(UiFramework.getWidgetOpacity());
        if (UiShowHideManager.autoHideUi !== autoHideUi)
          setAutoHideUi(UiShowHideManager.autoHideUi);
        if (UiShowHideManager.useProximityOpacity !== useProximityOpacity)
          setUseProximityOpacity(UiShowHideManager.useProximityOpacity);
        if (UiShowHideManager.snapWidgetOpacity !== snapWidgetOpacity)
          setSnapWidgetOpacity(UiShowHideManager.snapWidgetOpacity);
      }
    };
    return SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);
  }, [autoHideUi, showWidgetIcon, snapWidgetOpacity, theme, uiVersion, useDragInteraction, useProximityOpacity, widgetOpacity]);

  const defaultThemeOption = { label: systemPreferredLabel.current, value: SYSTEM_PREFERRED_COLOR_THEME };
  const themeOptions: SelectOption<string>[] = [
    defaultThemeOption,
    { label: lightLabel.current, value: ColorTheme.Light },
    { label: darkLabel.current, value: ColorTheme.Dark },
  ];

  const onThemeChange = React.useCallback((newValue: string) => {
    UiFramework.setColorTheme(newValue);
  }, []);

  const onAutoHideChange = React.useCallback(async () => {
    UiShowHideManager.autoHideUi = !autoHideUi;
  }, [autoHideUi]);

  const onUseProximityOpacityChange = React.useCallback(async () => {
    UiShowHideManager.useProximityOpacity = !useProximityOpacity;
  }, [useProximityOpacity]);

  const onSnapWidgetOpacityChange = React.useCallback(async () => {
    UiShowHideManager.snapWidgetOpacity = !snapWidgetOpacity;
  }, [snapWidgetOpacity]);

  const onWidgetIconChange = React.useCallback(async () => {
    UiFramework.setShowWidgetIcon(!showWidgetIcon);
  }, [showWidgetIcon]);

  const onWidgetOpacityChange = React.useCallback(async (values: readonly number[]) => {
    // istanbul ignore else
    if (values.length > 0) {
      UiFramework.setWidgetOpacity(values[0]);
    }
  }, []);
  const onToggleFrameworkVersion = React.useCallback(async () => {
    UiFramework.setUiVersion(uiVersion === "2" ? "1" : "2");
  }, [uiVersion]);

  const onToggleDragInteraction = React.useCallback(async () => {
    UiFramework.setUseDragInteraction(!useDragInteraction);
  }, [useDragInteraction]);

  const currentTheme = UiFramework.getColorTheme();

  return (
    <div className="uifw-settings">
      <SettingsItem title={themeTitle.current} description={themeDescription.current}
        settingUi={
          <div data-testid="select-theme-container" className="select-theme-container">
            <Select
              value={currentTheme}
              onChange={onThemeChange}
              options={themeOptions}
              data-testid="select-theme"
              size="small"
            />
          </div>
        }
      />
      <SettingsItem title={autoHideTitle.current} description={autoHideDescription.current}
        settingUi={<ToggleSwitch checked={autoHideUi} onChange={onAutoHideChange} />}
      />
      {allowSettingUiFrameworkVersion && <SettingsItem title={useNewUiTitle.current} description={useNewUiDescription.current}
        settingUi={<ToggleSwitch checked={UiFramework.uiVersion === "2"} onChange={onToggleFrameworkVersion} />}
      />}
      {UiFramework.uiVersion === "2" && <>
        <SettingsItem title={dragInteractionTitle.current} description={dragInteractionDescription.current}
          settingUi={<ToggleSwitch checked={useDragInteraction} onChange={onToggleDragInteraction} />}
        />
        <SettingsItem title={useProximityOpacityTitle.current} description={useProximityOpacityDescription.current}
          settingUi={<ToggleSwitch checked={useProximityOpacity} onChange={onUseProximityOpacityChange} />}
        />
        <SettingsItem title={snapWidgetOpacityTitle.current} description={snapWidgetOpacityDescription.current}
          settingUi={<ToggleSwitch checked={snapWidgetOpacity} onChange={onSnapWidgetOpacityChange} />}
        />
        <SettingsItem title={widgetIconTitle.current} description={widgetIconDescription.current}
          settingUi={<ToggleSwitch checked={showWidgetIcon} onChange={onWidgetIconChange} />}
        />
      </>
      }
      <SettingsItem title={widgetOpacityTitle.current} description={widgetOpacityDescription.current}
        settingUi={
          <Slider style={{ flex: "1" }} values={[widgetOpacity]} step={0.05} onChange={onWidgetOpacityChange}
            min={0.20} max={1.0} maxLabel="1.0" tickLabels={["", "", "", "", ""]} />
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

/**
 * Return a SettingsTabEntry that can be used to define the available settings that can be set for an application.
 * @param itemPriority - Used to define the order of the entry in the Settings Stage
 * @beta
 */
export function getUiSettingsManagerEntry(itemPriority: number, allowSettingUiFrameworkVersion?: boolean): SettingsTabEntry {
  return {
    itemPriority, tabId: "uifw:UiStateStorage",
    label: UiFramework.translate("settings.uiSettingsPage.label"),
    icon: IconSpecUtilities.createWebComponentIconSpec(widowSettingsIconSvg),
    page: <UiSettingsPage allowSettingUiFrameworkVersion={!!allowSettingUiFrameworkVersion} />,
    isDisabled: false,
    tooltip: UiFramework.translate("settings.uiSettingsPage.tooltip"),
  };
}
