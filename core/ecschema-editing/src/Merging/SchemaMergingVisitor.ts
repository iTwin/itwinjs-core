/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AnyClassItemDifference, AnySchemaDifference, AnySchemaItemDifference, ClassPropertyDifference, ConstantDifference, CustomAttributeClassDifference, CustomAttributeDifference, EntityClassDifference, EntityClassMixinDifference, EnumerationDifference, EnumeratorDifference, FormatDifference, InvertedUnitDifference, KindOfQuantityDifference, MixinClassDifference, PhenomenonDifference, PropertyCategoryDifference, RelationshipClassDifference, RelationshipConstraintClassDifference, RelationshipConstraintDifference, SchemaDifference, SchemaReferenceDifference, StructClassDifference, UnitDifference, UnitSystemDifference } from "../Differencing/SchemaDifference";
import { addConstant, modifyConstant } from "./ConstantMerger";
import { addCustomAttribute } from "./CustomAttributeMerger";
import { addCustomAttributeClass, modifyCustomAttributeClass } from "./CustomAttributeClassMerger";
import { addClassMixins, addEntityClass, modifyEntityClass } from "./EntityClassMerger";
import { addEnumeration, modifyEnumeration } from "./EnumerationMerger";
import { addEnumerator, modifyEnumerator } from "./EnumeratorMerger";
import { addKindOfQuantity, modifyKindOfQuantity } from "./KindOfQuantityMerger";
import { addMixinClass, modifyMixinClass } from "./MixinMerger";
import { addPhenomenon, modifyPhenomenon } from "./PhenomenonMerger";
import { addPropertyCategory, modifyPropertyCategory } from "./PropertyCategoryMerger";
import { addRelationshipClass, mergeRelationshipClassConstraint, mergeRelationshipConstraint, modifyRelationshipClass } from "./RelationshipClassMerger";
import { addSchemaReferences, modifySchemaReferences } from "./SchemaReferenceMerger";
import { addStructClass, modifyStructClass } from "./StructClassMerger";
import { addUnitSystem, modifyUnitSystem } from "./UnitSystemMerger";
import { mergePropertyDifference } from "./PropertyMerger";
import { isClassDifference } from "../Differencing/Utils";
import { SchemaDifferenceVisitor } from "../Differencing/SchemaDifferenceVisitor";
import { SchemaItemKey } from "@itwin/ecschema-metadata";
import { SchemaMergeContext } from "./SchemaMerger";

/** Definition of schema items change type handler array. */
interface ItemChangeTypeHandler<T extends AnySchemaDifference> {
  add: (context: SchemaMergeContext, entry: T) => Promise<void>;
  modify: (context: SchemaMergeContext, entry: T, key: SchemaItemKey) => Promise<void>;
}

/**
 * Implementation of ISchemaDifferenceVisitor that can be used to traverse schema
 * differences to call the appropriated merger methods.
 * @internal
 */
export class SchemaMergingVisitor implements SchemaDifferenceVisitor {

  private readonly _context: SchemaMergeContext;

  /**
   * Initializes a new instance of SchemaMergingVisitor class.
   */
  constructor(context: SchemaMergeContext) {
    this._context = context;
  }

  /**
   * Gets a SchemaItemKey for the given item name.
   */
  private toItemKey(itemName: string): SchemaItemKey {
    return new SchemaItemKey(itemName, this._context.targetSchemaKey);
  }

  /**
   * Shared merging logic for all types of ClassItemDifference union.
   */
  private async visitClassDifference<T extends AnyClassItemDifference>(entry: T, index: number, array: AnySchemaDifference[], handler: ItemChangeTypeHandler<T>) {
    return this.visitSchemaItemDifference(entry, {
      add: async (context) => {
        // To add classes a slightly different approach is done. In fact the class entries gets processed
        // two times. The first time, a stub with the bare minimum is added to the schema. The second time,
        // the class gets completed with all properties, mixins, etc...
        if(entry.changeType === "add" && !await context.targetSchema.getItem(entry.itemName)) {
          await handler.add(this._context, {
            ...entry,
            difference: {
              ...entry.difference,
              // Remove everything we want to validate before setting, this is done in the second iteration.
              baseClass: undefined,
              mixins: undefined,
              properties: undefined,
              customAttributes: undefined,
            },
          });

          // Searches for the last class difference and adds the entry after it. That way,
          // the class is completed before class related entries get processed.
          const insertIndex = findIndexOf(array, (e) => !isClassDifference(e), index) || array.length;
          array.splice(insertIndex, 0, entry);

          return;
        }

        // Now both a modification change or the second add iteration is a modification of an existing class.
        // So, regardless of the actual change type, modify is called.
        return handler.modify(this._context, entry, this.toItemKey(entry.itemName));
      },
      modify: handler.modify,
    });
  }

