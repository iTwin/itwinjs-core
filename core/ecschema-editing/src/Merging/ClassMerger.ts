/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECClass, ECClassModifier, parseClassModifier, Property, SchemaItemKey, SchemaItemType, schemaItemTypeToString, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaItemEditResults } from "../Editing/Editor";
import { MutableClass } from "../Editing/Mutable/MutableClass";
import { SchemaMergeContext } from "./SchemaMerger";
import { BaseClassDelta, ChangeType, ClassChanges, PropertyChanges, PropertyValueChange } from "../Validation/SchemaChanges";
import { mergeCustomAttributes } from "./CustomAttributeMerger";
import { createPropertyFromProps, mergePropertyAttributeValueChanges } from "./PropertyMerger";

/**
 * @internal
 */
export class ClassMerger<TClass extends ECClass> {
  protected readonly context: SchemaMergeContext;

  constructor(context: SchemaMergeContext) {
    this.context = context;
  }

  protected async create(_schemaKey: SchemaKey, ecClass: TClass): Promise<SchemaItemEditResults> {
    return { errorMessage: `${schemaItemTypeToString(ecClass.schemaItemType)} class type is not implemented.`};
  }

  protected async merge(itemKey: SchemaItemKey, _change: ClassChanges): Promise<SchemaItemEditResults> {
    return { itemKey };
  }

