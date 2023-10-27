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
export function UiSettingsPage(): React.ReactElement;

/**
 * @deprecated in 3.6. Framework version is deprecated, only UI2.0 is supported.
 * @beta
 */
export function UiSettingsPage({ allowSettingUiFrameworkVersion }: { allowSettingUiFrameworkVersion: boolean }): React.ReactElement; // eslint-disable-line @typescript-eslint/unified-signatures

/**
 * @deprecated in 3.6. Framework version is deprecated, only UI2.0 is supported.
 * @beta
 */
export function UiSettingsPage(props?: { allowSettingUiFrameworkVersion: boolean }) {
  const { allowSettingUiFrameworkVersion } = props || {};
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
  const autoCollapseUnpinnedPanelsTitle = React.useRef(UiFramework.translate("settings.uiSettingsPage.autoCollapseUnpinnedPanelsTitle"));
  const autoCollapseUnpinnedPanelsDescription = React.useRef(UiFramework.translate("settings.uiSettingsPage.autoCollapseUnpinnedPanelsDescription"));
  const animateToolSettingsTitle = React.useRef(UiFramework.translate("settings.uiSettingsPage.animateToolSettingsTitle"));
  const animateToolSettingsDescription = React.useRef(UiFramework.translate("settings.uiSettingsPage.animateToolSettingsDescription"));
  const useToolAsToolSettingsLabelTitle = React.useRef(UiFramework.translate("settings.uiSettingsPage.useToolAsToolSettingsLabelTitle"));
  const useToolAsToolSettingsLabelDescription = React.useRef(UiFramework.translate("settings.uiSettingsPage.useToolAsToolSettingsLabelDescription"));
  const toolbarOpacityTitle = React.useRef(UiFramework.translate("settings.uiSettingsPage.toolbarOpacityTitle"));
  const toolbarOpacityDescription = React.useRef(UiFramework.translate("settings.uiSettingsPage.toolbarOpacityDescription"));

  const [theme, setTheme] = React.useState(() => UiFramework.getColorTheme());
  const [uiVersion, setUiVersion] = React.useState(() => UiFramework.uiVersion); // eslint-disable-line deprecation/deprecation
  const [useDragInteraction, setUseDragInteraction] = React.useState(() => UiFramework.useDragInteraction);
  const [showWidgetIcon, setShowWidgetIcon] = React.useState(() => UiFramework.showWidgetIcon);
  const [autoCollapseUnpinnedPanels, setAutoCollapseUnpinnedPanels] = React.useState(() => UiFramework.autoCollapseUnpinnedPanels);
  const [animateToolSettings, setAnimateToolSettings] = React.useState(() => UiFramework.animateToolSettings);
  const [useToolAsToolSettingsLabel, setUseToolAsToolSettingsLabel] = React.useState(() => UiFramework.useToolAsToolSettingsLabel);
  const [widgetOpacity, setWidgetOpacity] = React.useState(() => UiFramework.getWidgetOpacity());
  const [autoHideUi, setAutoHideUi] = React.useState(() => UiFramework.visibility.autoHideUi);
  const [useProximityOpacity, setUseProximityOpacity] = React.useState(() => UiFramework.visibility.useProximityOpacity);
  const [snapWidgetOpacity, setSnapWidgetOpacity] = React.useState(() => UiFramework.visibility.snapWidgetOpacity);
  const [toolbarOpacity, setToolbarOpacity] = React.useState(() => UiFramework.getToolbarOpacity());

  React.useEffect(() => {
    const syncIdsOfInterest = ["configurableui:set_theme", "configurableui:set_widget_opacity", "configurableui:set-show-widget-icon",
      "configurableui:set-drag-interaction", "configurableui:set-framework-version",
      "configurableui:set-auto-collapse-unpinned-panels", "configurableui:set-animate-tool-settings",
      "configurableui:set-use-tool-as-tool-settings-label", "configurableui:set-toolbar-opacity", SyncUiEventId.ShowHideManagerSettingChange];

    const handleSyncUiEvent = (args: UiSyncEventArgs) => {
      // istanbul ignore else
      if (syncIdsOfInterest.some((value: string): boolean => args.eventIds.has(value))) {
        if (UiFramework.getColorTheme() !== theme)
          setTheme(UiFramework.getColorTheme());
        if (UiFramework.visibility.autoHideUi !== autoHideUi)
          setAutoHideUi(UiFramework.visibility.autoHideUi);
        if (UiFramework.uiVersion !== uiVersion) // eslint-disable-line deprecation/deprecation
          setUiVersion(UiFramework.uiVersion); // eslint-disable-line deprecation/deprecation
        if (UiFramework.useDragInteraction !== useDragInteraction)
          setUseDragInteraction(UiFramework.useDragInteraction);
        if (UiFramework.showWidgetIcon !== showWidgetIcon)
          setShowWidgetIcon(UiFramework.showWidgetIcon);
        if (UiFramework.autoCollapseUnpinnedPanels !== autoCollapseUnpinnedPanels)
          setAutoCollapseUnpinnedPanels(UiFramework.autoCollapseUnpinnedPanels);
        if (UiFramework.getWidgetOpacity() !== widgetOpacity)
          setWidgetOpacity(UiFramework.getWidgetOpacity());
        if (UiFramework.visibility.autoHideUi !== autoHideUi)
          setAutoHideUi(UiFramework.visibility.autoHideUi);
        if (UiFramework.visibility.useProximityOpacity !== useProximityOpacity)
          setUseProximityOpacity(UiFramework.visibility.useProximityOpacity);
        if (UiFramework.visibility.snapWidgetOpacity !== snapWidgetOpacity)
          setSnapWidgetOpacity(UiFramework.visibility.snapWidgetOpacity);
        if (UiFramework.animateToolSettings !== animateToolSettings)
          setAnimateToolSettings(UiFramework.animateToolSettings);
        if (UiFramework.useToolAsToolSettingsLabel !== useToolAsToolSettingsLabel)
          setUseToolAsToolSettingsLabel(UiFramework.useToolAsToolSettingsLabel);
        if (UiFramework.getToolbarOpacity() !== toolbarOpacity)
          setToolbarOpacity(UiFramework.getToolbarOpacity());
      }
    };
    return SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);
  }, [autoCollapseUnpinnedPanels, autoHideUi, showWidgetIcon, snapWidgetOpacity, theme, uiVersion,
    useDragInteraction, useProximityOpacity, widgetOpacity, animateToolSettings, useToolAsToolSettingsLabel, toolbarOpacity]);

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
    UiFramework.visibility.autoHideUi = !autoHideUi;
  }, [autoHideUi]);

  const onUseProximityOpacityChange = React.useCallback(async () => {
    UiFramework.visibility.useProximityOpacity = !useProximityOpacity;
  }, [useProximityOpacity]);

  const onSnapWidgetOpacityChange = React.useCallback(async () => {
    UiFramework.visibility.snapWidgetOpacity = !snapWidgetOpacity;
  }, [snapWidgetOpacity]);

  const onWidgetIconChange = React.useCallback(async () => {
    UiFramework.setShowWidgetIcon(!showWidgetIcon);
  }, [showWidgetIcon]);

  const onAutoCollapseUnpinnedPanelsChange = React.useCallback(async () => {
    UiFramework.setAutoCollapseUnpinnedPanels(!autoCollapseUnpinnedPanels);
  }, [autoCollapseUnpinnedPanels]);

  const onWidgetOpacityChange = React.useCallback(async (values: readonly number[]) => {
    // istanbul ignore else
    if (values.length > 0) {
      UiFramework.setWidgetOpacity(values[0]);
    }
  }, []);
  const onToggleFrameworkVersion = React.useCallback(async () => {
    UiFramework.setUiVersion(uiVersion === "2" ? "1" : "2"); // eslint-disable-line deprecation/deprecation
  }, [uiVersion]);

  const onToggleDragInteraction = React.useCallback(async () => {
    UiFramework.setUseDragInteraction(!useDragInteraction);
  }, [useDragInteraction]);

  const OnToggleAnimateToolSettings = React.useCallback(async () => {
    UiFramework.setAnimateToolSettings(!animateToolSettings);
  }, [animateToolSettings]);
  const currentTheme = UiFramework.getColorTheme();

  const OnToggleUseToolAsToolSettingsLabel = React.useCallback(async () => {
    UiFramework.setUseToolAsToolSettingsLabel(!useToolAsToolSettingsLabel);
  }, [useToolAsToolSettingsLabel]);

  const onToolbarOpacityChange = React.useCallback(async (values: readonly number[]) => {
    // istanbul ignore else
    if (values.length > 0) {
      UiFramework.setToolbarOpacity(values[0]);
    }
  }, []);

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
        settingUi={<ToggleSwitch checked={UiFramework.uiVersion === "2"} onChange={onToggleFrameworkVersion} />} // eslint-disable-line deprecation/deprecation
      />}
      {/* eslint-disable-next-line deprecation/deprecation */}
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
        <SettingsItem title={autoCollapseUnpinnedPanelsTitle.current} description={autoCollapseUnpinnedPanelsDescription.current}
          settingUi={<ToggleSwitch checked={autoCollapseUnpinnedPanels} onChange={onAutoCollapseUnpinnedPanelsChange} />}
        />
        <SettingsItem title={animateToolSettingsTitle.current} description={animateToolSettingsDescription.current}
          settingUi={<ToggleSwitch checked={animateToolSettings} onChange={OnToggleAnimateToolSettings} />}
        />
        <SettingsItem title={useToolAsToolSettingsLabelTitle.current} description={useToolAsToolSettingsLabelDescription.current}
          settingUi={<ToggleSwitch checked={useToolAsToolSettingsLabel} onChange={OnToggleUseToolAsToolSettingsLabel} />}
        />
        <SettingsItem title={toolbarOpacityTitle.current} description={toolbarOpacityDescription.current}
          settingUi={
            <Slider style={{ flex: "1" }} values={[toolbarOpacity]} step={0.05} onChange={onToolbarOpacityChange}
              min={0.20} max={1.0} maxLabel="1.0" tickLabels={["", "", "", "", ""]} />
          }
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
export function getUiSettingsManagerEntry(itemPriority: number): SettingsTabEntry;

/**
 * @deprecated in 3.6. Framework version is deprecated, only UI2.0 is supported. Use `getUiSettingsManagerEntry(itemPriority)` instead.
 * @beta
 */
export function getUiSettingsManagerEntry(itemPriority: number, allowSettingUiFrameworkVersion?: boolean): SettingsTabEntry; // eslint-disable-line @typescript-eslint/unified-signatures

/**
 * @deprecated in 3.6. Framework version is deprecated, only UI2.0 is supported.
 * @beta
 */
export function getUiSettingsManagerEntry(itemPriority: number, allowSettingUiFrameworkVersion?: boolean): SettingsTabEntry {
  return {
    itemPriority, tabId: "uifw:UiStateStorage",
    label: UiFramework.translate("settings.uiSettingsPage.label"),
    icon: IconSpecUtilities.createWebComponentIconSpec(widowSettingsIconSvg),
    page: <UiSettingsPage allowSettingUiFrameworkVersion={!!allowSettingUiFrameworkVersion} />, // eslint-disable-line deprecation/deprecation
    isDisabled: false,
    tooltip: UiFramework.translate("settings.uiSettingsPage.tooltip"),
  };
}
