/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiStateStorage
 */

import type { UiStateStorage, UiStateStorageResult} from "./UiStateStorage";
import { UiStateStorageStatus } from "./UiStateStorage";

/** A single UI State enter that is identified by namespace and setting name.
 * @public
 */
export class UiStateEntry<T> {
  /** Constructor
   * @param settingNamespace  Namespace for the setting, passed to UiStateStorage.
   * @param settingName       Name for the setting, passed to UiStateStorage.
   * @param getValue          Function for getting the value from the application.
   * @param applyValue        Function for applying the setting value to the application.
   * @param defaultValue      Optional default value if not already stored.
   */
  public constructor(public settingNamespace: string, public settingName: string, public getValue: () => T, public applyValue?: (v: T) => void, public defaultValue?: T) {
  }

  /** Gets the setting from [[UiStateStorage]] */
  public async getSetting(storage: UiStateStorage): Promise<UiStateStorageResult> {
    return storage.getSetting(this.settingNamespace, this.settingName);
  }

  /** Saves the setting value from the `getValue` function to UiStateStorage */
  public async saveSetting(storage: UiStateStorage): Promise<UiStateStorageResult> {
    return storage.saveSetting(this.settingNamespace, this.settingName, this.getValue());
  }

  /** Deletes the setting from UiStateStorage */
  public async deleteSetting(storage: UiStateStorage): Promise<UiStateStorageResult> {
    return storage.deleteSetting(this.settingNamespace, this.settingName);
  }

  /** Gets the setting from UiStateStorage and applies the value using the `applyValue` function */
  public async getSettingAndApplyValue(storage: UiStateStorage): Promise<UiStateStorageResult> {
    if (this.applyValue) {
      const result = await this.getSetting(storage);
      if (result.status === UiStateStorageStatus.Success) {
        this.applyValue(result.setting);
      } else if (undefined !== this.defaultValue) {
        this.applyValue(this.defaultValue);
        result.setting = this.defaultValue;
        result.status = UiStateStorageStatus.Success;
      }
      return result;
    }
    return { status: UiStateStorageStatus.Uninitialized };
  }
}
