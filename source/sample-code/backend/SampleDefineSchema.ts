/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ ClassRegistry.registerModule
import { ClassRegistry, Schema, Schemas, IModelDb, KnownLocations } from "@bentley/imodeljs-backend";

// Import all modules that define classes in this schema.
import * as module1 from "./TestPartitionElement";
// ... other modules ...

/** An example of defining a class that represents a schema.
 * Normally, you would define a schema class like this by first
 * generating an ECSchema and then generating a Schema definition
 * like this from it. Note that you do not have to define a Schema
 * in order to work with elements in that schema.
 */
export class TestSchema extends Schema {

  /** An app must call this to register the TestSchema schema prior to using it. */
  public static registerSchema() {
    // Make sure that this Schema is registered. 
    // An app may call this more than once. Make sure that's harmless.
    if (Schemas.getRegisteredSchema(TestSchema.name) !== undefined)
      return;

    Schemas.registerSchema(new TestSchema());

    // Make sure that this schema is imported into each model that is opened.
    IModelDb.onOpened.addListener((imodeldb: IModelDb) => {
      if (TestSchema.getClass("TestPartitionElement", imodeldb) === undefined) {
        // Must import the schema. The schema must have been delivered by the app in the
        // assets directory. Note that, for portability, make sure the case of 
        // the filename is correct!
        imodeldb.importSchema(KnownLocations.assetsDir + "/TestSchema.ecschema.xml");
      }
    });
  }

  // Registers all classes of the TestSchema schema.
  private constructor() {
    super();
    // Register all modules that define classes in this schema.
    // ClassRegistry detects all classes defined by each module and registers them.
    ClassRegistry.registerModule(module1, this);
    // ... other modules ...
  }
}
// __PUBLISH_EXTRACT_END__
