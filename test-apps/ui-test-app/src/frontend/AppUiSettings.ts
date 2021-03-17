/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UiSetting, UiSettings } from "@bentley/ui-core";
import { FrameworkAccuDraw, SyncUiEventArgs, SyncUiEventDispatcher, SyncUiEventId, UiFramework, UiShowHideManager } from "@bentley/ui-framework";

export interface InitialAppUiSettings {
  colorTheme: string;
  autoHideUi: boolean;
  useProximityOpacity: boolean;
  snapWidgetOpacity: boolean;
  dragInteraction: boolean;
  frameworkVersion: string;
  accuDrawNotifications: boolean;
  widgetOpacity: number;
}

export class AppUiSettings {
  private static _settingNamespace = "AppUiSettings";
  private _settings: Array<UiSetting<any>> = [];
  private _applyingLocalSettings = false;

  public colorTheme: UiSetting<string>;
  public dragInteraction: UiSetting<boolean>;
  public frameworkVersion: UiSetting<string>;
  public widgetOpacity: UiSetting<number>;
  public accuDrawNotifications: UiSetting<boolean>;
  public autoHideUi: UiSetting<boolean>;
  public useProximityOpacity: UiSetting<boolean>;
  public snapWidgetOpacity: UiSetting<boolean>;

  private setColorTheme = (theme: string) => {
    UiFramework.setColorTheme(theme);
    // always store to local storage to avoid flicker during startup if user is not yet logged-in
    localStorage.setItem("uifw:defaultTheme", theme);
  };

  constructor(defaults: Partial<InitialAppUiSettings>) {
    this._settings = [];

    this.colorTheme = new UiSetting<string>(AppUiSettings._settingNamespace, "ColorTheme", UiFramework.getColorTheme, this.setColorTheme, defaults.colorTheme);
    this._settings.push(this.colorTheme);

    this.autoHideUi = new UiSetting<boolean>(AppUiSettings._settingNamespace, "AutoHideUi",
      () => UiShowHideManager.autoHideUi, (value: boolean) => UiShowHideManager.autoHideUi = value, defaults.autoHideUi);
    this._settings.push(this.autoHideUi);

    this.useProximityOpacity = new UiSetting<boolean>(AppUiSettings._settingNamespace, "UseProximityOpacity",
      () => UiShowHideManager.useProximityOpacity, (value: boolean) => UiShowHideManager.useProximityOpacity = value, defaults.useProximityOpacity);
    this._settings.push(this.useProximityOpacity);

    this.snapWidgetOpacity = new UiSetting<boolean>(AppUiSettings._settingNamespace, "SnapWidgetOpacity",
      () => UiShowHideManager.snapWidgetOpacity, (value: boolean) => UiShowHideManager.snapWidgetOpacity = value, defaults.snapWidgetOpacity);
    this._settings.push(this.snapWidgetOpacity);

    this.dragInteraction = new UiSetting<boolean>(AppUiSettings._settingNamespace, "DragInteraction",
      () => UiFramework.useDragInteraction,
      (value: boolean) => UiFramework.setUseDragInteraction(value), defaults.dragInteraction);
    this._settings.push(this.dragInteraction);

    this.frameworkVersion = new UiSetting<string>(AppUiSettings._settingNamespace, "FrameworkVersion",
      () => UiFramework.uiVersion,
      (value: string) => UiFramework.setUiVersion(value), defaults.frameworkVersion);
    this._settings.push(this.frameworkVersion);

    this.accuDrawNotifications = new UiSetting<boolean>(AppUiSettings._settingNamespace, "AccuDrawNotifications",
      () => FrameworkAccuDraw.displayNotifications, (value: boolean) => FrameworkAccuDraw.displayNotifications = value, defaults.accuDrawNotifications);
    this._settings.push(this.accuDrawNotifications);

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

    if (args.eventIds.has(SyncUiEventId.ShowHideManagerSettingChange)) {
      await this.autoHideUi.saveSetting(UiFramework.getUiSettings());
      await this.snapWidgetOpacity.saveSetting(UiFramework.getUiSettings());
      await this.useProximityOpacity.saveSetting(UiFramework.getUiSettings());
    }
  };

  public async apply(uiSettings: UiSettings): Promise<void> {
    this._applyingLocalSettings = true;
    for await (const setting of this._settings) {
      await setting.getSettingAndApplyValue(uiSettings);
    }
    this._applyingLocalSettings = false;
  }
}
