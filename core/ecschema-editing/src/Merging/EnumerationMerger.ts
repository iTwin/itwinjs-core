/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Enumeration, Schema } from "@itwin/ecschema-metadata";
import { MutableSchema } from "../Editing/Mutable/MutableSchema";
import { ChangeType, EnumerationChanges } from "../Validation/SchemaChanges";

export class EnumerationMerger {

  public static async merge(targetSchema: Schema, changes: EnumerationChanges) {
    const mutableSchema = targetSchema as MutableSchema;

    // If the enumeration does not exists in the target schema, it can be simply
    // copied over.
    const sourceEnumeration = (await changes.schema.getItem<Enumeration>(changes.ecTypeName))!;
    if(changes.schemaItemMissing?.changeType === ChangeType.Missing) {
      const newEnumeration = await mutableSchema.createEnumeration(sourceEnumeration.name, sourceEnumeration.type);
      await newEnumeration.fromJSON(sourceEnumeration.toJSON(true));
    }

    // TBD: If enumeration exists in both schemas and they have different values,
    //      the values have to be copied. If they differ in value we throw an error.
  }
}
