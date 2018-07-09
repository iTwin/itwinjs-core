/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { UserSettingsManager as UserSettingsManagerDefinition, SettingValue, SettingValueTypes, ECPresentationError, ECPresentationStatus } from "@bentley/ecpresentation-common";
import { Id64 } from "@bentley/bentleyjs-core";
import { NativePlatformDefinition } from "./NativePlatform";

/** @hidden */
export default class UserSettingsManager implements UserSettingsManagerDefinition {
  private _getNativePlatform: () => NativePlatformDefinition;

  constructor(getNativePlatform: () => NativePlatformDefinition) {
    this._getNativePlatform = getNativePlatform;
  }

  public async setValue(ruleSetId: string, settingId: string, value: SettingValue): Promise<void> {
    return await this._getNativePlatform().setUserSetting(ruleSetId, settingId, JSON.stringify(value));
  }
  public async getBoolean(ruleSetId: string, settingId: string): Promise<boolean> {
    return await this._getNativePlatform().getUserSetting(ruleSetId, settingId, SettingValueTypes.Bool);
  }
  public async getInt(ruleSetId: string, settingId: string): Promise<number> {
    return await this._getNativePlatform().getUserSetting(ruleSetId, settingId, SettingValueTypes.Int);
  }
  public async getIntArray(ruleSetId: string, settingId: string): Promise<number[]> {
    return await this._getNativePlatform().getUserSetting(ruleSetId, settingId, SettingValueTypes.IntArray);
  }
  public async getId64(ruleSetId: string, settingId: string): Promise<Id64> {
    return new Id64(await this._getNativePlatform().getUserSetting(ruleSetId, settingId, SettingValueTypes.Id64));
  }
  public async getId64Array(ruleSetId: string, settingId: string): Promise<Id64[]> {
    const values: string[] = await this._getNativePlatform().getUserSetting(ruleSetId, settingId, SettingValueTypes.Id64Array);
    return values.map((x) => new Id64(x));
  }
  public async getString(ruleSetId: string, settingId: string): Promise<string> {
    return await this._getNativePlatform().getUserSetting(ruleSetId, settingId, SettingValueTypes.String);
  }

  public async getValue(ruleSetId: string, settingId: string, settingType: SettingValueTypes) {
    switch (settingType) {
      case SettingValueTypes.Bool:
        return await this.getBoolean(ruleSetId, settingId);
      case SettingValueTypes.Int:
        return await this.getInt(ruleSetId, settingId);
      case SettingValueTypes.IntArray:
        return await this.getIntArray(ruleSetId, settingId);
      case SettingValueTypes.Id64:
        return await this.getId64(ruleSetId, settingId);
      case SettingValueTypes.Id64Array:
        return await this.getId64Array(ruleSetId, settingId);
      case SettingValueTypes.String:
        return await this.getString(ruleSetId, settingId);
    }
    throw new ECPresentationError(ECPresentationStatus.InvalidArgument, "Invalid setting value type");
  }
}
