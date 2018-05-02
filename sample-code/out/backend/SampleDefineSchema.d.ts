import { Schema } from "@bentley/imodeljs-backend";
/** An example of defining a class that represents a schema.
 * Normally, you would define a schema class like this by first
 * generating an ECSchema and then generating a Schema definition
 * like this from it. Note that you do not have to define a Schema
 * to work with elements in that schema.
 */
export declare class TestSchema extends Schema {
    /** An app must call this to register the TestSchema schema prior to using it. */
    static registerSchema(): void;
    private constructor();
}
