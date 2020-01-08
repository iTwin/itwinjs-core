/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Guid } from "@bentley/bentleyjs-core";
import { Ruleset, RegisteredRuleset } from "@bentley/presentation-common";

/**
 * Presentation ruleset registry.
 * @public
 */
export interface RulesetManager {
  /**
   * Get a ruleset with the specified id.
   */
  get(id: string): Promise<RegisteredRuleset | undefined>;

  /**
   * Register the supplied ruleset
   */
  add(ruleset: Ruleset): Promise<RegisteredRuleset>;

  /**
   * Unregister the supplied ruleset
   */
  remove(ruleset: RegisteredRuleset | [string, string]): Promise<boolean>;

  /**
   * Remove all rulesets registered in this session.
   */
  clear(): Promise<void>;
}

/** @internal */
export class RulesetManagerImpl implements RulesetManager {

  private _clientRulesets = new Map<string, RegisteredRuleset[]>();

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
    const registered = new RegisteredRuleset(ruleset, Guid.createValue(), (r: RegisteredRuleset) => this.remove(r));
    if (!this._clientRulesets.has(ruleset.id))
      this._clientRulesets.set(ruleset.id, []);
    this._clientRulesets.get(ruleset.id)!.push(registered);
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

    return didRemove;
  }

  /**
   * Remove all rulesets registered in this session.
   */
  public async clear(): Promise<void> {
    if (0 === this._clientRulesets.size)
      return;

    this._clientRulesets.clear();
  }

}
