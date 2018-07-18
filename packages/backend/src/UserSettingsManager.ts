/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IUserSettingsManager, SettingValue, SettingValueTypes } from "@bentley/ecpresentation-common";
import { Id64 } from "@bentley/bentleyjs-core";
import { NativePlatformDefinition } from "./NativePlatform";

/** @hidden */
export default class UserSettingsManager implements IUserSettingsManager {
  private _getNativePlatform: () => NativePlatformDefinition;
  private _rulesetId: string;

  constructor(getNativeAddon: () => NativePlatformDefinition, rulesetId: string) {
    this._getNativePlatform = getNativeAddon;
    this._rulesetId = rulesetId;
  }

  public async setValue(settingId: string, value: SettingValue): Promise<void> {
    return await this._getNativePlatform().setUserSetting(this._rulesetId, settingId, JSON.stringify(value));
  }
  public async getValue(settingId: string, settingType: SettingValueTypes): Promise<boolean | string | number | number[] | Id64 | Id64[]> {
    let value = await this._getNativePlatform().getUserSetting(this._rulesetId, settingId, settingType);
    switch (settingType) {
      case SettingValueTypes.Id64:
        value = new Id64(value as string);
        break;
      case SettingValueTypes.Id64Array:
        value = (value as string[]).map((v) => new Id64(v));
        break;
    }
    return value;
  }
  public async getBoolean(settingId: string): Promise<boolean> {
    return await this.getValue(settingId, SettingValueTypes.Bool) as boolean;
  }
  public async getInt(settingId: string): Promise<number> {
    return await this.getValue(settingId, SettingValueTypes.Int) as number;
  }
  public async getIntArray(settingId: string): Promise<number[]> {
    return await this.getValue(settingId, SettingValueTypes.IntArray) as number[];
  }
  public async getId64(settingId: string): Promise<Id64> {
    return await this.getValue(settingId, SettingValueTypes.Id64) as Id64;
  }
  public async getId64Array(settingId: string): Promise<Id64[]> {
    return await this.getValue(settingId, SettingValueTypes.Id64Array) as Id64[];
  }
  public async getString(settingId: string): Promise<string> {
    return await this.getValue(settingId, SettingValueTypes.String) as string;
  }
}
