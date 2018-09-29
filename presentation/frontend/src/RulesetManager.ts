/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { BeEvent, Guid } from "@bentley/bentleyjs-core";
import { IRulesetManager, Ruleset, RegisteredRuleset } from "@bentley/presentation-common";
import { IClientStateHolder } from "@bentley/presentation-common/lib/RpcRequestsHandler";

/** @hidden */
export default class RulesetManager implements IRulesetManager, IClientStateHolder<IRulesetManager.State> {

  private _clientRulesets = new Map<string, RegisteredRuleset[]>();
  public key = IRulesetManager.STATE_ID;
  public onStateChanged = new BeEvent<() => void>();

  public get state(): IRulesetManager.State {
    const rulesets: IRulesetManager.State = [];
    this._clientRulesets.forEach((m) => {
      m.forEach((r) => rulesets.push(r.toJSON()));
    });
    return rulesets;
  }

  public async get(id: string): Promise<RegisteredRuleset | undefined> {
    const m = this._clientRulesets.get(id);
    if (!m)
      return undefined;
    return m[0];
  }

  public async add(ruleset: Ruleset): Promise<RegisteredRuleset> {
    const registered = new RegisteredRuleset(this, ruleset, Guid.createValue());
    if (!this._clientRulesets.has(ruleset.id))
      this._clientRulesets.set(ruleset.id, []);
    this._clientRulesets.get(ruleset.id)!.push(registered);
    this.onStateChanged.raiseEvent();
    return registered;
  }

  public async remove(ruleset: RegisteredRuleset | [string, string]): Promise<boolean> {
    let rulesetId, uniqueIdentifier: string;
    if (Array.isArray(ruleset)) {
      rulesetId = ruleset[0];
      uniqueIdentifier = ruleset[1];
    } else {
      rulesetId = ruleset.id;
      uniqueIdentifier = ruleset.uniqueIdentifier;
    }

    const m = this._clientRulesets.get(rulesetId);
    if (!m)
      return false;

    let didRemove = false;
    for (let i = 0; i < m.length; ++i) {
      if (m[i].uniqueIdentifier === uniqueIdentifier) {
        m.splice(i, 1);
        didRemove = true;
        break;
      }
    }

    if (didRemove)
      this.onStateChanged.raiseEvent();

    return didRemove;
  }

  public async clear(): Promise<void> {
    if (0 === this._clientRulesets.size)
      return;

    this._clientRulesets.clear();
    this.onStateChanged.raiseEvent();
  }

}
