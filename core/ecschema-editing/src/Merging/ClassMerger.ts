/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttribute, CustomAttributeClass, ECClass, ECClassModifier, Mixin, parseClassModifier, SchemaItem, SchemaItemKey, schemaItemTypeToString, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaItemEditResults } from "../Editing/Editor";
import { MutableClass } from "../Editing/Mutable/MutableClass";
import { SchemaMergeContext } from "./SchemaMerger";
import { BaseClassDelta, ChangeType, ClassChanges, CustomAttributeContainerChanges, EntityMixinChanges, PropertyValueChange } from "../Validation/SchemaChanges";
import { ClassPropertyMerger } from "./ClassPropertyMerger";

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

  protected async addMixin(itemKey: SchemaItemKey, mixin: Mixin): Promise<SchemaItemEditResults> {
    return { errorMessage: `Adding mixin '${mixin.name}' to '${itemKey.name}' class is not implemented.` };
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

  private async addMixins(itemKey: SchemaItemKey, entityMixinChanges: Iterable<EntityMixinChanges>, changeType?: ChangeType): Promise<SchemaItemEditResults> {
    if (changeType === ChangeType.Missing) {
      for (const entityMixinChange of entityMixinChanges) {
        for (const change of entityMixinChange.entityMixinChange) {
          const mixins = change.diagnostic.messageArgs! as unknown as [Mixin];
          for (const mixin of mixins) {
            const result = await this.addMixin(itemKey, mixin);
            if (result.errorMessage !== undefined) {
              return result;
            }
          }
        }
      }
      return {};
    }
    return { errorMessage: `Changing the class '${itemKey.name}' mixins is not supported.`};
  }

  private async mergeAttributeValueChanges(itemKey: SchemaItemKey, propertyValueChanges: PropertyValueChange[]) {
    if (propertyValueChanges.length === 0) {
      return;
    }

    const targetItem = await this.context.targetSchema.lookupItem<TClass>(itemKey);
    if (targetItem === undefined) {
      throw new Error(`'${itemKey.name}' class could not be located in the merged schema.`);
    }

    for (const change of propertyValueChanges) {
      const [attributeName, attributeNewValue, attributeOldValue] = change.diagnostic.messageArgs!;
      const results = await this.mergeAttributes(targetItem, attributeName, attributeNewValue, attributeOldValue);
      if (this.isSchemaItemEditResults(results) && results.errorMessage !== undefined) {
        throw new Error(results.errorMessage);
      }
    }
  }

  private async mergeCustomAttributes(classKey: SchemaItemKey, changes: Iterable<CustomAttributeContainerChanges>): Promise<SchemaItemEditResults> {
    for (const customAttributeContainerChange of changes) {
      for (const change of customAttributeContainerChange.customAttributeChanges) {
        if (change.changeType === ChangeType.Missing) {
          const sourceCustomAttribute = change.diagnostic.messageArgs![0] as CustomAttribute;
          const [schemaName, itemName] = SchemaItem.parseFullName(sourceCustomAttribute.className);
          const schemaItemKey = new SchemaItemKey(itemName, this.context.sourceSchema.schemaKey.compareByName(schemaName)
            ? this.context.targetSchema.schemaKey
            : new SchemaKey(schemaName),
          );
          const targetCustomAttribute = await this.context.targetSchema.lookupItem<CustomAttributeClass>(schemaItemKey);
          if (targetCustomAttribute === undefined) {
            return { errorMessage: `Unable to locate the custom attribute class ${schemaItemKey.name} in the merged schema.`};
          }

          const customAttribute = {
            ...sourceCustomAttribute,
            className: targetCustomAttribute.fullName,
          };

          const results = await this.context.editor.entities.addCustomAttribute(classKey, customAttribute);
          if (results.errorMessage !== undefined) {
            return {  errorMessage: results.errorMessage };
          }
        } else {
          return { errorMessage: `Changes of Custom Attribute ${customAttributeContainerChange.ecTypeName} on ${classKey.name} merge is not implemented.`};
        }
      }
    }
    return { itemKey: classKey };
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

        const results = await merger.create(context.targetSchema.schemaKey, sourceItem);
        if (results.errorMessage !== undefined) {
          throw new Error(results.errorMessage);
        }
        targetItemKey = results.itemKey!;
      }

      if (change.baseClassDelta !== undefined) {
        const results = await merger.setBaseClass(targetItemKey, change.baseClassDelta, changeType);
        if (results.errorMessage !== undefined) {
          throw new Error(results.errorMessage);
        }
      }

      if (change.entityMixinChanges.size > 0) {
        const results = await merger.addMixins(targetItemKey, change.entityMixinChanges.values(), changeType);
        if (results.errorMessage !== undefined) {
          throw new Error(results.errorMessage);
        }
      }

      await merger.mergeAttributeValueChanges(targetItemKey, change.propertyValueChanges);
      let mergeResults  = await ClassPropertyMerger.mergeChanges(context, targetItemKey, change.propertyChanges.values());
      if (mergeResults.errorMessage !== undefined) {
        throw new Error(mergeResults.errorMessage);
      }

      // merge custom attributes
      mergeResults = await merger.mergeCustomAttributes(targetItemKey, change.customAttributeChanges.values());
      if (mergeResults.errorMessage !== undefined) {
        throw new Error(mergeResults.errorMessage);
      }
    }
  }
}
