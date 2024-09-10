/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import { classModifierToString, ECClass, ECClassModifier, EntityClass, Enumeration, KindOfQuantity, LazyLoadedSchemaItem, Mixin, parseClassModifier, primitiveTypeToString, Property, propertyTypeToString, Schema, SchemaItem, SchemaItemKey, SchemaItemType } from "@itwin/ecschema-metadata";
import { AnySchemaDifference, AnySchemaItemDifference, ClassItemDifference, ClassPropertyDifference, ConstantDifference, CustomAttributeClassDifference, CustomAttributeDifference, EntityClassDifference, EntityClassMixinDifference, EnumerationDifference, EnumeratorDifference, FormatDifference, InvertedUnitDifference, KindOfQuantityDifference, MixinClassDifference, PhenomenonDifference, PropertyCategoryDifference, RelationshipClassDifference, RelationshipConstraintClassDifference, RelationshipConstraintDifference, SchemaDifference, SchemaOtherTypes, SchemaReferenceDifference, StructClassDifference, UnitDifference, UnitSystemDifference } from "./SchemaDifference";
import { ConflictCode, SchemaDifferenceConflict } from "./SchemaConflicts";
import { ISchemaDifferenceVisitor, SchemaDifferenceWalker } from "./SchemaDifferenceVisitor";

/**
 * Validates the given array of schema differences and returns a list of conflicts if the
 * validation finds violation against rules.
 * @param differences   An array of schema differences.
 * @param targetSchema  The target schema reference.
 * @param sourceSchema  The source schema reference.
 * @returns             An array of conflicts found when validating the difference.
 * @internal
 */
export async function validateDifferences(differences: AnySchemaDifference[], targetSchema: Schema, sourceSchema: Schema) {
  const visitor = new SchemaDifferenceValidationVisitor(targetSchema, sourceSchema);
  const walker = new SchemaDifferenceWalker(visitor);

  await walker.traverse(differences);

  return visitor.conflicts;
}

/**
 * The SchemaDifferenceValidationVisitor class is an implementation of ISchemaDifferenceVisitor and
 * validates the given SchemaDifferences if the violate against some EC Rules.
 * @internal
 */
class SchemaDifferenceValidationVisitor implements ISchemaDifferenceVisitor {

  public readonly conflicts: Array<SchemaDifferenceConflict>;
  private readonly _sourceSchema: Schema;
  private readonly _targetSchema: Schema;

  constructor(targetSchema: Schema, sourceSchema: Schema) {
    this.conflicts = [];
    this._targetSchema = targetSchema;
    this._sourceSchema = sourceSchema;
  }

  private addConflict(conflict: SchemaDifferenceConflict) {
    this.conflicts.push(conflict);
  }

  /**
   * Visitor implementation for handling SchemaDifference.
   * @internal
   */
  public async visitSchemaDifference(_entry: SchemaDifference) {
  }

  /**
   * Visitor implementation for handling SchemaReferenceDifference.
   * @internal
   */
  public async visitSchemaReferenceDifference(entry: SchemaReferenceDifference) {
    const sourceSchemaReference = await this._sourceSchema.getReference(entry.difference.name) as Schema;
    const targetSchemaReference = this._targetSchema.getReferenceNameByAlias(sourceSchemaReference.alias);
    if (targetSchemaReference && targetSchemaReference !== sourceSchemaReference.name) {
      this.addConflict({
        code: ConflictCode.ConflictingReferenceAlias,
        schemaType: SchemaOtherTypes.SchemaReference,
        source: entry.difference.name,
        target: targetSchemaReference,
        description: "Target schema already references a different schema with this alias.",
      });
    }
  }

  /**
   * Shared schema item validation for all types of AnySchemaItemDifference union.
   */
  private async visitSchemaItemDifference(entry: AnySchemaItemDifference, targetSchemaItem: SchemaItem | undefined) {
    // If the item shall be added, but the target schema already has an item with this name,
    // will produce an ConflictingItemName conflict.
    if (entry.changeType === "add" && targetSchemaItem !== undefined) {
      this.addConflict({
        code: ConflictCode.ConflictingItemName,
        schemaType: targetSchemaItem.schemaItemType,
        itemName: targetSchemaItem.name,
        source: entry.schemaType,
        target: targetSchemaItem.schemaItemType,
        description: "Target schema already contains a schema item with the name but different type.",
      });
      return false;
    }

    return true;
  }

