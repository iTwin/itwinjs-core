/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import { Schema, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaChanges, SchemaItemChanges } from "../Validation/SchemaChanges";
import { SchemaComparer } from "../Validation/SchemaComparer";
import { SchemaContextEditor } from "../Editing/Editor";
import { SchemaItemMerger } from "./SchemaItemMerger";

import mergeSchemaReferences from "./SchemaReferenceMerger";
import CAClassMerger from "./CAClassMerger";
import EnumerationMerger from "./EnumerationMerger";
import ConstantsMerger from "./ConstantMerger";
import EntityClassMerger from "./EntityClassMerger";
import StructClassMerger from "./StructClassMerger";
import MixinMerger from "./MixinMerger";
import { mergeCustomAttributes } from "./CustomAttributeMerger";
import KindOfQuantityMerger from "./KindOfQuantityMerger";
import RelationshipClassMerger from "./RelationshipClassMerger";

/**
 * Defines the context of a Schema merging run.
 * @beta
 */
export interface SchemaMergeContext {
  readonly targetSchema: Schema;
  readonly sourceSchema: Schema;
  readonly editor: SchemaContextEditor;
}

/**
 * Class to merge two schemas together.
 * @see [[merge]] to merge the schemas.
 * @beta
 */
export class SchemaMerger {
  /**
   * Gets the @see SchemaChanges between the two given Schemas from perspective of the source
   * to the target schema. For example if source contains a class which does not exists in the
   * target one, it would be listed as missing.
   * @param targetSchema  The schema the differences gets merged into.
   * @param sourceSchema  The schema to compare.
   * @returns             An instance of @see SchemaChanges between the two schemas.
   */
  private async getSchemaChanges(targetSchema: Schema, sourceSchema: Schema): Promise<SchemaChanges> {
    const changesList: SchemaChanges[] = [];
    const schemaComparer = new SchemaComparer({ report: changesList.push.bind(changesList) });

    // It is important to compare the schema items by name, not full name as otherwise
    // we'd often see differences when comparing two different schemas.
    await schemaComparer.compareSchemas(sourceSchema, targetSchema);

    return changesList[0];
  }

  /**
   * Copy the SchemaItems of the source schemas to the target schema.
   * @param targetSchema  The schema the SchemaItems gets merged to.
   * @param sourceSchema  The schema the SchemaItems gets copied from.
   * @returns             The merged target schema.
   */
  public async merge(targetSchema: Schema, sourceSchema: Schema): Promise<Schema> {
    const schemaChanges = await this.getSchemaChanges(targetSchema, sourceSchema);
    const mergeContext: SchemaMergeContext = {
      editor: new SchemaContextEditor(targetSchema.context),
      targetSchema,
      sourceSchema,
    };

    await mergeSchemaReferences(mergeContext, schemaChanges);

    const itemChanges = getSchemaItemChanges(schemaChanges);
    await EnumerationMerger.mergeChanges(mergeContext, itemChanges.enumeratations);
    await SchemaItemMerger.mergeChanges(mergeContext, itemChanges.propertyCategories);

    await SchemaItemMerger.mergeChanges(mergeContext, itemChanges.unitSystems);
    await SchemaItemMerger.mergeChanges(mergeContext, itemChanges.phenomenons);
    await ConstantsMerger.mergeChanges(mergeContext, itemChanges.constants);
    await KindOfQuantityMerger.mergeChanges(mergeContext, itemChanges.kindOfQuantities);

    // TODO: For now we just do simple copy and merging of properties and classes. For more complex types
    //       with bases classes or relationships, this might need to get extended.
    await CAClassMerger.mergeItemStubChanges(mergeContext, itemChanges.customAttributeClasses);
    await StructClassMerger.mergeItemStubChanges(mergeContext, itemChanges.structClasses);
    await EntityClassMerger.mergeItemStubChanges(mergeContext, itemChanges.entityClasses);
    await MixinMerger.mergeItemStubChanges(mergeContext, itemChanges.mixins);
    await RelationshipClassMerger.mergeItemStubChanges(mergeContext, itemChanges.relationships);

    // 2nd pass to complete merge changes such as properties, baseClasses and mixins.
    await CAClassMerger.mergeItemContentChanges(mergeContext, itemChanges.customAttributeClasses);
    await StructClassMerger.mergeItemContentChanges(mergeContext, itemChanges.structClasses);
    await EntityClassMerger.mergeItemContentChanges(mergeContext, itemChanges.entityClasses);
    await MixinMerger.mergeItemContentChanges(mergeContext, itemChanges.mixins);
    await RelationshipClassMerger.mergeItemContentChanges(mergeContext, itemChanges.relationships);

    await mergeCustomAttributes(mergeContext, schemaChanges.customAttributeChanges.values(), async (ca) => {
      return mergeContext.editor.addCustomAttribute(mergeContext.targetSchema.schemaKey, ca);
    });

    // TODO: For now we directly manipulate the target schema. For error handing purposes, we should first
    //       merge into a temporary schema and eventually swap that with the given instance.
    return targetSchema;
  }
}

/**
 * This helper method composes the different schema change objects to a single easier
 * to use object that should improve readability when the methods get called.
 */
function getSchemaItemChanges(schemaChanges: SchemaChanges) {
  return {
    get constants() { return filterChangesByItemType(schemaChanges.schemaItemChanges, SchemaItemType.Constant); },
    get customAttributeClasses() { return filterChangesByItemType(schemaChanges.classChanges, SchemaItemType.CustomAttributeClass); },
    get entityClasses() { return filterChangesByItemType(schemaChanges.classChanges, SchemaItemType.EntityClass); },
    get enumeratations() { return schemaChanges.enumerationChanges.values(); },
    get kindOfQuantities() { return schemaChanges.kindOfQuantityChanges.values(); },
    get mixins() { return filterChangesByItemType(schemaChanges.classChanges, SchemaItemType.Mixin); },
    get phenomenons() { return filterChangesByItemType(schemaChanges.schemaItemChanges, SchemaItemType.Phenomenon); },
    get propertyCategories() { return filterChangesByItemType(schemaChanges.schemaItemChanges, SchemaItemType.PropertyCategory); },
    get relationships() { return filterChangesByItemType(schemaChanges.classChanges, SchemaItemType.RelationshipClass); },
    get structClasses() { return filterChangesByItemType(schemaChanges.classChanges, SchemaItemType.StructClass); },
    get unitSystems() { return filterChangesByItemType(schemaChanges.schemaItemChanges, SchemaItemType.UnitSystem); },
  };
}

/**
 * Filters and returns the changed items by its schema item type.
 * @param changes   A map of changed schema items.
 * @param types     A list of schema item types to filter.
 * @returns         An Iterable with the filtered schema items.
 */
function * filterChangesByItemType<TChange extends SchemaItemChanges>(changes: Map<string, TChange>, ...types: SchemaItemType[]): Iterable<TChange> {
  for(const change of changes.values()) {
    if (types.includes(change.schemaItemType)) {
      yield change;
    }
  }
}
