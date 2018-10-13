/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module UiSettings */

import { UiSettings, UiSettingsResult, UiSettingsStatus } from "./UiSettings";

/**
 * Implementation of [[UiSettings]] using Window.localStorage.
 */
export class LocalUiSettings implements UiSettings {

  constructor(public w: Window = window) { }

  public getSetting = (settingNamespace: string, settingName: string): UiSettingsResult => {
    const setting = this.w.localStorage.getItem(`${settingNamespace}.${settingName}`);
    if (setting !== null)
      return { status: UiSettingsStatus.Sucess, setting: JSON.parse(setting) };
    else
      return { status: UiSettingsStatus.NotFound };
  }

  public saveSetting = (settingNamespace: string, settingName: string, setting: any): UiSettingsResult => {
    this.w.localStorage.setItem(`${settingNamespace}.${settingName}`, JSON.stringify(setting));
    return { status: UiSettingsStatus.Sucess };
  }

  public deleteSetting = (settingNamespace: string, settingName: string): UiSettingsResult => {
    const name = `${settingNamespace}.${settingName}`;
    const setting = this.w.localStorage.getItem(name);
    if (setting === null)
      return { status: UiSettingsStatus.NotFound };
    this.w.localStorage.removeItem(name);
    return { status: UiSettingsStatus.Sucess };
  }
}