  /**
   * Shared base-class validation for all types of ClassItemDifference union.
   */
  private async visitBaseClassDifference(entry: ClassItemDifference, targetClassItem: ECClass) {
    if (entry.difference.baseClass === undefined && targetClassItem.baseClass !== undefined) {
      return this.addConflict({
        code: ConflictCode.RemovingBaseClass,
        schemaType: targetClassItem.schemaItemType,
        itemName: targetClassItem.name,
        path: "$baseClass",
        source: null,
        target: resolveLazyItemFullName(targetClassItem.baseClass),
        description: "BaseClass cannot be removed, if there has been a baseClass before.",
      });
    }

    if (entry.difference.baseClass === undefined) {
      return;
    }

    const sourceBaseClass = await this._sourceSchema.lookupItem(entry.difference.baseClass) as ECClass;
    if (sourceBaseClass.modifier === ECClassModifier.Sealed) {
      return this.addConflict({
        code: ConflictCode.SealedBaseClass,
        schemaType: targetClassItem.schemaItemType,
        itemName: targetClassItem.name,
        path: "$baseClass",
        source: sourceBaseClass.fullName,
        target: resolveLazyItemFullName(targetClassItem.baseClass) || null,
        description: "BaseClass is sealed.",
      });
    }

    if (targetClassItem.baseClass && !await this.derivedFrom(sourceBaseClass, targetClassItem.baseClass)) {
      return this.addConflict({
        code: ConflictCode.ConflictingBaseClass,
        schemaType: targetClassItem.schemaItemType,
        itemName: targetClassItem.name,
        path: "$baseClass",
        source: sourceBaseClass.fullName,
        target: resolveLazyItemFullName(targetClassItem.baseClass),
        description: "BaseClass is not valid, source class must derive from target.",
      });
    }
  }

  /**
   * Shared validation for all types of ClassItemDifference union.
   */
  private async visitClassDifference(entry: ClassItemDifference) {
    const targetClassItem = await this._targetSchema.getItem<ECClass>(entry.itemName);
    if (!await this.visitSchemaItemDifference(entry, targetClassItem)) {
      return;
    }

    if (entry.changeType === "modify" && targetClassItem !== undefined) {
      await this.visitClassModifierDifference(entry, targetClassItem);
      await this.visitBaseClassDifference(entry, targetClassItem);
    }
  }

  /**
   * Validation the modifiers of all types of ClassItemDifference union.
   */
  private async visitClassModifierDifference(entry: ClassItemDifference, targetClass: ECClass) {
    if (entry.difference.modifier) {
      const changedModifier = parseClassModifier(entry.difference.modifier);
      if (changedModifier !== undefined && changedModifier !== ECClassModifier.None) {
        this.addConflict({
          code: ConflictCode.ConflictingClassModifier,
          schemaType: targetClass.schemaItemType,
          itemName: targetClass.name,
          source: entry.difference.modifier,
          target: classModifierToString(targetClass.modifier),
          description: "Class has conflicting modifiers.",
        });
      }
    }
  }

  /**
   * Visitor implementation for handling ConstantDifference.
   * @internal
   */
  public async visitConstantDifference(entry: ConstantDifference) {
    await this.visitSchemaItemDifference(entry, await this._targetSchema.getItem(entry.itemName));
  }

  /**
   * Visitor implementation for handling CustomAttributeClassDifference.
   * @internal
   */
  public async visitCustomAttributeClassDifference(entry: CustomAttributeClassDifference) {
    await this.visitClassDifference(entry);
  }

  /**
   * Visitor implementation for handling CustomAttributeDifference.
   * @internal
   */
  public async visitCustomAttributeInstanceDifference(_entry: CustomAttributeDifference) {
  }

  /**
   * Visitor implementation for handling EntityClassDifference.
   * @internal
   */
  public async visitEntityClassDifference(entry: EntityClassDifference) {
    await this.visitClassDifference(entry);
  }

  /**
   * Visitor implementation for handling EntityClassMixinDifference.
   * @internal
   */
  public async visitEntityClassMixinDifference(entry: EntityClassMixinDifference) {
    const targetEntityClass = await this._targetSchema.getItem(entry.itemName) as EntityClass;
    for (const addedMixin of entry.difference) {
      // To validate the added mixins, the instance from the source schema it fetched,
      // otherwise validation gets too complicated as the mixin must not be existing in
      // the current target schema, it could also be added to the schema.
      const sourceMixin = await this._sourceSchema.lookupItem(addedMixin) as Mixin;
      const sourceSchemaItem = await this._sourceSchema.getItem(entry.itemName) as EntityClass;
      if (sourceMixin.appliesTo && !await this.derivedFrom(sourceSchemaItem, sourceMixin.appliesTo)) {
        this.addConflict({
          code: ConflictCode.MixinAppliedMustDeriveFromConstraint,
          schemaType: targetEntityClass.schemaItemType,
          itemName: targetEntityClass.name,
          path: "$mixins",
          source: addedMixin,
          target: undefined,
          description: "Mixin cannot applied to this class.",
        });
      }
    }
  }

