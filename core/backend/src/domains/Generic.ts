/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { ClassRegistry } from "../ClassRegistry";
import { Schema, Schemas } from "../Schema";
import * as elementsModule from "./GenericElements";

/** @public */
export class GenericSchema extends Schema {
  public static get schemaName(): string { return "Generic"; }
  public static registerSchema() {
    if (this !== Schemas.getRegisteredSchema(this.schemaName)) {
      Schemas.unregisterSchema(this.schemaName);
      Schemas.registerSchema(this);
      ClassRegistry.registerModule(elementsModule, this);
    }
  }
}
