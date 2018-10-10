/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { BeEvent, Guid } from "@bentley/bentleyjs-core";
import { RulesetManagerState, Ruleset, RegisteredRuleset } from "@bentley/presentation-common";
import { IClientStateHolder } from "@bentley/presentation-common/lib/RpcRequestsHandler";

/** @hidden */
export default class RulesetManager implements IClientStateHolder<RulesetManagerState> {

  private _clientRulesets = new Map<string, RegisteredRuleset[]>();
  public key = RulesetManagerState.STATE_ID;
  public onStateChanged = new BeEvent<() => void>();

  public get state(): RulesetManagerState {
    const rulesets: RulesetManagerState = [];
    this._clientRulesets.forEach((m) => {
      m.forEach((r) => rulesets.push(r.toJSON()));
    });
    return rulesets;
  }

  /**
   * Get a ruleset with the specified id.
   */
  public async get(id: string): Promise<RegisteredRuleset | undefined> {
    const m = this._clientRulesets.get(id);
    if (!m)
      return undefined;
    return m[0];
  }

  /**
   * Register the supplied ruleset
   */
  public async add(ruleset: Ruleset): Promise<RegisteredRuleset> {
    const registered = new RegisteredRuleset(ruleset, Guid.createValue(), (ruleset: RegisteredRuleset) => this.remove(ruleset));
    if (!this._clientRulesets.has(ruleset.id))
      this._clientRulesets.set(ruleset.id, []);
    this._clientRulesets.get(ruleset.id)!.push(registered);
    this.onStateChanged.raiseEvent();
    return registered;
  }

  /**
   * Unregister the supplied ruleset
   */
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

  /**
   * Remove all rulesets registered in this session.
   */
  public async clear(): Promise<void> {
    if (0 === this._clientRulesets.size)
      return;

    this._clientRulesets.clear();
    this.onStateChanged.raiseEvent();
  }

}
