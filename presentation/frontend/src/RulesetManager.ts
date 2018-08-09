/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import {
  PresentationRpcInterface,
  IRulesetManager, RegisteredRuleset, Ruleset,
} from "@bentley/presentation-common";
import { RulesetRpcRequestOptions } from "@bentley/presentation-common/lib/PresentationRpcInterface";

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
    const tuple = await PresentationRpcInterface.getClient().getRuleset(this.createRequestOptions(), id);
    if (tuple) {
      const [ruleset, hash] = tuple;
      return new RegisteredRuleset(this, ruleset, hash);
    }
    return undefined;
  }

  public async add(ruleset: Ruleset): Promise<RegisteredRuleset> {
    const hash = await PresentationRpcInterface.getClient().addRuleset(this.createRequestOptions(), ruleset);
    return new RegisteredRuleset(this, ruleset, hash);
  }

  public async remove(ruleset: RegisteredRuleset | [string, string]): Promise<boolean> {
    if (Array.isArray(ruleset))
      return await PresentationRpcInterface.getClient().removeRuleset(this.createRequestOptions(), ruleset[0], ruleset[1]);
    return await PresentationRpcInterface.getClient().removeRuleset(this.createRequestOptions(), ruleset.id, ruleset.hash);
  }

  public async clear(): Promise<void> {
    return await PresentationRpcInterface.getClient().clearRulesets(this.createRequestOptions());
  }

}
