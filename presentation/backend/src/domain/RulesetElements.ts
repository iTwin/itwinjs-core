/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { DefinitionElement, IModelDb } from "@bentley/imodeljs-backend";
import { Code } from "@bentley/imodeljs-common";
import { PresentationRules } from "./PresentationRulesDomain";
import { Id64String } from "@bentley/bentleyjs-core";

/** @internal */
export class Ruleset extends DefinitionElement {
  /**
   * Name of the `Ruleset` element class.
   */
  public static get className(): string { return "Ruleset"; }

  /**
   * Generates a unique code for a ruleset
   * @param modelId     - ID of a the model this ruleset should be created in
   * @param rulesetId   - ID of the ruleset code is being created for (to ensure uniqueness for different rules)
   * @param iModelDb    - db the ruleset is supposed to be inserted into
   */
  public static createRulesetCode(modelId: Id64String, rulesetId: string, iModelDb: IModelDb) {
    return new Code({
      spec: iModelDb.codeSpecs.getByName(PresentationRules.CodeSpec.Ruleset).id,
      scope: modelId.toString(),
      value: rulesetId,
    });
  }
}
