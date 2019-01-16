/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Schema, Schemas, ClassRegistry } from "@bentley/imodeljs-backend";
import * as RulesetElements from "./RulesetElements";

/** @hidden */
export class PresentationRules extends Schema {

  /**
   * Registers this schema and it's elements' classes
   */
  public static registerSchema() {
    if (!Schemas.getRegisteredSchema(PresentationRules.name))
      Schemas.registerSchema(new PresentationRules());
  }

  private constructor() {
    super();
    ClassRegistry.registerModule(RulesetElements, this);
  }
}

/** @hidden */
/* istanbul ignore next */
export namespace PresentationRules {
  export const enum CodeSpec {
    Ruleset = "PresentationRules:Ruleset",
  }
}
