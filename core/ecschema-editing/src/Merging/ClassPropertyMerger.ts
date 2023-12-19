/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttribute, CustomAttributeClass, ECClass, Property, propertyTypeToString, SchemaItem, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";
import { PropertyEditResults, SchemaItemEditResults } from "../Editing/Editor";
import { ChangeType, CustomAttributeContainerChanges, PropertyChanges, PropertyValueChange } from "../Validation/SchemaChanges";
import { SchemaMergeContext } from "./SchemaMerger";
import { StructPropertyMerger } from "./StructPropertyMerger";
import { EnumerationArrayPropertyMerger, PrimitiveArraPropertyMerger, StructArrayPropertyMerger } from "./ArrayPropertyMerger";
import { AnyPropertyMerger } from "./AnyPropertyMerger";
import { EnumerationPropertyMerger, PrimitivePropertyMerger } from "./PrimitiveOrEnumPropertyMerger";

/**
 * @internal
 */
export class ClassPropertyMerger {
  protected readonly context: SchemaMergeContext;

  constructor(context: SchemaMergeContext) {
    this.context = context;
  }

  private getPropertyMerger(property: Property): AnyPropertyMerger<Property> {
    if (property.isEnumeration()) {
      if (property.isArray()) {
        return new EnumerationArrayPropertyMerger(this.context);
      }
      return new EnumerationPropertyMerger(this.context);
    }
    if (property.isPrimitive()) {
      if (property.isArray()) {
        return new PrimitiveArraPropertyMerger(this.context);
      }
      return new PrimitivePropertyMerger(this.context);
    }
    if (property.isStruct()) {
      if (property.isArray()) {
        return new StructArrayPropertyMerger(this.context);
      }
      return new StructPropertyMerger(this.context);
    }
    throw new Error(`Unsupported Property Type: ${propertyTypeToString(property.propertyType)}`);
  }

  protected isPropertyEditResults(obj: any): obj is PropertyEditResults {
    return typeof obj === "object" && "errorMessage" in obj;
  }

  private async mergeAttributeValueChanges(targetProperty: Property, propertyValueChanges: PropertyValueChange[]) {
    if (propertyValueChanges.length === 0)
      return;

    const merger = this.getPropertyMerger(targetProperty);

    for (const change of propertyValueChanges) {
      const [attributeName, attributeNewValue, attributeOldValue] = change.diagnostic.messageArgs!;
      const results = await merger.mergeAttributes(targetProperty, attributeName, attributeNewValue, attributeOldValue);
      if (this.isPropertyEditResults(results) && results.errorMessage !== undefined) {
        throw new Error(results.errorMessage);
      }
    }
  }

  private async mergeCustomAttributes(classKey: SchemaItemKey, propertyName: string, changes: Iterable<CustomAttributeContainerChanges>): Promise<PropertyEditResults> {
    for (const customAttributeContainerChange of changes) {
      for (const change of customAttributeContainerChange.customAttributeChanges) {
        if (change.changeType === ChangeType.Missing) {
          const sourceCustomAttribute = change.diagnostic.messageArgs![0] as CustomAttribute;
          const [schemaName, itemName] = SchemaItem.parseFullName(sourceCustomAttribute.className);
          const schemaItemKey = new SchemaItemKey(itemName, this.context.sourceSchema.schemaKey.compareByName(schemaName)
            ? classKey.schemaKey
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

          const results = await this.context.editor.entities.addCustomAttributeToProperty(classKey, propertyName, customAttribute);
          if (results.errorMessage !== undefined) {
            return {  errorMessage: results.errorMessage };
          }
        } else {
          return { errorMessage: `Changes of Custom Attribute ${customAttributeContainerChange.ecTypeName} on ${classKey.name} merge is not implemented.`};
        }
      }
    }
    return { itemKey: classKey, propertyName };
  }

  public static async mergeChanges(context: SchemaMergeContext, classKey: SchemaItemKey, propertyChanges: Iterable<PropertyChanges>): Promise<SchemaItemEditResults> {
    const merger = new this(context);

    for (const change of propertyChanges) {
      const targetItem = await context.targetSchema.lookupItem<ECClass>(classKey);
      if (targetItem === undefined) {
        return { errorMessage: `'${classKey.name}' class could not be located in the merged schema.`};
      }

      if (change.propertyMissing?.changeType === ChangeType.Missing) {
        const sourceProperty = change.propertyMissing.diagnostic.ecDefinition as unknown as Property;
        if (await targetItem.getProperty(change.ecTypeName) !== undefined) {
          return { errorMessage: `Merged schema already contains a class '${classKey.name}' property '${change.ecTypeName}'.`};
        }

        const propertyMerger =  merger.getPropertyMerger(sourceProperty);
        const results  = await propertyMerger.createFromProps(classKey, sourceProperty);
        if (results.errorMessage !== undefined) {
          return { errorMessage: results.errorMessage};
        }
      } else {
        const targetProperty = (await targetItem.getProperty(change.ecTypeName))!;
        await merger.mergeAttributeValueChanges(targetProperty, change.propertyValueChanges);
      }

      const mergeResults = await merger.mergeCustomAttributes(classKey, change.ecTypeName, change.customAttributeChanges.values());
      if (mergeResults.errorMessage !== undefined) {
        return { errorMessage: mergeResults.errorMessage};
      }
    }
    return { itemKey: classKey };
  }
}
