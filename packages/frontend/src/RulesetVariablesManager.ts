/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64 } from "@bentley/bentleyjs-core";
import { IRulesetVariablesManager } from "@bentley/presentation-common";
import { PresentationRpcInterface } from "@bentley/presentation-common";
import { VariableValueTypes, VariableValueJSON } from "@bentley/presentation-common/lib/IRulesetVariablesManager";
import { RulesetVariableRpcRequestOptions } from "@bentley/presentation-common/lib/PresentationRpcInterface";

/** @hidden */
export default class RulesetVariablesManager implements IRulesetVariablesManager {
  private _clientId: string;
  private _rulesetId: string;
  public constructor(clientId: string, rulesetId: string) {
    this._clientId = clientId;
    this._rulesetId = rulesetId;
  }
  private createRequestOptions(variableId: string): RulesetVariableRpcRequestOptions {
    return {
      clientId: this._clientId,
      rulesetId: this._rulesetId,
      variableId,
    };
  }

  private async getValue(variableId: string, variableType: VariableValueTypes): Promise<VariableValueJSON> {
    return await PresentationRpcInterface.getClient().getRulesetVariableValue(this.createRequestOptions(variableId), variableType);
  }

  public async getString(variableId: string): Promise<string> {
    return await this.getValue(variableId, VariableValueTypes.String) as string;
  }
  public async setString(variableId: string, value: string): Promise<void> {
    await PresentationRpcInterface.getClient().setRulesetVariableValue(this.createRequestOptions(variableId), VariableValueTypes.String, value);
  }

  public async getBool(variableId: string): Promise<boolean> {
    return await this.getValue(variableId, VariableValueTypes.Bool) as boolean;
  }
  public async setBool(variableId: string, value: boolean): Promise<void> {
    await PresentationRpcInterface.getClient().setRulesetVariableValue(this.createRequestOptions(variableId), VariableValueTypes.Bool, value);
  }

  public async getInt(variableId: string): Promise<number> {
    return await this.getValue(variableId, VariableValueTypes.Int) as number;
  }
  public async setInt(variableId: string, value: number): Promise<void> {
    await PresentationRpcInterface.getClient().setRulesetVariableValue(this.createRequestOptions(variableId), VariableValueTypes.Int, value);
  }

  public async getInts(variableId: string): Promise<number[]> {
    return await this.getValue(variableId, VariableValueTypes.IntArray) as number[];
  }
  public async setInts(variableId: string, value: number[]): Promise<void> {
    await PresentationRpcInterface.getClient().setRulesetVariableValue(this.createRequestOptions(variableId), VariableValueTypes.IntArray, value);
  }

  public async getId64(variableId: string): Promise<Id64> {
    return new Id64(await this.getValue(variableId, VariableValueTypes.Id64) as string);
  }
  public async setId64(variableId: string, value: Id64): Promise<void> {
    await PresentationRpcInterface.getClient().setRulesetVariableValue(this.createRequestOptions(variableId), VariableValueTypes.Id64, value.value);
  }

  public async getId64s(variableId: string): Promise<Id64[]> {
    return (await this.getValue(variableId, VariableValueTypes.Id64Array) as string[]).map((v) => new Id64(v));
  }
  public async setId64s(variableId: string, value: Id64[]): Promise<void> {
    await PresentationRpcInterface.getClient().setRulesetVariableValue(this.createRequestOptions(variableId),
      VariableValueTypes.Id64Array, value.map((v) => v.value));
  }
}
