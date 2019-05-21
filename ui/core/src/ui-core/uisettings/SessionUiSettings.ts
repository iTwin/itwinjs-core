/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module UiSettings */

import { UiSettings, UiSettingsResult, UiSettingsStatus } from "./UiSettings";

/**
 * Implementation of [[UiSettings]] using Window.sessionStorage.
 * @beta
 */
export class SessionUiSettings implements UiSettings {

  constructor(public w: Window = window) { }

  public getSetting = (settingNamespace: string, settingName: string): UiSettingsResult => {
    const setting = this.w.sessionStorage.getItem(`${settingNamespace}.${settingName}`);
    if (setting !== null)
      return { status: UiSettingsStatus.Success, setting: JSON.parse(setting) };
    else
      return { status: UiSettingsStatus.NotFound };
  }

  public saveSetting = (settingNamespace: string, settingName: string, setting: any): UiSettingsResult => {
    this.w.sessionStorage.setItem(`${settingNamespace}.${settingName}`, JSON.stringify(setting));
    return { status: UiSettingsStatus.Success };
  }

  public deleteSetting = (settingNamespace: string, settingName: string): UiSettingsResult => {
    const name = `${settingNamespace}.${settingName}`;
    const setting = this.w.sessionStorage.getItem(name);
    if (setting === null)
      return { status: UiSettingsStatus.NotFound };
    this.w.sessionStorage.removeItem(name);
    return { status: UiSettingsStatus.Success };
  }
}