  /**
   * Visitor implementation for handling EnumerationDifference.
   * @internal
   */
  public async visitEnumerationDifference(entry: EnumerationDifference) {
    const enumeration = await this._targetSchema.getItem<Enumeration>(entry.itemName);
    if (!await this.visitSchemaItemDifference(entry, enumeration)) {
      return;
    }

    if (entry.changeType === "modify" && enumeration !== undefined) {
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
  }

  /**
   * Visitor implementation for handling EnumeratorDifference.
   * @internal
   */
  public async visitEnumeratorDifference(entry: EnumeratorDifference) {
    if (entry.changeType !== "modify") {
      return;
    }

    const enumeration = await this._targetSchema.getItem(entry.itemName) as Enumeration;
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

  /**
   * Visitor implementation for handling FormatDifference.
   * @internal
   */
  public async visitFormatDifference(entry: FormatDifference) {
    await this.visitSchemaItemDifference(entry, await this._targetSchema.getItem(entry.itemName));
  }

  /**
   * Visitor implementation for handling InvertedUnitDifference.
   * @internal
   */
  public async visitInvertedUnitDifference(entry: InvertedUnitDifference) {
    await this.visitSchemaItemDifference(entry, await this._targetSchema.getItem(entry.itemName));
  }

  /**
   * Visitor implementation for handling KindOfQuantityDifference.
   * @internal
   */
  public async visitKindOfQuantityDifference(entry: KindOfQuantityDifference) {
    const kindOfQuantity = await this._targetSchema.getItem<KindOfQuantity>(entry.itemName);
    if (!await this.visitSchemaItemDifference(entry, kindOfQuantity)) {
      return;
    }

    if (entry.changeType === "modify" && kindOfQuantity !== undefined) {
      if (entry.difference.persistenceUnit) {
        this.addConflict({
          code: ConflictCode.ConflictingPersistenceUnit,
          schemaType: SchemaItemType.KindOfQuantity,
          itemName: kindOfQuantity.name,
          source: entry.difference.persistenceUnit,
          target: resolveLazyItemFullName(kindOfQuantity.persistenceUnit),
          description: "Kind of Quantity has a different persistence unit.",
        });
      }
    }
  }

  /**
   * Visitor implementation for handling MixinClassDifference.
   * @internal
   */
  public async visitMixinDifference(entry: MixinClassDifference) {
    await this.visitClassDifference(entry);
  }

  /**
   * Visitor implementation for handling PhenomenonDifference.
   * @internal
   */
  public async visitPhenomenonDifference(entry: PhenomenonDifference) {
    await this.visitSchemaItemDifference(entry, await this._targetSchema.getItem(entry.itemName));
  }

  /**
   * Visitor implementation for handling ClassPropertyDifference.
   * @internal
   */
  public async visitPropertyDifference(entry: ClassPropertyDifference) {
    const targetClass = await this._targetSchema.getItem(entry.itemName) as ECClass;
    const targetProperty = await targetClass.getProperty(entry.path);

    const sourceClass = await this._sourceSchema.getItem(entry.itemName) as ECClass;
    const sourceProperty = await sourceClass.getProperty(entry.path) as Property;

    // If property shall be added but there is already a property with this name
    // in target, a ConflictingPropertyName is issued.
    if (entry.changeType === "add" && targetProperty !== undefined) {
      return this.addConflict({
        code: ConflictCode.ConflictingPropertyName,
        schemaType: targetProperty.class.schemaItemType,
        itemName: targetProperty.class.name,
        path: targetProperty.name,
        source: resolvePropertyTypeName(sourceProperty),
        target: resolvePropertyTypeName(targetProperty),
        description: "Target class already contains a property with a different type.",
      });
    }

    if (entry.changeType === "modify" && targetProperty !== undefined) {
      if (entry.difference.kindOfQuantity) {
        const sourceKoQ = await sourceProperty.kindOfQuantity;
        const targetKoQ = await targetProperty.kindOfQuantity;
        if (!targetKoQ || sourceKoQ && resolveLazyItemName(sourceKoQ.persistenceUnit) !== resolveLazyItemName(targetKoQ.persistenceUnit)) {
          this.addConflict({
            code: ConflictCode.ConflictingPropertyKindOfQuantity,
            schemaType: targetClass.schemaItemType,
            itemName: targetClass.name,
            path: targetProperty.name,
            source: entry.difference.kindOfQuantity,
            target: resolveLazyItemFullName(targetProperty.kindOfQuantity),
            description: "The property has different kind of quantities with conflicting units defined.",
          });
        }
      }
    }
  }

  /**
   * Visitor implementation for handling PropertyCategoryDifference.
   * @internal
   */
  public async visitPropertyCategoryDifference(entry: PropertyCategoryDifference) {
    await this.visitSchemaItemDifference(entry, await this._targetSchema.getItem(entry.itemName));
  }

  /**
   * Visitor implementation for handling RelationshipClassDifference.
   * @internal
   */
  public async visitRelationshipClassDifference(entry: RelationshipClassDifference) {
    await this.visitClassDifference(entry);
  }

  /**
   * Visitor implementation for handling RelationshipConstraintDifference.
   * @internal
   */
  public async visitRelationshipConstraintDifference(_entry: RelationshipConstraintDifference) {
  }

  /**
   * Visitor implementation for handling RelationshipConstraintClassDifference.
   * @internal
   */
  public async visitRelationshipConstraintClassDifference(_entry: RelationshipConstraintClassDifference) {
  }

  /**
   * Visitor implementation for handling StructClassDifference.
   * @internal
   */
  public async visitStructClassDifference(entry: StructClassDifference) {
    await this.visitClassDifference(entry);
  }

  /**
   * Visitor implementation for handling UnitDifference.
   * @internal
   */
  public async visitUnitDifference(entry: UnitDifference) {
    await this.visitSchemaItemDifference(entry, await this._targetSchema.getItem(entry.itemName));
  }

  /**
   * Visitor implementation for handling UnitSystemDifference.
   * @internal
   */
  public async visitUnitSystemDifference(entry: UnitSystemDifference) {
    await this.visitSchemaItemDifference(entry, await this._targetSchema.getItem(entry.itemName));
  }

  /**
   * Recursive synchronous function to figure whether a given class derived from
   * a class with the given baseClass name.
   */
  private async derivedFrom(ecClass: ECClass | undefined, baseClassKey: Readonly<SchemaItemKey>): Promise<boolean> {
    if (ecClass === undefined) {
      return false;
    }

    // First check for name which must be same in any case...
    if (ecClass.name === baseClassKey.name) {
      // ... then check if the class is in the same schema as the expected base class...
      if(ecClass.schema.name === baseClassKey.schemaName)
        return true;
      // ... if not, whether it's in the other schema, which could be the case if the base class
      // gets added to the target schema...
      if(ecClass.schema.name === this._sourceSchema.name || ecClass.schema.name === this._targetSchema.name)
        return true;
    }
    return this.derivedFrom(await ecClass.baseClass, baseClassKey);
  }
}

/**
 * Helper method to resolve the schema item name from lazy loaded schema items.
 * @param lazyItem  LazyLoaded item
 * @returns         The full name of the item or undefined item was not set.
 */
function resolveLazyItemFullName(lazyItem?: LazyLoadedSchemaItem<SchemaItem>) {
  return lazyItem && lazyItem.fullName;
}

/**
 * Helper method to resolve the schema item name from lazy loaded schema items.
 * @param lazyItem  LazyLoaded item
 * @returns         The full name of the item or undefined item was not set.
 */
function resolveLazyItemName(lazyItem?: LazyLoadedSchemaItem<SchemaItem>) {
  return lazyItem && lazyItem.name;
}

/**
 * Helper method to resolve the type name of a property.
 * @param property  The property which's type shall be resolved.
 * @returns         The (full) name of the properties type.
 */
function resolvePropertyTypeName(property: Property) {
  const [prefix, suffix] = property.isArray() ? ["[", "]"] : ["", ""];
  if (property.isEnumeration())
    return `${prefix}${resolveLazyItemFullName(property.enumeration)}${suffix}`;
  if (property.isPrimitive())
    return `${prefix}${primitiveTypeToString(property.primitiveType)}${suffix}`;
  if (property.isStruct())
    return `${prefix}${property.structClass.fullName}${suffix}`;
  if (property.isNavigation())
    return `${prefix}${property.relationshipClass.fullName}${suffix}`;
  return propertyTypeToString(property.propertyType);
}
