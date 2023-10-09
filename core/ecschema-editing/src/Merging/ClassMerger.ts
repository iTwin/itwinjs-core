// /*---------------------------------------------------------------------------------------------
// * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
// * See LICENSE.md in the project root for license terms and full copyright notice.
// *--------------------------------------------------------------------------------------------*/
import { ECClass, SchemaItemKey } from "@itwin/ecschema-metadata";
import { BaseClassDelta, ChangeType, ClassChanges, PropertyChanges } from "../Validation/SchemaChanges";
import { SchemaItemMerger } from "./SchemaItemMerger";

/**
 * @internal
 */
export default class ClassMerger extends SchemaItemMerger<ECClass> {

  protected override async merge(itemKey: SchemaItemKey, source: ECClass, change: ClassChanges) {
    // This applies to all type of classes regardless if they are Entities, Structs, Mixins,...
    // all can have properties that required to get merged.
    await this.mergeBaseClasses(itemKey, source, change.baseClassDelta);

    for(const propertyChange of change.propertyChanges.values()) {
      await this.mergeProperties(itemKey, source, propertyChange);
    }
  }

  private async mergeBaseClasses(itemKey: SchemaItemKey, source: ECClass, baseClassChange?: BaseClassDelta) {
    if (baseClassChange !== undefined) {
      const [sourceBaseClass, targetBaseClass] = baseClassChange.diagnostic.messageArgs! as [ECClass, ECClass];
      if (targetBaseClass === undefined) {

        const baseClassKey = sourceBaseClass.schema.schemaKey.matches(source.schema.schemaKey)
          ? new SchemaItemKey(sourceBaseClass.name, itemKey.schemaKey)
          : sourceBaseClass.key;

        await this.context.editor.entities.setBaseClass(itemKey, baseClassKey);
      } else {
        throw new Error(`Failed to merge base class '${sourceBaseClass.name}': not supported case`);
      }
    }
  }

  private async mergeProperties(itemKey: SchemaItemKey, source: ECClass, propertyChange: PropertyChanges) {
    if (propertyChange.propertyMissing?.changeType === ChangeType.Missing) {

      const property = await source.getProperty(propertyChange.ecTypeName);
      if (property === undefined) {
        throw Error(`Property '${propertyChange.ecTypeName}' not found in class ${source.name}`);
      }

      if (property.isPrimitive()) {
        const primitiveProps =  property.toJSON();
        property.isArray()
          ? await this.context.editor.entities.createPrimitiveArrayPropertyFromProps(itemKey, propertyChange.ecTypeName, property.primitiveType, primitiveProps)
          : await this.context.editor.entities.createPrimitivePropertyFromProps(itemKey, propertyChange.ecTypeName, property.primitiveType, primitiveProps);

      } else {
        throw Error(`Failed to merge '${propertyChange.ecTypeName}' property: not supported type`);
      }
    }
  }
}
