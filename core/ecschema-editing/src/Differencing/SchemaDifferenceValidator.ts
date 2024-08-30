/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import { ECClass, ECClassModifier, EntityClass, Enumeration, KindOfQuantity, LazyLoadedSchemaItem, Mixin, primitiveTypeToString, Property, propertyTypeToString, Schema, SchemaItem, SchemaItemKey, SchemaItemType } from "@itwin/ecschema-metadata";
import { AnySchemaDifference, AnySchemaItemDifference, ClassItemDifference, ClassPropertyDifference, ConstantDifference, CustomAttributeClassDifference, CustomAttributeDifference, EntityClassDifference, EntityClassMixinDifference, EnumerationDifference, EnumeratorDifference, FormatDifference, InvertedUnitDifference, KindOfQuantityDifference, MixinClassDifference, PhenomenonDifference, PropertyCategoryDifference, RelationshipClassDifference, RelationshipConstraintClassDifference, RelationshipConstraintDifference, SchemaDifference, SchemaOtherTypes, SchemaReferenceDifference, StructClassDifference, UnitDifference, UnitSystemDifference } from "./SchemaDifference";
import { ConflictCode, SchemaDifferenceConflict } from "./SchemaConflicts";
import { ISchemaDifferenceVisitor, SchemaDifferenceWalker } from "./SchemaDifferenceVisitor";

/**
 *
 * @param targetSchema
 * @param differences
 * @returns
 */
export async function validateDifferences(differences: AnySchemaDifference[], targetSchema: Schema, sourceSchema: Schema) {
  const visitor = new SchemaDifferenceValidationVisitor(targetSchema, sourceSchema);
  const walker = new SchemaDifferenceWalker(visitor);

  await walker.traverse(differences);

  for (const [search, replace] of visitor.replacements) {
    const index = differences.findIndex((entry) => entry === search);
    if (index > -1) {
      differences[index] = replace;
    }
  }

  return visitor.conflicts;
}

/**
 * @internal
 */
class SchemaDifferenceValidationVisitor implements ISchemaDifferenceVisitor {

  public readonly conflicts: Array<SchemaDifferenceConflict>;
  public readonly replacements: Array<[AnySchemaDifference, AnySchemaDifference]>;

  private readonly _sourceSchema: Schema;
  private readonly _targetSchema: Schema;

  constructor(targetSchema: Schema, sourceSchema: Schema) {
    this.conflicts = [];
    this.replacements = [];
    this._targetSchema = targetSchema;
    this._sourceSchema = sourceSchema;
  }

  private addConflict(conflict: SchemaDifferenceConflict) {
    this.conflicts.push(conflict);
  }

  private async createPropertyConflict(entry: ClassPropertyDifference, targetProperty: Property) {
    const sourceClass = await this._sourceSchema.getItem(targetProperty.class.name) as ECClass;
    const sourceProperty = await sourceClass.getProperty(targetProperty.name) as Property;

    this.addConflict({
      code: ConflictCode.ConflictingPropertyName,
      schemaType: targetProperty.class.schemaItemType,
      itemName: targetProperty.class.name,
      path: targetProperty.name,
      source: resolvePropertyTypeName(sourceProperty),
      target: resolvePropertyTypeName(targetProperty),
      description: "Target class already contains a property with a different type.",
    });

    // Since the property can't merged with this conflict, the "modify" entry is replaced with a
    // full item body add entry.
    this.replaceDifference(entry, {
      changeType: "add",
      schemaType: SchemaOtherTypes.Property,
      itemName: targetProperty.class.name,
      path: targetProperty.name,
      difference: sourceProperty.toJSON(),
    });
  }

  private replaceDifference(difference: AnySchemaDifference, replacer: AnySchemaDifference) {
    this.replacements.push([difference, replacer]);
  }

  private async getSchemaItem<T extends SchemaItem>(name: string): Promise<T> {
    const item = await this._targetSchema.getItem<T>(name);
    if (item === undefined) {
      throw new Error();
    }
    return item;
  }

  public async visitSchemaDifference(_entry: SchemaDifference) {
    // Nothing to validate
  }

  public async visitSchemaReferenceDifference(_entry: SchemaReferenceDifference) {
    // Nothing to validate
  }

