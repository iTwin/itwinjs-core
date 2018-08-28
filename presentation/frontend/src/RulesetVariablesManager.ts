/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64, IDisposable } from "@bentley/bentleyjs-core";
import { IRulesetVariablesManager, RpcRequestsHandler } from "@bentley/presentation-common";
import { VariableValueTypes, VariableValue } from "@bentley/presentation-common/lib/IRulesetVariablesManager";

/** @hidden */
export default class RulesetVariablesManager implements IRulesetVariablesManager, IDisposable {

  private _requestsHandler: RpcRequestsHandler;
  private _rulesetId: string;
  private _clientValues = new Map<string, [VariableValueTypes, VariableValue]>();

  public constructor(requestsHandler: RpcRequestsHandler, rulesetId: string) {
    this._rulesetId = rulesetId;
    this._requestsHandler = requestsHandler;
    this._requestsHandler.syncHandlers.push(this.syncWithBackend);
  }

  public dispose() {
    const index = this._requestsHandler.syncHandlers.indexOf(this.syncWithBackend);
    if (-1 !== index)
      this._requestsHandler.syncHandlers.splice(index, 1);
  }

  // tslint:disable-next-line:naming-convention
  private syncWithBackend = async (): Promise<void> => {
    if (0 === this._clientValues.size)
      return;

    const values: Array<[string, VariableValueTypes, VariableValue]> = [];
    for (const entry of this._clientValues)
      values.push([entry[0], entry[1][0], entry[1][1]]);
    await this._requestsHandler.setRulesetVariableValues(this._rulesetId, values);
  }

  private async getValue(id: string, type: VariableValueTypes): Promise<VariableValue> {
    return await this._requestsHandler.getRulesetVariableValue(this._rulesetId, id, type);
  }
  private async setValue(id: string, type: VariableValueTypes, value: VariableValue): Promise<void> {
    this._clientValues.set(id, [type, value]);
    await this._requestsHandler.setRulesetVariableValue(this._rulesetId, id, type, value);
  }

  public async getString(variableId: string): Promise<string> {
    return await this.getValue(variableId, VariableValueTypes.String) as string;
  }
  public async setString(variableId: string, value: string): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.String, value);
  }

  public async getBool(variableId: string): Promise<boolean> {
    return await this.getValue(variableId, VariableValueTypes.Bool) as boolean;
  }
  public async setBool(variableId: string, value: boolean): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.Bool, value);
  }

  public async getInt(variableId: string): Promise<number> {
    return await this.getValue(variableId, VariableValueTypes.Int) as number;
  }
  public async setInt(variableId: string, value: number): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.Int, value);
  }

  public async getInts(variableId: string): Promise<number[]> {
    return await this.getValue(variableId, VariableValueTypes.IntArray) as number[];
  }
  public async setInts(variableId: string, value: number[]): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.IntArray, value);
  }

  public async getId64(variableId: string): Promise<Id64> {
    return await this.getValue(variableId, VariableValueTypes.Id64) as Id64;
  }
  public async setId64(variableId: string, value: Id64): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.Id64, value);
  }

  public async getId64s(variableId: string): Promise<Id64[]> {
    return await this.getValue(variableId, VariableValueTypes.Id64Array) as Id64[];
  }
  public async setId64s(variableId: string, value: Id64[]): Promise<void> {
    await this.setValue(variableId, VariableValueTypes.Id64Array, value);
  }
}
