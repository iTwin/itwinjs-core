/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64 } from "@bentley/bentleyjs-core";
import { VariableValueTypes, VariableValue, VariableValueJSON } from "@bentley/presentation-common/lib/RulesetVariables";
import { NativePlatformDefinition } from "./NativePlatform";

/** @hidden */
export default class RulesetVariablesManager {
  private _getNativePlatform: () => NativePlatformDefinition;
  private _rulesetId: string;

  constructor(getNativeAddon: () => NativePlatformDefinition, rulesetId: string) {
    this._getNativePlatform = getNativeAddon;
    this._rulesetId = rulesetId;
  }

  public setValueJSON(variableId: string, type: VariableValueTypes, value: VariableValueJSON): void {
    this._getNativePlatform().setRulesetVariableValue(this._rulesetId, variableId, type, value);
  }

  public getValueJSON(variableId: string, type: VariableValueTypes): VariableValueJSON {
    return this._getNativePlatform().getRulesetVariableValue(this._rulesetId, variableId, type);
  }

  public setValue(variableId: string, type: VariableValueTypes, value: VariableValue): void {
    switch (type) {
      case VariableValueTypes.Bool: return this.setBool(variableId, value as boolean);
      case VariableValueTypes.Id64: return this.setId64(variableId, value as Id64);
      case VariableValueTypes.Id64Array: return this.setId64s(variableId, value as Id64[]);
      case VariableValueTypes.Int: return this.setInt(variableId, value as number);
      case VariableValueTypes.IntArray: return this.setInts(variableId, value as number[]);
      case VariableValueTypes.String: return this.setString(variableId, value as string);
    }
  }
  public getValue(variableId: string, type: VariableValueTypes): VariableValue {
    switch (type) {
      case VariableValueTypes.Bool: return this.getBool(variableId);
      case VariableValueTypes.Id64: return this.getId64(variableId);
      case VariableValueTypes.Id64Array: return this.getId64s(variableId);
      case VariableValueTypes.Int: return this.getInt(variableId);
      case VariableValueTypes.IntArray: return this.getInts(variableId);
      case VariableValueTypes.String: return this.getString(variableId);
    }
  }

  /**
   * Retrieves `string` variable value.
   * Returns empty string if variable does not exist or does not convert to string.
   */
  public getString(variableId: string): string {
    return (this.getValueJSON(variableId, VariableValueTypes.String)) as string;
  }

  /**
   * Sets `string` variable value
   */
  public setString(variableId: string, value: string): void {
    this.setValueJSON(variableId, VariableValueTypes.String, value);
  }

  /**
   * Retrieves `boolean` variable value.
   * Returns `false` if variable does not exist or does not convert to boolean.
   */
  public getBool(variableId: string): boolean {
    return (this.getValueJSON(variableId, VariableValueTypes.Bool)) as boolean;
  }

  /**
   * Sets `boolean` variable value
   */
  public setBool(variableId: string, value: boolean): void {
    this.setValueJSON(variableId, VariableValueTypes.Bool, value);
  }

  /**
   * Retrieves `number` variable value.
   * Returns `0` if variable does not exist or does not convert to integer.
   */
  public getInt(variableId: string): number {
    return (this.getValueJSON(variableId, VariableValueTypes.Int)) as number;
  }

  /**
   * Sets `number` variable value
   */
  public setInt(variableId: string, value: number): void {
    this.setValueJSON(variableId, VariableValueTypes.Int, value);
  }

  /**
   * Retrieves `number[]` variable value.
   * Returns empty array if variable does not exist or does not convert to integer array.
   */
  public getInts(variableId: string): number[] {
    return (this.getValueJSON(variableId, VariableValueTypes.IntArray)) as number[];
  }

  /**
   * Sets `number[]` variable value
   */
  public setInts(variableId: string, value: number[]): void {
    this.setValueJSON(variableId, VariableValueTypes.IntArray, value);
  }

  /**
   * Retrieves `Id64` variable value.
   * Returns invalid Id64 if variable does not exist or does not convert to Id64.
   */
  public getId64(variableId: string): Id64 {
    return new Id64((this.getValueJSON(variableId, VariableValueTypes.Id64)) as string);
  }

  /**
   * Sets `Id64` variable value
   */
  public setId64(variableId: string, value: Id64): void {
    this.setValueJSON(variableId, VariableValueTypes.Id64, value.value);
  }

  /**
   * Retrieves `Id64[]` variable value.
   * Returns empty array if variable does not exist or does not convert to Id64 array.
   */
  public getId64s(variableId: string): Id64[] {
    const value = (this.getValueJSON(variableId, VariableValueTypes.Id64Array)) as string[];
    return value.map((v) => new Id64(v));
  }

  /**
   * Sets `Id64[]` variable value
   */
  public setId64s(variableId: string, value: Id64[]): void {
    this.setValueJSON(variableId, VariableValueTypes.Id64Array, value.map((v) => v.value));
  }
}
