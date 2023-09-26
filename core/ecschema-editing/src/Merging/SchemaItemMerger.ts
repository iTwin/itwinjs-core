/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaItem, SchemaItemKey } from "@itwin/ecschema-metadata";
import { ChangeType, PropertyValueChange, SchemaItemChanges } from "../Validation/SchemaChanges";
import { SchemaItemFactory } from "./SchemaItemFactory";
import { SchemaMergeContext } from "./SchemaMerger";

export type PropertyValueResolver<T extends SchemaItem> = {
  -readonly [key in keyof ReturnType<T["toJSON"]>]?: (value: any, item: MutableSchemaProps<T>) => any;
};

type MutableSchemaProps<T extends SchemaItem> = {
  -readonly [key in keyof ReturnType<T["toJSON"]>]: ReturnType<T["toJSON"]>[key];
};

export abstract class SchemaItemMerger<TItem extends SchemaItem> {

  protected readonly context: SchemaMergeContext;

  constructor(context: SchemaMergeContext) {
    this.context = context;
  }

  /**
   * Merges the property values.
   * @param targetItem  The current schema item
   * @param changes     The property changes.
   */
  private async mergeItemPropertyValues(targetItem: TItem, changes: PropertyValueChange[]) {
    // This implementation is still a bit wanky, as the editor api does not allow to set all
    const jsonProps = targetItem.toJSON() as MutableSchemaProps<TItem>;
    const propertyResolver = {
      label: (value: string) => value,
      description: (value: string) => value,
      ...await this.createPropertyValueResolver(),
    };

    for(const change of changes) {
      const [propertyName, propertyValue] = change.diagnostic.messageArgs! as [keyof typeof jsonProps, any];
      const resolver = propertyResolver[propertyName];
      if(resolver !== undefined) {
        jsonProps[propertyName] = resolver(propertyValue, jsonProps);
      }
    }
    await targetItem.fromJSON(jsonProps);
  }

  /**
   * This overridable method allows to create a property value resolver that gets defines
   * a handler function for every possible property change. This allows adding complex handing
   * if a property value requires complicated merging.
   * @returns   A resolver map with resolvers for the property.
   */
  protected async createPropertyValueResolver(): Promise<PropertyValueResolver<TItem>> {
    return {};
  }

  /**
   * This overridable method gets called for more complex merging.
   * @param _itemKey  The key of the current schema item.
   * @param _source   The source item that shall gets merged into.
   * @param _change   The schema item change to be applied.
   */
  protected async merge(_itemKey: SchemaItemKey, _source: TItem, _change: SchemaItemChanges) {
    // Can be overriden for complex merging
  }

  /**
   * Merges the given schema item changes in the current context.
   * @param context             The merging context
   * @param schemaItemChanges   An iterable of item changes.
   */
  public static async mergeChanges<TChange extends SchemaItemChanges>(context: SchemaMergeContext, schemaItemChanges: Iterable<TChange>) {
    const merger = this.createMerger(context);
    for(const change of schemaItemChanges) {

      // Gets the source and the target item. The target item could be undefined at that point.
      const sourceItem = (await context.sourceSchema.getItem<SchemaItem>(change.ecTypeName))!;
      let targetItem = await context.targetSchema.getItem<SchemaItem>(change.ecTypeName);

      // In case the schema item does not exists in the target schema, an instance for
      // this schema item is created. It's properties get set by the merger then.
      if(change.schemaItemMissing?.changeType === ChangeType.Missing) {
        // Check for name to make sure there is no collision for items with the same name
        // but different type.
        if(targetItem !== undefined) {
          throw new Error(`Schema ${context.targetSchema.name} already contains a Schema Item ${change.ecTypeName}.`);
        }

        // TODO: Think about renaming the Schema Item. This could be controlled though a flag.

        const itemKey = await SchemaItemFactory.add(context, sourceItem);
        targetItem = await context.targetSchema.lookupItem(itemKey);
      }

      if(targetItem === undefined) {
        throw new Error("Invalid state, targetItem must not be undefined at that point.");
      }

      await merger.mergeItemPropertyValues(targetItem, change.propertyValueChanges);
      await merger.merge(targetItem.key, sourceItem, change);
    }
  }

  /**
   * Creates a specific merger instance that runs the merging of a specific schema item.
   * The method is basically some typescript sugar to be able to instantiate from a static method.
   * @param context   The current merge context
   * @returns         The schema item merger instance.
   */
  private static createMerger(this: unknown, context: SchemaMergeContext): SchemaItemMerger<SchemaItem> {
    const constructable = this as new (c: SchemaMergeContext) => SchemaItemMerger<SchemaItem>;
    return new constructable(context);
  }
}
