/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import { IDisposable } from "@bentley/bentleyjs-core";
import { Ruleset, Rule, VariablesGroup, SupplementationInfo, SchemasSpecification } from "./rules";

/**
 * A ruleset that is registered in a ruleset manager.
 */
export class RegisteredRuleset implements IDisposable, Ruleset {
  private _manager: IRulesetManager;
  private _ruleset: Ruleset;
  private _uniqueIdentifier: string;
  public constructor(manager: IRulesetManager, ruleset: Ruleset, uniqueIdentifier: string) {
    this._manager = manager;
    this._ruleset = ruleset;
    this._uniqueIdentifier = uniqueIdentifier;
  }
  public dispose() {
    this._manager.remove(this);
  }
  public get uniqueIdentifier() { return this._uniqueIdentifier; }
  public get id(): string { return this._ruleset.id; }
  public get supportedSchemas(): SchemasSpecification | undefined { return this._ruleset.supportedSchemas; }
  public get supplementationInfo(): SupplementationInfo | undefined { return this._ruleset.supplementationInfo; }
  public get rules(): Rule[] { return this._ruleset.rules; }
  public get vars(): VariablesGroup[] | undefined { return this._ruleset.vars; }
  public toJSON(): Ruleset { return this._ruleset; }
}

/**
 * Interface for manager which stores rulesets.
 */
export interface IRulesetManager {
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
  remove(remove: RegisteredRuleset | [string, string]): Promise<boolean>;

  /**
   * Remove all rulesets registered in this session.
   */
  clear(): Promise<void>;
}

export namespace IRulesetManager {
  export const STATE_ID = "rulesets";
  export type State = Ruleset[];
}
