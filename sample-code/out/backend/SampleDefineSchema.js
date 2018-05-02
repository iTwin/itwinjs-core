"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ ClassRegistry.registerModule
const imodeljs_backend_1 = require("@bentley/imodeljs-backend");
// Import all modules that define classes in this schema.
const module1 = require("./TestPartitionElement");
// ... other modules ...
/** An example of defining a class that represents a schema.
 * Normally, you would define a schema class like this by first
 * generating an ECSchema and then generating a Schema definition
 * like this from it. Note that you do not have to define a Schema
 * to work with elements in that schema.
 */
class TestSchema extends imodeljs_backend_1.Schema {
    /** An app must call this to register the TestSchema schema prior to using it. */
    static registerSchema() {
        // Make sure that this Schema is registered.
        // An app may call this more than once. Make sure that's harmless.
        if (imodeljs_backend_1.Schemas.getRegisteredSchema(TestSchema.name) !== undefined)
            return;
        imodeljs_backend_1.Schemas.registerSchema(new TestSchema());
        // Make sure that this schema is imported into each model that is opened.
        imodeljs_backend_1.IModelDb.onOpened.addListener((imodeldb) => {
            if (TestSchema.getClass("TestPartitionElement", imodeldb) === undefined) {
                // Must import the schema. The schema must have been delivered by the app in the
                // assets directory. Note that, for portability, make sure the case of
                // the filename is correct!
                imodeldb.importSchema(imodeljs_backend_1.KnownLocations.assetsDir + "/TestSchema.ecschema.xml");
            }
        });
    }
    // Registers all classes of the TestSchema schema.
    constructor() {
        super();
        // Register all modules that define classes in this schema.
        // ClassRegistry detects all classes defined by each module and registers them.
        imodeljs_backend_1.ClassRegistry.registerModule(module1, this);
        // ... other modules ...
    }
}
exports.TestSchema = TestSchema;
// __PUBLISH_EXTRACT_END__
//# sourceMappingURL=SampleDefineSchema.js.map