  /**
   * Visitor implementation for handling ConstantDifference.
   * @internal
   */
  public async visitConstantDifference(entry: ConstantDifference): Promise<void> {
    return this.visitSchemaItemDifference(entry, {
      add: addConstant,
      modify: modifyConstant,
    });
  }

  /**
   * Visitor implementation for handling CustomAttributeClassDifference.
   * @internal
   */
  public async visitCustomAttributeClassDifference(entry: CustomAttributeClassDifference, index: number, array: AnySchemaDifference[]): Promise<void> {
    return this.visitClassDifference(entry, index, array, {
      add: addCustomAttributeClass,
      modify: modifyCustomAttributeClass,
    });
  }

  /**
   * Visitor implementation for handling CustomAttributeDifference.
   * @internal
   */
  public async visitCustomAttributeInstanceDifference(entry: CustomAttributeDifference): Promise<void> {
    switch(entry.changeType) {
      case "add": return addCustomAttribute(this._context, entry);
    }
  }

  /**
   * Visitor implementation for handling EntityClassDifference.
   * @internal
   */
  public async visitEntityClassDifference(entry: EntityClassDifference, index: number, array: AnySchemaDifference[]): Promise<void> {
    return this.visitClassDifference(entry, index, array, {
      add: addEntityClass,
      modify: modifyEntityClass,
    });
  }

  /**
   * Visitor implementation for handling EntityClassMixinDifference.
   * @internal
   */
  public async visitEntityClassMixinDifference(entry: EntityClassMixinDifference): Promise<void> {
    switch(entry.changeType) {
      case "add": return addClassMixins(this._context, entry);
    }
  }

  /**
   * Visitor implementation for handling EnumerationDifference.
   * @internal
   */
  public async visitEnumerationDifference(entry: EnumerationDifference): Promise<void> {
    return this.visitSchemaItemDifference(entry, {
      add: addEnumeration,
      modify: modifyEnumeration,
    });
  }

  /**
   * Visitor implementation for handling EnumeratorDifference.
   * @internal
   */
  public async visitEnumeratorDifference(entry: EnumeratorDifference): Promise<void> {
    switch(entry.changeType) {
      case "add": return addEnumerator(this._context, entry);
      case "modify": return modifyEnumerator(this._context, entry, this.toItemKey(entry.itemName));
    }
  }

  /**
   * Visitor implementation for handling FormatDifference.
   * @internal
   */
  public async visitFormatDifference(_entry: FormatDifference): Promise<void> {
    // TODO: Add merger handler...
  }

  /**
   * Visitor implementation for handling InvertedUnitDifference.
   * @internal
   */
  public async visitInvertedUnitDifference(_entry: InvertedUnitDifference): Promise<void> {
    // TODO: Add merger handler...
  }

  /**
   * Visitor implementation for handling KindOfQuantityDifference.
   * @internal
   */
  public async visitKindOfQuantityDifference(entry: KindOfQuantityDifference): Promise<void> {
    return this.visitSchemaItemDifference(entry, {
      add: addKindOfQuantity,
      modify: modifyKindOfQuantity,
    });
  }

  /**
   * Visitor implementation for handling MixinClassDifference.
   * @internal
   */
  public async visitMixinDifference(entry: MixinClassDifference, index: number, array: AnySchemaDifference[]): Promise<void> {
    return this.visitClassDifference(entry, index, array, {
      add: addMixinClass,
      modify: modifyMixinClass,
    });
  }

  /**
   * Visitor implementation for handling PhenomenonDifference.
   * @internal
   */
  public async visitPhenomenonDifference(entry: PhenomenonDifference): Promise<void> {
    return this.visitSchemaItemDifference(entry, {
      add: addPhenomenon,
      modify: modifyPhenomenon,
    });
  }