  public async visitSchemaItemDifference(entry: AnySchemaItemDifference, targetSchemaItem: SchemaItem) {
    if ("schemaItemType" in entry.difference) {
      this.addConflict({
        code: ConflictCode.ConflictingItemName,
        schemaType: targetSchemaItem.schemaItemType,
        itemName: targetSchemaItem.name,
        source: entry.difference.schemaItemType,
        target: targetSchemaItem.schemaItemType,
        description: "Target schema already contains a schema item with the name but different type.",
      });

      // Since the item can't merged with this conflict, the "modify" entry is replaced with a
      // full item body add entry.
      const sourceItem = await this._sourceSchema.getItem(entry.itemName) as SchemaItem;
      this.replaceDifference(entry, {
        changeType: "add",
        schemaType: entry.schemaType,
        itemName: entry.itemName,
        difference: sourceItem.toJSON() as any,
      });
      return false;
    }

    return true;
  }

  public async visitBaseClassDifference(entry: ClassItemDifference, targetClassItem: ECClass) {
    if (entry.difference.baseClass === undefined && targetClassItem.baseClass !== undefined) {
      this.addConflict({
        code: ConflictCode.RemovingBaseClass,
        schemaType: targetClassItem.schemaItemType,
        itemName: targetClassItem.name,
        path: "$baseClass",
        source: null,
        target: resolveLazyItemName(targetClassItem.baseClass),
        description: "BaseClass cannot be removed, if there has been a baseClass before.",
      });
      return;
    }

    if (entry.difference.baseClass === undefined) {
      return;
    }

    const sourceBaseClass = await this._sourceSchema.lookupItem<ECClass>(entry.difference.baseClass);
    if (sourceBaseClass === undefined) {
      return;
    }

    if (sourceBaseClass.modifier === ECClassModifier.Sealed) {
      this.addConflict({
        code: ConflictCode.SealedBaseClass,
        schemaType: targetClassItem.schemaItemType,
        itemName: targetClassItem.name,
        path: "$baseClass",
        source: sourceBaseClass.fullName,
        target: resolveLazyItemName(targetClassItem.baseClass),
        description: "BaseClass is sealed.",
      });
      return;
    }

    const baseClassKey = targetClassItem.baseClass as Readonly<SchemaItemKey>;
    if (baseClassKey === undefined) {
      return;
    }

    if (!await derivedFrom(sourceBaseClass, baseClassKey.name)) {
      this.addConflict({
        code: ConflictCode.ConflictingBaseClass,
        schemaType: targetClassItem.schemaItemType,
        itemName: targetClassItem.name,
        path: "$baseClass",
        source: sourceBaseClass.fullName,
        target: resolveLazyItemName(targetClassItem.baseClass),
        description: "BaseClass is not valid, source class must derive from target.",
      });
    }
  }

  public async visitClassDifference(entry: ClassItemDifference) {
    if (entry.changeType !== "modify") {
      return;
    }

    const targetClassItem = await this.getSchemaItem<ECClass>(entry.itemName);
    if (!await this.visitSchemaItemDifference(entry, targetClassItem)) {
      return;
    }

    await this.visitBaseClassDifference(entry, targetClassItem);
  }

  public async visitConstantDifference(entry: ConstantDifference) {
    if (entry.changeType === "modify") {
      await this.visitSchemaItemDifference(entry, await this.getSchemaItem(entry.itemName));
    }
  }

  public async visitCustomAttributeClassDifference(entry: CustomAttributeClassDifference) {
    if (entry.changeType === "modify") {
      await this.visitClassDifference(entry);
    }
  }

  public async visitCustomAttributeInstanceDifference(_entry: CustomAttributeDifference) {
    // Nothing to validate
  }

  public async visitEntityClassDifference(entry: EntityClassDifference) {
    if (entry.changeType === "modify") {
      await this.visitClassDifference(entry);
    }
  }