  protected async mergeAttributes(ecClass: TClass, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<SchemaItemEditResults | boolean> {
    const mutableClass = ecClass as unknown as MutableClass;
    switch(attributeName) {
      case "schemaItemType":
        if (attributeOldValue !== undefined && attributeOldValue !== attributeNewValue) {
          return { errorMessage: `Changing the class '${ecClass.name}' type is not supported.` };
        }
        return true;

      case "label":
        mutableClass.setDisplayLabel(attributeNewValue);
        return true;

      case "description":
        mutableClass.setDescription(attributeNewValue);
        return true;

      case "modifier":
        const modifier = parseClassModifier(attributeNewValue);
        if (modifier === undefined) {
          return { errorMessage: "An invalid class modifier has been provided." };
        }

        if (attributeOldValue === undefined || modifier === ECClassModifier.None) {
          mutableClass.setModifier(modifier);
          return true;
        }
        return { errorMessage: `Changing the class '${ecClass.name}' modifier is not supported.` };
    }
    return false;
  }

  protected isSchemaItemEditResults(obj: any): obj is SchemaItemEditResults {
    return typeof obj === "object" && "errorMessage" in obj;
  }

  private async setBaseClass(itemKey: SchemaItemKey, baseClassDelta: BaseClassDelta, changeType?: ChangeType): Promise<SchemaItemEditResults> {
    const [sourceBaseClass, targetBaseClass] = baseClassDelta.diagnostic.messageArgs! as [ECClass, ECClass];
    if (sourceBaseClass !== undefined) {
      const baseClassKey = new SchemaItemKey(sourceBaseClass.name, sourceBaseClass.schema.schemaKey.matches(this.context.sourceSchema.schemaKey)
        ? this.context.targetSchema.schemaKey
        : sourceBaseClass.schema.schemaKey);

      if (changeType === ChangeType.Missing && targetBaseClass === undefined) {
        if (sourceBaseClass.schemaItemType === SchemaItemType.EntityClass) {
          return this.context.editor.entities.setBaseClass(itemKey, baseClassKey);
        } else if (sourceBaseClass.schemaItemType === SchemaItemType.Mixin) {
          return this.context.editor.mixins.setMixinBaseClass(itemKey, baseClassKey);
        }
      }

      if (targetBaseClass !== undefined) {
        const baseClass = await this.context.targetSchema.lookupItem<ECClass>(baseClassKey);
        if (baseClass === undefined) {
          return { errorMessage: `'${baseClassKey.name}' class could not be located in the merged schema.`};
        }
        if (await baseClass.is(targetBaseClass)) {
          if (baseClass.schemaItemType === SchemaItemType.EntityClass) {
            return this.context.editor.entities.setBaseClass(itemKey, baseClassKey);
          } else if (baseClass.schemaItemType === SchemaItemType.Mixin) {
            return this.context.editor.mixins.setMixinBaseClass(itemKey, baseClassKey);
          }
        }
      }
    }
    return { errorMessage: `Changing the class '${itemKey.name}' baseClass is not supported.`};
  }

  private async mergeAttributeValueChanges(itemKey: SchemaItemKey, propertyValueChanges: PropertyValueChange[]): Promise<SchemaItemEditResults> {
    if (propertyValueChanges.length > 0) {

      const targetItem = await this.context.targetSchema.lookupItem<TClass>(itemKey);
      if (targetItem === undefined) {
        return { errorMessage: `'${itemKey.name}' class could not be located in the merged schema.` };
      }

      for (const change of propertyValueChanges) {
        const [attributeName, attributeNewValue, attributeOldValue] = change.diagnostic.messageArgs!;
        const results = await this.mergeAttributes(targetItem, attributeName, attributeNewValue, attributeOldValue);
        if (this.isSchemaItemEditResults(results) && results.errorMessage !== undefined) {
          return results;
        }
      }
    }

    return { itemKey };
  }

  private async handleError(callback: Promise<SchemaItemEditResults>) {
    const result = await callback;
    if (result.errorMessage) {
      throw new Error(result.errorMessage);
    }
  }

  private async mergePropertyChanges(itemKey: SchemaItemKey, propertyChanges: Iterable<PropertyChanges>): Promise<SchemaItemEditResults> {
    const targetItem = await this.context.targetSchema.lookupItem<TClass>(itemKey);
    if (targetItem === undefined) {
      return { itemKey, errorMessage: `'${itemKey.name}' class could not be located in the merged schema.`};
    }

    for (const change of propertyChanges) {
      if (change.propertyMissing?.changeType === ChangeType.Missing) {
        if (await targetItem.getProperty(change.ecTypeName) !== undefined) {
          return { itemKey, errorMessage: `Merged schema already contains a class '${itemKey.name}' property '${change.ecTypeName}'.`};
        }

        const sourceProperty = change.propertyMissing.diagnostic.ecDefinition as unknown as Property;
        const results  = await createPropertyFromProps(this.context, itemKey, sourceProperty);
        if (results.errorMessage !== undefined) {
          return { itemKey, errorMessage:  results.errorMessage };
        }
      } else {
        const targetProperty = (await targetItem.getProperty(change.ecTypeName))!;
        const results = await mergePropertyAttributeValueChanges(this.context, targetProperty, change.propertyValueChanges);
        if (results.errorMessage !== undefined) {
          return { itemKey, errorMessage: results.errorMessage  };
        }
      }

      const mergeResults = await mergeCustomAttributes(this.context, change.customAttributeChanges.values(), async (ca) => {
        return this.context.editor.entities.addCustomAttributeToProperty(itemKey, change.ecTypeName, ca);
      });

      if (mergeResults.errorMessage !== undefined) {
        return { itemKey, errorMessage: mergeResults.errorMessage};
      }
    }
    return { itemKey };
  }

  // First pass to create missing changes
  public static async mergeItemStubChanges(context: SchemaMergeContext, classChanges: Iterable<ClassChanges>) {
    const merger = new this(context);

    for (const change of classChanges) {
      const sourceItem = (await change.schema.getItem<ECClass>(change.ecTypeName))!;
      const targetItemKey = new SchemaItemKey(change.ecTypeName, context.targetSchema.schemaKey);
      const changeType = change.schemaItemMissing?.changeType;

      if (changeType === ChangeType.Missing) {

        if (await context.targetSchema.lookupItem<ECClass>(targetItemKey) !== undefined) {
          throw new Error(`Merged schema already contains a class '${change.ecTypeName}'.`);
        }

        await merger.handleError(merger.create(context.targetSchema.schemaKey, sourceItem));
      }
    }
  }

  // 2nd pass to merge baseClass, properties, mixins and CA.
  public static async mergeItemContentChanges(context: SchemaMergeContext, classChanges: Iterable<ClassChanges>){
    const merger = new this(context);
    for (const change of classChanges) {
      const targetItemKey = new SchemaItemKey(change.ecTypeName, context.targetSchema.schemaKey);
      const changeType = change.schemaItemMissing?.changeType;

      if (change.baseClassDelta !== undefined) {
        await merger.handleError(merger.setBaseClass(targetItemKey, change.baseClassDelta, changeType));
      }

      // merge class attributes
      await merger.handleError(merger.mergeAttributeValueChanges(targetItemKey, change.propertyValueChanges));

      // merge class mixins/constraints/etc
      await merger.handleError(merger.merge(targetItemKey, change));

      // merge class property attribute values
      if (change.propertyChanges.size > 0) {
        await merger.handleError(merger.mergePropertyChanges(targetItemKey, change.propertyChanges.values()));
      }

      // merge custom attributes
      await merger.handleError(mergeCustomAttributes(merger.context, change.customAttributeChanges.values(), async (ca) => {
        return merger.context.editor.entities.addCustomAttribute(targetItemKey, ca);
      }));
    }
  }
}
