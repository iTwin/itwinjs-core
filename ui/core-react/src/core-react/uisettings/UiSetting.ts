/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiSettings
 */

import { UiSettingsResult, UiSettingsStatus, UiSettingsStorage } from "./UiSettingsStorage";

/** A Ui Setting with namespace and setting name.
 * @public
 */
export class UiSetting<T> {
  /** Constructor
   * @param settingNamespace  Namespace for the setting, passed to UiSettings.
   * @param settingName       Name for the setting, passed to UiSettings.
   * @param getValue          Function for getting the value from the application.
   * @param applyValue        Function for applying the setting value to the application.
   * @param defaultValue      Optional default value if not already stored.
   */
  public constructor(public settingNamespace: string, public settingName: string, public getValue: () => T, public applyValue?: (v: T) => void, public defaultValue?: T) {
  }

  /** Gets the setting from [[UiSettingsStorage]] */
  public async getSetting(storage: UiSettingsStorage): Promise<UiSettingsResult> {
    return storage.getSetting(this.settingNamespace, this.settingName);
  }

  /** Saves the setting value from the `getValue` function to UiSettings */
  public async saveSetting(storage: UiSettingsStorage): Promise<UiSettingsResult> {
    return storage.saveSetting(this.settingNamespace, this.settingName, this.getValue());
  }

  /** Deletes the setting from UiSettings */
  public async deleteSetting(storage: UiSettingsStorage): Promise<UiSettingsResult> {
    return storage.deleteSetting(this.settingNamespace, this.settingName);
  }

  /** Gets the setting from UiSettings and applies the value using the `applyValue` function */
  public async getSettingAndApplyValue(storage: UiSettingsStorage): Promise<UiSettingsResult> {
    if (this.applyValue) {
      const result = await this.getSetting(storage);
      if (result.status === UiSettingsStatus.Success) {
        this.applyValue(result.setting);
      } else if (undefined !== this.defaultValue) {
        this.applyValue(this.defaultValue);
        result.setting = this.defaultValue;
        result.status = UiSettingsStatus.Success;
      }
      return result;
    }
    return { status: UiSettingsStatus.Uninitialized };
  }
}
