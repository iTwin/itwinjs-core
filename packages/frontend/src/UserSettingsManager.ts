/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IUserSettingsManager, SettingValue, SettingValueTypes } from "@bentley/ecpresentation-common";
import { UserSettingsRpcRequestOptions } from "@bentley/ecpresentation-common/lib/ECPresentationRpcInterface";
import { Id64 } from "@bentley/bentleyjs-core";
import { ECPresentationRpcInterface } from "@bentley/ecpresentation-common";

/** @hidden */
export default class UserSettingsManager implements IUserSettingsManager {
  private _clientId: string;
  private _rulesetId: string;
  public constructor(clientId: string, rulesetId: string) {
    this._clientId = clientId;
    this._rulesetId = rulesetId;
  }
  private createRequestOptions(settingId: string): UserSettingsRpcRequestOptions {
    return {
      clientId: this._clientId,
      rulesetId: this._rulesetId,
      settingId,
    };
  }
  public async setValue(settingId: string, value: SettingValue): Promise<void> {
    return await ECPresentationRpcInterface.getClient().setUserSettingValue(this.createRequestOptions(settingId), value);
  }
  public async getValue(settingId: string, settingType: SettingValueTypes): Promise<boolean | string | number | number[] | Id64 | Id64[]> {
    return await ECPresentationRpcInterface.getClient().getUserSettingValue(this.createRequestOptions(settingId), settingType);
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
