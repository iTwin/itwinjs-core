/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, parseCustomAttributeContainerType, SchemaKey } from "@itwin/ecschema-metadata";
import { ClassMerger } from "./ClassMerger";
import { SchemaItemEditResults } from "../Editing/Editor";
import { MutableCAClass } from "../Editing/Mutable/MutableCAClass";

/**
 * @internal
 */
export default class CAClassMerger extends ClassMerger<CustomAttributeClass> {

  protected override async create(schemaKey: SchemaKey, ecClass: CustomAttributeClass): Promise<SchemaItemEditResults> {
    return this.context.editor.customAttributes.create(schemaKey, ecClass.name, ecClass.containerType);
  }

  protected override async mergeAttributes(ecClass: CustomAttributeClass, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<SchemaItemEditResults | boolean> {
    const results = await super.mergeAttributes(ecClass, attributeName, attributeNewValue, attributeOldValue);
    if (results === true || this.isSchemaItemEditResults(results) && results.errorMessage !== undefined) {
      return results;
    }

    const mutableCAClass = ecClass as unknown as MutableCAClass;
    switch(attributeName) {
      case "appliesTo":
        if (attributeOldValue !== undefined && attributeOldValue !== attributeNewValue) {
          const containerType = parseCustomAttributeContainerType(`${attributeOldValue}, ${attributeNewValue}`);
          if (containerType === undefined) {
            return { errorMessage: "An invalid custom attribute class containerType has been provided."};
          }
          mutableCAClass.setContainerType(containerType);
        }
        return true;
    }
    return false;
  }
}
