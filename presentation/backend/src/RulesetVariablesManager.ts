/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64 } from "@bentley/bentleyjs-core";
import { IRulesetVariablesManager } from "@bentley/presentation-common";
import { VariableValueTypes, VariableValue, VariableValueJSON } from "@bentley/presentation-common/lib/IRulesetVariablesManager";
import { NativePlatformDefinition } from "./NativePlatform";

/** @hidden */
export default class RulesetVariablesManager implements IRulesetVariablesManager {
  private _getNativePlatform: () => NativePlatformDefinition;
  private _rulesetId: string;

  constructor(getNativeAddon: () => NativePlatformDefinition, rulesetId: string) {
    this._getNativePlatform = getNativeAddon;
    this._rulesetId = rulesetId;
  }

  public async setValueJSON(variableId: string, type: VariableValueTypes, value: VariableValueJSON): Promise<void> {
    return await this._getNativePlatform().setRulesetVariableValue(this._rulesetId, variableId, type, value);
  }
  public async getValueJSON(variableId: string, type: VariableValueTypes): Promise<VariableValueJSON> {
    return await this._getNativePlatform().getRulesetVariableValue(this._rulesetId, variableId, type);
  }

  public async setValue(variableId: string, type: VariableValueTypes, value: VariableValue): Promise<void> {
    switch (type) {
      case VariableValueTypes.Bool: return await this.setBool(variableId, value as boolean);
      case VariableValueTypes.Id64: return await this.setId64(variableId, value as Id64);
      case VariableValueTypes.Id64Array: return await this.setId64s(variableId, value as Id64[]);
      case VariableValueTypes.Int: return await this.setInt(variableId, value as number);
      case VariableValueTypes.IntArray: return await this.setInts(variableId, value as number[]);
      case VariableValueTypes.String: return await this.setString(variableId, value as string);
    }
  }
  public async getValue(variableId: string, type: VariableValueTypes): Promise<VariableValue> {
    switch (type) {
      case VariableValueTypes.Bool: return await this.getBool(variableId);
      case VariableValueTypes.Id64: return await this.getId64(variableId);
      case VariableValueTypes.Id64Array: return await this.getId64s(variableId);
      case VariableValueTypes.Int: return await this.getInt(variableId);
      case VariableValueTypes.IntArray: return await this.getInts(variableId);
      case VariableValueTypes.String: return await this.getString(variableId);
    }
  }

  public async getString(variableId: string): Promise<string> {
    return (await this.getValueJSON(variableId, VariableValueTypes.String)) as string;
  }
  public async setString(variableId: string, value: string): Promise<void> {
    await this.setValueJSON(variableId, VariableValueTypes.String, value);
  }

  public async getBool(variableId: string): Promise<boolean> {
    return (await this.getValueJSON(variableId, VariableValueTypes.Bool)) as boolean;
  }
  public async setBool(variableId: string, value: boolean): Promise<void> {
    await this.setValueJSON(variableId, VariableValueTypes.Bool, value);
  }

  public async getInt(variableId: string): Promise<number> {
    return (await this.getValueJSON(variableId, VariableValueTypes.Int)) as number;
  }
  public async setInt(variableId: string, value: number): Promise<void> {
    await this.setValueJSON(variableId, VariableValueTypes.Int, value);
  }

  public async getInts(variableId: string): Promise<number[]> {
    return (await this.getValueJSON(variableId, VariableValueTypes.IntArray)) as number[];
  }
  public async setInts(variableId: string, value: number[]): Promise<void> {
    await this.setValueJSON(variableId, VariableValueTypes.IntArray, value);
  }

  public async getId64(variableId: string): Promise<Id64> {
    const value = (await this.getValueJSON(variableId, VariableValueTypes.Id64)) as string;
    return new Id64(value);
  }
  public async setId64(variableId: string, value: Id64): Promise<void> {
    await this.setValueJSON(variableId, VariableValueTypes.Id64, value.value);
  }

  public async getId64s(variableId: string): Promise<Id64[]> {
    const value = (await this.getValueJSON(variableId, VariableValueTypes.Id64Array)) as string[];
    return value.map((v) => new Id64(v));
  }
  public async setId64s(variableId: string, value: Id64[]): Promise<void> {
    await this.setValueJSON(variableId, VariableValueTypes.Id64Array, value.map((v) => v.value));
  }
}