  /**
   * Visitor implementation for handling PropertyCategoryDifference.
   * @internal
   */
  public async visitPropertyCategoryDifference(entry: PropertyCategoryDifference): Promise<void> {
    return this.visitSchemaItemDifference(entry, {
      add: addPropertyCategory,
      modify: modifyPropertyCategory,
    });
  }

  /**
   * Visitor implementation for handling ClassPropertyDifference.
   * @internal
   */
  public async visitPropertyDifference(entry: ClassPropertyDifference): Promise<void> {
    await mergePropertyDifference(this._context, entry);
  }

  /**
   * Visitor implementation for handling RelationshipClassDifference.
   * @internal
   */
  public async visitRelationshipClassDifference(entry: RelationshipClassDifference, index: number, array: AnySchemaDifference[]): Promise<void> {
    return this.visitClassDifference(entry, index, array, {
      add: addRelationshipClass,
      modify: modifyRelationshipClass,
    });
  }

  /**
   * Visitor implementation for handling RelationshipConstraintClassDifference.
   * @internal
   */
  public async visitRelationshipConstraintClassDifference(entry: RelationshipConstraintClassDifference): Promise<void> {
    await mergeRelationshipClassConstraint(this._context, entry);
  }

  /**
   * Visitor implementation for handling RelationshipConstraintDifference.
   * @internal
   */
  public async visitRelationshipConstraintDifference(entry: RelationshipConstraintDifference): Promise<void> {
    await mergeRelationshipConstraint(this._context, entry);
  }

  /**
   * Visitor implementation for handling SchemaDifference.
   * @internal
   */
  public async visitSchemaDifference({ difference }: SchemaDifference): Promise<void> {
    if (difference.label !== undefined) {
      await this._context.editor.setDisplayLabel(this._context.targetSchemaKey, difference.label);
    }
    if (difference.description !== undefined) {
      await this._context.editor.setDescription(this._context.targetSchemaKey, difference.description);
    }
  }

  /**
   * Shared merging logic for all types of AnySchemaItemDifference union.
   */
  private async visitSchemaItemDifference<T extends AnySchemaItemDifference>(entry: T, handler: ItemChangeTypeHandler<T>) {
    switch(entry.changeType) {
      case "add": {
        return handler.add(this._context, entry);
      }
      case "modify": {
        if("schemaItemType" in entry.difference && entry.difference.schemaItemType !== entry.schemaType) {
          throw new Error(`Changing the type of item '${entry.itemName}' not supported.`);
        }

        return handler.modify(this._context, entry, this.toItemKey(entry.itemName));
      };
    }
  }

  /**
   * Visitor implementation for handling SchemaReferenceDifference.
   * @internal
   */
  public async visitSchemaReferenceDifference(entry: SchemaReferenceDifference): Promise<void> {
    switch(entry.changeType) {
      case "add": return addSchemaReferences(this._context, entry);
      case "modify": return modifySchemaReferences(this._context, entry);
    }
  }

  /**
   * Visitor implementation for handling StructClassDifference.
   * @internal
   */
  public async visitStructClassDifference(entry: StructClassDifference, index: number, array: AnySchemaDifference[]): Promise<void> {
    return this.visitClassDifference(entry, index, array, {
      add: addStructClass,
      modify: modifyStructClass,
    });
  }

  /**
   * Visitor implementation for handling UnitDifference.
   * @internal
   */
  public async visitUnitDifference(_entry: UnitDifference): Promise<void> {
    // TODO: Add merger handler...
  }

  /**
   * Visitor implementation for handling UnitSystemDifference.
   * @internal
   */
  public async visitUnitSystemDifference(entry: UnitSystemDifference): Promise<void> {
    return this.visitSchemaItemDifference(entry, {
      add: addUnitSystem,
      modify: modifyUnitSystem,
    });
  }
}

/**
 * Helper method to get the index of the first element in the array that satisfies the provided testing function.
 * @param array     Array to search.
 * @param predicate Function to execute on each value in the array.
 * @param fromIndex The index to start the search at.
 * @returns         An index in the array if an element passes the test; otherwise, false.
 */
function findIndexOf(array: AnySchemaDifference[], predicate: (entry: AnySchemaDifference) => boolean, fromIndex: number) {
  for (let i = fromIndex; i < array.length; i++) {
    if (predicate(array[i]))
      return i;
  }
  return false;
}
