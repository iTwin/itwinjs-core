/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { BeEvent, Guid } from "@itwin/core-bentley";
import { RegisteredRuleset, Ruleset } from "@itwin/presentation-common";

/**
 * Presentation ruleset registry.
 * @public
 */
export interface RulesetManager {
  /** @alpha */
  onRulesetModified: BeEvent<(curr: RegisteredRuleset, prev: Ruleset) => void>;

  /**
   * Get a ruleset with the specified id.
   */
  get(id: string): Promise<RegisteredRuleset | undefined>;

  /**
   * Register the supplied ruleset
   */
  add(ruleset: Ruleset): Promise<RegisteredRuleset>;

  /**
   * Modify the given pre-registered ruleset
   * @alpha
   */
  modify(ruleset: RegisteredRuleset, newRules: Omit<Ruleset, "id">): Promise<RegisteredRuleset>;

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
  public onRulesetModified = new BeEvent<(curr: RegisteredRuleset, prev: Ruleset) => void>();

  public static create() {
    return new RulesetManagerImpl();
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
    const registered = new RegisteredRuleset(ruleset, Guid.createValue(), async (r: RegisteredRuleset) => this.remove(r));
    if (!this._clientRulesets.has(ruleset.id))
      this._clientRulesets.set(ruleset.id, []);
    this._clientRulesets.get(ruleset.id)!.push(registered);
    return registered;
  }

  /**
   * Modifies the given pre-registered ruleset
   */
  public async modify(ruleset: RegisteredRuleset, newRules: Omit<Ruleset, "id">): Promise<RegisteredRuleset> {
    await this.remove(ruleset);
    const modified = await this.add({ ...newRules, id: ruleset.id });
    this.onRulesetModified.raiseEvent(modified, ruleset.toJSON());
    return modified;
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
