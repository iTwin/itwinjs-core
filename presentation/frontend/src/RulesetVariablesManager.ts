/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64, Id64String, BeEvent } from "@bentley/bentleyjs-core";
import { RulesetVariablesState } from "@bentley/presentation-common";
import { VariableValueTypes, VariableValue } from "@bentley/presentation-common/lib/RulesetVariables";
import { IClientStateHolder } from "@bentley/presentation-common/lib/RpcRequestsHandler";

/** @hidden */
export default class RulesetVariablesManager implements IClientStateHolder<RulesetVariablesState> {

  private _rulesetId: string;
  private _clientValues = new Map<string, [VariableValueTypes, VariableValue]>();
  public key = RulesetVariablesState.STATE_ID;
  public onStateChanged = new BeEvent<() => void>();

  public constructor(rulesetId: string) {
    this._rulesetId = rulesetId;
  }

  public get state(): RulesetVariablesState {
    const state: RulesetVariablesState = {};
    const values: Array<[string, VariableValueTypes, VariableValue]> = [];
    for (const entry of this._clientValues)
      values.push([entry[0], entry[1][0], entry[1][1]]);
    state[this._rulesetId] = values;
    return state;
  }

  private changeValueType(actualValue: VariableValue, fromType: VariableValueTypes, toType: VariableValueTypes): VariableValue | undefined {
    switch (toType) {
      case VariableValueTypes.Bool:
        switch (fromType) {
          case VariableValueTypes.Int: return (0 !== actualValue);
          case VariableValueTypes.Id64: return Id64.isValidId64(actualValue as string);
          default: return undefined;
        }
      case VariableValueTypes.Int:
        switch (fromType) {
          case VariableValueTypes.Bool: return actualValue ? 1 : 0;
          case VariableValueTypes.Id64: return Id64.getUpperUint32(actualValue as string);
          default: return undefined;
        }
      case VariableValueTypes.IntArray:
        switch (fromType) {
          case VariableValueTypes.Id64Array: return (actualValue as string[]).map((id) => Id64.getUpperUint32(id));
          default: return undefined;
        }
      case VariableValueTypes.Id64:
        switch (fromType) {
          case VariableValueTypes.Bool: return Id64.fromLocalAndBriefcaseIds(actualValue ? 1 : 0, 0);
          case VariableValueTypes.Int: return Id64.fromLocalAndBriefcaseIds(actualValue as number, 0);
          default: return undefined;
        }
      case VariableValueTypes.Id64Array:
        switch (fromType) {
          case VariableValueTypes.IntArray: return (actualValue as number[]).map((int) => Id64.fromLocalAndBriefcaseIds(int, 0));
          default: return undefined;
        }
    }
    return undefined;
  }

  private async getValue(id: string, type: VariableValueTypes): Promise<VariableValue | undefined> {
    const value = this._clientValues.get(id);
    if (!value)
      return undefined;

    if (value[0] !== type)
      return this.changeValueType(value[1], value[0], type);

    return value[1];
  }
  private async setValue(id: string, type: VariableValueTypes, value: VariableValue): Promise<void> {
    this._clientValues.set(id, [type, value]);
    this.onStateChanged.raiseEvent();
  }

  /**
   * Retrieves `string` variable value.
   * Returns empty string if variable does not exist or does not convert to string.
   */
  public async getString(variableId: string): Promise<string> {
    return (await this.getValue(variableId, VariableValueTypes.String) as string) || "";
  }

  /**
   * Sets `string` variable value
   */
  public async setString(variableId: string, value: string): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.String, value);
  }

  /**
   * Retrieves `boolean` variable value.
   * Returns `false` if variable does not exist or does not convert to boolean.
   */
  public async getBool(variableId: string): Promise<boolean> {
    return (await this.getValue(variableId, VariableValueTypes.Bool) as boolean) || false;
  }

  /**
   * Sets `boolean` variable value
   */
  public async setBool(variableId: string, value: boolean): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.Bool, value);
  }

  /**
   * Retrieves `number` variable value.
   * Returns `0` if variable does not exist or does not convert to integer.
   */
  public async getInt(variableId: string): Promise<number> {
    return (await this.getValue(variableId, VariableValueTypes.Int) as number) || 0;
  }

  /**
   * Sets `number` variable value
   */
  public async setInt(variableId: string, value: number): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.Int, value);
  }

  /**
   * Retrieves `number[]` variable value.
   * Returns empty array if variable does not exist or does not convert to integer array.
   */
  public async getInts(variableId: string): Promise<number[]> {
    return (await this.getValue(variableId, VariableValueTypes.IntArray) as number[]) || [];
  }

  /**
   * Sets `number[]` variable value
   */
  public async setInts(variableId: string, value: number[]): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.IntArray, value);
  }

  /**
   * Retrieves `Id64String` variable value.
   * Returns invalid Id64String if variable does not exist or does not convert to Id64String.
   */
  public async getId64(variableId: string): Promise<Id64String> {
    return (await this.getValue(variableId, VariableValueTypes.Id64) as Id64String) || Id64.invalid;
  }

  /**
   * Sets `Id64String` variable value
   */
  public async setId64(variableId: string, value: Id64String): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.Id64, value);
  }

  /**
   * Retrieves `Id64String[]` variable value.
   * Returns empty array if variable does not exist or does not convert to Id64String array.
   */
  public async getId64s(variableId: string): Promise<Id64String[]> {
    return (await this.getValue(variableId, VariableValueTypes.Id64Array) as Id64String[]) || [];
  }

  /**
   * Sets `Id64String[]` variable value
   */
  public async setId64s(variableId: string, value: Id64String[]): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.Id64Array, value);
  }
}
