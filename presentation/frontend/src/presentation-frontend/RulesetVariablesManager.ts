/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import type { Id64String} from "@itwin/core-bentley";
import { assert, BeEvent, Id64, OrderedId64Iterable } from "@itwin/core-bentley";
import type { RulesetVariable, VariableValue} from "@itwin/presentation-common";
import { VariableValueTypes } from "@itwin/presentation-common";
import type { IpcRequestsHandler } from "./IpcRequestsHandler";

/**
 * Presentation ruleset variables' registry.
 * @public
 */
export interface RulesetVariablesManager {

  /**
   * An event that is raised when variable changes.
   */
  onVariableChanged: BeEvent<(variableId: string, prevValue: VariableValue | undefined, currValue: VariableValue | undefined) => void>;

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

  /** Unsets variable with given id. */
  unset(variableId: string): Promise<void>;

  /** Retrieves all variables.
   * @internal
   */
  getAllVariables(): RulesetVariable[];
}

/** @internal */
export class RulesetVariablesManagerImpl implements RulesetVariablesManager {

  private _clientValues = new Map<string, RulesetVariable>();
  private _rulesetId: string;
  private _ipcHandler?: IpcRequestsHandler;
  public onVariableChanged = new BeEvent<(variableId: string, prevValue: VariableValue | undefined, currValue: VariableValue | undefined) => void>();

  public constructor(rulesetId: string, ipcHandler?: IpcRequestsHandler) {
    this._rulesetId = rulesetId;
    this._ipcHandler = ipcHandler;
  }

  public getAllVariables(): RulesetVariable[] {
    const variables: RulesetVariable[] = [];
    for (const entry of this._clientValues)
      variables.push(entry[1]);
    return variables;
  }

  private changeValueType(variable: RulesetVariable, toType: VariableValueTypes): VariableValue | undefined {
    switch (toType) {
      case VariableValueTypes.Bool:
        switch (variable.type) {
          case VariableValueTypes.Int: return (0 !== variable.value);
          case VariableValueTypes.Id64: return Id64.isValidId64(variable.value);
          default: return undefined;
        }
      case VariableValueTypes.Int:
        switch (variable.type) {
          case VariableValueTypes.Bool: return variable.value ? 1 : 0;
          case VariableValueTypes.Id64: return Id64.getUpperUint32(variable.value);
          default: return undefined;
        }
      case VariableValueTypes.IntArray:
        switch (variable.type) {
          case VariableValueTypes.Id64Array: return variable.value.map((id) => Id64.getUpperUint32(id));
          default: return undefined;
        }
      case VariableValueTypes.Id64:
        switch (variable.type) {
          case VariableValueTypes.Bool: return Id64.fromLocalAndBriefcaseIds(variable.value ? 1 : 0, 0);
          case VariableValueTypes.Int: return Id64.fromLocalAndBriefcaseIds(variable.value, 0);
          default: return undefined;
        }
      case VariableValueTypes.Id64Array:
        switch (variable.type) {
          case VariableValueTypes.IntArray: return variable.value.map((int) => Id64.fromLocalAndBriefcaseIds(int, 0));
          default: return undefined;
        }
      case VariableValueTypes.String:
        switch (variable.type) {
          case VariableValueTypes.IntArray:
          case VariableValueTypes.Id64Array:
            return undefined;
          default: variable.value.toString();
        }
    }
    return undefined;
  }

  private async getValue(id: string, type: VariableValueTypes): Promise<VariableValue | undefined> {
    const variable = this._clientValues.get(id);
    if (!variable)
      return undefined;
    if (variable.type !== type)
      return this.changeValueType(variable, type);
    return variable.value;
  }

  private async setValue(variable: RulesetVariable): Promise<void> {
    const oldVariable = this._clientValues.get(variable.id);
    if (oldVariable && variablesEqual(oldVariable, variable))
      return;

    this._clientValues.set(variable.id, variable);
    if (this._ipcHandler) {
      await this._ipcHandler.setRulesetVariable({ rulesetId: this._rulesetId, variable });
    }

    this.onVariableChanged.raiseEvent(variable.id, oldVariable?.value, variable.value);
  }

  public async unset(variableId: string): Promise<void> {
    const variable = this._clientValues.get(variableId);
    if (variable === undefined)
      return;

    this._clientValues.delete(variable.id);
    if (this._ipcHandler) {
      await this._ipcHandler.unsetRulesetVariable({ rulesetId: this._rulesetId, variableId });
    }
    this.onVariableChanged.raiseEvent(variable.id, variable.value, undefined);
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
    await this.setValue({ id: variableId, type: VariableValueTypes.String, value });
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
    await this.setValue({ id: variableId, type: VariableValueTypes.Bool, value });
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
    await this.setValue({ id: variableId, type: VariableValueTypes.Int, value });
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
    await this.setValue({ id: variableId, type: VariableValueTypes.IntArray, value: [...value] });
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
    await this.setValue({ id: variableId, type: VariableValueTypes.Id64, value });
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
    await this.setValue({ id: variableId, type: VariableValueTypes.Id64Array, value: [...OrderedId64Iterable.sortArray(value)] });
  }
}

function variablesEqual(lhs: RulesetVariable, rhs: RulesetVariable) {
  if (lhs.type !== rhs.type)
    return false;

  switch (lhs.type) {
    case VariableValueTypes.IntArray:
    case VariableValueTypes.Id64Array:
      assert(rhs.type === lhs.type);
      return arraysEqual(lhs.value, rhs.value);

    default:
      return lhs.value === rhs.value;
  }
}

function arraysEqual(lhs: any[], rhs: any[]) {
  if (lhs.length !== rhs.length)
    return false;

  for (let i = 0; i < lhs.length; ++i) {
    if (lhs[i] !== rhs[i])
      return false;
  }
  return true;
}
