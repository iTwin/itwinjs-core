/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECClass, ECClassModifier, parseClassModifier, SchemaItemKey, schemaItemTypeToString, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaItemEditResults } from "../Editing/Editor";
import { MutableClass } from "../Editing/Mutable/MutableClass";
import { SchemaMergeContext } from "./SchemaMerger";
import { BaseClassDelta, ChangeType, ClassChanges, PropertyValueChange } from "../Validation/SchemaChanges";
import { ClassPropertyMerger } from "./ClassPropertyMerger";
import { mergeCustomAttributes } from "./CustomAttributeMerger";

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
        return this.context.editor.entities.setBaseClass(itemKey, baseClassKey);
      }

      if (targetBaseClass !== undefined) {
        const baseClass = await this.context.targetSchema.lookupItem<ECClass>(baseClassKey);
        if (baseClass === undefined) {
          return { errorMessage: `'${baseClassKey.name}' class could not be located in the merged schema.`};
        }
        if (await baseClass.is(targetBaseClass)) {
          return this.context.editor.entities.setBaseClass(itemKey, baseClassKey);
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

  public static async mergeChanges(context: SchemaMergeContext, classChanges: Iterable<ClassChanges>) {
    const merger = new this(context);

    for (const change of classChanges) {
      const sourceItem = (await change.schema.getItem<ECClass>(change.ecTypeName))!;
      let targetItemKey = new SchemaItemKey(change.ecTypeName, context.targetSchema.schemaKey);
      const changeType = change.schemaItemMissing?.changeType;

      if (changeType === ChangeType.Missing) {

        if (await context.targetSchema.lookupItem<ECClass>(targetItemKey) !== undefined) {
          throw new Error(`Merged schema already contains a class '${change.ecTypeName}'.`);
        }

        // create class
        const results = await merger.create(context.targetSchema.schemaKey, sourceItem);
        if (results.errorMessage !== undefined) {
          throw new Error(results.errorMessage);
        }
        targetItemKey = results.itemKey!;
      }

      // merge base classes
      if (change.baseClassDelta !== undefined) {
        await merger.handleError(merger.setBaseClass(targetItemKey, change.baseClassDelta, changeType));
      }

      // merge class attributes
      await merger.handleError(merger.mergeAttributeValueChanges(targetItemKey, change.propertyValueChanges));

      // merge class property values
      await merger.handleError(ClassPropertyMerger.mergeChanges(context, targetItemKey, change.propertyChanges.values()));

      // merge class mixins/constraints/etc
      await merger.handleError(merger.merge(targetItemKey, change));

      // merge custom attributes
      await merger.handleError(mergeCustomAttributes(merger.context, change.customAttributeChanges.values(), async (ca) => {
        return merger.context.editor.entities.addCustomAttribute(targetItemKey, ca);
      }));
    }
  }
}
