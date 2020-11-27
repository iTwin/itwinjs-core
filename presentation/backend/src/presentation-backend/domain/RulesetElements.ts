/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { DefinitionElement, IModelDb } from "@bentley/imodeljs-backend";
import { Code } from "@bentley/imodeljs-common";
import { PresentationRules } from "./PresentationRulesDomain";

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
  public static createRulesetCode(modelId: Id64String, rulesetId: string, iModelDb: IModelDb): Code {
    return new Code({
      spec: iModelDb.codeSpecs.getByName(PresentationRules.CodeSpec.Ruleset).id,
      scope: modelId.toString(),
      value: rulesetId,
    });
  }
}
