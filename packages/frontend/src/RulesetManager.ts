/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import {
  ECPresentationRpcInterface,
  IRulesetManager, RegisteredRuleset, Ruleset,
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

  public async get(id: string): Promise<RegisteredRuleset | undefined> {
    const ruleset = await ECPresentationRpcInterface.getClient().getRuleset(this.createRequestOptions(), id);
    if (ruleset)
      return new RegisteredRuleset(this, ruleset);
    return undefined;
  }

  public async add(ruleset: Ruleset): Promise<RegisteredRuleset> {
    await ECPresentationRpcInterface.getClient().addRuleset(this.createRequestOptions(), ruleset);
    return new RegisteredRuleset(this, ruleset);
  }

  public async remove(remove: Ruleset | string): Promise<void> {
    const rulesetId = (typeof remove === "string") ? remove : remove.id;
    return await ECPresentationRpcInterface.getClient().removeRuleset(this.createRequestOptions(), rulesetId);
  }

  public async clear(): Promise<void> {
    return await ECPresentationRpcInterface.getClient().clearRulesets(this.createRequestOptions());
  }

}
