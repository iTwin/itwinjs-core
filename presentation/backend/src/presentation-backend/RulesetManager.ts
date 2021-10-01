/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { RegisteredRuleset, Ruleset } from "@itwin/presentation-common";
import { NativePlatformDefinition } from "./NativePlatform";

/**
 * Presentation ruleset registry.
 * @public
 */
export interface RulesetManager {
  /**
   * Get a ruleset with the specified id.
   */
  get(id: string): RegisteredRuleset | undefined;

  /**
   * Register the supplied ruleset
   */
  add(ruleset: Ruleset): RegisteredRuleset;

  /**
   * Unregister the supplied ruleset
   */
  remove(ruleset: RegisteredRuleset | [string, string]): boolean;

  /**
   * Remove all rulesets registered in this session.
   */
  clear(): void;
}

/**
 * Presentation ruleset registry implementation.
 * @internal
 */
export class RulesetManagerImpl implements RulesetManager {

  private _getNativePlatform: () => NativePlatformDefinition;
  private _registeredRulesets = new Map<string, RegisteredRuleset>();

  constructor(getNativePlatform: () => NativePlatformDefinition) {
    this._getNativePlatform = getNativePlatform;
  }

  /**
   * Get a ruleset with the specified id.
   */
  public get(id: string): RegisteredRuleset | undefined {
    const foundRuleset = this._registeredRulesets.get(id);
    if (foundRuleset)
      return foundRuleset;

    const serializedRulesetsArray = this._getNativePlatform().getRulesets(id).result;
    const rulesetsArray: RulesetResponseJson[] = JSON.parse(serializedRulesetsArray);
    if (0 === rulesetsArray.length)
      return undefined;
    return this.saveRuleset(rulesetsArray[0].ruleset, rulesetsArray[0].hash, (ruleset: RegisteredRuleset) => this.remove(ruleset));
  }

  /**
   * Register the supplied ruleset
   */
  public add(ruleset: Ruleset): RegisteredRuleset {
    const foundRuleset = this._registeredRulesets.get(ruleset.id);
    if (foundRuleset)
      return foundRuleset;

    const hash = this._getNativePlatform().addRuleset(JSON.stringify(ruleset)).result;
    return this.saveRuleset(ruleset, hash, (r: RegisteredRuleset) => this.remove(r));
  }

  /**
   * Unregister the supplied ruleset
   */
  public remove(ruleset: RegisteredRuleset | [string, string]): boolean {
    let rulesetId, rulesetIdentifier: string;
    if (Array.isArray(ruleset)) {
      rulesetId = ruleset[0];
      rulesetIdentifier = ruleset[1];
    } else {
      rulesetId = ruleset.id;
      rulesetIdentifier = ruleset.uniqueIdentifier;
    }

    this._registeredRulesets.delete(rulesetId);
    return this._getNativePlatform().removeRuleset(rulesetId, rulesetIdentifier).result;
  }

  /**
   * Remove all rulesets registered in this session.
   */
  public clear(): void {
    this._getNativePlatform().clearRulesets();
    this._registeredRulesets.clear();
  }

  private saveRuleset(ruleset: Ruleset, hash: string, disposeFunc: (ruleset: RegisteredRuleset) => void) {
    const newRuleset = new RegisteredRuleset(ruleset, hash, disposeFunc);
    this._registeredRulesets.set(newRuleset.id, newRuleset);
    return newRuleset;
  }
}

interface RulesetResponseJson {
  ruleset: Ruleset;
  hash: string;
}
