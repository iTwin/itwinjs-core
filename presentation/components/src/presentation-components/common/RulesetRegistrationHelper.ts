/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import type { IDisposable } from "@itwin/core-bentley";
import type { Ruleset } from "@itwin/presentation-common";
import { RegisteredRuleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";

/**
 * A helper class that registers a given ruleset on create and unregisters it on disposal.
 * @internal
 */
export class RulesetRegistrationHelper implements IDisposable {
  private _rulesetId: string;
  private _registeredRuleset?: RegisteredRuleset;
  private _isDisposed?: boolean;

  /** Constructor. Registers the ruleset if necessary */
  public constructor(ruleset: Ruleset | string) {
    this._rulesetId = (typeof ruleset === "string") ? ruleset : ruleset.id;
    if (typeof ruleset === "object") {
      this.registerRuleset(ruleset); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  /** Destructor. Must be called to clean up.  */
  public dispose() {
    this._isDisposed = true;
    this.disposeRegisteredRuleset();
  }

  /** Get ID of the ruleset. */
  public get rulesetId() { return this._rulesetId; }

  private disposeRegisteredRuleset() {
    if (!this._registeredRuleset)
      return;

    this._registeredRuleset.dispose();
    this._registeredRuleset = undefined;
  }

  private async registerRuleset(ruleset: Ruleset) {
    this._registeredRuleset = await Presentation.presentation.rulesets().add(ruleset instanceof RegisteredRuleset ? ruleset.toJSON() : ruleset);
    if (this._isDisposed) {
      // ensure we don't keep a hanging registered ruleset if the instance
      // gets disposed before the ruleset finishes registration
      this.disposeRegisteredRuleset();
    }
  }
}
