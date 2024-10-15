/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import { SchemaItemType } from "@itwin/ecschema-metadata";
import { type AnySchemaDifference, SchemaOtherTypes } from "./SchemaDifference";

/**
 * Defines the interface for a visitor that can be used to traverse schema differences.
 * It dynamically creates a method for each schema difference type.
 * @internal
 */
export type SchemaDifferenceVisitor = {
  [Difference in AnySchemaDifference as `visit${Difference["schemaType"]}Difference`]: (entry: Difference, index: number, array: AnySchemaDifference[]) => Promise<void>;
};

/**
 * Implementation of a walker that traverses schema differences and calls the appropriate
 * method on the visitor.
 * @internal
 */
export class SchemaDifferenceWalker {

  private readonly _visitor: SchemaDifferenceVisitor;

  /** Initializes a new instance of SchemaDifferenceWalker class. */
  constructor(visitor: SchemaDifferenceVisitor) {
    this._visitor = visitor;
  }

  /**
   * Traverses the schema differences and calls the appropriate method on the visitor.
   * @param differences The differences to traverse.
   */
  public async traverse(differences: Array<AnySchemaDifference>): Promise<void> {
    for (const [index, entry] of differences.entries()) {
      await this.visit(entry, index, differences);
    }
  }

  /**
   * Calls the appropriate method on the visitor based on the schema difference type.
   */
  private async visit(difference: AnySchemaDifference, index: number, array: AnySchemaDifference[]) {
    switch (difference.schemaType) {
      case SchemaOtherTypes.Schema:
        return this._visitor.visitSchemaDifference(difference, index, array);
      case SchemaOtherTypes.SchemaReference:
        return this._visitor.visitSchemaReferenceDifference(difference, index, array);
      case SchemaItemType.Constant:
        return this._visitor.visitConstantDifference(difference, index, array);
      case SchemaItemType.CustomAttributeClass:
        return this._visitor.visitCustomAttributeClassDifference(difference, index, array);
      case SchemaOtherTypes.CustomAttributeInstance:
        return this._visitor.visitCustomAttributeInstanceDifference(difference, index, array);
      case SchemaItemType.EntityClass:
        return this._visitor.visitEntityClassDifference(difference, index, array);
      case SchemaOtherTypes.EntityClassMixin:
        return this._visitor.visitEntityClassMixinDifference(difference, index, array);
      case SchemaItemType.Enumeration:
        return this._visitor.visitEnumerationDifference(difference, index, array);
      case SchemaOtherTypes.Enumerator:
        return this._visitor.visitEnumeratorDifference(difference, index, array);
      case SchemaItemType.Format:
        return this._visitor.visitFormatDifference(difference, index, array);
      case SchemaItemType.InvertedUnit:
        return this._visitor.visitInvertedUnitDifference(difference, index, array);
      case SchemaItemType.KindOfQuantity:
        return this._visitor.visitKindOfQuantityDifference(difference, index, array);
      case SchemaItemType.Mixin:
        return this._visitor.visitMixinDifference(difference, index, array);
      case SchemaItemType.Phenomenon:
        return this._visitor.visitPhenomenonDifference(difference, index, array);
      case SchemaOtherTypes.Property:
        return this._visitor.visitPropertyDifference(difference, index, array);
      case SchemaItemType.PropertyCategory:
        return this._visitor.visitPropertyCategoryDifference(difference, index, array);
      case SchemaItemType.RelationshipClass:
        return this._visitor.visitRelationshipClassDifference(difference, index, array);
      case SchemaOtherTypes.RelationshipConstraint:
        return this._visitor.visitRelationshipConstraintDifference(difference, index, array);
      case SchemaOtherTypes.RelationshipConstraintClass:
        return this._visitor.visitRelationshipConstraintClassDifference(difference, index, array);
      case SchemaItemType.StructClass:
        return this._visitor.visitStructClassDifference(difference, index, array);
      case SchemaItemType.Unit:
        return this._visitor.visitUnitDifference(difference, index, array);
      case SchemaItemType.UnitSystem:
        return this._visitor.visitUnitSystemDifference(difference, index, array);
    }
  }
}
