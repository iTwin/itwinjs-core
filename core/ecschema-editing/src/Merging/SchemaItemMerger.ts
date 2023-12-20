/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaItem, SchemaItemKey } from "@itwin/ecschema-metadata";
import { ChangeType, PropertyValueChange, SchemaItemChanges } from "../Validation/SchemaChanges";
import { SchemaItemFactory } from "./SchemaItemFactory";
import { SchemaMergeContext } from "./SchemaMerger";

/**
 * Defines a type-safe interface of Property Value resolver.
 * @internal
 */
export type PropertyValueResolver<T extends SchemaItem, TProps=MutableSchemaItemProps<T>> = {
  [P in keyof TProps]?: (newValue: any, item: SchemaItemKey, oldValue?: any) => any;
};

/**
 * Defines a Mutable Schema Props interface.
 */
type MutableSchemaItemProps<T extends SchemaItem> = {
  -readonly [key in keyof ReturnType<T["toJSON"]>]: ReturnType<T["toJSON"]>[key];
};

/**
 * The SchemaItemMerger is an base class for several other mergers with the actual logic
 * to perform merging for a certain schema item type. The class provides the shared logics
 * that is shared for all schema item mergers and custom logic can be applied by overriding
 * the protected class members.
 * @internal
 */
export class SchemaItemMerger<TItem extends SchemaItem> {

  protected readonly context: SchemaMergeContext;

  /**
   * Constructor of the SchemaItemMerger class. This should not be overriden or extended
   * by sub-implementations.
   * @param context   The current merging context.
   */
  constructor(context: SchemaMergeContext) {
    this.context = context;
  }

  /**
   * This overridable method allows to create a property value resolver that gets defines
   * a handler function for every possible property change. This allows adding complex handing
   * if a property value requires complicated merging.
   * @returns   A resolver map with resolvers for the property.
   */
  protected async createPropertyValueResolver(): Promise<PropertyValueResolver<TItem>> {
    // Can be overriden for complex property value merging
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

  protected async lookup<T extends SchemaItem>(schemaItem: T): Promise<T | undefined>{
    const itemKey = new SchemaItemKey(schemaItem.name, this.context.sourceSchema.schemaKey.matches(schemaItem.schema.schemaKey)
      ? this.context.targetSchema.schemaKey
      : schemaItem.schema.schemaKey,
    );
    return this.context.targetSchema.lookupItem<T>(itemKey);
  }

  /**
   * Merges the given schema item changes in the current context.
   * @param context             The merging context
   * @param schemaItemChanges   An iterable of item changes.
   */
  public static async mergeChanges<TChange extends SchemaItemChanges>(context: SchemaMergeContext, schemaItemChanges: Iterable<TChange>) {
    const merger = new this(context);
    for(const change of schemaItemChanges) {

      // Gets the source and the target item. The target item could be undefined at that point.
      const sourceItem = (await context.sourceSchema.getItem<SchemaItem>(change.ecTypeName))!;
      let targetItemKey = new SchemaItemKey(change.ecTypeName, context.targetSchema.schemaKey);

      // In case the schema item does not exists in the target schema, an instance for
      // this schema item is created. It's properties get set by the merger then.
      if(change.schemaItemMissing?.changeType === ChangeType.Missing) {
        // Check for name to make sure there is no collision for items with the same name
        // but different type.
        if(await context.targetSchema.lookupItem(targetItemKey) !== undefined) {
          throw new Error(`Schema ${context.targetSchema.name} already contains a Schema Item ${change.ecTypeName}.`);
        }

        // TODO: Think about renaming the Schema Item. This could be controlled though a flag.
        targetItemKey = await SchemaItemFactory.create(context, sourceItem);
      }

      await merger.mergeItemPropertyValues(targetItemKey, change.propertyValueChanges);
      await merger.merge(targetItemKey, sourceItem, change);
    }
  }
  /**
   * Merges the property values.
   * @param targetItem  The current schema item
   * @param changes     The property changes.
   */
  private async mergeItemPropertyValues(targetItemKey: SchemaItemKey, changes: PropertyValueChange[]) {
    // No need to process anything if no properties differ.
    if(changes.length === 0) {
      return;
    }

    const targetItem = (await this.context.targetSchema.lookupItem<SchemaItem>(targetItemKey));
    const jsonProps = (targetItem?.toJSON() ?? {}) as MutableSchemaItemProps<TItem>;
    const propertyResolver = await this.createPropertyValueResolver();

    for(const change of changes) {
      const [propertyName, propertyNewValue, propertyOldValue] = change.diagnostic.messageArgs! as [keyof typeof jsonProps, any, any];
      const resolver = propertyResolver[propertyName];
      jsonProps[propertyName] = resolver !== undefined
        ? resolver(propertyNewValue, targetItemKey, propertyOldValue)
        : propertyNewValue;
    }

    await this.context.editor.schemaItems.applyProps(targetItemKey, jsonProps);
  }
}
