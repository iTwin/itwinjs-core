/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ ClassRegistry.registerModule
import { ClassRegistry, Schema, Schemas } from "@bentley/imodeljs-backend";

// Import all modules that define classes in this schema.
import * as module1 from "./TestPartitionElement";
// ... other modules ...

/** An example of defining a class that represents a schema. Normally, you would define a schema class like this
 * by first generating an ECSchema and then generating a Schema definition like this from it.
 * Note that you do not have to define a Schema in order to work with elements in that schema.
 */
export class TestSchema extends Schema {

  /** An app must call this to register the TestSchema schema prior to using it. */
  public static registerSchema() {
    if (!Schemas.getRegisteredSchema(TestSchema.name))
      Schemas.registerSchema(new TestSchema());
  }

  // Registers all classes of the TestSchema schema.
  private constructor() {
    super();
    // Register all modules that define classes in this schema. ClassRegistry detects all classes defined by each module and registers them.
    ClassRegistry.registerModule(module1, this);
    // ... other modules ...
  }
}
// __PUBLISH_EXTRACT_END__