  public async visitEntityClassMixinDifference(entry: EntityClassMixinDifference) {
    const targetSchemaClass = await this.getSchemaItem<EntityClass>(entry.itemName);
    for (const addedMixin of entry.difference) {
      // To validate the added mixins, the instance from the source schema it fetched,
      // otherwise validation gets too complicated as the mixin must not be existing in
      // the current target schema, it could also be added to the schema.
      const sourceMixin = await this._sourceSchema.lookupItem<Mixin>(addedMixin);
      const sourceSchemaItem = await this._sourceSchema.getItem<EntityClass>(entry.itemName);
      if (sourceMixin === undefined) {
        return;
      }

      const appliesTo = sourceMixin.appliesTo as Readonly<SchemaItemKey>;
      if (appliesTo && !await derivedFrom(sourceSchemaItem, appliesTo.name)) {
        this.addConflict({
          code: ConflictCode.MixinAppliedMustDeriveFromConstraint,
          schemaType: targetSchemaClass.schemaItemType,
          itemName: targetSchemaClass.name,
          path: "$mixins",
          source: sourceMixin.fullName,
          target: undefined,
          description: "Mixin cannot applied to this class.",
        });
      }
    }
  }

  public async visitEnumerationDifference(entry: EnumerationDifference) {
    if (entry.changeType !== "modify") {
      return;
    }

    const enumeration = await this.getSchemaItem<Enumeration>(entry.itemName);
    if (!await this.visitSchemaItemDifference(entry, enumeration)) {
      return;
    }

    if (entry.difference.type) {
      this.addConflict({
        code: ConflictCode.ConflictingEnumerationType,
        schemaType: SchemaItemType.Enumeration,
        itemName: enumeration.name,
        source: entry.difference.type,
        target: primitiveTypeToString(enumeration.type!),
        description: "Enumeration has a different primitive type.",
      });
    }
  }

  public async visitEnumerationPropertyDifference(entry: ClassPropertyDifference, property: Property) {
    if ("enumeration" in entry.difference) {
      await this.createPropertyConflict(entry, property);
    }
  }

  public async visitEnumeratorDifference(entry: EnumeratorDifference) {
    if (entry.changeType !== "modify") {
      return;
    }

    const enumeration = await this.getSchemaItem<Enumeration>(entry.itemName);
    const enumerator = enumeration.getEnumeratorByName(entry.path);
    if (!enumerator) {
      return;
    }

    if (entry.difference.value) {
      this.addConflict({
        code: ConflictCode.ConflictingEnumeratorValue,
        schemaType: SchemaItemType.Enumeration,
        itemName: enumeration.name,
        path: enumerator.name,
        source: entry.difference.value,
        target: enumerator.value,
        description: "Enumerators must have unique values.",
      });
    }
  }

  public async visitFormatDifference(entry: FormatDifference) {
    if (entry.changeType === "modify") {
      await this.visitSchemaItemDifference(entry, await this.getSchemaItem(entry.itemName));
    }
  }

  public async visitInvertedUnitDifference(entry: InvertedUnitDifference) {
    if (entry.changeType === "modify") {
      await this.visitSchemaItemDifference(entry, await this.getSchemaItem(entry.itemName));
    }
  }

  public async visitKindOfQuantityDifference(entry: KindOfQuantityDifference) {
    if (entry.changeType !== "modify") {
      return;
    }

    const kindOfQuantity = await this.getSchemaItem<KindOfQuantity>(entry.itemName);
    if (!await this.visitSchemaItemDifference(entry, kindOfQuantity)) {
      return;
    }

    if (entry.difference.persistenceUnit) {
      this.addConflict({
        code: ConflictCode.ConflictingPersistenceUnit,
        schemaType: SchemaItemType.KindOfQuantity,
        itemName: kindOfQuantity.name,
        source: entry.difference.persistenceUnit,
        target: resolveLazyItemName(kindOfQuantity.persistenceUnit),
        description: "Kind of Quantity has a different persistence unit.",
      });
    }
  }

  public async visitMixinDifference(entry: MixinClassDifference) {
    if (entry.changeType === "modify") {
      await this.visitClassDifference(entry);
    }
  }

  public async visitNavigationPropertyDifference(entry: ClassPropertyDifference, property: Property) {
    if ("relationshipName" in entry.difference) {
      await this.createPropertyConflict(entry, property);
    }
  }

  public async visitPhenomenonDifference(entry: PhenomenonDifference) {
    if (entry.changeType === "modify") {
      await this.visitSchemaItemDifference(entry, await this.getSchemaItem(entry.itemName));
    }
  }

