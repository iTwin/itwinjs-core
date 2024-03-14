/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AnyArrayProperty, AnyEnumerationProperty, AnyPrimitiveProperty, AnyStructProperty,  Enumeration, KindOfQuantity, NavigationProperty, Property, PropertyCategory, PropertyProps, propertyTypeToString, RelationshipClass, SchemaItem, SchemaItemKey, SchemaItemType, schemaItemTypeToString, SchemaKey, StructClass } from "@itwin/ecschema-metadata";
import { SchemaMergeContext } from "./SchemaMerger";
import { PropertyEditResults } from "../Editing/Editor";
import { MutableProperty } from "../Editing/Mutable/MutableProperty";
import { MutableArrayProperty } from "../Editing/Mutable/MutableArrayProperty";
import { MutablePrimitiveOrEnumPropertyBase } from "../Editing/Mutable/MutablePrimitiveOrEnumProperty";
import { PropertyValueChange } from "../Validation/SchemaChanges";

async function mergePropertyAttributes(context: SchemaMergeContext, property: Property, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
  if (property.isEnumeration()) {
    return EnumPropertyMerger.mergeAttributes(context, property, attributeName, attributeNewValue, attributeOldValue);
  }
  if (property.isPrimitive()) {
    return PrimitivePropertyMerger.mergeAttributes(context, property, attributeName, attributeNewValue, attributeOldValue);
  }
  if (property.isStruct()) {
    return StructPropertyMerger.mergeAttributes(context, property, attributeName, attributeNewValue, attributeOldValue);
  }
  if (property.isNavigation()) {
    return NavigationPropertyMerger.mergeAttributes(context, property, attributeName, attributeNewValue, attributeOldValue);
  }
  return false;
}

/**
 * Updates property with attribute value changes.
 * @param context The current merging context.
 * @param property The Property object to be changed.
 * @param propertyValueChanges The changes to be applied to the property.
 * @internal
 */
export async function mergePropertyAttributeValueChanges(context: SchemaMergeContext, property: Property, propertyValueChanges: PropertyValueChange[]): Promise<PropertyEditResults> {
  for (const change of propertyValueChanges) {
    const [attributeName, attributeNewValue, attributeOldValue] = change.diagnostic.messageArgs!;
    const results = await mergePropertyAttributes(context, property, attributeName, attributeNewValue, attributeOldValue);
    if (!results) {
      return { errorMessage: `Property ${property.fullName} attribute ${attributeName} change is not implemented.` };
    }
    if (typeof results === "object" && "errorMessage" in results && results.errorMessage !== undefined) {
      return results;
    }
  }
  return { itemKey: property.class.key, propertyName: property.name };
}

/**
 * Creates a Property through a PropertyProps.
 * @param context The current merging context.
 * @param classKey The SchemaItemKey of the class.
 * @param property The Property object to be cloned.
 * @internal
 */
export async function createPropertyFromProps(context: SchemaMergeContext, classKey: SchemaItemKey, property: Property): Promise<PropertyEditResults> {
  let props = {} as PropertyProps;

  if (property.category !== undefined) {
    const sourceCategory = await property.category;
    const itemKey = new SchemaItemKey(sourceCategory.name, context.sourceSchema.schemaKey.matches(sourceCategory.schema.schemaKey)
      ? context.targetSchema.schemaKey
      : sourceCategory.schema.schemaKey,
    );
    const targetCategory = await context.targetSchema.lookupItem<PropertyCategory>(itemKey);
    if (targetCategory === undefined) {
      return { errorMessage: `Unable to locate the property category class ${sourceCategory.name} in the context schema.` };
    }
    props = {...props, category: targetCategory.fullName};
  }

  if (property.kindOfQuantity !== undefined) {
    const sourceKoq = await property.kindOfQuantity;
    const itemKey = new SchemaItemKey(sourceKoq.name, context.sourceSchema.schemaKey.matches(sourceKoq.schema.schemaKey)
      ? context.targetSchema.schemaKey
      : sourceKoq.schema.schemaKey,
    );
    const targetKoq = await context.targetSchema.lookupItem<KindOfQuantity>(itemKey);
    if (targetKoq === undefined) {
      return { errorMessage: `Unable to locate the property kind of quantity class ${sourceKoq.name} in the context schema.` };
    }
    props = {...props, kindOfQuantity: targetKoq.fullName};
  }
  if (property.isEnumeration())
    return EnumPropertyMerger.createFromProps(context, classKey, property, props);
  if (property.isPrimitive())
    return PrimitivePropertyMerger.createFromProps(context, classKey, property, props);
  if (property.isStruct())
    return StructPropertyMerger.createFromProps(context, classKey, property, props);
  if (property.isNavigation())
    return NavigationPropertyMerger.createFromProps(context, classKey, property, props);

  return { errorMessage: `Unsupported Property Type: ${propertyTypeToString(property.propertyType)}` };
}

