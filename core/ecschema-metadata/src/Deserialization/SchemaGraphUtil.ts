/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import Schema from "./../Metadata/Schema";

/** Utility class for working with Schema graphs. */
export default class SchemaGraphUtil {
  /**
   * Creates a flattened list of schemas in topological order, typically used before schema import
   * so that dependent schemas are processed after their references.
   * @param insertSchema The schema to be imported.
   * @param schemas The schema collection that will hold the ordered schemas. If null, the collection
   * will be created internally and passed along during recursive calls.
   */
  public static buildDependencyOrderedSchemaList(insertSchema: Schema, schemas?: Schema[]): Schema[] {
    if (!schemas)
      schemas = [];

    this.insertSchemaInDependencyOrderedList(schemas, insertSchema);
    for (const reference of insertSchema.references) {
      this.buildDependencyOrderedSchemaList(reference, schemas);
    }
    return schemas;
  }

  /**
   * Indicates if the given Schema references the possibleDependency Schema.
   * @param schema The possible dependent schema.
   * @param possibleDependency The possible Schema dependency.
   */
  private static dependsOn(schema: Schema, possibleDependency: Schema): boolean {
    if (this.directlyReferences(schema, possibleDependency))
      return true;

    // Possible SupplementalSchema support?
    // ...
    return false;
  }

  /**
   * Indicates if the given Schema directly references the possiblyReferencedSchema Schema.
   * @param schema The possible parent schema.
   * @param possibleDependency The Schema that may be referenced.
   */
  private static directlyReferences(schema: Schema, possiblyReferencedSchema: Schema): boolean {
    for (const reference of schema.references) {
      if (reference === possiblyReferencedSchema)
        return true;
    }

    return false;
  }

  /**
   * Helper method that manages the insertion of a Schema into the schemas collection
   * based on the topological ordering algorithm.
   * @param schemas The ordered Schema collection.
   * @param insertSchema The Schema to insert.
   */
  private static insertSchemaInDependencyOrderedList(schemas: Schema[], insertSchema: Schema) {
    if (schemas.includes(insertSchema))
      return;

    for (let i = schemas.length - 1; i >= 0; --i) {
      const schema = schemas[i];
      if (this.dependsOn(insertSchema, schema)) {
        // insert right after the referenced schema in the list
        const index = schemas.indexOf(schema);
        schemas.splice(index + 1, 0, insertSchema);
        return;
      }
    }

    schemas.splice(0, 0, insertSchema);
  }
}
