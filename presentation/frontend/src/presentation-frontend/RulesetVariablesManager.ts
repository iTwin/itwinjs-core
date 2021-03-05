/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { BeEvent, Id64, Id64String } from "@bentley/bentleyjs-core";
import { RulesetVariable, VariableValue, VariableValueTypes } from "@bentley/presentation-common";
import { IpcRequestsHandler } from "./IpcRequestsHandler";

/**
 * Presentation ruleset variables' registry.
 * @public
 */
export interface RulesetVariablesManager {

  /**
   * An event that is raised when variable changes.
   */
  onVariableChanged: BeEvent<(variableId: string, prevValue: VariableValue, currValue: VariableValue) => void>;

  /**
   * Retrieves `string` variable value.
   * Returns empty string if variable does not exist or does not convert to string.
   */
  getString(variableId: string): Promise<string>;
  /**
   * Sets `string` variable value
   */
  setString(variableId: string, value: string): Promise<void>;

  /**
   * Retrieves `boolean` variable value.
   * Returns `false` if variable does not exist or does not convert to boolean.
   */
  getBool(variableId: string): Promise<boolean>;
  /**
   * Sets `boolean` variable value
   */
  setBool(variableId: string, value: boolean): Promise<void>;

  /**
   * Retrieves `number` variable value.
   * Returns `0` if variable does not exist or does not convert to integer.
   */
  getInt(variableId: string): Promise<number>;
  /**
   * Sets `number` variable value
   */
  setInt(variableId: string, value: number): Promise<void>;

  /**
   * Retrieves `number[]` variable value.
   * Returns empty array if variable does not exist or does not convert to integer array.
   */
  getInts(variableId: string): Promise<number[]>;
  /**
   * Sets `number[]` variable value
   */
  setInts(variableId: string, value: number[]): Promise<void>;

  /**
   * Retrieves `Id64String` variable value.
   * Returns invalid Id64String if variable does not exist or does not convert to Id64String.
   */
  getId64(variableId: string): Promise<Id64String>;
  /**
   * Sets `Id64String` variable value
   */
  setId64(variableId: string, value: Id64String): Promise<void>;

  /**
   * Retrieves `Id64String[]` variable value.
   * Returns empty array if variable does not exist or does not convert to Id64String array.
   */
  getId64s(variableId: string): Promise<Id64String[]>;
  /**
   * Sets `Id64String[]` variable value
   */
  setId64s(variableId: string, value: Id64String[]): Promise<void>;

  /** Retrieves all variables.
   * @internal
   */
  getAllVariables(): Promise<RulesetVariable[]>;
}

/** @internal */
export class RulesetVariablesManagerImpl implements RulesetVariablesManager {

  private _clientValues = new Map<string, [VariableValueTypes, VariableValue]>();
  private _rulesetId: string;
  private _ipcHandler?: IpcRequestsHandler;
  public onVariableChanged = new BeEvent<(variableId: string, prevValue: VariableValue | undefined, currValue: VariableValue) => void>();

  public constructor(rulesetId: string, ipcHandler?: IpcRequestsHandler) {
    this._rulesetId = rulesetId;
    this._ipcHandler = ipcHandler;
  }

  public async getAllVariables(): Promise<RulesetVariable[]> {
    const variables: RulesetVariable[] = [];
    for (const entry of this._clientValues)
      variables.push({ id: entry[0], type: entry[1][0], value: entry[1][1] });

    return variables;
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
    const oldValue = this._clientValues.get(id);
    this._clientValues.set(id, [type, value]);
    if (this._ipcHandler) {
      await this._ipcHandler.setRulesetVariable({ rulesetId: this._rulesetId, variable: { id, type, value } });
    }

    this.onVariableChanged.raiseEvent(id, oldValue?.[1], value);
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