/**
 * @internal
 */
namespace PropertyMerger {
  export async function mergeAttributes(context: SchemaMergeContext, property: Property, attributeName: string, attributeNewValue: any, _attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    const mutableProperty = property as unknown as MutableProperty;
    switch(attributeName) {
      case "type":
        return { errorMessage: `Changing the property '${property.fullName}' type is not supported.` };
      case "description":
        mutableProperty.setDescription(attributeNewValue);
        return true;
      case "label":
        mutableProperty.setLabel(attributeNewValue);
        return true;
      case "isReadOnly":
        mutableProperty.setIsReadOnly(attributeNewValue);
        return true;
      case "priority":
        mutableProperty.setPriority(attributeNewValue);
        return true;
      case "category":
        const [schemaName, itemName]  = SchemaItem.parseFullName(attributeNewValue);
        const itemKey = new SchemaItemKey(itemName, context.sourceSchema.schemaKey.compareByName(schemaName)
          ? context.targetSchema.schemaKey
          : new SchemaKey(schemaName),
        );
        return context.editor.entities.setPropertyCategory(property.class.key, property.name, itemKey);
      case "kindOfQuantity":
        return { errorMessage: `Changing the property '${property.fullName}' kind of quantity is not supported.` };
    }
    return false;
  }
}

/**
 * @internal
 */
namespace ArrayPropertyMerger {
  export async function mergeAttributes(context: SchemaMergeContext, property: AnyArrayProperty, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    const mutableProperty = property as unknown as MutableArrayProperty;
    switch (attributeName) {
      case "minOccurs":
        mutableProperty.setMinOccurs(attributeNewValue);
        return true;

      case "maxOccurs":
        mutableProperty.setMaxOccurs(attributeNewValue);
        return true;
    }
    return PropertyMerger.mergeAttributes(context, property, attributeName, attributeNewValue, attributeOldValue);
  }
}

/**
 * @internal
 */
namespace PrimitiveOrEnumPropertyMerger {
  export async function mergeAttributes(context: SchemaMergeContext, property: AnyPrimitiveProperty | AnyEnumerationProperty, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    const mutableProperty = property as unknown as MutablePrimitiveOrEnumPropertyBase;
    switch (attributeName) {
      case "extendedTypeName": {
        mutableProperty.setExtendedTypeName(attributeNewValue);
        return true;
      }
      case "minLength": {
        mutableProperty.setMinLength(attributeNewValue);
        return true;
      }
      case "maxLength": {
        mutableProperty.setMaxLength(attributeNewValue);
        return true;
      }
      case "minValue": {
        mutableProperty.setMinValue(attributeNewValue);
        return true;
      }
      case "maxValue": {
        mutableProperty.setMaxValue(attributeNewValue);
        return true;
      }
    }
    if (property.isArray()) {
      return ArrayPropertyMerger.mergeAttributes(context, property, attributeName, attributeNewValue, attributeOldValue);
    }
    return PropertyMerger.mergeAttributes(context, property, attributeName, attributeNewValue, attributeOldValue);
  }
}

/**
 * @internal
 */
namespace EnumPropertyMerger {
  export async function createFromProps(context: SchemaMergeContext, classKey: SchemaItemKey, property: AnyEnumerationProperty, props: PropertyProps): Promise<PropertyEditResults> {
    if (property.enumeration === undefined) {
      return { errorMessage: `Property ${property.fullName} is missing the required 'enumeration' attribute.` };
    }

    const enumeration = await property.enumeration;
    const itemKey = new SchemaItemKey(enumeration.name, context.sourceSchema.schemaKey.matches(enumeration.schema.schemaKey)
      ? context.targetSchema.schemaKey
      : enumeration.schema.schemaKey,
    );
    const type = await context.targetSchema.lookupItem<Enumeration>(itemKey);
    if (type === undefined) {
      return { errorMessage: `Unable to locate the enumeration class ${enumeration.name} in the context schema.` };
    }

    const enumProps = {
      ...property.toJSON(),
      ...props,
      typeName: type.fullName,
    };

    if (property.isArray()) {
      return context.editor.entities.createEnumerationArrayPropertyFromProps(classKey, property.name, type, enumProps);
    }
    return context.editor.entities.createEnumerationPropertyFromProps(classKey, property.name, type, enumProps);
  }

  export async function mergeAttributes(context: SchemaMergeContext, property: AnyEnumerationProperty, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    switch (attributeName) {
      case "enumeration":
        return { errorMessage: `Changing the property '${property.fullName}' enumeration is not supported.` };
    }
    return PrimitiveOrEnumPropertyMerger.mergeAttributes(context, property, attributeName, attributeNewValue, attributeOldValue);
  }
}