  public async visitPrimitivePropertyDifference(entry: ClassPropertyDifference, property: Property) {
    if ("primitiveType" in entry.difference) {
      await this.createPropertyConflict(entry, property);
    }
  }

  public async visitPropertyDifference(entry: ClassPropertyDifference) {
    if (entry.changeType !== "modify") {
      return;
    }

    const classItem = await this.getSchemaItem<ECClass>(entry.itemName);
    const property = await classItem.getProperty(entry.path);

    if (property === undefined) {
      return;
    }

    if (entry.difference.type) {
      await this.createPropertyConflict(entry, property);
      return;
    }

    if ("enumeration" in entry.difference) {
      return this.visitEnumerationPropertyDifference(entry, property);
    }
    if ("relationshipName" in entry.difference) {
      return this.visitNavigationPropertyDifference(entry, property);
    }
    if ("primitiveType" in entry.difference) {
      return this.visitPrimitivePropertyDifference(entry, property);
    }
    if ("typeName" in entry.difference) {
      return this.visitStructPropertyDifference(entry, property);
    }
  }

  public async visitPropertyCategoryDifference(entry: PropertyCategoryDifference) {
    if (entry.changeType === "modify") {
      await this.visitSchemaItemDifference(entry, await this.getSchemaItem(entry.itemName));
    }
  }

  public async visitRelationshipClassDifference(entry: RelationshipClassDifference) {
    if (entry.changeType === "modify") {
      await this.visitClassDifference(entry);
    }
  }

  public async visitRelationshipConstraintDifference(_entry: RelationshipConstraintDifference) {
    // Nothing to validate
  }

  public async visitRelationshipConstraintClassDifference(_entry: RelationshipConstraintClassDifference) {
    // Nothing to validate
  }

  public async visitStructClassDifference(entry: StructClassDifference) {
    if (entry.changeType === "modify") {
      await this.visitClassDifference(entry);
    }
  }

  public async visitStructPropertyDifference(entry: ClassPropertyDifference, property: Property) {
    if ("typeName" in entry.difference) {
      await this.createPropertyConflict(entry, property);
    }
  }

  public async visitUnitDifference(entry: UnitDifference) {
    if (entry.changeType === "modify") {
      await this.visitSchemaItemDifference(entry, await this.getSchemaItem(entry.itemName));
    }
  }

  public async visitUnitSystemDifference(entry: UnitSystemDifference) {
    if (entry.changeType === "modify") {
      await this.visitSchemaItemDifference(entry, await this.getSchemaItem(entry.itemName));
    }
  }
}

/**
 * Helper method to resolve the schema item name from lazy loaded schema items.
 * @param lazyItem  LazyLoaded item
 * @returns         The full name of the item or undefined item was not set.
 */
function resolveLazyItemName(lazyItem?: LazyLoadedSchemaItem<SchemaItem>) {
  return lazyItem && lazyItem.fullName;
}

/**
 * Helper method to resolve the type name of a property.
 * @param property  The property which's type shall be resolved.
 * @returns         The (full) name of the properties type.
 */
function resolvePropertyTypeName(property: Property) {
  const [prefix, suffix] = property.isArray() ? ["[", "]"] : ["", ""];
  if (property.isEnumeration())
    return `${prefix}${resolveLazyItemName(property.enumeration)}${suffix}`;
  if (property.isPrimitive())
    return `${prefix}${primitiveTypeToString(property.primitiveType)}${suffix}`;
  if (property.isStruct())
    return `${prefix}${property.structClass.fullName}${suffix}`;
  if (property.isNavigation())
    return `${prefix}${property.relationshipClass.fullName}${suffix}`;
  return propertyTypeToString(property.propertyType);
}

/**
 * Recursive synchronous function to figure whether a given class derived from
 * a class with the given baseClassName.
 */
async function derivedFrom(ecClass: ECClass | undefined, baseClassName: string): Promise<boolean> {
  if (ecClass === undefined) {
    return false;
  }
  if (ecClass && ecClass.name === baseClassName) {
    return true;
  }
  return derivedFrom(await ecClass.baseClass, baseClassName);
}
