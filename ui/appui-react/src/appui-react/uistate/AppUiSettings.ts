/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Settings
 */

import { UiStateEntry, UiStateStorage } from "@itwin/core-react";
import { SyncUiEventArgs, SyncUiEventDispatcher } from "../syncui/SyncUiEventDispatcher";
import { FrameworkVersionId, UiFramework, UserSettingsProvider } from "../UiFramework";

// cSpell:ignore configurableui

/** Default values that may be specified for [[AppUiSettings]].
 * @public
 */
export interface InitialAppUiSettings {
  colorTheme: string;
  dragInteraction: boolean;
  frameworkVersion: FrameworkVersionId;
  widgetOpacity: number;
}

/** These are the UI settings that are stored in the Redux store. They control the color theme, the UI version,
 * how toolbar group buttons work, and the opacity of widgets in 1.0 and floating widget in 2.0 when the cursor
 * is not inside them. It is expect that an IModelApp using App UI components will create and register AppUiSettings with
 * defaults specific to their application. This would be done by calling the following.
 *
 * ```ts
 * UiFramework.registerUserSettingsProvider(new AppUiSettings(defaults));
 * ```
 *
 * @public
 */
export class AppUiSettings implements UserSettingsProvider {
  public readonly providerId = "AppUiSettingsProvider";

  private static _settingNamespace = "AppUiSettings";
  private _settings: Array<UiStateEntry<any>> = [];
  private _applyingLocalSettings = false;

  public colorTheme: UiStateEntry<string>;
  public dragInteraction: UiStateEntry<boolean>;
  public frameworkVersion: UiStateEntry<FrameworkVersionId>;
  public widgetOpacity: UiStateEntry<number>;

  private setColorTheme = (theme: string) => {
    UiFramework.setColorTheme(theme);
    // always store to local storage to avoid flicker during startup if user is not yet logged-in
    window.localStorage.setItem("uifw:defaultTheme", theme);
  };

  constructor(defaults: Partial<InitialAppUiSettings>) {
    this._settings = [];

    this.colorTheme = new UiStateEntry<string>(AppUiSettings._settingNamespace, "ColorTheme", UiFramework.getColorTheme, this.setColorTheme, defaults.colorTheme);
    this._settings.push(this.colorTheme);

    this.dragInteraction = new UiStateEntry<boolean>(AppUiSettings._settingNamespace, "DragInteraction",
      () => UiFramework.useDragInteraction,
      (value: boolean) => UiFramework.setUseDragInteraction(value), defaults.dragInteraction);
    this._settings.push(this.dragInteraction);

    this.frameworkVersion = new UiStateEntry<FrameworkVersionId>(AppUiSettings._settingNamespace, "FrameworkVersion",
      () => UiFramework.uiVersion,
      (value: FrameworkVersionId) => UiFramework.setUiVersion(value), defaults.frameworkVersion);
    this._settings.push(this.frameworkVersion);

    this.widgetOpacity = new UiStateEntry<number>(AppUiSettings._settingNamespace, "WidgetOpacity",
      () => UiFramework.getWidgetOpacity(), (value: number) => UiFramework.setWidgetOpacity(value), defaults.widgetOpacity);
    this._settings.push(this.widgetOpacity);

    SyncUiEventDispatcher.onSyncUiEvent.addListener(this.handleSyncUiEvent);
  }

  private handleSyncUiEvent = async (args: SyncUiEventArgs) => {
    if (this._applyingLocalSettings)
      return;

    if (args.eventIds.has("configurableui:set_theme")) {
      await this.colorTheme.saveSetting(UiFramework.getUiStateStorage());
      // always store as default theme in local storage to avoid flicker during startup if user is not yet logged-in
      window.localStorage.setItem("uifw:defaultTheme", UiFramework.getColorTheme());
    }

    if (args.eventIds.has("configurableui:set-drag-interaction"))
      await this.dragInteraction.saveSetting(UiFramework.getUiStateStorage());

    if (args.eventIds.has("configurableui:set-framework-version"))
      await this.frameworkVersion.saveSetting(UiFramework.getUiStateStorage());

    if (args.eventIds.has("configurableui:set_widget_opacity"))
      await this.widgetOpacity.saveSetting(UiFramework.getUiStateStorage());
  };

  public async apply(storage: UiStateStorage): Promise<void> {
    this._applyingLocalSettings = true;
    for await (const setting of this._settings) {
      await setting.getSettingAndApplyValue(storage);
    }
    this._applyingLocalSettings = false;
  }

  public async loadUserSettings(storage: UiStateStorage): Promise<void> {
    await this.apply(storage);
  }
}
