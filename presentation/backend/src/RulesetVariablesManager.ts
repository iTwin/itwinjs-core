/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64 } from "@bentley/bentleyjs-core";
import { IRulesetVariablesManager } from "@bentley/presentation-common";
import { VariableValueJSON, VariableValueTypes } from "@bentley/presentation-common/lib/IRulesetVariablesManager";
import { NativePlatformDefinition } from "./NativePlatform";

/** @hidden */
export default class RulesetVariablesManager implements IRulesetVariablesManager {
  private _getNativePlatform: () => NativePlatformDefinition;
  private _rulesetId: string;

  constructor(getNativeAddon: () => NativePlatformDefinition, rulesetId: string) {
    this._getNativePlatform = getNativeAddon;
    this._rulesetId = rulesetId;
  }

  public async setValue(variableId: string, type: VariableValueTypes, value: VariableValueJSON): Promise<void> {
    return await this._getNativePlatform().setRulesetVariableValue(this._rulesetId, variableId, type, value);
  }
  public async getValue(variableId: string, type: VariableValueTypes): Promise<VariableValueJSON> {
    return await this._getNativePlatform().getRulesetVariableValue(this._rulesetId, variableId, type);
  }

  public async getString(variableId: string): Promise<string> {
    return (await this.getValue(variableId, VariableValueTypes.String)) as string;
  }
  public async setString(variableId: string, value: string): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.String, value);
  }

  public async getBool(variableId: string): Promise<boolean> {
    return (await this.getValue(variableId, VariableValueTypes.Bool)) as boolean;
  }
  public async setBool(variableId: string, value: boolean): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.Bool, value);
  }

  public async getInt(variableId: string): Promise<number> {
    return (await this.getValue(variableId, VariableValueTypes.Int)) as number;
  }
  public async setInt(variableId: string, value: number): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.Int, value);
  }

  public async getInts(variableId: string): Promise<number[]> {
    return (await this.getValue(variableId, VariableValueTypes.IntArray)) as number[];
  }
  public async setInts(variableId: string, value: number[]): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.IntArray, value);
  }

  public async getId64(variableId: string): Promise<Id64> {
    const value = (await this.getValue(variableId, VariableValueTypes.Id64)) as string;
    return new Id64(value);
  }
  public async setId64(variableId: string, value: Id64): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.Id64, value.value);
  }

  public async getId64s(variableId: string): Promise<Id64[]> {
    const value = (await this.getValue(variableId, VariableValueTypes.Id64Array)) as string[];
    return value.map((v) => new Id64(v));
  }
  public async setId64s(variableId: string, value: Id64[]): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.Id64Array, value.map((v) => v.value));
  }
}
