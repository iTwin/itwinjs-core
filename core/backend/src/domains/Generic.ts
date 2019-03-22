/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { ClassRegistry } from "../ClassRegistry";
import { Schema, Schemas } from "../Schema";
import * as elementsModule from "./GenericElements";

/** @public */
export class Generic extends Schema {
  public static registerSchema() {
    Schemas.unregisterSchema(Generic.name);
    Schemas.registerSchema(new Generic());
  }
  private constructor() {
    super();
    ClassRegistry.registerModule(elementsModule, this);
  }
}
