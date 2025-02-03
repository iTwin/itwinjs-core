/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { SchemaMergeContext } from "./SchemaMerger";
import type { AnyClassItemDifference, ClassPropertyDifference, DifferenceType } from "../Differencing/SchemaDifference";
import { AnyProperty, AnyPropertyProps, ArrayPropertyProps, CustomAttribute, ECClass, Enumeration, EnumerationPropertyProps, NavigationPropertyProps, parsePrimitiveType, PrimitivePropertyProps, RelationshipClass, SchemaItemKey, SchemaItemType, StructClass, StructPropertyProps } from "@itwin/ecschema-metadata";
import { getClassEditor, toItemKey, toPropertyKey, updateSchemaItemFullName, updateSchemaItemKey } from "./Utils";
import { MutableProperty } from "../Editing/Mutable/MutableProperty";
import { applyCustomAttributes } from "./CustomAttributeMerger";

type PartialEditable<T> = {
  -readonly [P in keyof T]: T[P];
};

interface PropertyMerger<T extends AnyPropertyProps> {
  is(property: AnyPropertyProps): property is T;
  add(context: SchemaMergeContext, itemKey: SchemaItemKey, props: PartialEditable<T>): Promise<void>;
  merge(context: SchemaMergeContext, itemKey: SchemaItemKey, property: AnyProperty, props: T): Promise<void>;
}

/**
 * @internal
 */
export async function mergePropertyDifference(context: SchemaMergeContext, change: ClassPropertyDifference): Promise<void> {
  const classKey = new SchemaItemKey(change.itemName, context.targetSchemaKey);
  return mergeClassProperty(context, change, classKey, {
    ...change.difference,
    name: change.path,
  } as AnyPropertyProps);
}

/**
 * @internal
 */
export async function mergeClassProperties(context: SchemaMergeContext, change: AnyClassItemDifference, itemKey: SchemaItemKey): Promise<void> {
  for (const property of change.difference.properties || []) {
    await mergeClassProperty(context, change, itemKey, property);
  }
}

async function mergeClassProperty(context: SchemaMergeContext, change: { changeType: DifferenceType }, itemKey: SchemaItemKey, property: AnyPropertyProps) {
  return change.changeType === "add"
    ? addClassProperty(context, itemKey, property)
    : modifyClassProperty(context, itemKey, property);
}

async function addClassProperty(context: SchemaMergeContext, itemKey: SchemaItemKey, property: PartialEditable<AnyPropertyProps>): Promise<void> {
  const ecClass = await context.targetSchema.lookupItem(toItemKey(context, itemKey.name)) as ECClass;

  if (property.category !== undefined) {
    property.category = await updateSchemaItemFullName(context, property.category);
  }

  if (property.kindOfQuantity !== undefined) {
    property.kindOfQuantity = await updateSchemaItemFullName(context, property.kindOfQuantity);
  }

  await createProperty(context, ecClass.key, property);

  if (property.customAttributes !== undefined) {
    await applyCustomAttributes(context, property.customAttributes as CustomAttribute[], async (ca) => {
      const classEditor = await getClassEditor(context, ecClass.key);
      await classEditor.properties.addCustomAttribute(ecClass.key, property.name, ca);
    });
  }
}

async function createProperty(context: SchemaMergeContext, itemKey: SchemaItemKey, property: PartialEditable<AnyPropertyProps>) {
  if (enumerationProperty.is(property)) {
    return enumerationProperty.add(context, itemKey, property);
  }
  if (navigationProperty.is(property)) {
    return navigationProperty.add(context, itemKey, property);
  }
  if (primitiveProperty.is(property)) {
    return primitiveProperty.add(context, itemKey, property);
  }
  if (structProperty.is(property)) {
    return structProperty.add(context, itemKey, property);
  }
  return {};
}

