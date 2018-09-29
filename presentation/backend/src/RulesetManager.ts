/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IRulesetManager, RegisteredRuleset, Ruleset } from "@bentley/presentation-common";
import { NativePlatformDefinition } from "./NativePlatform";

/** @hidden */
export default class RulesetManager implements IRulesetManager {

  private _getNativePlatform: () => NativePlatformDefinition;

  constructor(getNativePlatform: () => NativePlatformDefinition) {
    this._getNativePlatform = getNativePlatform;
  }

  public async get(id: string): Promise<RegisteredRuleset | undefined> {
    const serializedRulesetsArray = this._getNativePlatform().getRulesets(id);
    const rulesetsArray: RulesetResponseJson[] = JSON.parse(serializedRulesetsArray);
    if (0 === rulesetsArray.length)
      return undefined;
    return new RegisteredRuleset(this, rulesetsArray[0].ruleset, rulesetsArray[0].hash);
  }

  public async add(ruleset: Ruleset): Promise<RegisteredRuleset> {
    const hash = this._getNativePlatform().addRuleset(JSON.stringify(ruleset));
    return new RegisteredRuleset(this, ruleset, hash);
  }

  public async remove(ruleset: RegisteredRuleset | [string, string]): Promise<boolean> {
    if (Array.isArray(ruleset))
      return this._getNativePlatform().removeRuleset(ruleset[0], ruleset[1]);
    return this._getNativePlatform().removeRuleset(ruleset.id, ruleset.uniqueIdentifier);
  }

  public async clear(): Promise<void> {
    this._getNativePlatform().clearRulesets();
  }
}

interface RulesetResponseJson {
  ruleset: Ruleset;
  hash: string;
}
