/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import { classModifierToString, ECClass, ECClassModifier, EntityClass, Enumeration, KindOfQuantity, LazyLoadedSchemaItem, Mixin, parseClassModifier, primitiveTypeToString, Property, propertyTypeToString, Schema, SchemaItem, SchemaItemKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { AnyClassItemDifference, AnySchemaDifference, AnySchemaItemDifference, ClassPropertyDifference, ConstantDifference, CustomAttributeClassDifference, CustomAttributeDifference, EntityClassDifference, EntityClassMixinDifference, EnumerationDifference, EnumeratorDifference, FormatDifference, InvertedUnitDifference, KindOfQuantityDifference, KindOfQuantityPresentationFormatDifference, MixinClassDifference, PhenomenonDifference, PropertyCategoryDifference, RelationshipClassDifference, RelationshipConstraintClassDifference, RelationshipConstraintDifference, SchemaDifference, SchemaReferenceDifference, StructClassDifference, UnitDifference, UnitSystemDifference } from "./SchemaDifference";
import { AnySchemaDifferenceConflict, ConflictCode } from "./SchemaConflicts";
import { SchemaDifferenceVisitor, SchemaDifferenceWalker } from "./SchemaDifferenceVisitor";

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
 */
class SchemaDifferenceValidationVisitor implements SchemaDifferenceVisitor {

  public readonly conflicts: Array<AnySchemaDifferenceConflict>;
  private readonly _sourceSchema: Schema;
  private readonly _targetSchema: Schema;

  /** Initializes a new instance of SchemaDifferenceValidationVisitor class. */
  constructor(targetSchema: Schema, sourceSchema: Schema) {
    this.conflicts = [];
    this._targetSchema = targetSchema;
    this._sourceSchema = sourceSchema;
  }

  private addConflict(conflict: AnySchemaDifferenceConflict) {
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
    const targetSchemaReferenceName = this._targetSchema.getReferenceNameByAlias(sourceSchemaReference.alias);
    if (targetSchemaReferenceName && targetSchemaReferenceName !== sourceSchemaReference.name) {
      this.addConflict({
        code: ConflictCode.ConflictingReferenceAlias,
        difference: entry,
        source: entry.difference.name,
        target: targetSchemaReferenceName,
        description: "Target schema already references a different schema with this alias.",
      });
    }

    const sourceSchemaKey = sourceSchemaReference.schemaKey;
    const targetSchemaKey = await this._targetSchema.getReference(entry.difference.name)
      .then((schema) => schema?.schemaKey);

    if(entry.changeType === "modify" && targetSchemaKey && !sourceSchemaKey.matches(targetSchemaKey, SchemaMatchType.LatestWriteCompatible)) {
      return this.addConflict({
        code: ConflictCode.ConflictingReferenceVersion,
        difference: entry,
        description: "Schema reference cannot be updated, incompatible versions",
        source: sourceSchemaKey.toString(),
        target: targetSchemaKey.toString(),
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
        difference: entry,
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
  private async visitBaseClassDifference(entry: AnyClassItemDifference, targetClassItem: ECClass) {
    if ("baseClass" in entry.difference && entry.difference.baseClass === undefined && targetClassItem.baseClass !== undefined) {
      return this.addConflict({
        code: ConflictCode.RemovingBaseClass,
        difference: entry,
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
        difference: entry,
        source: sourceBaseClass.fullName,
        target: resolveLazyItemFullName(targetClassItem.baseClass) || null,
        description: "BaseClass is sealed.",
      });
    }

    if (targetClassItem.baseClass && !await this.derivedFrom(sourceBaseClass, targetClassItem.baseClass)) {
      return this.addConflict({
        code: ConflictCode.ConflictingBaseClass,
        difference: entry,
        source: sourceBaseClass.fullName,
        target: resolveLazyItemFullName(targetClassItem.baseClass),
        description: "BaseClass is not valid, source class must derive from target.",
      });
    }
  }

  /**
   * Shared validation for all types of ClassItemDifference union.
   */
  private async visitClassDifference(entry: AnyClassItemDifference) {
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
  private async visitClassModifierDifference(entry: AnyClassItemDifference, targetClass: ECClass) {
    if (entry.difference.modifier) {
      const changedModifier = parseClassModifier(entry.difference.modifier);
      if (changedModifier !== undefined && changedModifier !== ECClassModifier.None) {
        this.addConflict({
          code: ConflictCode.ConflictingClassModifier,
          difference: entry,
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
    for (const addedMixin of entry.difference) {
      // To validate the added mixins, the instance from the source schema it fetched,
      // otherwise validation gets too complicated as the mixin must not be existing in
      // the current target schema, it could also be added to the schema.
      const sourceMixin = await this._sourceSchema.lookupItem(addedMixin) as Mixin;
      const sourceSchemaItem = await this._sourceSchema.getItem(entry.itemName) as EntityClass;
      if (sourceMixin.appliesTo && !await sourceSchemaItem.is(await sourceMixin.appliesTo)) {
        this.addConflict({
          code: ConflictCode.MixinAppliedMustDeriveFromConstraint,
          difference: entry,
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
          difference: entry,
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
        difference: entry,
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
          difference: entry,
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
        difference: entry,
        source: resolvePropertyTypeName(sourceProperty),
        target: resolvePropertyTypeName(targetProperty),
        description: "Target class already contains a property with a different type.",
      });
    }

    if (entry.changeType === "modify" && targetProperty !== undefined) {
      if ("kindOfQuantity" in entry.difference) {
        const sourceKoQ = await sourceProperty.kindOfQuantity;
        const targetKoQ = await targetProperty.kindOfQuantity;
        if(!targetKoQ) {
          return this.addConflict({
            code: ConflictCode.ConflictingPropertyKindOfQuantity,
            difference: entry,
            source: entry.difference.kindOfQuantity,
            target: null,
            description: "The kind of quantity cannot be assiged if the property did not have a kind of quantities before.",
          });
        }

        if(!sourceKoQ) {
          return this.addConflict({
            code: ConflictCode.ConflictingPropertyKindOfQuantity,
            difference: entry,
            source: null,
            target: resolveLazyItemFullName(targetProperty.kindOfQuantity),
            description: "The kind of quantity cannot be undefined if the property had a kind of quantities before.",
          });
        }

        if (resolveLazyItemName(sourceKoQ.persistenceUnit) !== resolveLazyItemName(targetKoQ.persistenceUnit)) {
          this.addConflict({
            code: ConflictCode.ConflictingPropertyKindOfQuantityUnit,
            difference: entry,
            source: entry.difference.kindOfQuantity,
            target: resolveLazyItemFullName(targetProperty.kindOfQuantity),
            description: "The property has different kind of quantities with conflicting units.",
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
   * Visitor implementation for handling KindOfQuantityPresentationFormatDifference.
   * @internal
   */
  public async visitKindOfQuantityPresentationFormatDifference(_entry: KindOfQuantityPresentationFormatDifference) {
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
      // ... if not, whether it's in the source schema, but then we expect the baseclass
      // to be in the target schema.
      if(ecClass.schema.name === this._sourceSchema.name && baseClassKey.schemaName === this._targetSchema.name)
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
