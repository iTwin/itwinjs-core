/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { IDisposable } from "@bentley/bentleyjs-core";
import { Rule } from "./rules/Rule";
import { Ruleset, SupplementationInfo } from "./rules/Ruleset";
import { SchemasSpecification } from "./rules/SchemasSpecification";
import { VariablesGroup } from "./rules/Variables";

/**
 * A ruleset that is registered in a ruleset manager.
 * @public
 */
export class RegisteredRuleset implements IDisposable, Ruleset {
  private _ruleset: Ruleset;
  private _uniqueIdentifier: string;
  private _disposeFunc: (ruleset: RegisteredRuleset) => void;

  /** Create a registered ruleset */
  public constructor(ruleset: Ruleset, uniqueIdentifier: string, disposeFunc: (ruleset: RegisteredRuleset) => void) {
    this._disposeFunc = disposeFunc;
    this._ruleset = ruleset;
    this._uniqueIdentifier = uniqueIdentifier;
  }

  /** Dispose registered ruleset. */
  public dispose() {
    this._disposeFunc(this);
  }

  public get uniqueIdentifier() { return this._uniqueIdentifier; }
  public get id(): string { return this._ruleset.id; }
  public get supportedSchemas(): SchemasSpecification | undefined {
    // eslint-disable-next-line deprecation/deprecation
    return this._ruleset.supportedSchemas;
  }
  public get supplementationInfo(): SupplementationInfo | undefined { return this._ruleset.supplementationInfo; }
  public get rules(): Rule[] { return this._ruleset.rules; }
  public get vars(): VariablesGroup[] | undefined { return this._ruleset.vars; }
  public toJSON(): Ruleset { return this._ruleset; }
}
