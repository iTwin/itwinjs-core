/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { ClassRegistry, Schema, Schemas } from "@bentley/imodeljs-backend";
import * as RulesetElements from "./RulesetElements";

/** @internal */
export class PresentationRules extends Schema {
  public static get schemaName(): string { return "PresentationRules"; }

  /** Registers this schema and it's elements' classes */
  public static registerSchema(): void {
    if (this !== Schemas.getRegisteredSchema(PresentationRules.schemaName)) {
      Schemas.registerSchema(PresentationRules);
      ClassRegistry.registerModule(RulesetElements, this);
    }
  }
}

/** @internal */
/* istanbul ignore next */
export namespace PresentationRules {
  export enum CodeSpec {
    Ruleset = "PresentationRules:Ruleset",
  }
}
