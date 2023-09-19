/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaItem, SchemaItemKey } from "@itwin/ecschema-metadata";
import { ChangeType, PropertyValueChange, SchemaItemChanges } from "../Validation/SchemaChanges";
import { MutableSchema } from "../Editing/Mutable/MutableSchema";
import { SchemaItemFactory } from "./SchemaItemFactory";
import { SchemaMergeContext } from "./SchemaMerger";

type SchemaItemMergeFn<TChange extends SchemaItemChanges, TItem extends SchemaItem> = (target: TItem, source: TItem, change: TChange, context: SchemaMergeContext) => Promise<void>;
type PropertyChangedFn<TItem extends SchemaItem> = (item: TItem, propertyName: string, propertyValue: any) => void | boolean;

abstract class MutableSchemaItem extends SchemaItem {
  public abstract override setDisplayLabel(displayLabel: string): void;
  public abstract override setDescription(description: string): void;
}

/**
 * Merges schema items from the source in the target schema. This method applies for all schema items
 * and handles the basic processing such as create-if-not-exists or name collisions or base property setting.
 * @param context           The current merge context
 * @param schemaItemChanges The schema items to be merged
 * @param mergeFn           Merge function for complex merging.
 * @internal
 */
export default async function mergeSchemaItems<TChange extends SchemaItemChanges, TItem extends SchemaItem>(context: SchemaMergeContext, schemaItemChanges: Iterable<TChange>, mergeFn?: SchemaItemMergeFn<TChange, TItem>) {
  for (const change of schemaItemChanges) {

    // Gets the source and the target item. The target item could be undefined at that point.
    const sourceItem = (await context.sourceSchema.getItem<TItem>(change.ecTypeName))!;
    let targetItem = await context.targetSchema.getItem<TItem>(change.ecTypeName);

    // In case the schema item does not exists in the target schema, an instance for
    // this schema item is created. It's properties get set by the merger then.
    if (change.schemaItemMissing?.changeType === ChangeType.Missing) {
      // Check for name to make sure there is no collision for items with the same name
      // but different type.
      if (targetItem !== undefined) {
        throw new Error(`Schema ${context.targetSchema.name} already contains a Schema Item ${change.ecTypeName}.`);
      }

      // TODO: Think about renaming the Schema Item. This could be controlled though a flag.

      const createdItem = await SchemaItemFactory.create(context.targetSchema, sourceItem) as TItem;
      (context.targetSchema as MutableSchema).addItem(targetItem = createdItem);
    }

    if (targetItem === undefined) {
      throw new Error("Invalid state, targetItem must not be undefined at that point.");
    }

    // Sets the Schema items base properties...
    await mergeSchemaItemProperties(targetItem, change.propertyValueChanges, (item, propertyName, propertyValue) => {
      const mutableSchemaItem = item as unknown as MutableSchemaItem;
      switch (propertyName) {
        case "label":
          mutableSchemaItem.setDisplayLabel(propertyValue);
          return true;
        case "description":
          mutableSchemaItem.setDescription(propertyValue);
          return true;
        case "schemaItemType":
          return true;
      }
      return;
    });

    if (mergeFn)
      await mergeFn(targetItem, sourceItem, change, context);
  }
}

export async function mergeSchemaItemProperties<T extends SchemaItem>(targetItem: T, changes: PropertyValueChange[], handler: PropertyChangedFn<T>) {
  for (let index = 0, stepUp = true; index < changes.length; stepUp && index++, stepUp = true) {
    const [propertyName, propertyValue] = changes[index].diagnostic.messageArgs!;
    if (handler(targetItem, propertyName, propertyValue) === true) {
      changes.splice(index, 1);
      stepUp = false;
    }
  }
}

/**
 * 
 * @param source The schema item the reference gets copied from 
 * @param itemFullName The full name of the schema item to get the schema reference from.
 * @returns the item reference schema and the item name, these values are needed to create a schema item key. 
 */
export async function getItemNameAndSchemaRef(source: SchemaItem, itemFullName: string): Promise<[Schema | undefined, string]> {
  const [schemaName, itemName] = SchemaItem.parseFullName(itemFullName);
  const refSchema = await source.schema.getReference(schemaName);
  return [refSchema, itemName];
}

/**
 * This is needed to create a lazy loaded type for target schema when merging.
 * @param refSchema the schema the item references to
 * @param itemName name of the schema item
 * @returns a schema item key.
 */
export function createNewSchemaItemKey(refSchema: Schema, itemName: string){
  return new SchemaItemKey(itemName, refSchema.schemaKey);
}
