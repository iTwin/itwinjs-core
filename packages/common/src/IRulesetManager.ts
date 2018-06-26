/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IDisposable } from "@bentley/bentleyjs-core";
import { PresentationRuleSet, PresentationRule, UserSettingsGroup, ContentModifier } from "./rules";

/**
 * A ruleset that is registered in a ruleset manager.
 */
export class RegisteredRuleSet implements IDisposable, PresentationRuleSet {
  private _manager: IRulesetManager;
  private _ruleset: PresentationRuleSet;
  public constructor(manager: IRulesetManager, ruleset: PresentationRuleSet) {
    this._manager = manager;
    this._ruleset = ruleset;
  }
  public dispose() {
    this._manager.remove(this);
  }
  public get ruleSetId(): string { return this._ruleset.ruleSetId; }
  public get supportedSchemas(): string | undefined { return this._ruleset.supportedSchemas; }
  public get isSupplemental(): boolean | undefined { return this._ruleset.isSupplemental; }
  public get supplementalPurpose(): string | undefined { return this._ruleset.supplementalPurpose; }
  public get versionMajor(): number | undefined { return this._ruleset.versionMajor; }
  public get versionMinor(): number | undefined { return this._ruleset.versionMinor; }
  public get rules(): PresentationRule[] | undefined { return this._ruleset.rules; }
  public get contentModifiers(): ContentModifier[] | undefined { return this._ruleset.contentModifiers; }
  public get userSettings(): UserSettingsGroup[] | undefined { return this._ruleset.userSettings; }
}

/**
 * Interface for manager which stores rulesets.
 */
export interface IRulesetManager {
  /**
   * Get a ruleset with the specified id.
   */
  get(id: string): Promise<RegisteredRuleSet>;

  /**
   * Register the supplied ruleset
   */
  add(ruleset: PresentationRuleSet): Promise<RegisteredRuleSet>;

  /**
   * Unregister the supplied ruleset
   */
  remove(remove: PresentationRuleSet | string): Promise<void>;

  /**
   * Removes all rulesets registered in this session.
   */
  clear(): Promise<void>;
}
