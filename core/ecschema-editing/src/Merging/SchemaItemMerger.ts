/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaItem } from "@itwin/ecschema-metadata";
import { ChangeType, PropertyValueChange, SchemaItemChanges } from "../Validation/SchemaChanges";
import { MutableSchema } from "../Editing/Mutable/MutableSchema";
import { SchemaItemFactory } from "./SchemaItemFactory";
import { SchemaMergeContext } from "./SchemaMerger";

type SchemaItemMergeFn<TChange extends SchemaItemChanges, TItem extends SchemaItem> = (target: TItem, source: TItem, change: TChange, context: SchemaMergeContext) => Promise<void>;

abstract class MutableSchemaItem extends SchemaItem{
  public abstract override setDisplayLabel(displayLabel: string): void;
  public abstract override setDescription(description: string): void;
}

/**
   *
   * @param context
   * @param schemaItemChanges
   * @param mergeFn
   */
export default async function mergeSchemaItems<TChange extends SchemaItemChanges, TItem extends SchemaItem>(context: SchemaMergeContext, schemaItemChanges: Iterable<TChange>, mergeFn?: SchemaItemMergeFn<TChange, TItem>) {
  for(const change of schemaItemChanges) {

    // Gets the source and the target item. The target item could be undefined at that point.
    const sourceItem = (await context.sourceSchema.getItem<TItem>(change.ecTypeName))!;
    let targetItem = await context.targetSchema.getItem<TItem>(change.ecTypeName);

    // In case the schema item does not exists in the target schema, an instance for
    // this schema item is created. It's properties get set by the merger then.
    if(change.schemaItemMissing?.changeType === ChangeType.Missing) {
      // Check for name to make sure there is no collision for items with the same name
      // but different type.
      if(targetItem !== undefined) {
        throw new Error(`Schema ${context.targetSchema.name} already contains a Schema Item ${change.ecTypeName}.`);
      }

      // TODO: Think about renaming the Schema Item. This could be controlled though a flag.

      const createdItem = await SchemaItemFactory.create(sourceItem, context.targetSchema) as TItem;
      (context.targetSchema as MutableSchema).addItem(targetItem = createdItem);
    }

    // Sets the Schema items base properties...
    await mergeSchemaItemProperties(targetItem!, change.propertyValueChanges, (item, propertyName, propertyValue) => {
      const mutableSchemaItem = item as unknown as MutableSchemaItem;
      switch(propertyName) {
        case "label":
          return mutableSchemaItem.setDisplayLabel(propertyValue);
        case "description":
          return mutableSchemaItem.setDescription(propertyValue);
      }
    });

    if(mergeFn) {
      await mergeFn(targetItem!, sourceItem, change, context);
    }
  }
}

export async function mergeSchemaItemProperties<T extends SchemaItem>(targetItem: T, changes: Iterable<PropertyValueChange>, handler: (item: T, propertyName: string, propertyValue: any) => void) {
  for(const change of changes) {
    const [propertyName, propertyValue] = change.diagnostic.messageArgs!;
    handler(targetItem, propertyName, propertyValue);
  }
}
