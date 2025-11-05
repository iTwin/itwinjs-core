/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { SchemaInfo } from "../Interfaces";
import type { SchemaKey } from "../SchemaKey";
import type { Schema } from "../Metadata/Schema";

type SchemaReferenceLookup<T extends SchemaInfo> = (input: T, reference: SchemaKey) => T | undefined;

/**
 * Utility class for working with Schema graphs.
 * @internal
 */
export class SchemaGraphUtil {
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

    const lookupFn = (schema: Schema, referenceKey: SchemaKey) => {
      return schema.references.find((s) => s.schemaKey.name === referenceKey.name);
    };

    this.insertSchemaInDependencyOrderedList(schemas, insertSchema, lookupFn);
    for (const reference of insertSchema.references) {
      this.buildDependencyOrderedSchemaList(reference, schemas);
    }
    return schemas;
  }

  /**
   * Returns a flat list of schemas in topological order, typically used before schema import
   * so that dependent schemas are processed after their references. This method does not alter
   * the original schemaInfos array.
   * @param schemaInfos   The schema collection that will hold the ordered schemas.
   * @returns             A list of schemas in topological order.
   */
  public static buildDependencyOrderedSchemaInfoList(schemaInfos: ReadonlyArray<SchemaInfo>): ReadonlyArray<SchemaInfo> {
    const sortedList: Array<SchemaInfo> = [];
    const lookupFn = (_schema: SchemaInfo, reference: SchemaKey) => {
      return schemaInfos.find((s) => s.schemaKey.name === reference.name);
    };

    for(const schemaInfo of schemaInfos) {
      this.insertSchemaInDependencyOrderedList(sortedList, schemaInfo, lookupFn);
    }

    return sortedList;
  }

  /**
   * Indicates if the given Schema references the possibleDependency Schema.
   * @param schema The possible dependent schema.
   * @param possibleDependency The possible Schema dependency.
   */
  private static dependsOn<T extends SchemaInfo>(schema: T, possibleDependency: T, lookup: SchemaReferenceLookup<T>): boolean {
    if (this.directlyReferences(schema, possibleDependency))
      return true;

    // search for dependencies in indirect references
    for (const referenceInfo of schema.references) {
      const reference = lookup(schema, referenceInfo.schemaKey);
      if (reference && this.dependsOn(reference, possibleDependency, lookup))
        return true;
    }

    return false;
  }

  /**
   * Indicates if the given Schema directly references the possiblyReferencedSchema Schema.
   * @param schema The possible parent schema.
   * @param possibleDependency The Schema that may be referenced.
   */
  private static directlyReferences<T extends SchemaInfo>(schema: T, possiblyReferencedSchema: T): boolean {
    return schema.references.some((ref) => ref.schemaKey.name === possiblyReferencedSchema.schemaKey.name);
  }

  /**
   * Helper method that manages the insertion of a Schema into the schemas collection
   * based on the topological ordering algorithm.
   * @param schemas The ordered collection.
   * @param insert  The instance to insert.
   */
  private static insertSchemaInDependencyOrderedList<T extends SchemaInfo>(orderedList: T[], insert: T, lookup: SchemaReferenceLookup<T>) {
    if (orderedList.includes(insert))
      return;

    for (let i = orderedList.length - 1; i >= 0; --i) {
      const schema = orderedList[i];
      if (this.dependsOn(insert, schema, lookup)) {
        // insert right after the referenced schema in the list
        const index = orderedList.indexOf(schema);
        orderedList.splice(index + 1, 0, insert);
        return;
      }
    }

    orderedList.splice(0, 0, insert);
  }
}
