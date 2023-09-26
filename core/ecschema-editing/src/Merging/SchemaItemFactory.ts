/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, EntityClass, Enumeration, PrimitiveType, PropertyCategory, SchemaItem, SchemaItemKey, SchemaKey, StructClass } from "@itwin/ecschema-metadata";
import { SchemaContextEditor, SchemaItemEditResults } from "../Editing/Editor";
import { SchemaMergeContext } from "./SchemaMerger";

/**
 * @internal
 */
export namespace SchemaItemFactory {

  export async function add(context: SchemaMergeContext, template: SchemaItem): Promise<SchemaItemKey> {
    return new Promise(async (resolve, reject) => {
      const result = await create(context.editor, context.targetSchema.schemaKey, template);
      if(result.errorMessage) {
        return reject(result.errorMessage);
      }
      if(result.itemKey) {
        return resolve(result.itemKey);
      }
    });
  }

  async function create(editor: SchemaContextEditor, targetSchemaKey: SchemaKey, template: SchemaItem): Promise<SchemaItemEditResults> {
    if (is(template, Enumeration))
      return editor.enumerations.create(targetSchemaKey, template.name, template.isInt ? PrimitiveType.Integer : PrimitiveType.String, template.label, template.isStrict);
    if (is(template, EntityClass))
      return editor.entities.create(targetSchemaKey, template.name, template.modifier);
    if (is(template, StructClass))
      return editor.structs.create(targetSchemaKey, template.name);
    if (is(template, CustomAttributeClass))
      return editor.customAttributes.create(targetSchemaKey, template.name, template.containerType);
    if(is(template, PropertyCategory))
      return editor.propertyCategories.create(targetSchemaKey, template.name, template.priority);
    throw new Error(`Unsupported Schema Item Type: ${template.constructor.name}`);
  }

  function is<T extends SchemaItem>(item: SchemaItem, type: new (...args: any) => T ): item is T {
    return item instanceof type;
  }
}
