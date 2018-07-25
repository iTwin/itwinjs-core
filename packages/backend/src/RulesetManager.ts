/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IRulesetManager, RegisteredRuleset, Ruleset } from "@bentley/ecpresentation-common";
import { NativePlatformDefinition } from "./NativePlatform";

/** @hidden */
export default class RulesetManager implements IRulesetManager {

  private _getNativePlatform: () => NativePlatformDefinition;

  constructor(getNativePlatform: () => NativePlatformDefinition) {
    this._getNativePlatform = getNativePlatform;
  }

  public async get(id: string): Promise<RegisteredRuleset | undefined> {
    const serializedRulesetsArray = this._getNativePlatform().getRulesets(id);
    const rulesetsArray: Ruleset[] = JSON.parse(serializedRulesetsArray);
    if (0 === rulesetsArray.length)
      return undefined;
    return new RegisteredRuleset(this, rulesetsArray[0]);
  }

  public async add(ruleset: Ruleset): Promise<RegisteredRuleset> {
    this._getNativePlatform().addRuleset(JSON.stringify(ruleset));
    return new RegisteredRuleset(this, ruleset);
  }

  public async remove(remove: Ruleset | string): Promise<void> {
    const rulesetId = (typeof remove === "string") ? remove : remove.id;
    this._getNativePlatform().removeRuleset(rulesetId);
  }

  public async clear(): Promise<void> {
    this._getNativePlatform().clearRulesets();
  }

}
