/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import {
  ECPresentationRpcInterface,
  IRulesetManager, RegisteredRuleSet, PresentationRuleSet,
} from "@bentley/ecpresentation-common";
import { RulesetRpcRequestOptions } from "@bentley/ecpresentation-common/lib/ECPresentationRpcInterface";

/** @hidden */
export default class RulesetManager implements IRulesetManager {

  private _clientId: string;

  public constructor(clientId: string) {
    this._clientId = clientId;
  }

  private createRequestOptions(): RulesetRpcRequestOptions {
    return {
      clientId: this._clientId,
    };
  }

  public async get(_id: string): Promise<RegisteredRuleSet> {
    throw new Error("Not implemented");
    /*const response = this._getNativeAddon().getRuleSet(id);
    if (!response)
      throw new ECPresentationError(ECPresentationStatus.InvalidResponse);
    if (response.error)
      throw new ECPresentationError(ECPresentationStatus.Error, response.error.message);
    if (response.result === undefined)
      throw new ECPresentationError(ECPresentationStatus.InvalidResponse);
    const serializedRuleset: string = response.result;
    const ruleset: PresentationRuleSet = JSON.parse(serializedRuleset);
    return new RegisteredRuleSet(this, ruleset);*/
  }

  public async add(ruleset: PresentationRuleSet): Promise<RegisteredRuleSet> {
    await ECPresentationRpcInterface.getClient().addRuleset(this.createRequestOptions(), ruleset);
    return new RegisteredRuleSet(this, ruleset);
  }

  public async remove(remove: PresentationRuleSet | string): Promise<void> {
    const rulesetId = (typeof remove === "string") ? remove : remove.ruleSetId;
    return await ECPresentationRpcInterface.getClient().removeRuleset(this.createRequestOptions(), rulesetId);
  }

  public async clear(): Promise<void> {
    return await ECPresentationRpcInterface.getClient().clearRulesets(this.createRequestOptions());
  }

}
