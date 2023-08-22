/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Enumeration } from "@itwin/ecschema-metadata";
import { ChangeType, EnumerationChanges } from "../Validation/SchemaChanges";
import { SchemaChangeContext } from "./SchemaMerger";

export class EnumerationMerger {

  public static async merge(context: SchemaChangeContext, changes: EnumerationChanges) {

    // If the enumeration does not exists in the target schema, it can be simply
    // copied over.
    const sourceEnumeration = (await changes.schema.getItem<Enumeration>(changes.ecTypeName))!;
    if(changes.schemaItemMissing?.changeType === ChangeType.Missing) {
      const _newEnumeration = await context.editor.enumerations.createFromProps(context.targetSchema.schemaKey, sourceEnumeration.toJSON());
    }

    // TBD: If enumeration exists in both schemas and they have different values,
    //      the values have to be copied. If they differ in value we throw an error.
  }
}