async function modifyClassProperty(context: SchemaMergeContext, itemKey: SchemaItemKey, propertyProps: AnyPropertyProps): Promise<void> {
  const ecClass = await context.targetSchema.lookupItem(toItemKey(context, itemKey.name)) as ECClass;
  const propertyKey = toPropertyKey(context, itemKey.name, propertyProps.name);
  const property = await ecClass.getProperty(propertyKey.propertyName) as MutableProperty;

  if (property === undefined) {
    throw new Error(`Couldn't find property ${propertyKey.propertyName} on class ${ecClass.key.name}`);
  }

  if (propertyProps.type !== undefined) {
    throw new Error(`Changing the property '${property.fullName}' type is not supported.`);
  }

  const classEditor = await getClassEditor(context, ecClass);

  if (propertyProps.description !== undefined) {
    await classEditor.properties.setDescription(ecClass.key, property.name, propertyProps.description);
  }
  if (propertyProps.label !== undefined) {
    await classEditor.properties.setLabel(ecClass.key, property.name, propertyProps.label);
  }
  if (propertyProps.isReadOnly !== undefined) {
    await classEditor.properties.setIsReadOnly(ecClass.key, property.name, propertyProps.isReadOnly);
  }
  if (propertyProps.priority !== undefined) {
    await classEditor.properties.setPriority(ecClass.key, property.name, propertyProps.priority);
  }
  if (propertyProps.kindOfQuantity !== undefined) {
    await classEditor.properties.setKindOfQuantity(ecClass.key, property.name, await updateSchemaItemKey(context, propertyProps.kindOfQuantity));
  }

  if (property.isArray()) {
    await arrayProperty.merge(context, ecClass.key, property.name, propertyProps);
  }

  if (propertyProps.category !== undefined) {
    const categoryKey = await updateSchemaItemKey(context, propertyProps.category);
    await classEditor.properties.setCategory(ecClass.key, property.name, categoryKey);
  }

  if (property.isEnumeration()) {
    return enumerationProperty.merge(context, ecClass.key, property, propertyProps as any);
  }
  if (property.isNavigation()) {
    return navigationProperty.merge(context, ecClass.key, property, propertyProps as any);
  }
  if (property.isPrimitive()) {
    return primitiveProperty.merge(context, ecClass.key, property, propertyProps as any);
  }
  if (property.isStruct()) {
    return structProperty.merge(context, ecClass.key, property, propertyProps as any);
  }
}

const arrayProperty = {
  is(property: AnyPropertyProps): boolean {
    return "minOccurs" in property && "maxOccurs" in property;
  },
  async merge(context: SchemaMergeContext, itemKey: SchemaItemKey, propertyName: string, props: ArrayPropertyProps) {
    const classEditor = await getClassEditor(context, itemKey);
    if (props.minOccurs !== undefined) {
      await classEditor.arrayProperties.setMinOccurs(itemKey, propertyName, props.minOccurs);
    }
    if (props.maxOccurs !== undefined) {
      await classEditor.arrayProperties.setMaxOccurs(itemKey, propertyName, props.maxOccurs);
    }
  },
};

const enumerationProperty: PropertyMerger<EnumerationPropertyProps> = {
  is(property): property is EnumerationPropertyProps {
    return primitiveProperty.is(property) && property.typeName.includes(".");
  },
  async add(context, itemKey, property): Promise<void> {
    const enumerationKey = await updateSchemaItemKey(context, property.typeName);
    const enumerationType = await context.editor.schemaContext.getTypedSchemaItem(enumerationKey, Enumeration);
    if (enumerationType === undefined) {
      throw new Error(`Unable to locate the enumeration class ${enumerationKey.name} in the context schema.`);
    }

    property.typeName = enumerationType.fullName;

    const classEditor = await getClassEditor(context, itemKey);

    arrayProperty.is(property)
      ? await classEditor.createEnumerationArrayPropertyFromProps(itemKey, property.name, enumerationType, property)
      : await classEditor.createEnumerationPropertyFromProps(itemKey, property.name, enumerationType, property);
  },
  async merge(context, itemKey, property, props) {
    if ("enumeration" in props && props.enumeration !== undefined) {
      throw new Error(`Changing the property '${property.fullName}' enumeration is not supported.`);
    }
    return primitiveProperty.merge(context, itemKey, property, props);
  },
};

