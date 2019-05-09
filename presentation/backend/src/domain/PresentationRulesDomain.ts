/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Schema, Schemas, ClassRegistry } from "@bentley/imodeljs-backend";
import * as RulesetElements from "./RulesetElements";

/** @hidden */
export class PresentationRules extends Schema {
  public static get schemaName(): string { return "PresentationRules"; }

  /** Registers this schema and it's elements' classes */
  public static registerSchema() {
    if (this !== Schemas.getRegisteredSchema(PresentationRules.schemaName)) {
      Schemas.registerSchema(PresentationRules);
      ClassRegistry.registerModule(RulesetElements, this);
    }
  }
}

/** @hidden */
/* istanbul ignore next */
export namespace PresentationRules {
  export enum CodeSpec {
    Ruleset = "PresentationRules:Ruleset",
  }
}
