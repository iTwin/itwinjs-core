/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, CustomAttributeClass, EntityClass, Enumeration, KindOfQuantity, Phenomenon, PrimitiveType, PropertyCategory, SchemaItem, SchemaItemKey, SchemaKey, StructClass, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaContextEditor, SchemaItemEditResults } from "../Editing/Editor";
import { SchemaMergeContext } from "./SchemaMerger";

/**
 * @internal
 */
export namespace SchemaItemFactory {

  /**
   * Creates a new Schema Item based on the given template instance.
   * @param context   The current merging context.
   * @param template  The Schema Items Template
   * @returns         The SchemaItemKey of the created item.
   */
  export async function create(context: SchemaMergeContext, template: SchemaItem): Promise<SchemaItemKey> {
    const result = await createItem(context.editor, context.targetSchema.schemaKey, template);
    if(result.errorMessage) {
      throw new Error(result.errorMessage);
    }
    return result.itemKey!;
  }

  /**
   * Creates a new Schema Item in the SchemaContextEditor.
   * @param editor          The SchemaContextEditor
   * @param targetSchemaKey The key of the target schema the item shall be created in.
   * @param template        The Schema Items Template
   * @returns               A SchemaItemEditResults with a schema key if the item could be created.
   */
  async function createItem(editor: SchemaContextEditor, targetSchemaKey: SchemaKey, template: SchemaItem): Promise<SchemaItemEditResults> {
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
    if (is(template, Phenomenon))
      return editor.phenomenons.create(targetSchemaKey, template.name, template.definition);
    if (is(template, Constant)) {
      if(template.phenomenon === undefined) {
        throw new Error(`Invalid Constant ${template.name} has no phenomenon defined`);
      }
      const phenomenon = await template.phenomenon;
      const itemKey = phenomenon.key.schemaKey.matches(template.key.schemaKey)
        ? new SchemaItemKey(phenomenon.name, targetSchemaKey)
        : phenomenon.key;

      return editor.constants.create(targetSchemaKey, template.name, itemKey, template.definition);
    }
    if (is(template, KindOfQuantity)) {
      if(template.persistenceUnit === undefined) {
        throw new Error(`Invalid KindOfQuantity ${template.name} has no persistenceUnit defined`);
      }
      const persistenceUnit = await template.persistenceUnit;
      const itemKey = persistenceUnit.key.schemaKey.matches(template.key.schemaKey)
        ? new SchemaItemKey(persistenceUnit.name, targetSchemaKey)
        : persistenceUnit.key;
      return editor.kindOfQuantities.create(targetSchemaKey, template.name, itemKey);
    }
    if (is(template, UnitSystem))
      return editor.unitSystems.create(targetSchemaKey, template.name);

    throw new Error(`Unsupported Schema Item Type: ${template.constructor.name}`);
  }

  /**
   * Type Guard to "cast" a given schema item into an implementation
   * @param item  Item to be checked
   * @param type  The desired implementation.
   * @returns     true if the item could be casted, otherwise false.
   */
  function is<T extends SchemaItem>(item: SchemaItem, type: new (...args: any) => T ): item is T {
    return item instanceof type;
  }
}
