/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { UserSettingsManager as UserSettingsManagerDefinition, SettingValue, SettingValueTypes } from "@bentley/ecpresentation-common";
import { Id64 } from "@bentley/bentleyjs-core";
import { ECPresentationRpcInterface } from "@bentley/ecpresentation-common";

/** @hidden */
export default class UserSettingsManager implements UserSettingsManagerDefinition {

  public async setValue(ruleSetId: string, settingId: string, value: SettingValue): Promise<void> {
    return await ECPresentationRpcInterface.getClient().setUserSettingValue(ruleSetId, settingId, value);
  }
  public async getBoolean(ruleSetId: string, settingId: string): Promise<boolean> {
    return await ECPresentationRpcInterface.getClient().getUserSettingValue(ruleSetId, settingId, SettingValueTypes.Bool);
  }
  public async getInt(ruleSetId: string, settingId: string): Promise<number> {
    return await ECPresentationRpcInterface.getClient().getUserSettingValue(ruleSetId, settingId, SettingValueTypes.Int);
  }
  public async getIntArray(ruleSetId: string, settingId: string): Promise<number[]> {
    return await ECPresentationRpcInterface.getClient().getUserSettingValue(ruleSetId, settingId, SettingValueTypes.IntArray);
  }
  public async getId64(ruleSetId: string, settingId: string): Promise<Id64> {
    return await ECPresentationRpcInterface.getClient().getUserSettingValue(ruleSetId, settingId, SettingValueTypes.Id64);
  }
  public async getId64Array(ruleSetId: string, settingId: string): Promise<Id64[]> {
    return await ECPresentationRpcInterface.getClient().getUserSettingValue(ruleSetId, settingId, SettingValueTypes.Id64Array);
  }
  public async getString(ruleSetId: string, settingId: string): Promise<string> {
    return await ECPresentationRpcInterface.getClient().getUserSettingValue(ruleSetId, settingId, SettingValueTypes.String);
  }
}
