/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UiSetting, UiSettings } from "@bentley/ui-core";
import { FrameworkAccuDraw, UiFramework, UiShowHideManager } from "@bentley/ui-framework";
import { SampleAppIModelApp, SampleAppUiActionId } from ".";

export class AppUiSettings {
  private static _settingNamespace = "AppUiSettings";
  private _settings: Array<UiSetting<any>> = [];

  public colorTheme: UiSetting<string>;
  public autoHideUi: UiSetting<boolean>;
  public useProximityOpacity: UiSetting<boolean>;
  public snapWidgetOpacity: UiSetting<boolean>;
  public dragInteraction: UiSetting<boolean>;
  public frameworkVersion: UiSetting<string>;
  public accuDrawNotifications: UiSetting<boolean>;
  public widgetOpacity: UiSetting<number>;

  constructor() {
    this._settings = [];

    this.colorTheme = new UiSetting<string>(AppUiSettings._settingNamespace, "ColorTheme", UiFramework.getColorTheme, UiFramework.setColorTheme);
    this._settings.push(this.colorTheme);

    this.autoHideUi = new UiSetting<boolean>(AppUiSettings._settingNamespace, "AutoHideUi",
      () => UiShowHideManager.autoHideUi, (value: boolean) => UiShowHideManager.autoHideUi = value);
    this._settings.push(this.autoHideUi);

    this.useProximityOpacity = new UiSetting<boolean>(AppUiSettings._settingNamespace, "UseProximityOpacity",
      () => UiShowHideManager.useProximityOpacity, (value: boolean) => UiShowHideManager.useProximityOpacity = value);
    this._settings.push(this.useProximityOpacity);

    this.snapWidgetOpacity = new UiSetting<boolean>(AppUiSettings._settingNamespace, "SnapWidgetOpacity",
      () => UiShowHideManager.snapWidgetOpacity, (value: boolean) => UiShowHideManager.snapWidgetOpacity = value);
    this._settings.push(this.snapWidgetOpacity);

    this.dragInteraction = new UiSetting<boolean>(AppUiSettings._settingNamespace, "DragInteraction",
      () => SampleAppIModelApp.store.getState().sampleAppState.dragInteraction,
      (value: boolean) => UiFramework.dispatchActionToStore(SampleAppUiActionId.setDragInteraction, value, true));
    this._settings.push(this.dragInteraction);

    this.frameworkVersion = new UiSetting<string>(AppUiSettings._settingNamespace, "FrameworkVersion",
      () => SampleAppIModelApp.store.getState().sampleAppState.frameworkVersion,
      (value: string) => UiFramework.dispatchActionToStore(SampleAppUiActionId.setFrameworkVersion, value, true));
    this._settings.push(this.frameworkVersion);

    this.accuDrawNotifications = new UiSetting<boolean>(AppUiSettings._settingNamespace, "AccuDrawNotifications",
      () => FrameworkAccuDraw.displayNotifications, (value: boolean) => FrameworkAccuDraw.displayNotifications = value);
    this._settings.push(this.accuDrawNotifications);

    this.widgetOpacity = new UiSetting<number>(AppUiSettings._settingNamespace, "WidgetOpacity",
      () => UiFramework.getWidgetOpacity(), (value: number) => UiFramework.setWidgetOpacity(value));
    this._settings.push(this.widgetOpacity);
  }

  public async apply(uiSettings: UiSettings): Promise<void> {
    for (const setting of this._settings) {
      await setting.getSettingAndApplyValue(uiSettings);
    }
  }
}
