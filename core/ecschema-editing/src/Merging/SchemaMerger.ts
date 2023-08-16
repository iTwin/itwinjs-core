/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { MutableSchema } from "../Editing/Mutable/MutableSchema";
import { ClassChanges, EnumerationChanges, PropertyChanges, SchemaChanges } from "../Validation/SchemaChanges";
import { SchemaComparer } from "../Validation/SchemaComparer";

export class SchemaMerger {

  private readonly _mergedSchema: MutableSchema;

  constructor(context: SchemaContext, name: string, alias: string, readVersion: number, writeVersion: number, minorVersion: number) {
    this._mergedSchema = new Schema(context, name, alias, readVersion, writeVersion, minorVersion) as MutableSchema;
  }

  public async merge(...schemas: Schema[]): Promise<Schema> {
    for(const schemaToMerge of schemas) {
      await this.mergeSchemas(await this.getSchemaChanges(schemaToMerge));
    }

    return this._mergedSchema.schema;
  }

  private async getSchemaChanges(schemaToMerge: Schema): Promise<SchemaChanges> {
    const changesList: SchemaChanges[] = [];
    const schemaComparer = new SchemaComparer({ report: changesList.push.bind(changesList) });

    return schemaComparer.compareSchemas(this._mergedSchema, schemaToMerge).then(() => changesList[0]);
  }

  private async mergeSchemas(schemaChanges: SchemaChanges): Promise<void> {

    for(const enumerationChanges of schemaChanges.enumerationChanges.values()) {
      await this.mergeEnumeration(enumerationChanges);
    }

    for(const classChanges of schemaChanges.classChanges.values()) {
      await this.mergeClasses(classChanges);
    }

  }

  private async mergeEnumeration(_changes: EnumerationChanges): Promise<void> {

  }

  private async mergeClasses(classChanges: ClassChanges): Promise<void> {
    for(const propertyChanges of classChanges.propertyChanges.values()) {
      await this.mergeProperties(propertyChanges);
    }
  }

  private async mergeProperties(_propertyChanges: PropertyChanges): Promise<void> {

  }
}
