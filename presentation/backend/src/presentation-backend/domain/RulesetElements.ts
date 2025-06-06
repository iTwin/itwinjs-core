/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { Id64String } from "@itwin/core-bentley";
import { DefinitionElement, IModelDb } from "@itwin/core-backend";
import { Code } from "@itwin/core-common";
import { Ruleset as PresentationRuleset } from "@itwin/presentation-common";
import { normalizeVersion } from "../Utils.js";
import { PresentationRules } from "./PresentationRulesDomain.js";

/** @internal */
export class Ruleset extends DefinitionElement {
  /**
   * Name of the `Ruleset` element class.
   */
  public static override get className(): string {
    return "Ruleset";
  }

  /**
   * Generates a unique code for a ruleset
   * @param iModelDb DB the ruleset is supposed to be inserted into
   * @param modelId ID of a the model this ruleset should be created in
   * @param ruleset The ruleset code is being created for
   */
  public static createRulesetCode(iModelDb: IModelDb, modelId: Id64String, ruleset: PresentationRuleset) {
    let codeValue = ruleset.id;
    if (ruleset.version) {
      codeValue += `@${normalizeVersion(ruleset.version)}`;
    }

    return new Code({
      spec: iModelDb.codeSpecs.getByName(PresentationRules.CodeSpec.Ruleset).id,
      scope: modelId.toString(),
      value: codeValue,
    });
  }
}
