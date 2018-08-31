/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { ClassRegistry } from "../ClassRegistry";
import { Schema, Schemas } from "../Schema";
import * as elementsModule from "./FunctionalElements";

export class Functional extends Schema {
  public static registerSchema() {
    if (!Schemas.getRegisteredSchema(Functional.name))
      Schemas.registerSchema(new Functional());

  }
  private constructor() {
    super();
    ClassRegistry.registerModule(elementsModule, this);
  }
}
