/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaDifferenceWalker } from "../Differencing/SchemaDifferenceVisitor";
import { AnySchemaDifference, DifferenceType, SchemaOtherTypes, SchemaType } from "../Differencing/SchemaDifference";

/**
 * A walker that traverses the schema differences in a certain oder and invokes the appropriate
 * visitor method for each kind of schema difference.
 * @internal
 */
export class SchemaMergingWalker extends SchemaDifferenceWalker {

  /**
   * Traverses the schema differences and calls the appropriate method on the visitor.
   * This method overrides the derived class method to apply some ordering how the
   * differences are traversed.
   *
   * @param differences The differences to traverse.
   * @param changeType  Optional type of change to filter by.
   */
  public override async traverse(differences: Array<AnySchemaDifference>, changeType?: DifferenceType): Promise<void> {

    const filterByType = (schemaType: SchemaType) => {
      return (entry: AnySchemaDifference) => {
        return entry.schemaType === schemaType && (!changeType || entry.changeType === changeType);
      };
    };

    return super.traverse([
      // First the schema related differences are traversed...
      ...differences.filter(filterByType(SchemaOtherTypes.Schema)),
      ...differences.filter(filterByType(SchemaOtherTypes.SchemaReference)),

      // Then the schema items (excluding classes)...
      ...differences.filter(filterByType(SchemaItemType.UnitSystem)),
      ...differences.filter(filterByType(SchemaItemType.PropertyCategory)),
      ...differences.filter(filterByType(SchemaItemType.Enumeration)),
      ...differences.filter(filterByType(SchemaOtherTypes.Enumerator)),
      ...differences.filter(filterByType(SchemaItemType.Phenomenon)),
      ...differences.filter(filterByType(SchemaItemType.Unit)),
      ...differences.filter(filterByType(SchemaItemType.InvertedUnit)),
      ...differences.filter(filterByType(SchemaItemType.Format)),
      ...differences.filter(filterByType(SchemaItemType.KindOfQuantity)),
      ...differences.filter(filterByType(SchemaItemType.Constant)),

      // Followed by classes and class related differences...
      ...differences.filter(filterByType(SchemaItemType.CustomAttributeClass)),
      ...differences.filter(filterByType(SchemaItemType.Mixin)),
      ...differences.filter(filterByType(SchemaItemType.StructClass)),
      ...differences.filter(filterByType(SchemaItemType.EntityClass)),
      ...differences.filter(filterByType(SchemaItemType.RelationshipClass)),
      ...differences.filter(filterByType(SchemaOtherTypes.EntityClassMixin)),
      ...differences.filter(filterByType(SchemaOtherTypes.RelationshipConstraint)),
      ...differences.filter(filterByType(SchemaOtherTypes.RelationshipConstraintClass)),
      ...differences.filter(filterByType(SchemaOtherTypes.Property)),

      // And then the custom attributes.
      ...differences.filter(filterByType(SchemaOtherTypes.CustomAttributeInstance)),
    ]);
  }
}
