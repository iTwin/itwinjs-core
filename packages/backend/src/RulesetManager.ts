/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IRulesetManager, RegisteredRuleSet, PresentationRuleSet } from "@bentley/ecpresentation-common";
import { NativePlatformDefinition } from "./NativePlatform";

/** @hidden */
export default class RulesetManager implements IRulesetManager {

  private _getNativePlatform: () => NativePlatformDefinition;

  constructor(getNativePlatform: () => NativePlatformDefinition) {
    this._getNativePlatform = getNativePlatform;
  }

  public async get(_id: string): Promise<RegisteredRuleSet> {
    throw new Error("Not implemented");
    /*const response = this._getNativeAddon().getRuleSet(id);
    if (!response)
      throw new ECPresentationError(ECPresentationStatus.InvalidResponse);
    if (response.error)
      throw new ECPresentationError(ECPresentationStatus.Error, response.error.message);
    if (response.result === undefined)
      throw new ECPresentationError(ECPresentationStatus.InvalidResponse);
    const serializedRuleset: string = response.result;
    const ruleset: PresentationRuleSet = JSON.parse(serializedRuleset);
    return new RegisteredRuleSet(this, ruleset);*/
  }

  public async add(ruleset: PresentationRuleSet): Promise<RegisteredRuleSet> {
    this._getNativePlatform().addRuleSet(JSON.stringify(ruleset));
    return new RegisteredRuleSet(this, ruleset);
  }

  public async remove(remove: PresentationRuleSet | string): Promise<void> {
    const rulesetId = (typeof remove === "string") ? remove : remove.ruleSetId;
    this._getNativePlatform().removeRuleSet(rulesetId);
  }

  public async clear(): Promise<void> {
    this._getNativePlatform().clearRuleSets();
  }

}
