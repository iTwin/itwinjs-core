/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECClass } from "@itwin/ecschema-metadata";
import { ChangeType, ClassChanges } from "../Validation/SchemaChanges";
import { SchemaMergeContext } from "./SchemaMerger";

export default async function mergeClasses(target: ECClass, source: ECClass, change: ClassChanges, context: SchemaMergeContext) {
  await target.fromJSON(source.toJSON());

  for(const propertyChange of change.propertyChanges.values()) {
    if (propertyChange.propertyMissing?.changeType === ChangeType.Missing) {

      const property = await source.getProperty(propertyChange.ecTypeName);
      if (property === undefined) {
        throw Error(`Property '${propertyChange.ecTypeName}' not found in class ${source.name}`);
      }

      if (property.isPrimitive()) {
        const primitiveProps =  property.toJSON();
        const result = property.isArray()
          ? await context.editor.entities.createPrimitiveArrayPropertyFromProps(target.key, propertyChange.ecTypeName, property.primitiveType, primitiveProps)
          : await context.editor.entities.createPrimitivePropertyFromProps(target.key, propertyChange.ecTypeName, property.primitiveType, primitiveProps);

        if (result.errorMessage !== undefined) {
          throw Error(`Failed to merge '${propertyChange.ecTypeName}' property: ${result.errorMessage}`);
        }
      } else {
        throw Error(`Failed to merge '${propertyChange.ecTypeName}' property: not supported type`);
      }
    }
  }

}
