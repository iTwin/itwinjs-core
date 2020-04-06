/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiSettings
 */

import { UiSettings, UiSettingsStatus, UiSettingsResult } from "./UiSettings";

/**
 * Implementation of [[UiSettings]] using Window.localStorage.
 * @beta
 */
export class LocalUiSettings implements UiSettings {

  constructor(public w: Window = window) { }

  public async getSetting(settingNamespace: string, settingName: string): Promise<UiSettingsResult> {
    const setting = this.w.localStorage.getItem(`${settingNamespace}.${settingName}`);
    if (setting !== null)
      return { status: UiSettingsStatus.Success, setting: JSON.parse(setting) };
    else
      return { status: UiSettingsStatus.NotFound };
  }

  public async saveSetting(settingNamespace: string, settingName: string, setting: any): Promise<UiSettingsResult> {
    this.w.localStorage.setItem(`${settingNamespace}.${settingName}`, JSON.stringify(setting));
    return { status: UiSettingsStatus.Success };
  }

  public async deleteSetting(settingNamespace: string, settingName: string): Promise<UiSettingsResult> {
    const name = `${settingNamespace}.${settingName}`;
    const setting = this.w.localStorage.getItem(name);
    if (setting === null)
      return { status: UiSettingsStatus.NotFound };
    this.w.localStorage.removeItem(name);
    return { status: UiSettingsStatus.Success };
  }
}
