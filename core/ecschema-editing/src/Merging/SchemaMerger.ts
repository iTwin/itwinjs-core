/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema } from "@itwin/ecschema-metadata";
import { SchemaChanges } from "../Validation/SchemaChanges";
import { SchemaComparer } from "../Validation/SchemaComparer";
import { ClassMerger } from "./ClassMerger";
import { EnumerationMerger } from "./EnumerationMerger";

export class SchemaMerger {

  private async getSchemaChanges(targetSchema: Schema, sourceSchema: Schema): Promise<SchemaChanges> {
    const changesList: SchemaChanges[] = [];
    const schemaComparer = new SchemaComparer({ report: changesList.push.bind(changesList) });

    const options = {
      compareItemFullName: false,
    };

    return schemaComparer.compareSchemas(sourceSchema, targetSchema, options).then(() => changesList[0]);
  }

  public async merge(targetSchema: Schema, sourceSchema: Schema): Promise<Schema> {
    const schemaChanges = await this.getSchemaChanges(targetSchema, sourceSchema);

    for(const changes of schemaChanges.enumerationChanges.values()) {
      await EnumerationMerger.merge(targetSchema, changes);
    }

    for(const changes of schemaChanges.classChanges.values()) {
      await ClassMerger.merge(targetSchema, changes);
    }

    return targetSchema;
  }
}