const navigationProperty: PropertyMerger<NavigationPropertyProps> = {
  is(property): property is NavigationPropertyProps {
    return property.type === "NavigationProperty";
  },
  async add(context, itemKey, property): Promise<void> {
    const relationshipKey = await updateSchemaItemKey(context, property.relationshipName);
    const relationshipType = await context.editor.schemaContext.getTypedSchemaItem(relationshipKey, RelationshipClass);
    if (relationshipType === undefined) {
      throw new Error(`Unable to locate the relationship class ${relationshipKey.name} in the context schema.`);
    }

    property.relationshipName = relationshipType.fullName;

    const ecClass = await context.editor.schemaContext.getSchemaItem(itemKey) as ECClass;
    if (ecClass.schemaItemType === SchemaItemType.EntityClass)
      return context.editor.entities.createNavigationPropertyFromProps(ecClass.key, property);
    if (ecClass.schemaItemType === SchemaItemType.Mixin)
      return context.editor.mixins.createNavigationPropertyFromProps(ecClass.key, property);
    if (ecClass.schemaItemType === SchemaItemType.RelationshipClass)
      return context.editor.relationships.createNavigationPropertyFromProps(ecClass.key, property);
    throw new Error(`Navigation property can't be added to ${ecClass.schemaItemType}.`);
  },
  async merge(_context, _itemKey, property, props) {
    if (props.direction !== undefined) {
      throw new Error(`Changing the property '${property.fullName}' direction is not supported.`);
    }
    if ("relationshipClass" in props && props.relationshipClass !== undefined) {
      throw new Error(`Changing the property '${property.fullName}' relationship class is not supported.`);
    }
  },
};

const primitiveProperty: PropertyMerger<PrimitivePropertyProps> = {
  is(property): property is PrimitivePropertyProps {
    return property.type === "PrimitiveProperty" || property.type === "PrimitiveArrayProperty";
  },
  async add(context, itemKey, property): Promise<void> {
    const propertyType = parsePrimitiveType(property.typeName);
    if (propertyType === undefined) {
      throw new Error(`Invalid property type ${property.typeName} on property ${property.name}`);
    }

    const classEditor = await getClassEditor(context, itemKey);
    return arrayProperty.is(property)
      ? classEditor.createPrimitiveArrayPropertyFromProps(itemKey, property.name, propertyType, property)
      : classEditor.createPrimitivePropertyFromProps(itemKey, property.name, propertyType, property);
  },
  async merge(context, itemKey, property, props) {
    if (props.typeName) {
      throw new Error(`Changing the property '${property.fullName}' primitiveType is not supported.`);
    }

    const classEditor = await getClassEditor(context, itemKey);
    if (props.extendedTypeName !== undefined) {
      await classEditor.primitiveProperties.setExtendedTypeName(itemKey, property.name, props.extendedTypeName);
    }
    if (props.minLength !== undefined) {
      await classEditor.primitiveProperties.setMinLength(itemKey, property.name, props.minLength);
    }
    if (props.maxLength !== undefined) {
      await classEditor.primitiveProperties.setMaxLength(itemKey, property.name, props.maxLength);
    }
    if (props.minValue !== undefined) {
      await classEditor.primitiveProperties.setMinValue(itemKey, property.name, props.minValue);
    }
    if (props.maxValue !== undefined) {
      await classEditor.primitiveProperties.setMaxValue(itemKey, property.name, props.maxValue);
    }
  },
};

const structProperty: PropertyMerger<StructPropertyProps> = {
  is(property): property is StructPropertyProps {
    return property.type === "StructProperty" || property.type === "StructArrayProperty";
  },
  async add(context, itemKey, property): Promise<void> {
    const structKey = await updateSchemaItemKey(context, property.typeName);
    const structType = await context.editor.schemaContext.getTypedSchemaItem(structKey, StructClass);
    if (structType === undefined) {
      throw new Error(`Unable to locate the struct ${structKey.name} in the context schema.`);
    }

    property.typeName = structType.fullName;

    const classEditor = await getClassEditor(context, itemKey);
    return arrayProperty.is(property)
      ? classEditor.createStructArrayPropertyFromProps(itemKey, property.name, structType, property)
      : classEditor.createStructPropertyFromProps(itemKey, property.name, structType, property);
  },
  async merge(_context, _itemKey, property, props) {
    if ("structClass" in props && props.structClass !== undefined) {
      throw new Error(`Changing the property '${property.fullName}' structClass is not supported.`);
    }
  },
};
