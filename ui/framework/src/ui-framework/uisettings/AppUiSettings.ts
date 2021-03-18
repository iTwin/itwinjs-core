/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Settings
 */

import { UiSetting, UiSettings } from "@bentley/ui-core";
import { SyncUiEventArgs, SyncUiEventDispatcher } from "../syncui/SyncUiEventDispatcher";
import { UiFramework, UserSettingsProvider } from "../UiFramework";

/** @alpha */
export interface InitialAppUiSettings {
  colorTheme: string;
  dragInteraction: boolean;
  frameworkVersion: string;
  widgetOpacity: number;
}

/** @alpha */
export class AppUiSettings implements UserSettingsProvider  {
  public readonly providerId = "AppUiSettingsProvider";

  private static _settingNamespace = "AppUiSettings";
  private _settings: Array<UiSetting<any>> = [];
  private _applyingLocalSettings = false;

  public colorTheme: UiSetting<string>;
  public dragInteraction: UiSetting<boolean>;
  public frameworkVersion: UiSetting<string>;
  public widgetOpacity: UiSetting<number>;

  private setColorTheme = (theme: string) => {
    UiFramework.setColorTheme(theme);
    // always store to local storage to avoid flicker during startup if user is not yet logged-in
    localStorage.setItem("uifw:defaultTheme", theme);
  };

  constructor(defaults: Partial<InitialAppUiSettings>) {
    this._settings = [];

    this.colorTheme = new UiSetting<string>(AppUiSettings._settingNamespace, "ColorTheme", UiFramework.getColorTheme, this.setColorTheme, defaults.colorTheme);
    this._settings.push(this.colorTheme);

    this.dragInteraction = new UiSetting<boolean>(AppUiSettings._settingNamespace, "DragInteraction",
      () => UiFramework.useDragInteraction,
      (value: boolean) => UiFramework.setUseDragInteraction(value), defaults.dragInteraction);
    this._settings.push(this.dragInteraction);

    this.frameworkVersion = new UiSetting<string>(AppUiSettings._settingNamespace, "FrameworkVersion",
      () => UiFramework.uiVersion,
      (value: string) => UiFramework.setUiVersion(value), defaults.frameworkVersion);
    this._settings.push(this.frameworkVersion);

    this.widgetOpacity = new UiSetting<number>(AppUiSettings._settingNamespace, "WidgetOpacity",
      () => UiFramework.getWidgetOpacity(), (value: number) => UiFramework.setWidgetOpacity(value), defaults.widgetOpacity);
    this._settings.push(this.widgetOpacity);

    SyncUiEventDispatcher.onSyncUiEvent.addListener(this.handleSyncUiEvent);
  }

  private handleSyncUiEvent = async (args: SyncUiEventArgs) => {
    if (this._applyingLocalSettings)
      return;

    if (args.eventIds.has("configurableui:set_theme")) {
      await this.colorTheme.saveSetting(UiFramework.getUiSettings());
      // always store as default theme in local storage to avoid flicker during startup if user is not yet logged-in
      localStorage.setItem("uifw:defaultTheme", UiFramework.getColorTheme());
    }

    if (args.eventIds.has("configurableui:set-drag-interaction"))
      await this.dragInteraction.saveSetting(UiFramework.getUiSettings());

    if (args.eventIds.has("configurableui:set-framework-version"))
      await this.frameworkVersion.saveSetting(UiFramework.getUiSettings());

    if (args.eventIds.has("configurableui:set_widget_opacity"))
      await this.widgetOpacity.saveSetting(UiFramework.getUiSettings());
  };

  public async apply(uiSettings: UiSettings): Promise<void> {
    this._applyingLocalSettings = true;
    for await (const setting of this._settings) {
      await setting.getSettingAndApplyValue(uiSettings);
    }
    this._applyingLocalSettings = false;
  }

  public async loadUserSettings(settings: UiSettings): Promise<void> {
    await this.apply(settings);
  }
}
