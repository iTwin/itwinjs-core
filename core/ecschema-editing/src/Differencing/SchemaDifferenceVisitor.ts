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
export type ISchemaDifferenceVisitor = {
  [Difference in AnySchemaDifference as `visit${Difference["schemaType"]}Difference`]: (entry: Difference) => Promise<void>;
};

/**
 * Implementation of a walker that traverses schema differences and calls the appropriate
 * method on the visitor.
 * @internal
 */
export class SchemaDifferenceWalker {

  private readonly _visitor: ISchemaDifferenceVisitor;

  /** Initializes a new instance of SchemaDifferenceWalker class. */
  constructor(visitor: ISchemaDifferenceVisitor) {
    this._visitor = visitor;
  }

  /**
   * Traverses the schema differences and calls the appropriate method on the visitor.
   * @param differences The differences to traverse.
   */
  public async traverse(differences: Iterable<AnySchemaDifference>): Promise<void> {
    for (const entry of differences) {
      await this.visit(entry);
    }
  }

  private async visit(difference: AnySchemaDifference) {
    switch (difference.schemaType) {
      case SchemaOtherTypes.Schema:
        return this._visitor.visitSchemaDifference(difference);
      case SchemaOtherTypes.SchemaReference:
        return this._visitor.visitSchemaReferenceDifference(difference);
      case SchemaItemType.Constant:
        return this._visitor.visitConstantDifference(difference);
      case SchemaItemType.CustomAttributeClass:
        return this._visitor.visitCustomAttributeClassDifference(difference);
      case SchemaOtherTypes.CustomAttributeInstance:
        return this._visitor.visitCustomAttributeInstanceDifference(difference);
      case SchemaItemType.EntityClass:
        return this._visitor.visitEntityClassDifference(difference);
      case SchemaOtherTypes.EntityClassMixin:
        return this._visitor.visitEntityClassMixinDifference(difference);
      case SchemaItemType.Enumeration:
        return this._visitor.visitEnumerationDifference(difference);
      case SchemaOtherTypes.Enumerator:
        return this._visitor.visitEnumeratorDifference(difference);
      case SchemaItemType.Format:
        return this._visitor.visitFormatDifference(difference);
      case SchemaItemType.InvertedUnit:
        return this._visitor.visitInvertedUnitDifference(difference);
      case SchemaItemType.KindOfQuantity:
        return this._visitor.visitKindOfQuantityDifference(difference);
      case SchemaItemType.Mixin:
        return this._visitor.visitMixinDifference(difference);
      case SchemaItemType.Phenomenon:
        return this._visitor.visitPhenomenonDifference(difference);
      case SchemaOtherTypes.Property:
        return this._visitor.visitPropertyDifference(difference);
      case SchemaItemType.PropertyCategory:
        return this._visitor.visitPropertyCategoryDifference(difference);
      case SchemaItemType.RelationshipClass:
        return this._visitor.visitRelationshipClassDifference(difference);
      case SchemaOtherTypes.RelationshipConstraint:
        return this._visitor.visitRelationshipConstraintDifference(difference);
      case SchemaOtherTypes.RelationshipConstraintClass:
        return this._visitor.visitRelationshipConstraintClassDifference(difference);
      case SchemaItemType.StructClass:
        return this._visitor.visitStructClassDifference(difference);
      case SchemaItemType.Unit:
        return this._visitor.visitUnitDifference(difference);
      case SchemaItemType.UnitSystem:
        return this._visitor.visitUnitSystemDifference(difference);
    }
  }
}