/**
 * @internal
 */
namespace PrimitivePropertyMerger {
  export async function createFromProps(context: SchemaMergeContext, classKey: SchemaItemKey, property: AnyPrimitiveProperty, props: PropertyProps): Promise<PropertyEditResults> {
    const primitiveProps = {
      ...property.toJSON(),
      ...props,
    };

    if (property.isArray()) {
      return context.editor.entities.createPrimitiveArrayPropertyFromProps(classKey, property.name, property.primitiveType, primitiveProps);
    }
    return context.editor.entities.createPrimitivePropertyFromProps(classKey, property.name, property.primitiveType, primitiveProps);
  }

  export async function mergeAttributes(context: SchemaMergeContext, property: AnyPrimitiveProperty, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    switch (attributeName) {
      case "primitiveType":
        return { errorMessage: `Changing the property '${property.fullName}' primitiveType is not supported.` };
    }
    return PrimitiveOrEnumPropertyMerger.mergeAttributes(context, property, attributeName, attributeNewValue, attributeOldValue);
  }
}

/**
 * @internal
 */
namespace StructPropertyMerger {
  export async function createFromProps(context: SchemaMergeContext, classKey: SchemaItemKey, property: AnyStructProperty, props: PropertyProps): Promise<PropertyEditResults> {
    const itemKey = new SchemaItemKey(property.structClass.name, context.sourceSchema.schemaKey.matches(property.structClass.schema.schemaKey)
      ? context.targetSchema.schemaKey
      : property.structClass.schema.schemaKey,
    );
    const type = await context.targetSchema.lookupItem<StructClass>(itemKey);
    if (type === undefined) {
      return { errorMessage: `Unable to locate the struct class ${property.structClass.name} in the context schema.` };
    }

    const structProps = {
      ...property.toJSON(),
      ...props,
      typeName: type.fullName,
    };

    if (property.isArray()) {
      return context.editor.entities.createStructArrayPropertyFromProps(classKey, property.name, type, structProps);
    }
    return context.editor.entities.createStructPropertyFromProps(classKey, property.name, type, structProps);
  }

  export async function mergeAttributes(context: SchemaMergeContext, property: AnyStructProperty, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    switch (attributeName) {
      case "structClass":
        return { errorMessage: `Changing the property '${property.fullName}' structClass is not supported.` };
    }
    if (property.isArray()) {
      return ArrayPropertyMerger.mergeAttributes(context, property, attributeName, attributeNewValue, attributeOldValue);
    }
    return PropertyMerger.mergeAttributes(context, property, attributeName, attributeNewValue, attributeOldValue);
  }
}

/**
 * @internal
 */
namespace NavigationPropertyMerger {
  export async function createFromProps(context: SchemaMergeContext, classKey: SchemaItemKey, property: NavigationProperty, props: PropertyProps): Promise<PropertyEditResults> {
    const itemKey = new SchemaItemKey(property.relationshipClass.name, context.sourceSchema.schemaKey.matches(property.relationshipClass.schemaKey)
      ? context.targetSchema.schemaKey
      : property.relationshipClass.schemaKey,
    );
    const type = await context.targetSchema.lookupItem<RelationshipClass>(itemKey);
    if (type === undefined) {
      return { errorMessage: `Unable to locate the relationship class ${property.relationshipClass.name} in the context schema.` };
    }

    const navigationProps = {
      ...property.toJSON(),
      ...props,
      relationshipName: type.fullName,
    };

    if (property.class.schemaItemType === SchemaItemType.EntityClass)
      return context.editor.entities.createNavigationPropertyFromProps(classKey, navigationProps);
    if (property.class.schemaItemType === SchemaItemType.Mixin)
      return context.editor.mixins.createNavigationPropertyFromProps(classKey, navigationProps);
    if (property.class.schemaItemType === SchemaItemType.RelationshipClass)
      return context.editor.relationships.createNavigationPropertyFromProps(classKey, navigationProps);
    return { errorMessage: `Navigation property can't be added to ${schemaItemTypeToString(property.class.schemaItemType)}.` };
  }

  export async function mergeAttributes(context: SchemaMergeContext, property: NavigationProperty, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    switch (attributeName) {
      case "direction": {
        return { errorMessage: `Changing the property '${property.fullName}' direction is not supported.` };
      }
      case "relationshipClass": {
        return { errorMessage: `Changing the property '${property.fullName}' relationship class is not supported.` };
      }
    }
    return PropertyMerger.mergeAttributes(context, property, attributeName, attributeNewValue, attributeOldValue);
  }
}
