/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IDisposable } from "@bentley/bentleyjs-core";
import {
  RpcRequestsHandler,
  IRulesetManager, RegisteredRuleset, Ruleset,
} from "@bentley/presentation-common";

/** @hidden */
export default class RulesetManager implements IRulesetManager, IDisposable {

  private _requestsHandler: RpcRequestsHandler;
  private _clientRulesets = new Map<string, Ruleset>();

  public constructor(requestsHandler: RpcRequestsHandler) {
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
    if (0 === this._clientRulesets.size)
      return;

    const rulesets: Ruleset[] = [];
    this._clientRulesets.forEach((r) => rulesets.push(r));
    await this._requestsHandler.addRulesets(rulesets);
  }

  public async get(id: string): Promise<RegisteredRuleset | undefined> {
    const tuple = await this._requestsHandler.getRuleset(id);
    if (tuple) {
      const [ruleset, hash] = tuple;
      return new RegisteredRuleset(this, ruleset, hash);
    }
    return undefined;
  }

  public async add(ruleset: Ruleset): Promise<RegisteredRuleset> {
    this._clientRulesets.set(ruleset.id, ruleset);
    const hash = await this._requestsHandler.addRuleset(ruleset);
    return new RegisteredRuleset(this, ruleset, hash);
  }

  public async remove(ruleset: RegisteredRuleset | [string, string]): Promise<boolean> {
    let id = "", hash = "";
    if (Array.isArray(ruleset)) {
      id = ruleset[0];
      hash = ruleset[1];
    } else {
      id = ruleset.id;
      hash = ruleset.hash;
    }
    this._clientRulesets.delete(id);
    return await this._requestsHandler.removeRuleset(id, hash);
  }

  public async clear(): Promise<void> {
    this._clientRulesets.clear();
    await this._requestsHandler.clearRulesets();
  }

}
